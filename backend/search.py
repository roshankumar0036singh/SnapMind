import os
from database import get_db_pool
from dotenv import load_dotenv

load_dotenv()
db_pool = get_db_pool()

from api_clients import get_mistral_client

# Import hybrid search, reranking, and configuration
from hybrid_search import HybridSearcher
from config import SearchConfig, FeatureFlags, RerankingConfig, CacheConfig, ContextConfig
from cache import cache_query, store_in_cache
from context_optimizer import optimize_context
from query_processor import enhance_query, get_best_query_for_search
import time

# Lazy import reranker to avoid loading heavy models unless needed
_reranker_instance = None

def is_mostly_non_ascii(s):
    if not s: return False
    # Heuristic: If > 20% of chars are non-ASCII, it's likely a foreign language
    non_ascii = len([c for c in s if ord(c) > 127])
    return non_ascii > len(s) * 0.2

def get_reranker():
    """Lazy initialization of reranker"""
    global _reranker_instance
    if _reranker_instance is None and RerankingConfig.RERANK_ENABLED:
        try:
            from reranker import Reranker
            prefer_local = (RerankingConfig.RERANK_MODEL == "local")
            _reranker_instance = Reranker(prefer_local=prefer_local)
        except Exception as e:
            print(f"[RERANK] Failed to initialize: {e}")
            _reranker_instance = None
    return _reranker_instance

GENERATION_MODEL = "mistral-small-latest"

LANG_MAP = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "ja": "Japanese",
    "zh": "Chinese",
    "pt": "Portuguese",
    "ru": "Russian",
    "ko": "Korean"
}

def get_relevant_context(query: str, match_threshold: float = None, site_id: str | None = None, api_keys: dict = None, search_query: str | None = None, limit: int | None = None) -> tuple[str, list]:
    """
    Retrieves relevant context from PostgreSQL using hybrid search (Phase 2)
    and optional reranking (Phase 3).
    """
    
    # Use configured threshold if not specified
    if match_threshold is None:
        match_threshold = SearchConfig.MATCH_THRESHOLD
    
    # Determine search mode based on feature flags
    if FeatureFlags.PHASE_2_HYBRID_SEARCH:
        search_mode = SearchConfig.SEARCH_MODE
    else:
        search_mode = "vector_only"  # Fallback to Phase 1 behavior
        
    if search_query:
        print(f"[SEARCH] Using pre-translated search_query from frontend")
    else:
        search_query = query
        
    if FeatureFlags.PHASE_4_QUERY_ENHANCEMENT:
        try:
            enhanced = enhance_query(query, api_keys=api_keys)
            search_query = get_best_query_for_search(enhanced)
            print(f"[QUERY ENHANCEMENT] Using enhanced query for search")
        except Exception as e:
            print(f"[QUERY ENHANCEMENT] Failed: {e}")
    
    print(f"[SEARCH] Mode: {search_mode}, Rerank: {RerankingConfig.RERANK_ENABLED}, Query: {search_query[:50]}...")
    
    try:
        # Step 1: Initial retrieval (hybrid or vector search)
        searcher = HybridSearcher(db_pool, api_keys=api_keys)
        
        # Get more candidates if reranking is enabled
        initial_count = limit or SearchConfig.MATCH_COUNT
        if not limit and RerankingConfig.RERANK_ENABLED and FeatureFlags.PHASE_3_RERANKING:
            initial_count = RerankingConfig.RERANK_CANDIDATES
        
        # [NEW] Support multiple site_ids (comma-separated from frontend)
        site_ids = [s.strip() for s in site_id.split(",")] if site_id else []
        
        matches = []
        if site_ids:
            # Query each site and aggregate
            per_site_top_k = max(initial_count, 10) 
            all_site_matches = []
            seen_ids = set()
            
            for sid in site_ids:
                if not sid:
                    continue
                site_matches = searcher.search(
                    query=search_query,
                    site_id=sid,
                    top_k=per_site_top_k,
                    mode=search_mode
                )
                for m in site_matches:
                    if m['id'] not in seen_ids:
                        all_site_matches.append(m)
                        seen_ids.add(m['id'])
                        
            # Sort by combined score descending
            all_site_matches.sort(key=lambda x: x.get('score', 0), reverse=True)
            matches = all_site_matches[:initial_count]
        else:
            matches = searcher.search(
                query=search_query,
                site_id=None,
                top_k=initial_count,
                mode=search_mode
            )
        
        # [NEW] Global Fallback: If no results for these sites, try global search
        if not matches and site_ids:
            print(f"[SEARCH] No matches for site_ids: {site_ids}. Falling back to global search...")
            matches = searcher.search(
                query=search_query,
                site_id=None,
                top_k=initial_count,
                mode=search_mode
            )
            if matches:
                 print(f"[SEARCH] Global fallback found {len(matches)} candidates")
        
        print(f"[SEARCH] Retrieval results: {len(matches)} candidates")
        
        if not matches:
            print("[SEARCH] No matches found (Global)")
            return "", []
        
        # Step 2: Reranking (if enabled)
        if RerankingConfig.RERANK_ENABLED and FeatureFlags.PHASE_3_RERANKING and len(matches) > 1:
            try:
                reranker = get_reranker()
                if reranker:
                    print(f"[RERANK] Reranking {len(matches)} candidates → top {RerankingConfig.RERANK_TOP_K}")
                    matches = reranker.rerank(
                        query=query,
                        documents=matches,
                        top_k=RerankingConfig.RERANK_TOP_K
                    )
                    print(f"[RERANK] Reranked to {len(matches)} results")
                    
                    # Log reranking quality
                    for idx, doc in enumerate(matches[:3]):
                        print(f"[RERANK] Result {idx+1}:")
                        print(f"  Rerank score: {doc.get('rerank_score', 0):.4f}")
                        print(f"  Original rank: {doc.get('original_rank', 'N/A')}")
                else:
                    print("[RERANK] Reranker not available, using original order")
            except Exception as e:
                print(f"[RERANK] Error during reranking: {e}")
                # Continue with original matches if reranking fails
        
        # Log search quality metrics
        if matches and search_mode == "hybrid":
            for idx, doc in enumerate(matches[:3]):
                print(f"[SEARCH] Match {idx+1}:")
                if 'rerank_score' in doc:
                    print(f"  Rerank: {doc.get('rerank_score', 0):.4f}")
                print(f"  Combined: {doc.get('score', 0):.4f}")
                print(f"  Vector: {doc.get('vector_score', 0):.4f}")
                print(f"  Keyword: {doc.get('keyword_score', 0):.4f}")
        
        # Step 3: Format Context with citations
        graph_context = ""
        if FeatureFlags.GRAPHRAG_ENABLED:
            from graph_logic import get_graph_context
            graph_context = get_graph_context(query, api_keys=api_keys)
        
        if matches and FeatureFlags.PHASE_5_CONTEXT_OPTIMIZATION:
            optimized_ctx = optimize_context(matches, query)
            print(f"[CONTEXT] Optimized from {optimized_ctx.original_tokens} to {optimized_ctx.optimized_tokens} tokens")
            final_content = optimized_ctx.content + graph_context
            return final_content, optimized_ctx.chunks

        # Fallback to simple concatenation if optimization disabled
        context_parts = []
        for i, doc in enumerate(matches):
            source = doc.get('source_url', 'Doc') or "Doc"
            content = doc.get('content', '').strip()
            
            # Inject citation ID
            pseudo_id = f"db-block-{i+1}"
            
            # Add metadata if available
            metadata = doc.get('metadata', {})
            heading = metadata.get('heading', '')
            heading_info = f"\nHeading: {heading}" if heading else ""
            
            # Add rerank info if available
            rerank_info = ""
            if 'rerank_score' in doc:
                rerank_info = f" (Relevance: {doc['rerank_score']:.2f})"
            
            context_parts.append(
                f"Source: {source}{heading_info}{rerank_info}\n"
                f"ID: [{pseudo_id}]\n"
                f"Content:\n{content}"
            )
        
        full_context = "\n\n---\n\n".join(context_parts) + graph_context
        print(f"[SEARCH] Final context: {len(matches)} chunks, {len(full_context)} chars")
        
        return full_context, matches
    
    except Exception as e:
        print(f"[SEARCH] Error: {e}")
        import traceback
        traceback.print_exc()
        return "", []

