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

    def _retrieval_flags(self, request: SearchRequestDTO) -> Dict[str, bool]:
        """
        Resolve the three per-request retrieval switches against this
        deployment's configuration.

        `None` on a request field means "whatever this deployment configured",
        so a client that sends nothing keeps the previous behaviour exactly.
        Query enhancement covers both HyDE and multi-query, which config.py
        flags separately — it counts as on when either is enabled.
        """
        return {
            "rerank": (
                settings.reranking.enabled
                if request.use_reranking is None
                else bool(request.use_reranking)
            ),
            "graphrag": (
                settings.graphrag_enabled
                if request.use_graphrag is None
                else bool(request.use_graphrag)
            ),
            "enhance": (
                (settings.query.hyde_enabled or settings.query.multi_query_enabled)
                if request.use_query_enhancement is None
                else bool(request.use_query_enhancement)
            ),
        }

    def _cache_namespace(
        self,
        request: SearchRequestDTO,
        flags: Dict[str, bool],
        output_lang: str,
    ) -> str:
        """
        Everything that changes the answer for the same question text.

        The cache used to be keyed on the query alone, which meant one reader's
        answer could be served to another and that toggling a retrieval switch
        appeared to do nothing on a repeat question. Anything that alters what
        gets retrieved or how it reads belongs in the key.
        """
        sources = request.filters.get("source_urls") or []
        parts = [
            request.user_id or "anon",
            request.workspace_id or "no-ws",
            ",".join(sorted(sources)) or "all",
            output_lang or "auto",
            str(request.limit or 5),
            "r1" if flags["rerank"] else "r0",
            "g1" if flags["graphrag"] else "g0",
            "e1" if flags["enhance"] else "e0",
        ]
        return "|".join(parts)

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
        flags = self._retrieval_flags(request)

        # 1. Multi-Language Query Routing
        search_query, query_lang, is_translated = await llm_svc.translate(query, target_lang="en")

        # Check Cache — namespaced by reader, workspace, source filter, language
        # and the retrieval switches, so a hit is only ever a hit for the same
        # question asked the same way by the same person.
        cache_ns = self._cache_namespace(request, flags, output_lang)
        query_embedding = await self._get_embedding(search_query, api_keys)
        cached_result = self.cache.get(search_query, query_embedding, site_id=cache_ns)
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
        # A. Query Expansion (HyDE + Multi-query) — one extra LLM call and two
        # extra embeddings per question, so it is worth being able to turn off.
        target_queries = [search_query]
        if flags["enhance"]:
            enhanced = self.query_processor.enhance_query(search_query)
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
        if self.reranker and flags["rerank"]:
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
        if flags["graphrag"]:
            graph_context = get_graph_context(search_query, api_keys=api_keys, user_id=request.user_id, workspace_id=request.workspace_id)
            if graph_context:
                print(f"[SearchService] Graph context added: {len(graph_context)} chars")

        context_text = "\n\n".join([f"--- [db-block-{i+1}] ---\nContent: {s.get('content')}" for i, s in enumerate(context_sources)])
        full_context = f"{graph_context}\n\n### Document Context\n{context_text}"
        
        model_id = settings.models.mistral_small
        lang_name = LANG_MAP.get(output_lang, output_lang) if output_lang != "auto" else "English"
        
        system_instruction = """You are a highly capable SnapMind research assistant. 
Your primary goal is to answer the user's question using the provided context blocks.
If the context blocks contain relevant information, you MUST use them and cite them.

CRITICAL CITATION RULES:
1. Every fact or claim derived from the context MUST be followed by the exact source tag.
2. Place citations immediately after the relevant sentence.
3. Example: "The total funding is $5M [db-block-1]. Innovation is key [db-block-2]."
4. If you use your own general knowledge to supplement the answer, do not cite a block for that specific part.
5. If requested, provide a diagram or technical visualization using Mermaid syntax in a ```mermaid block."""

        prompt = f"""CONTEXT DOCUMENT BLOCKS:
{full_context}

---
USER QUERY: {query}

INSTRUCTION: Answer the query comprehensively in {lang_name}.
Prioritize using the provided context blocks. You may supplement with your own general knowledge if the context is incomplete, but you must cite the context blocks (e.g. [db-block-1]) whenever you use information from them.
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
        self.cache.set(search_query, query_embedding, result.model_dump(), site_id=cache_ns)

        return result

    async def chat_stream(
        self,
        request: SearchRequestDTO,
        api_keys: Dict[str, str],
        history: Optional[List[Dict[str, Any]]] = None,
        output_lang: str = "auto",
        skip_reasoning: bool = False,
        query_notebook: bool = False,
        persona_id: Optional[str] = None,
        **kwargs
    ):
        """
        Streaming version of chat. Orchestrates retrieval and yields NDJSON tokens/blocks.
        """
        import json
        llm_svc = LLMService(api_keys=api_keys)

        query = request.query
        session_id = request.session_id
        flags = self._retrieval_flags(request)

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
        target_queries = [search_query]
        if flags["enhance"]:
            enhanced = self.query_processor.enhance_query(search_query)
            if enhanced.hyde_document:
                target_queries.append(enhanced.hyde_document)
            target_queries.extend(enhanced.enhanced_queries[:2])
        
        all_candidates = []
        primary_embedding = None
        for q in target_queries:
            q_emb = await self._get_embedding(q, api_keys)
            if primary_embedding is None:
                primary_embedding = q_emb
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
        if self.reranker and flags["rerank"]:
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

        # D. Research-notebook correlation. Saved bookmarks are a separate table,
        # so they get their own nb-block-N namespace and the LLM is told what they
        # are — a fact the user chose to keep carries different weight to a chunk
        # that merely happened to be crawled.
        notebook_sources: List[SearchResultDTO] = []
        if query_notebook and primary_embedding:
            notebook_sources = self._notebook_blocks(primary_embedding, request)
            sources.extend(notebook_sources)

        yield json.dumps({
            "type": "retrieved_blocks",
            "blocks": [s.model_dump() for s in sources]
        }) + "\n"

        # 3. LLM Synthesis (Streaming)
        lang_name = LANG_MAP.get(output_lang, output_lang) if output_lang != "auto" else "English"
        system_prompt = f"""You are a highly capable SnapMind research assistant. 
