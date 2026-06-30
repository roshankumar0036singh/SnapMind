from typing import List, Dict, Any, Optional
from config import settings
from models.dtos import ChatResponseDTO, SearchResultDTO, SearchRequestDTO
from repositories.document_repository import DocumentRepository
from llm_router import LLMRouter
from services.llm_service import LLMService
from utils import LANG_MAP, is_mostly_non_ascii, pad_embedding
from query_processor import QueryProcessor
from reranker import CohereReranker, BaseReranker
from context_optimizer import ContextOptimizer
from credibility import CredibilityScorer
from graph_logic import get_graph_context
from cache import get_cache
from reasoning_chain import ReasoningPlanner, ReasoningExecutor, is_multi_hop_query

class SearchService:
    """
    Core service for hybrid neural search and reranking.
    Part of the SnapMind intelligence layer.
    """
    """
    Service layer for SnapMind Semantic Search and RAG.
    Decouples the logic from FastAPI endpoints.
    """
    
    def __init__(self, api_keys: Dict[str, str] = None):
        self.doc_repo = DocumentRepository()
        self.api_keys = api_keys or {}
        self.router = LLMRouter(api_keys=self.api_keys)
        self.query_processor = QueryProcessor(api_keys=self.api_keys)
        self.optimizer = ContextOptimizer()
        self.scorer = CredibilityScorer()
        self.cache = get_cache()
        
        # Initialize Reranker
        try:
            self.reranker = CohereReranker(api_key=self.api_keys.get("cohere"))
        except Exception:
            self.reranker = None # Fallback logic in chat method
    
    async def chat(
        self,
        request: SearchRequestDTO,
        api_keys: Dict[str, str],
        history: Optional[List[Dict[str, Any]]] = None,
        output_lang: str = "auto",
        skip_reasoning: bool = False,
        **kwargs
    ) -> ChatResponseDTO:
        """
        Execute a conversational RAG search (Orchestrates Translation -> Retrieval -> Synthesis).
        """
        llm_svc = LLMService(api_keys=api_keys)
        
        query = request.query
        session_id = request.session_id
        
        # 1. Multi-Language Query Routing
        search_query, query_lang, is_translated = await llm_svc.translate(query, target_lang="en")
        
        # Check Cache
        query_embedding = await self._get_embedding(search_query, api_keys)
        cached_result = self.cache.get(search_query, query_embedding)
        if cached_result:
            return ChatResponseDTO(**cached_result)

        # 1.5 Multi-hop reasoning detection
        if not skip_reasoning and is_multi_hop_query(search_query, api_keys=api_keys):
            print(f"[SearchService] Complex query detected: {search_query}")
            planner = ReasoningPlanner(api_keys=api_keys)
            plan = planner.plan(search_query) 
            
            if len(plan) > 1:
                executor = ReasoningExecutor(api_keys=api_keys, session_id=session_id)
                # For non-streaming chat, we collect all results
                # In real use, chat is often used for sub-steps (which have skip_reasoning=True)
                final_res = None
                async for chunk in executor.execute_chain(plan, search_query):
                    if chunk["type"] == "final":
                        final_res = chunk
                
                if final_res:
                    return ChatResponseDTO(
                        answer=final_res["answer"],
                        sources=[
                            SearchResultDTO(
                                id=f"hop-{i}", url=url, content="Finding from reasoning step", 
                                credibility_tier="expert", is_reasoning_result=True
                            ) for i, url in enumerate(final_res.get("sources", []))
                        ],
                        session_id=session_id,
                        user_id=request.user_id,
                        reasoning_chain=final_res.get("chain", [])
                    )
        
        # 2. Advanced Retrieval Pipeline
        # A. Query Expansion (HyDE + Multi-query)
        enhanced = self.query_processor.enhance_query(search_query)
        target_queries = [search_query]
        if enhanced.hyde_document:
            target_queries.append(enhanced.hyde_document)
        target_queries.extend(enhanced.enhanced_queries[:2]) # Top 2 variations
        
        all_candidates = []
        for q in target_queries:
            q_emb = await self._get_embedding(q, api_keys)
            results = self.doc_repo.search_hybrid(
                vector=q_emb,
                query_text=q,
                top_k=settings.reranking.candidates,
                threshold=settings.search.match_threshold,
                user_id=request.user_id, workspace_id=request.workspace_id,
                filter_source_urls=request.filters.get("source_urls")
            )
            all_candidates.extend(results)
            
        # B. Semantic Deduplication
        unique_candidates = self.optimizer.remove_duplicates(all_candidates)
        
        # C. Reranking
        if self.reranker and settings.reranking.enabled:
            reranked_results = self.reranker.rerank(search_query, unique_candidates, top_k=request.limit or 5)
            context_sources = [r.document for r in reranked_results]
        else:
            # Simple score fallback
            unique_candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
            context_sources = unique_candidates[:request.limit or 5]
        
        # Mapped IDs for LLM Citations
        # Use simple numeric blocks so the LLM reliably reproduces them.
        for i, s in enumerate(context_sources):
            s['mapped_id'] = f"db-block-{i+1}"

        # 3. LLM Synthesis
        # 3. [NEW] GraphRAG Fusion
        graph_context = ""
        if settings.graphrag_enabled:
            graph_context = get_graph_context(search_query, api_keys=api_keys, user_id=request.user_id, workspace_id=request.workspace_id)
            if graph_context:
                print(f"[SearchService] Graph context added: {len(graph_context)} chars")

        context_text = "\n\n".join([f"--- [db-block-{i+1}] ---\nContent: {s.get('content')}" for i, s in enumerate(context_sources)])
        full_context = f"{graph_context}\n\n### Document Context\n{context_text}"
        
        model_id = settings.models.mistral_small
        
        system_instruction = """You are a highly precise SnapMind research assistant. 
Your ABSOLUTE MANDATE is to answer using ONLY the provided context blocks.
DO NOT use your pre-trained general knowledge. If the exact answer is not found in the context blocks below, you MUST reply: "I do not have enough context to answer this question."

CRITICAL CITATION RULES:
1. Every single fact OR claim you make MUST be followed by the exact source tag like [db-block-1].
2. Place citations immediately after the relevant sentence.
3. Example: "The total funding is $5M [db-block-1]. Innovation is key [db-block-2]."
4. NEVER respond without citations.
5. If the user asks for a diagram, flowchart, or technical workflow, use Mermaid syntax in a ```mermaid block.
6. If the context does not contain the answer, politely state that you don't know and DO NOT include any citations."""

        prompt = f"""CONTEXT DOCUMENT BLOCKS:
{full_context}

---
USER QUERY: {query}

MANDATORY INSTRUCTION: Answer based ONLY on the sources above. Do NOT use outside knowledge.
You MUST cite every fact with the exact tag like [db-block-1].
If no answer is found in the sources, say "I do not have enough context to answer this question" and DO NOT include any citations.
"""
        answer = self.router.chat(
            prompt=prompt,
            system_instruction=system_instruction,
            model_id=model_id,
            history=history
        )
        
        # 4. Map sources to DTOs
        sources = []
        for s in context_sources:
            # Metadata-based credibility fallback or re-scoring
            meta = s.get("metadata", {})
            cred_score = meta.get("credibility_score")
            cred_tier = meta.get("credibility_tier")
            
            if cred_score is None:
                # Late-bind scoring if not stored during ingest
                c_res = self.scorer.score(s.get("url", ""), s.get("content", ""))
                cred_score = c_res["score"]
                cred_tier = c_res["tier"]
            
            sources.append(SearchResultDTO(
                id=s.get("mapped_id"),
                url=s.get("url", s.get("source_url", "")),
                content=s.get("content", ""),
                metadata=meta,
                combined_score=s.get("score", 0.0),
                credibility_score=cred_score,
                credibility_tier=cred_tier,
                highlight_snippet=s.get("content", "")[:150] + "..."
            ))
        
        # 4. [NEW] Store in Cache
        result = ChatResponseDTO(
            answer=answer,
            sources=sources,
            session_id=session_id,
            tenant_id=request.tenant_id,
            user_id=request.user_id,
            workspace_id=request.workspace_id,
            model_used=model_id,
            metadata={"translated": is_translated}
        )
        self.cache.set(search_query, query_embedding, result.model_dump())

        return result

    async def chat_stream(
        self,
        request: SearchRequestDTO,
        api_keys: Dict[str, str],
        history: Optional[List[Dict[str, Any]]] = None,
        output_lang: str = "auto",
        skip_reasoning: bool = False,
        **kwargs
    ):
        """
        Streaming version of chat. Orchestrates retrieval and yields NDJSON tokens/blocks.
        """
        import json
        llm_svc = LLMService(api_keys=api_keys)
        
        query = request.query
        session_id = request.session_id
        
        # 1. Multi-Language Query Routing
        search_query, _, _ = await llm_svc.translate(query, target_lang="en")

        # 1.5 Multi-hop reasoning detection
        if not skip_reasoning and is_multi_hop_query(search_query, api_keys=api_keys):
            planner = ReasoningPlanner(api_keys=api_keys)
            plan = planner.plan(search_query)
            
            if len(plan) > 1:
                executor = ReasoningExecutor(api_keys=api_keys, session_id=session_id)
                async for chunk in executor.execute_chain(plan, search_query):
                    if chunk["type"] == "thought":
                        yield json.dumps({"type": "thought", "data": chunk}) + "\n"
                    elif chunk["type"] == "final":
                        # Output individual tokens if needed? No, for reasoning we often output the full synthesis at once
                        # But we use "token" type for the final answer to keep extension logic simple
                        yield json.dumps({"type": "answer", "data": chunk["answer"]}) + "\n"
                        # Final metadata for reasoning
                        yield json.dumps({
                            "type": "metadata", 
                            "sources": [], 
                            "reasoning_chain": chunk["chain"],
                            "model_used": settings.models.mistral_large
                        }) + "\n"
                return
        
        # 2. Advanced Retrieval Pipeline
        # A. Query Expansion (HyDE + Multi-query)
        enhanced = self.query_processor.enhance_query(search_query)
        target_queries = [search_query]
        if enhanced.hyde_document:
            target_queries.append(enhanced.hyde_document)
        target_queries.extend(enhanced.enhanced_queries[:2])
        
        all_candidates = []
        for q in target_queries:
            q_emb = await self._get_embedding(q, api_keys)
            results = self.doc_repo.search_hybrid(
                vector=q_emb,
                query_text=q,
                top_k=settings.reranking.candidates,
                threshold=settings.search.match_threshold,
                user_id=request.user_id, workspace_id=request.workspace_id,
                filter_source_urls=request.filters.get("source_urls")
            )
            all_candidates.extend(results)
            
        # B. Semantic Deduplication
        unique_candidates = self.optimizer.remove_duplicates(all_candidates)
        
        # C. Reranking
        if self.reranker and settings.reranking.enabled:
            reranked_results = self.reranker.rerank(search_query, unique_candidates, top_k=request.limit or 5)
            context_sources = [r.document for r in reranked_results]
        else:
            unique_candidates.sort(key=lambda x: x.get('score', 0), reverse=True)
            context_sources = unique_candidates[:request.limit or 5]
        
        for i, s in enumerate(context_sources):
            s['mapped_id'] = f"db-block-{i+1}"

        sources = []
        for s in context_sources:
            meta = s.get("metadata", {})
            cred_score = meta.get("credibility_score")
            cred_tier = meta.get("credibility_tier")
            
            if cred_score is None:
                c_res = self.scorer.score(s.get("url", ""), s.get("content", ""))
                cred_score = c_res["score"]
                cred_tier = c_res["tier"]
                
            sources.append(SearchResultDTO(
                id=s.get("mapped_id"),
                url=s.get("url", s.get("source_url", "")),
                content=s.get("content", ""),
                metadata=meta,
                combined_score=s.get("score", 0.0),
                credibility_score=cred_score,
                credibility_tier=cred_tier,
                highlight_snippet=s.get("content", "")[:150] + "..."
            ))
        
        yield json.dumps({
            "type": "retrieved_blocks",
            "blocks": [s.model_dump() for s in sources]
        }) + "\n"

        # 3. LLM Synthesis (Streaming)
        lang_name = LANG_MAP.get(output_lang, output_lang) if output_lang != "auto" else "English"
        system_prompt = f"""You are a highly precise SnapMind research assistant. 
Your ABSOLUTE MANDATE is to answer in {lang_name} using ONLY the provided context blocks.
DO NOT use your pre-trained general knowledge. If the exact answer is not found in the context blocks below, you MUST reply: "I do not have enough context to answer this question."

FORMATTING RULES:
1. Be highly professional, structured, and easy to read.
2. Use bolding, bullet points, and numbered lists where appropriate.
3. Use Markdown tables for comparisons or data.

CRITICAL CITATION RULES:
1. Every single fact OR claim you make MUST be followed by the exact block ID.
2. Wrap the ID in SINGLE brackets. For example, if the header is [[ SOURCE db-block-1 ]], you must cite it as [db-block-1]. DO NOT output '[[ SOURCE db-block-1 ]]'.
3. Place citations immediately after the relevant sentence.
4. NEVER respond without citations.
5. If requested, provide a diagram or technical visualization using Mermaid syntax in a ```mermaid block.
6. If the context does not contain the answer, politely state that you don't know and DO NOT include any citations."""
        
        context_text = "\n\n".join([f"[[ SOURCE {s.get('mapped_id')} ]]\n{s.get('content', '')}" for s in context_sources])
        
        prompt = f"""CONTEXT DATA BLOCKS:
{context_text}

---
USER QUERY: {query}

FINAL INSTRUCTION: Answer in {lang_name} using ONLY the sources above. Do NOT use outside knowledge.
EVERY fact MUST be cited with the exact tag like [db-block-1].
Example: "The sky is blue [db-block-1]. Humans breathe air [db-block-2]."
If no answer is found in the sources, say "I do not have enough context to answer this question" and DO NOT include any citations.
"""
        
        async for token in self.router.stream(
            prompt=prompt,
            system_instruction=system_prompt,
            model_id=settings.models.mistral_small,
            history=history
        ):
            yield json.dumps({"type": "token", "text": token}) + "\n"

    # --- Private Helper Methods ---

    async def _get_embedding(self, text: str, api_keys: Dict[str, str]) -> List[float]:
        """
        Internal embedding logic using IngestService's provider logic.
        """
        from services.ingest_service import IngestService
        ingest_svc = IngestService(api_keys=api_keys)
        try:
            return ingest_svc.get_embedding(text, api_keys=api_keys)
        except Exception as e:
            print(f"[SearchService] Failed to embed query: {e}")
            return [0.0] * 3072

    async def global_search(self, query: str, workspace_id: str, limit: int = 20, user_id: str = None) -> List[SearchResultDTO]:
        """
        Perform a unified search across documents and bookmarks for a specific workspace.
        """
        embedding = await self._get_embedding(query, self.api_keys)
        
        results = []
        try:
            with self.doc_repo.pool.connection() as conn:
                from psycopg.rows import dict_row
                with conn.cursor(row_factory=dict_row) as cur:
                    # 1. Search Documents
                    cur.execute(
                        "SELECT id, content, source_url, metadata, 1 - (embedding <=> %s::vector) AS similarity "
                        "FROM documents "
                        "WHERE workspace_id = %s::uuid AND user_id = %s::uuid AND (embedding <=> %s::vector) < 0.6 "
                        "ORDER BY similarity DESC LIMIT %s",
                        (embedding, workspace_id, user_id, embedding, limit)
                    )
                    doc_rows = cur.fetchall()
                    for r in doc_rows:
                        results.append(SearchResultDTO(
                            id=str(r["id"]),
                            url=r.get("source_url", ""),
                            content=r.get("content", ""),
                            metadata=r.get("metadata", {}),
                            combined_score=r.get("similarity", 0.0)
                        ))
                    
                    # 2. Search Bookmarks
                    cur.execute(
                        "SELECT id, content, source_url, metadata, 1 - (embedding <=> %s::vector) AS similarity "
                        "FROM bookmarks "
                        "WHERE workspace_id = %s::uuid AND user_id = %s::uuid AND (embedding <=> %s::vector) < 0.6 "
                        "ORDER BY similarity DESC LIMIT %s",
                        (embedding, workspace_id, user_id, embedding, limit)
                    )
                    bm_rows = cur.fetchall()
                    for r in bm_rows:
                        results.append(SearchResultDTO(
                            id=str(r["id"]),
                            url=r.get("source_url", ""),
                            content=r.get("content", ""),
                            metadata=r.get("metadata", {}),
                            combined_score=r.get("similarity", 0.0)
                        ))
            
            # Sort combined results by highest similarity score
            results.sort(key=lambda x: x.combined_score, reverse=True)
            return results[:limit]
        except Exception as e:
            print(f"[GLOBAL SEARCH] Error: {e}")
            return []