def save_chat_message(session_id: str, role: str, content: str, api_keys: dict = None):
    """
    Saves a chat message to the persistent Postgres memory.
    Embeds the content for semantic recall later.
    """
    if not session_id or not content:
        return
        
    try:
        # Generate embedding
        from rag_pipeline import embed_single_chunk
        _, embedding = embed_single_chunk(content, api_keys=api_keys)
        
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO chat_sessions (session_id, role, content, embedding) VALUES (%s, %s, %s, %s::halfvec)",
                    (session_id, role, content, embedding)
                )
            conn.commit()
    except Exception as e:
        print(f"[MEMORY] Error saving chat message: {e}")

def load_chat_history(session_id: str, query: str = None, limit: int = 15) -> list[dict]:
    """
    Loads recent chat history from Postgres for the given session.
    If query is provided, performs a vector search to pull semantically relevant older messages.
    """
    if not session_id:
        return []
        
    history = []
    try:
        from psycopg.rows import dict_row
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Basic chronological history (last N messages)
                cur.execute(
                    "SELECT role, content FROM chat_sessions WHERE session_id = %s ORDER BY created_at ASC LIMIT %s",
                    (session_id, limit)
                )
                rows = cur.fetchall()
                
                for row in rows:
                    history.append({"role": row["role"], "content": row["content"]})
                    
        return history
    except Exception as e:
        print(f"[MEMORY] Error loading chat history: {e}")
        return []

def get_all_tags(limit: int = 50) -> list[str]:
    """Retrieve unique semantic tags from the documents table's JSONB metadata array."""
    if not db_pool:
        return []
        
    try:
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                # Extracts unique text items from the metadata->tags array directly in standard PG JSONB format
                cur.execute(
                    "SELECT DISTINCT jsonb_array_elements_text(metadata->'tags') as tag "
                    "FROM documents "
                    "WHERE metadata ? 'tags' "
                    "LIMIT %s",
                    (limit,)
                )
                tags = [row[0] for row in cur.fetchall()]
                return tags
    except Exception as e:
        print(f"[TAGS] Error retrieving global tags: {e}")
        return []