Your primary goal is to answer the user's question in {lang_name} using the provided context blocks.
If the context blocks contain relevant information, you MUST use them and cite them.

FORMATTING RULES:
1. Be highly professional, structured, and easy to read.
2. Use bolding, bullet points, and numbered lists where appropriate.
3. Use Markdown tables for comparisons or data.

CRITICAL CITATION RULES:
1. Every fact or claim derived from the context MUST be followed by the exact block ID.
2. Wrap the ID in SINGLE brackets. For example, if the header is [[ SOURCE db-block-1 ]], you must cite it as [db-block-1]. DO NOT output '[[ SOURCE db-block-1 ]]'.
3. Place citations immediately after the relevant sentence.
4. If you use your own general knowledge to supplement the answer, do not cite a block for that specific part.
5. If requested, provide a diagram or technical visualization using Mermaid syntax in a ```mermaid block."""

        addon = self._persona_addon(persona_id, request.user_id)
        if addon:
            system_prompt = f"{system_prompt}\n\nPERSONA DIRECTIVE (takes priority on tone and emphasis):\n{addon}"

        context_text = "\n\n".join([f"[[ SOURCE {s.get('mapped_id')} ]]\n{s.get('content', '')}" for s in context_sources])

        if notebook_sources:
            notebook_text = "\n\n".join(
                f"[[ SOURCE {s.id} ]] (saved by the user in their research notebook)\n{s.content}"
                for s in notebook_sources
            )
            context_text = f"{context_text}\n\n{notebook_text}" if context_text else notebook_text

        # GraphRAG fusion. The non-streaming chat() has always done this; the
        # streaming path — which is what every current client actually calls —
        # did not, so the entity graph was effectively unused. It is prepended
        # rather than mixed into the numbered blocks because it carries no
        # citable source of its own.
        if flags["graphrag"]:
            graph_context = get_graph_context(
                search_query,
                api_keys=api_keys,
                user_id=request.user_id,
                workspace_id=request.workspace_id,
            )
            if graph_context:
                print(f"[SearchService] Graph context added: {len(graph_context)} chars")
                context_text = f"{graph_context}\n\n### Document Context\n{context_text}"

        prompt = f"""CONTEXT DATA BLOCKS:
{context_text}

---
USER QUERY: {query}

FINAL INSTRUCTION: Answer in {lang_name}. Prioritize using the provided context blocks. 
You may supplement with your own general knowledge if the context is incomplete, but you must cite the context blocks (e.g. [db-block-1]) whenever you use information from them.
"""
        
        async for token in self.router.stream(
            prompt=prompt,
            system_instruction=system_prompt,
            model_id=settings.models.mistral_small,
            history=history
        ):
            yield json.dumps({"type": "token", "text": token}) + "\n"

    # --- Private Helper Methods ---

    def _persona_addon(self, persona_id: Optional[str], user_id: Optional[str] = None) -> str:
        """
        Extra system-prompt text for a saved agent persona.

        Scoped to the reader, so a persona id belonging to another account can't be
        applied by passing it in the request. Personas written before migration v17
        have no owner and stay usable by everyone, matching the personas endpoint.

        Returns "" for a missing persona or a failed lookup: a stale persona id
        from a stored UI preference must not break the answer. That also covers a
        deployment that hasn't applied v17 yet — the scoped query fails, and the
        second attempt below falls back to the unscoped lookup.
        """
        if not persona_id:
            return ""
        attempts = (
            [
                (
                    "SELECT system_prompt_addon FROM personas WHERE id = %s::uuid AND (user_id = %s OR user_id IS NULL)",
                    (persona_id, user_id),
                ),
                ("SELECT system_prompt_addon FROM personas WHERE id = %s::uuid", (persona_id,)),
            ]
            if user_id
            else [("SELECT system_prompt_addon FROM personas WHERE id = %s::uuid", (persona_id,))]
        )
        for index, (sql, params) in enumerate(attempts):
            try:
                with self.doc_repo.pool.connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(sql, params)
                        row = cur.fetchone()
                return (row[0] or "").strip() if row else ""
            except Exception as e:
                # Only the last attempt's failure is worth reporting; an earlier one
                # just means personas.user_id doesn't exist yet.
                if index == len(attempts) - 1:
                    print(f"[SearchService] Persona {persona_id} lookup failed: {e}")
        return ""

    def _notebook_blocks(
        self,
        query_embedding: List[float],
        request: SearchRequestDTO,
        limit: int = 4,
    ) -> List[SearchResultDTO]:
        """
        Nearest saved bookmarks for the query, as nb-block-N citation blocks.

        `bookmarks.embedding` is vector(3072) where `documents.embedding` is
        halfvec(3072), so this cannot go through DocumentRepository.search_hybrid.
        Bookmarks have no crawl provenance, so they are scored as expert tier —
        the user vouched for them by saving them.
        """
        clauses = ["embedding IS NOT NULL"]
        filter_params: List[Any] = []
        if request.user_id:
            clauses.append("user_id = %s::uuid")
            filter_params.append(request.user_id)
        if request.workspace_id:
            clauses.append("workspace_id = %s::uuid")
            filter_params.append(request.workspace_id)

        sql = (
            "SELECT id, content, source_url, metadata, "
            "1 - (embedding <=> %s::vector) AS similarity "
            f"FROM bookmarks WHERE {' AND '.join(clauses)} "
            "ORDER BY similarity DESC LIMIT %s"
        )

        try:
            with self.doc_repo.pool.connection() as conn:
                from psycopg.rows import dict_row
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(sql, [query_embedding, *filter_params, limit])
                    rows = cur.fetchall()
        except Exception as e:
            print(f"[SearchService] Notebook correlation failed: {e}")
            return []

        blocks: List[SearchResultDTO] = []
        for i, r in enumerate(rows):
            content = r.get("content") or ""
            meta = r.get("metadata") or {}
            meta = {**meta, "origin": "notebook", "bookmark_id": str(r.get("id"))}
            blocks.append(SearchResultDTO(
                id=f"nb-block-{i+1}",
                url=r.get("source_url") or "",
                content=content,
                metadata=meta,
                similarity=float(r.get("similarity") or 0.0),
                combined_score=float(r.get("similarity") or 0.0),
                credibility_score=90,
                credibility_tier="expert",
                highlight_snippet=content[:150] + ("..." if len(content) > 150 else "")
            ))
        return blocks

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