def get_notebook_context(query: str, api_keys: dict = None, limit: int = 15) -> tuple[str, list[dict]]:
    """
    Retrieves relevant snippets from the research notebook (bookmarks table).
    Returns (formatted_text, structured_blocks).
    """
    if not db_pool:
        return "", []
        
    try:
        from rag_pipeline import embed_single_chunk
        _, embedding = embed_single_chunk(query, api_keys=api_keys)
        
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                # [NEW] Vector search on bookmarks for semantic correlation
                cur.execute(
                    "SELECT id, content, source_url, created_at, (embedding <=> %s::halfvec) as distance "
                    "FROM bookmarks "
                    "ORDER BY distance ASC LIMIT %s",
                    (embedding, limit)
                )
                rows = cur.fetchall()
                
                if not rows:
                    return "", []
                
                parts = []
                blocks = []
                for i, (b_id, content, url, created_at, dist) in enumerate(rows):
                    # Use a consistent pseudo-ID for the AI to cite
                    pseudo_id = f"nb-block-{i+1}"
                    parts.append(
                        f"BOOKMARK [{pseudo_id}]\n"
                        f"Source: {url}\n"
                        f"Saved: {created_at}\n"
                        f"Content: {content}"
                    )
                    blocks.append({
                        "id": pseudo_id,
                        "text": content,
                        "url": url,
                        "type": "bookmark",
                        "original_id": b_id
                    })
                return "\n\n".join(parts), blocks
    except Exception as e:
        print(f"[NOTEBOOK SEARCH] Error: {e}")
        return "", []

def chat_logic(query: str, page_content: str | None = None, content_blocks: list[dict] | None = None, site_id: str | None = None, history: list[dict] | None = None, session_id: str | None = None, api_keys: dict = None, search_query: str | None = None, query_lang: str | None = None, output_lang: str = "auto", query_notebook: bool = False) -> dict:
    """
    Main chat logic.
    1. Translate query to English (base language) for vector search.
    2. If content_blocks provided -> Use ID-tagged context for citations.
    3. If page_content provided -> Use it as context (Direct RAG).
    4. Else -> Search vector DB (Indexed RAG).
    """
    
    # [NEW] Multi-Language Query Routing
    from rag_pipeline import translate_text_lingo
    
    # Heuristic: If client says it's English but it's full of Kanji/Devanagari/etc, ignore client
    force_translate = is_mostly_non_ascii(query) and (not search_query or search_query == query)
    
    if not search_query or force_translate:
        if force_translate: print(f"[CHAT] Backend translation FORCED due to non-ASCII query.")
        search_query, query_lang, is_translated = translate_text_lingo(query, target_lang="en", api_keys=api_keys)
    else:
        is_translated = (query_lang and query_lang != "en" and query_lang != "unknown")
        print(f"[CHAT] Using client-provided translation. Original Lang: {query_lang}")
    
    # [NEW] Enhanced Language Instruction (Moved to top for prominence)
    lang_name = LANG_MAP.get(output_lang, output_lang) if output_lang != "auto" else "the user's preferred language"
    
    lang_instruction = ""
    if output_lang and output_lang != "auto":
        lang_instruction = f"CRITICAL: You MUST output your entire response EXCLUSIVELY in {lang_name}. This includes all explanations, citations, and suggested follow-ups. DO NOT use any other language.\n\n"

    system_instruction = f"""{lang_instruction}You are a helpful AI assistant for the Snapmind browser extension.

CRITICAL RULES - FOLLOW STRICTLY:
1. ONLY answer using information from the provided CONTEXT.
2. DO NOT use external knowledge, training data, or make assumptions.
3. If the CONTEXT lacks the answer to the user's question, output ONLY: "I don't have that information in the indexed content". Do not output anything else.
4. DO NOT hallucinate, invent, or provide general knowledge.
5. DO NOT write code examples unless they exist in the CONTEXT.
6. [GENERATIVE UI] If the user explicitly asks for a process, workflow, architecture, diagram, or sequence of events, you MUST output a Mermaid.js diagram to visualize it. Wrap it strictly in a ```mermaid\n ... \n``` block.
   CRITICAL MERMAID RULES:
   - YOU MUST EXCLUSIVELY USE 'graph TD' or 'graph LR'. 
   - When asked for a timeline, use a top-down flowchart. Example:
     ```mermaid
     graph TD
     A[January 2026] --> B[February 2026]
     B --> C[March 2026]
     ```
   - NEVER use 'sequenceDiagram', 'gantt', or commas in node names.
   - Use standard flowchart nodes. e.g. A[Start] --> B(Process)
   - DO NOT use unsupported characters or brackets in node names unless quoted.
   - Keep the syntax strictly valid.
7. PRIORITIZE SUBSTANCE: If the user makes a meta-comment about the conversation or previous responses (e.g., "why is giving this response") while also asking for information, prioritize fulfilling the information request using the CONTEXT. Avoid performing a meta-analysis or comparative analysis of requests unless explicitly and solely asked to do so.

At the end of your response, suggest 2-3 short (max 10 words), engaging follow-up questions ONLY if answerable from the CONTEXT. Format as 'Suggested Follow-ups:' with each in **bold**.

SPECIAL INSTRUCTION: If the user is asking about correlations or connections between bookmarks/references, you MUST look for legal, causal, or prerequisite links. e.g. "To participate in X (Bookmark A), you must comply with Y (Bookmark B)". Give a deep reasoning, not just a surface-level summary."""

    citation_instruction = ""
    context = ""
    is_direct_context = False

    context_parts = []
    
    # [NEW] Cross-Lingual Comparison Logic
    has_pinned_sources = any(b.get("id", "").startswith("source-") for b in (content_blocks or []))
    is_comparison_query = ("compare" in query.lower() or "contrast" in query.lower() or has_pinned_sources)
    lingo_feature_prompt = ""
    
    if content_blocks and isinstance(content_blocks, list):
        # If comparison is requested, group blocks by source and optionally translate
        if is_comparison_query:
            print("[CROSS-LINGUAL] Comparison requested, grouping sources...")
            sources = []
            curr_source = {"id": "Main Page", "blocks": [], "text_content": ""}
            for block in content_blocks:
                block_id = block.get("id", "unknown")
                if block_id.startswith("source-"):
                    if curr_source["blocks"]:
                        sources.append(curr_source)
                    curr_source = {"id": block_id, "blocks": [], "text_content": ""}
                    # Add the header block itself
                    context_parts.append(f"[{block_id}] {block.get('text', '')}")
                else:
                    text = block.get("text", "")
                    if text and len(text.strip()) >= 5:
                        curr_source["blocks"].append(block)
                        if len(curr_source["text_content"]) < 4000:  # Collect sample for translation
                            curr_source["text_content"] += text + "\n"
            if curr_source["blocks"]:
                sources.append(curr_source)
                
            from rag_pipeline import translate_text_lingo
            for idx, source in enumerate(sources):
                print(f"[CROSS-LINGUAL] Processing source {idx+1}: {source['id']}")
                sample_text = source["text_content"][:4000]
                translated_text, src_lang, is_trans = translate_text_lingo(sample_text, target_lang="en", api_keys=api_keys)
                
                # Append original blocks
                for block in source["blocks"]:
                     context_parts.append(f"[{block.get('id', 'unknown')}] {block.get('text', '')}")
                     
                if is_trans and src_lang != "en" and src_lang != "unknown":
                    print(f"[CROSS-LINGUAL] Source was in {src_lang}. Appending translated baseline.")
                    context_parts.append(f"\n--- [LINGO.DEV TRANSLATION BASELINE FOR {source['id']} (Original: {src_lang})] ---\n{translated_text}\n--- END BASELINE ---\n")
            
            lingo_feature_prompt = """
CRITICAL COMPARISON TASK:
The user wants to compare distinct websites/pages in different languages. You have been provided with the original raw text AND a [LINGO.DEV TRANSLATION BASELINE] for the foreign language content.
1. Contrast the original sites based on their translated baseline.
2. Analyze localization differences (tone, cultural adaptations, missing/extra content).
3. Provide EXACT "Lingo.dev Feature Suggestions" tailored to any pain points or missed localization opportunities you find (e.g. culturally insensitive phrasing, UI issues from text expansion).
"""
        else:
            # 1. Structured Context (Standard Flow)
            for block in content_blocks:
                if not block.get("text") or len(block["text"].strip()) < 5:
                    continue
                block_id = block.get("id", "unknown")
                text = block.get("text", "")
                context_parts.append(f"[{block_id}] {text}")

    if lingo_feature_prompt:
        system_instruction += "\n\n" + lingo_feature_prompt

    if not context_parts and page_content and str(page_content).strip():
        # 2. Raw Text Context -> Chunk it to allow citations
        lines = page_content[:100000].split('\n')
        block_count = 1
        current_chunk = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            current_chunk.append(line)
            if len("\n".join(current_chunk)) > 500:
                text = "\n".join(current_chunk)
                context_parts.append(f"ID: [db-block-{block_count}]\n{text}")
                block_count += 1
                current_chunk = []
        if current_chunk:
             text = "\n".join(current_chunk)
             context_parts.append(f"ID: [db-block-{block_count}]\n{text}")

    # 3. Research Notebook Context
    notebook_context = ""
    notebook_blocks = []
    if query_notebook:
        print(f"[CHAT] Notebook correlation requested. Querying bookmarks...")
        notebook_context, notebook_blocks = get_notebook_context(search_query, api_keys=api_keys)

    # 4. Prioritize Vector DB Search
    db_context, retrieved_raw_blocks = get_relevant_context(search_query, site_id=site_id, api_keys=api_keys)
    
    context_str = ""
    if notebook_context:
        context_str += "RESEARCH NOTEBOOK CONTEXT (MOST RELEVANT BOOKMARKS):\n" + notebook_context + "\n\n"
        
    if db_context:
        context_str += "DATABASE CONTEXT:\n" + db_context + "\n\n"
    
    if context_parts:
        context_str += "LIVE PAGE / PINNED TABS CONTEXT (with IDs):\n" + "\n\n".join(context_parts)
        is_direct_context = True
        
    context = context_str.strip()
    
    citation_instruction = ""
    if context:
        cite_examples = []
        if query_notebook:
            cite_examples.append("[nb-block-1]")
        if context_parts or db_context:
            cite_examples.append("[db-block-1]")
        
        example_str = " or ".join(cite_examples) if cite_examples else "[db-block-1]"
        
        notebook_priority = "\nPREFERENCE: Research Notebook mode is active. Prioritize information from BOOKMARK [nb-block-X] sources." if query_notebook else ""
        
        citation_instruction = f"""{notebook_priority}
CITATION RULES:
1. You MUST cite the source block ID in brackets, e.g. {example_str}, for EVERY fact you use from the context.
2. ONLY cite using IDs explicitly provided in the CONTEXT above (e.g., [db-block-1], [nb-block-1], or [SSOC-1]). 
3. DO NOT invent, hallucinate, or guess any block IDs. DO NOT use prefixes like 'bi-block' unless specifically provided in the context (it might be a source handle like [SSOC-1]).
4. If a piece of information is not tagged with an ID, do not cite it.
5. Attach citations to the specific sentences or phrases they support.
6. Use at most 4 distinct citations per response.
"""

    # Force Language constraint if translated
    if is_translated and query_lang and query_lang not in ["en", "unknown"]:
        citation_instruction += f"\n\nCRITICAL LANGUAGE RULE: The user asked in '{query_lang}'. You MUST format your entire response in that exact language seamlessly."

    if context:
        prompt = f"""{system_instruction}

CONTEXT:
{context}

{citation_instruction}
CITATION RULE: You MUST cite the source ID (e.g. [db-block-12]) regarding the specific sentence you are generating. Do not blindly list citations at the end. Attach them to the sentences they support.

QUESTION: {query}
"""
    else:
        prompt = f"""{system_instruction}
        
NO SPECIFIC CONTEXT WAS RETRIEVED.
Question: {query}
"""

    # Mistral Generation
    try:
        print(f"Generating with Mistral model: mistral-small-latest")
        
        system_content = f"{system_instruction}\n{citation_instruction}\n\nCONTEXT:\n{context}" if context else f"{system_instruction}\nNO CONTEXT FOUND."
        
        final_messages = [
            {"role": "system", "content": system_content}
        ]
        
        # Load history from DB if not provided by frontend
        db_history = history
        if not db_history and session_id:
            db_history = load_chat_history(session_id, query)
            print(f"[MEMORY] Loaded {len(db_history)} messages from Postgres memory")
            
        if db_history:
            for msg in db_history:
                role = "user" if msg.get("role") == "user" else "assistant"
                final_messages.append({"role": role, "content": msg.get("content", "")})
        
        final_messages.append({"role": "user", "content": query})

        client = get_mistral_client(api_keys)
        chat_response = client.chat.complete(
            model="mistral-small-latest",
            messages=final_messages,
        )
        answer = chat_response.choices[0].message.content
        
        # [NEW] Post-Translation via Lingo.dev if output_lang is specified
        print(f"[CHAT] Post-generation check: output_lang={output_lang}")
        if output_lang and output_lang not in ["auto", "en", "unknown"]:
            print(f"[CHAT] Applying post-generation Lingo.dev translation to: {output_lang}")
            from rag_pipeline import translate_text_lingo
            translated_answer, _, was_translated = translate_text_lingo(answer, target_lang=output_lang, api_keys=api_keys)
            if translated_answer:
                answer = translated_answer
                print(f"[CHAT] Translation applied (was_translated={was_translated}, len={len(answer)})")
                
        result = {
            "answer": answer,
            "context_found": bool(context),
            "sources": ["Current Page"] if is_direct_context else [],
            "model_used": "mistral-small-latest",
            "retrieved_blocks": (retrieved_raw_blocks or []) + notebook_blocks
        }

        
        # Save memory turn (Phase 3)
        if session_id:
            try:
                # Save user query
                save_chat_message(session_id, "user", query, api_keys=api_keys)
                # Save assistant response
                save_chat_message(session_id, "assistant", answer, api_keys=api_keys)
                print(f"[MEMORY] Saved Turn to memory (Session: {session_id})")
            except Exception as e:
                print(f"[MEMORY] Error saving turn: {e}")
        
        # Store in Cache (Phase 6)
        if FeatureFlags.PHASE_6_CACHING and not is_direct_context and not history:
             # Only cache single-turn RAG queries for now
             store_in_cache(search_query, None, result, site_id)
             
        return result
    except Exception as e:
        print(f"Warning: Mistral failed: {e}")
        last_error = e

    return {"error": f"All models failed. Last error: {str(last_error)}"}

def chat_logic_stream(query: str, page_content: str | None = None, content_blocks: list[dict] | None = None, site_id: str | None = None, history: list[dict] | None = None, session_id: str | None = None, api_keys: dict = None, search_query: str | None = None, query_lang: str | None = None, output_lang: str = "auto", query_notebook: bool = False):
    """
    Streaming version of chat logic. Yields NDJSON chunks.
    """
    print(f"[CHAT-STREAM] Request - Query: {query[:50]}... | Output Lang: {output_lang} | Query Lang: {query_lang}")
    import json
    
    # [NEW] Multi-Language Query Routing
    from rag_pipeline import translate_text_lingo
    
    # Heuristic: If client says it's English but it's full of non-ASCII, ignore client
    force_translate = is_mostly_non_ascii(query) and (not search_query or search_query == query)
    
    if not search_query or force_translate:
        if force_translate: print(f"[CHAT-STREAM] Backend translation FORCED due to non-ASCII query.")
        search_query, query_lang, is_translated = translate_text_lingo(query, target_lang="en", api_keys=api_keys)
    else:
        is_translated = (query_lang and query_lang != "en" and query_lang != "unknown")
        print(f"[CHAT-STREAM] Using client-provided translation. Original Lang: {query_lang}")
    
    # [NEW] Enhanced Language Instruction (Moved to top for prominence)
    lang_name = LANG_MAP.get(output_lang, output_lang) if output_lang != "auto" else "the user's preferred language"
    
    lang_instruction = ""
    if output_lang and output_lang != "auto":
        lang_instruction = f"CRITICAL: You MUST output your entire response EXCLUSIVELY in {lang_name}. This includes all explanations, citations, and suggested follow-ups. DO NOT use any other language.\n\n"

    system_instruction = f"""{lang_instruction}You are a helpful AI assistant for the Snapmind browser extension.

CRITICAL RULES - FOLLOW STRICTLY:
1. ONLY answer using information from the provided CONTEXT.
2. DO NOT use external knowledge, training data, or make assumptions.
3. If the CONTEXT lacks the answer to the user's question, output ONLY: "I don't have that information in the indexed content". Do not output anything else.
4. DO NOT hallucinate, invent, or provide general knowledge.
5. DO NOT write code examples unless they exist in the CONTEXT.
6. [GENERATIVE UI] If the user explicitly asks for a process, workflow, architecture, diagram, or sequence of events, you MUST output a Mermaid.js diagram to visualize it. Wrap it strictly in a ```mermaid\n ... \n``` block.
   CRITICAL MERMAID RULES:
   - YOU MUST EXCLUSIVELY USE 'graph TD' or 'graph LR'. 
   - When asked for a timeline, use a top-down flowchart. Example:
     ```mermaid
     graph TD
     A[January 2026] --> B[February 2026]
     B --> C[March 2026]
     ```
   - NEVER use 'sequenceDiagram', 'gantt', or commas in node names.
   - Use standard flowchart nodes. e.g. A[Start] --> B(Process)
   - DO NOT use unsupported characters or brackets in node names unless quoted.
   - Keep the syntax strictly valid.
7. PRIORITIZE SUBSTANCE: If the user makes a meta-comment about the conversation or previous responses (e.g., "why is giving this response") while also asking for information, prioritize fulfilling the information request using the CONTEXT. Avoid performing a meta-analysis or comparative analysis of requests unless explicitly and solely asked to do so.

At the end of your response, suggest 2-3 short (max 10 words), engaging follow-up questions ONLY if answerable from the CONTEXT. Format as 'Suggested Follow-ups:' with each in **bold**.

SPECIAL INSTRUCTION: If the user is asking about correlations or connections between bookmarks/references, you MUST look for legal, causal, or prerequisite links. e.g. "To participate in X (Bookmark A), you must comply with Y (Bookmark B)". Give a deep reasoning, not just a surface-level summary."""
    print(f"[CHAT-STREAM] System Instruction Language Rule: {lang_instruction.strip() or 'None'}")

    citation_instruction = ""
    context = ""
    is_direct_context = False

    context_parts = []
    
    # [NEW] Cross-Lingual Comparison Logic
    has_pinned_sources = any(b.get("id", "").startswith("source-") for b in (content_blocks or []))
    is_comparison_query = ("compare" in query.lower() or "contrast" in query.lower() or has_pinned_sources)
    lingo_feature_prompt = ""
    
    if content_blocks and isinstance(content_blocks, list):
        # If comparison is requested, group blocks by source and optionally translate
        if is_comparison_query:
            print("[CROSS-LINGUAL] Comparison requested, grouping sources...")
            sources = []
            curr_source = {"id": "Main Page", "blocks": [], "text_content": ""}
            for block in content_blocks:
                block_id = block.get("id", "unknown")
                if block_id.startswith("source-"):
                    if curr_source["blocks"]:
                        sources.append(curr_source)
                    curr_source = {"id": block_id, "blocks": [], "text_content": ""}
                    # Add the header block itself
                    context_parts.append(f"[{block_id}] {block.get('text', '')}")
                else:
                    text = block.get("text", "")
                    if text and len(text.strip()) >= 5:
                        curr_source["blocks"].append(block)
                        if len(curr_source["text_content"]) < 4000:  # Collect sample for translation
                            curr_source["text_content"] += text + "\n"
            if curr_source["blocks"]:
                sources.append(curr_source)
                
            from rag_pipeline import translate_text_lingo
            for idx, source in enumerate(sources):
                print(f"[CROSS-LINGUAL] Processing source {idx+1}: {source['id']}")
                sample_text = source["text_content"][:4000]
                translated_text, src_lang, is_trans = translate_text_lingo(sample_text, target_lang="en", api_keys=api_keys)
                
                # Append original blocks
                for block in source["blocks"]:
                     context_parts.append(f"[{block.get('id', 'unknown')}] {block.get('text', '')}")
                     
                if is_trans and src_lang != "en" and src_lang != "unknown":
                    print(f"[CROSS-LINGUAL] Source was in {src_lang}. Appending translated baseline.")
                    context_parts.append(f"\n--- [LINGO.DEV TRANSLATION BASELINE FOR {source['id']} (Original: {src_lang})] ---\n{translated_text}\n--- END BASELINE ---\n")
            
            lingo_feature_prompt = """
CRITICAL COMPARISON TASK:
The user wants to compare distinct websites/pages in different languages. You have been provided with the original raw text AND a [LINGO.DEV TRANSLATION BASELINE] for the foreign language content.
1. Contrast the original sites based on their translated baseline.
2. Analyze localization differences (tone, cultural adaptations, missing/extra content).
3. Provide EXACT "Lingo.dev Feature Suggestions" tailored to any pain points or missed localization opportunities you find (e.g. culturally insensitive phrasing, UI issues from text expansion).
"""
        else:
            # 1. Structured Context (Standard Flow)
            for block in content_blocks:
                if not block.get("text") or len(block["text"].strip()) < 5:
                    continue
                block_id = block.get("id", "unknown")
                text = block.get("text", "")
                context_parts.append(f"[{block_id}] {text}")

    if lingo_feature_prompt:
        system_instruction += "\n\n" + lingo_feature_prompt

    if not context_parts and page_content and str(page_content).strip():
        # 2. Raw Text Context -> Chunk it to allow citations
        lines = page_content[:100000].split('\n')
        block_count = 1
        current_chunk = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            current_chunk.append(line)
            if len("\n".join(current_chunk)) > 500:
                text = "\n".join(current_chunk)
                context_parts.append(f"ID: [db-block-{block_count}]\n{text}")
                block_count += 1
                current_chunk = []
        if current_chunk:
             text = "\n".join(current_chunk)
             context_parts.append(f"ID: [db-block-{block_count}]\n{text}")

    # 3. Research Notebook Context
    notebook_context = ""
    notebook_blocks = []
    if query_notebook:
        print(f"[CHAT-STREAM] Notebook correlation requested. Querying bookmarks...")
        notebook_context, notebook_blocks = get_notebook_context(search_query, api_keys=api_keys)

    # 4. Handle Vector DB Search and Live Blocks
    db_context, retrieved_raw_blocks = get_relevant_context(search_query, site_id=site_id, api_keys=api_keys)
    
    context_str = ""
    if notebook_context:
        context_str += "RESEARCH NOTEBOOK CONTEXT (MOST RELEVANT BOOKMARKS):\n" + notebook_context + "\n\n"
        
    if db_context:
        context_str += "DATABASE CONTEXT:\n" + db_context + "\n\n"
        if retrieved_raw_blocks:
            for i, doc in enumerate(retrieved_raw_blocks):
                content_blocks = content_blocks or []
                content_blocks.append({
                    "id": f"db-block-{i+1}",
                    "text": doc.get('content', ''),
                    "url": doc.get('source_url', '')
                })

    if context_parts:
        context_str += "LIVE PAGE / PINNED TABS CONTEXT (with IDs):\n" + "\n\n".join(context_parts)
        is_direct_context = True

    # [NEW] Merge Notebook Blocks for streaming response metadata
    if notebook_blocks:
        content_blocks = content_blocks or []
        content_blocks.extend(notebook_blocks)

    context = context_str.strip()
    print(f"[DEBUG CONTEXT] Final context length: {len(context)} chars")
    if len(context) > 0:
        print(f"[DEBUG CONTEXT] Preview: {context[:500]}...")

    citation_instruction = ""
    if context:
        cite_examples = []
        if query_notebook:
            cite_examples.append("[nb-block-1]")
        if context_parts or db_context:
            cite_examples.append("[db-block-1]")
        
        example_str = " or ".join(cite_examples) if cite_examples else "[db-block-1]"
        
        notebook_priority = "\nPREFERENCE: Research Notebook mode is active. Prioritize information from BOOKMARK [nb-block-X] sources." if query_notebook else ""
        
        citation_instruction = f"""{notebook_priority}
CITATION RULES:
1. You MUST cite the source block ID in brackets, e.g. {example_str}, for EVERY fact you use from the context.
2. ONLY cite using IDs explicitly provided in the CONTEXT above (e.g., [db-block-1], [nb-block-1], or [source-1]). 
3. DO NOT invent, hallucinate, or guess any block IDs. DO NOT use prefixes like 'bi-block' unless specifically provided in the context.
4. If a piece of information is not tagged with an ID, do not cite it.
5. Attach citations to the specific sentences or phrases they support.
6. Use at most 4 distinct citations per response.
"""

    # Force Language constraint if translated
    if is_translated and query_lang and query_lang not in ["en", "unknown"]:
        citation_instruction += f"\n\nCRITICAL LANGUAGE RULE: The user asked in '{query_lang}'. You MUST format your entire response in that exact language seamlessly."

    if context:
        prompt = f"""{system_instruction}

CONTEXT:
{context}

{citation_instruction}
CITATION RULE: You MUST cite the source ID (e.g. [db-block-12]) regarding the specific sentence you are generating. Do not blindly list citations at the end. Attach them to the sentences they support.

QUESTION: {query}
"""
    else:
        prompt = f"""{system_instruction}
        
NO SPECIFIC CONTEXT WAS RETRIEVED.
Question: {query}
"""

    # Mistral Streaming
    try:
        print(f"Streaming with Mistral model: mistral-small-latest")
        
        # 1. System Message (Instructions + RAG Context)
        system_content = f"{system_instruction}\n{citation_instruction}\n\nCONTEXT:\n{context}" if context else f"{system_instruction}\nNO CONTEXT FOUND."
        
        final_messages = [
            {"role": "system", "content": system_content}
        ]
        
        # 2. History
        db_history = history
        if not db_history and session_id:
            db_history = load_chat_history(session_id, query)
            
        if db_history:
            for msg in db_history:
                role = "user" if msg.get("role") == "user" else "assistant"
                final_messages.append({"role": role, "content": msg.get("content", "")})
        
        # 3. Current User Question
        final_messages.append({"role": "user", "content": query})

        client = get_mistral_client(api_keys)
        stream_response = client.chat.stream(
            model="mistral-small-latest",
            messages=final_messages,
        )

        full_response = ""
        for chunk in stream_response:
             if chunk.data.choices[0].delta.content:
                text_chunk = chunk.data.choices[0].delta.content
                full_response += text_chunk
                # [NEW] Wait to yield tokens if we need to translate the whole stream first.
                if output_lang and output_lang not in ["auto", "en", "unknown"]:
                    continue # Do not yield english blocks if we intend to translate at the end
                yield json.dumps({"type": "token", "text": text_chunk}) + "\n"
        
        # [NEW] Post-Translation via Lingo.dev for stream
        print(f"[CHAT-STREAM] Post-generation check: output_lang={output_lang}, response_len={len(full_response)}")
        if output_lang and output_lang not in ["auto", "en", "unknown"]:
             print(f"[CHAT-STREAM] Applying post-generation Lingo.dev translation to: {output_lang}")
             from rag_pipeline import translate_text_lingo
             translated_answer, _, was_translated = translate_text_lingo(full_response, target_lang=output_lang, api_keys=api_keys)
             if translated_answer and was_translated:
                 full_response = translated_answer
                 print(f"[CHAT-STREAM] Translation applied successfully ({len(full_response)} chars)")
             elif translated_answer:
                 # Lingo returned something but is_trans was False — use it anyway since user explicitly asked
                 full_response = translated_answer
                 print(f"[CHAT-STREAM] Translation returned text but marked as not-translated. Using Mistral output_lang instruction instead.")
             else:
                 print(f"[CHAT-STREAM] Translation returned empty. Yielding original English response.")
             
             # Yield the translated (or original) response as a single chunk
             yield json.dumps({"type": "token", "text": full_response}) + "\n"
        
        if session_id:
            try:
                save_chat_message(session_id, "user", query, api_keys=api_keys)
                save_chat_message(session_id, "assistant", full_response, api_keys=api_keys)
                print(f"[MEMORY] Saved Stream Turn to memory (Session: {session_id})")
            except Exception as e:
                print(f"[MEMORY] Error saving stream turn: {e}")
        
        # Final Metadata
        yield json.dumps({
            "type": "usage",
            "context_found": bool(context),
            "model_used": "mistral-small-latest",
            "retrieved_blocks": content_blocks or []
        }) + "\n"
        return
        
    except Exception as e:
        print(f"Warning: Mistral streaming failed: {e}")

    yield json.dumps({"type": "error", "error": "All models failed."}) + "\n"

def get_chat_suggestions(page_content: str | None, url: str | None, site_id: str | None, api_keys: dict = None) -> dict:
    import json
    try:
        context = ""
        if page_content and len(page_content.strip()) > 50:
            context = f"PAGE CONTENT:\n{page_content[:3000]}"
        elif site_id or url:
            target_id = site_id or url
            db_context, _ = get_relevant_context("What is this page about? Provide a summary.", site_id=target_id, api_keys=api_keys, limit=3)
            if db_context:
                context = f"DATABASE CONTENT:\n{db_context}"
            else:
                context = f"URL: {target_id}"
                
        system_prompt = """You are a helpful AI assistant.
Based on the provided context, generate exactly 3 short (max 10 words), engaging, and highly relevant questions the user could ask you.
DO NOT include any explanations. Output strictly a JSON object with a 'suggestions' key containing an array of strings: {"suggestions": ["Q1", "Q2", "Q3"]}."""

        client = get_mistral_client(api_keys)
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context if context else "General tech topics"}
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"): content = content[7:]
        if content.startswith("```"): content = content[3:]
        if content.endswith("```"): content = content[:-3]
        content = content.strip()
        
        return json.loads(content)
    except Exception as e:
        print(f"[SUGGEST] Error generating suggestions: {e}")
        return {"suggestions": ["What are the key points?", "Explain this simply.", "Summarize the content."]}

