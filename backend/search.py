import os
from database import get_db_pool
from dotenv import load_dotenv

load_dotenv()
db_pool = get_db_pool()

from api_clients import get_mistral_client, get_openai_client, get_gemini_client

# Import hybrid search, reranking, and configuration
from hybrid_search import HybridSearcher
from config import SearchConfig, FeatureFlags, RerankingConfig, CacheConfig, ContextConfig, LLMProviderConfig
from cache import cache_query, store_in_cache
from context_optimizer import optimize_context
from query_processor import enhance_query, get_best_query_for_search
import time
from ollama_client import ollama_client

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
                        r_score = doc.get('rerank_score')
                        score_display = f"{r_score:.4f}" if r_score is not None else "[MISSING]"
                        print(f"[RERANK] Result {idx+1}:")
                        print(f"  Rerank score: {score_display}")
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
                    r_score = doc.get('rerank_score')
                    score_display = f"{r_score:.4f}" if r_score is not None else "[MISSING]"
                    print(f"  Rerank: {score_display}")
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
        # [NEW] Increased Context Slicing to 20000 chars to support multi-tab research
        if len(full_context) > 20000:
            full_context = full_context[:20000] + "... [Truncated for Context Limit]"
            
        print(f"[SEARCH] Final context: {len(matches)} chunks, {len(full_context)} chars")
        
        return full_context, matches
    
    except Exception as e:
        print(f"[SEARCH] Error: {e}")
        import traceback
        traceback.print_exc()
        return "", []

def search_global(query: str, limit: int = 20, api_keys: dict = None) -> list[dict]:
    """
    Performs a global semantic search across documents, bookmarks, and chat_messages.
    Returns a unified, sorted list of results.
    """
    if not db_pool: return []
    try:
        from rag_pipeline import embed_single_chunk
        _, embedding = embed_single_chunk(query, api_keys=api_keys)
        
        results = []
        with db_pool.connection() as conn:
            from psycopg.rows import dict_row
            with conn.cursor(row_factory=dict_row) as cur:
                # 1. Search Documents
                cur.execute(
                    "SELECT id, content, source_url, metadata, 1 - (embedding <=> %s::halfvec) AS similarity "
                    "FROM documents "
                    "WHERE embedding <=> %s::halfvec < 0.6 "
                    "ORDER BY similarity DESC LIMIT %s",
                    (embedding, embedding, limit)
                )
                doc_rows = cur.fetchall()
                for r in doc_rows:
                    results.append({
                        "id": r["id"],
                        "type": "document",
                        "content": r["content"],
                        "url": r["source_url"],
                        "metadata": r.get("metadata", {}),
                        "score": r["similarity"]
                    })
                
                # 2. Search Bookmarks
                cur.execute(
                    "SELECT id, content, source_url, metadata, 1 - (embedding <=> %s::halfvec) AS similarity "
                    "FROM bookmarks "
                    "WHERE embedding <=> %s::halfvec < 0.6 "
                    "ORDER BY similarity DESC LIMIT %s",
                    (embedding, embedding, limit)
                )
                bm_rows = cur.fetchall()
                for r in bm_rows:
                    results.append({
                        "id": str(r["id"]),
                        "type": "bookmark",
                        "content": r["content"],
                        "url": r["source_url"],
                        "metadata": r.get("metadata", {}),
                        "score": r["similarity"]
                    })
                
                # 3. Search Chat Messages (Sessions)
                # Group by session_id to avoid repeating the same session too much
                cur.execute(
                    "SELECT id, session_id, role, content, 1 - (embedding <=> %s::halfvec) AS similarity "
                    "FROM chat_messages "
                    "WHERE embedding <=> %s::halfvec < 0.6 "
                    "ORDER BY similarity DESC LIMIT %s",
                    (embedding, embedding, limit)
                )
                chat_rows = cur.fetchall()
                # Deduplicate by session_id preferring highest score
                seen_sessions = set()
                for r in chat_rows:
                    if r["session_id"] not in seen_sessions:
                        seen_sessions.add(r["session_id"])
                        results.append({
                            "id": str(r["id"]),
                            "type": "session",
                            "content": f"{r['role'].upper()}: {r['content']}",
                            "url": f"/session/{r['session_id']}",
                            "metadata": {"session_id": r["session_id"]},
                            "score": r["similarity"]
                        })
                        
        # Sort combined results by highest similarity score
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    except Exception as e:
        print(f"[GLOBAL SEARCH] Error: {e}")
        return []

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
                    "INSERT INTO chat_messages (session_id, role, content, embedding) VALUES (%s, %s, %s, %s::halfvec)",
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
                    "SELECT role, content FROM chat_messages WHERE session_id = %s ORDER BY created_at ASC LIMIT %s",
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

def get_notebook_context(query: str, session_id: str = None, api_keys: dict = None, limit: int = 15) -> tuple[str, list[dict]]:
    """
    Retrieves relevant snippets from the research notebook (bookmarks table).
    Supports session-id filtering, relaxed semantic search, and keyword fallback.
    Returns (formatted_text, structured_blocks).
    """
    if not db_pool:
        return "", []
        
    try:
        from rag_pipeline import embed_single_chunk
        _, embedding = embed_single_chunk(query, api_keys=api_keys)
        
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                # [NEW] Multi-tiered Search for Bookmarks
                # We prioritize current session matches, but allow any highly relevant bookmark from the user's history.
                query_sql = """
                    SELECT id, content, source_url, created_at, (embedding <=> %s::halfvec) as distance, metadata,
                           CASE WHEN metadata->>'session_id' = %s THEN 0 ELSE 1 END as session_rank
                    FROM bookmarks 
                    WHERE (embedding <=> %s::halfvec) < 0.50
                    ORDER BY session_rank ASC, distance ASC 
                    LIMIT %s
                """
                params = [embedding, session_id, embedding, limit]
                
                cur.execute(query_sql, tuple(params))
                rows = cur.fetchall()
                
                # 2. Keyword Fallback (Cross-session by default if no direct session matches)
                if not rows and query and len(query) > 3:
                    print(f"[NOTEBOOK] Vector search failed (dist > 0.5), trying Keyword fallback...")
                    kw_query = """
                        SELECT id, content, source_url, created_at, 0.1 as distance, metadata,
                               CASE WHEN metadata->>'session_id' = %s THEN 0 ELSE 1 END as session_rank
                        FROM bookmarks
                        WHERE (content ILIKE %s OR metadata->>'tags' ILIKE %s)
                        ORDER BY session_rank ASC, created_at DESC 
                        LIMIT %s
                    """
                    kw_params = [session_id, f"%{query}%", f"%{query}%", limit]
                    
                    cur.execute(kw_query, tuple(kw_params))
                    rows = cur.fetchall()

                # 3. Generative Fallback: if specifically asking "what is in my notebook" or similar
                general_phrases = ["what is in my", "show my", "latest", "notebook", "research", "saved", "bookmarks", "infer from", "stored", "memory"]
                is_general = any(p in query.lower() for p in general_phrases) or not query.strip()
                
                if not rows and is_general:
                    print(f"[NOTEBOOK] General query detected, returning most recent bookmarks (all sessions).")
                    recent_query = """
                        SELECT id, content, source_url, created_at, 0.9 as distance, metadata,
                               CASE WHEN metadata->>'session_id' = %s THEN 0 ELSE 1 END as session_rank
                        FROM bookmarks 
                        ORDER BY session_rank ASC, created_at DESC 
                        LIMIT 15
                    """
                    cur.execute(recent_query, (session_id,))
                    rows = cur.fetchall()

                if not rows:
                    return "", []
                
                import urllib.parse
                from browser_agents import extract_highlight_snippet
                parts = []
                blocks = []
                for i, (b_id, content, url, created_at, dist, meta) in enumerate(rows):
                    pseudo_id = f"nb-block-{i+1}"
                    
                    # Prefer stored metadata if available (from RagPipeline or handleSaveBookmark)
                    h_snippet = meta.get("highlight_snippet") if meta else None
                    if not h_snippet:
                        h_snippet = extract_highlight_snippet(content)
                        
                    highlight_url = meta.get("highlightUrl") if meta else None
                    if not highlight_url and url:
                        safe_h_snippet = urllib.parse.quote(h_snippet[:80])
                        highlight_url = f"{url}#:~:text={safe_h_snippet}"

                    parts.append(
                        f"BOOKMARK [{pseudo_id}]\n"
                        f"Source: {url}\n"
                        f"Saved: {created_at}\n"
                        f"Content: {content}"
                    )
                    blocks.append({
                        "id": pseudo_id,
                        "text": content,
                        "highlight_snippet": h_snippet,
                        "url": url,
                        "highlightUrl": highlight_url,
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
3. If the available CONTEXT (including current page and pinned tabs) lacks the answer to the user's question, output ONLY: "I don't have that information in the current research context". Do not output anything else.
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
    # [FIX] Only trigger expensive translation path on explicit comparison keywords
    query_lower = query.lower()
    is_comparison_query = any(kw in query_lower for kw in ["compare", "contrast", "difference between", "vs ", "versus"])
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
                # [NEW] Scrub numeric footnotes from individual context blocks
                import re
                text = re.sub(r'\[\d{1,3}\]', '', text)
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
    # [FIX] site_id might be a comma-separated list of URLs
    site_ids = [s.strip() for s in site_id.split(",")] if site_id else []
    
    db_context = ""
    retrieved_raw_blocks = []
    
    if site_ids:
        db_context, retrieved_raw_blocks = get_relevant_context(search_query, site_id=site_id, api_keys=api_keys)
        
        # [NEW] Phase 26: Dynamic Pinned-Site Crawling (Non-Streaming)
        if len(retrieved_raw_blocks) < 3:
             from rag_pipeline import scrape_website_firecrawl
             import hashlib
             for sid in site_ids:
                 if sid.startswith(("http://", "https://")):
                     try:
                         live_text, live_title = scrape_website_firecrawl(sid, api_keys=api_keys)
                         if live_text and len(live_text) > 500:
                             from chunking import chunk_text
                             live_chunks = chunk_text(live_text, max_chars=800, source_url=sid, use_semantic=False)
                             url_hash = hashlib.md5(sid.encode()).hexdigest()[:6]
                             for i, chunk in enumerate(live_chunks[:10]):
                                 text = chunk.get('content', '')
                                 retrieved_raw_blocks.append({
                                     'id': f"pin-block-{url_hash}-{i+1}",
                                     'content': text,
                                     'source_url': sid,
                                     'score': 1.0,
                                     'metadata': {'title': live_title}
                                 })
                     except: pass
             # Re-generate db_context if we added live blocks
             if len(retrieved_raw_blocks) > 0:
                 from search import optimize_context
                 # Need to convert retrieved_raw_blocks to expected format for optimize_context
                 optimized = optimize_context(retrieved_raw_blocks, query=search_query)
                 db_context = optimized.content
    else:
        # Global search
        db_context, retrieved_raw_blocks = get_relevant_context(search_query, site_id=None, api_keys=api_keys)
    
    context_str = ""
    if notebook_context:
        context_str += "RESEARCH NOTEBOOK CONTEXT (MOST RELEVANT BOOKMARKS):\n" + notebook_context + "\n\n"
        
    if db_context:
        # [FIX] Normalize non-streaming context attribution
        if retrieved_raw_blocks:
            context_str += "DATABASE CONTEXT (HISTORICAL INDEXED DATA):\n"
            for i, doc in enumerate(retrieved_raw_blocks):
                b_id = doc.get("id", f"db-{i+1}")
                b_text = doc.get("content", "").strip()
                b_source = doc.get("source_url", "External Document")
                context_str += f"SOURCE: {b_source}\nID: [{b_id}]\nCONTENT: {b_text}\n\n---\n\n"
        else:
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
1. You MUST cite the source block ID in brackets (e.g., {example_str}) for EVERY fact used.
2. ONLY use IDs provided in the CONTEXT. DO NOT invent or guess IDs. 
3. Attach citations to the end of the sentence or paragraph they support.
4. Keep citations subtle; do not let them interrupt the flow of the professional summary.
5. NEVER use numeric citations like [1], [2]. Use the full block IDs.
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

        active_provider = (api_keys or {}).get("llm_provider", LLMProviderConfig.PROVIDER).lower()
        active_model = (api_keys or {}).get("llm_model", "")

        if active_provider in ["local", "hybrid", "ollama"]:
            model_target = active_model or LLMProviderConfig.OLLAMA_GENERATION_MODEL
            model_used = f"Ollama ({model_target})"
            print(f"[CHAT] Using Local LLM (Ollama): {model_target}")
            final_answer = ollama_client.generate(
                prompt=query,
                system_prompt=system_content,
                model=model_target
            )
        elif active_provider == "openai":
            model_target = active_model or "gpt-4o-mini"
            model_used = f"OpenAI ({model_target})"
            print(f"[CHAT] Using OpenAI model: {model_target}")
            client = get_openai_client(api_keys)
            chat_response = client.chat.completions.create(
                model=model_target,
                messages=final_messages,
            )
            final_answer = chat_response.choices[0].message.content
        elif active_provider == "gemini":
            model_target = active_model or "gemini-2.0-flash"
            model_used = f"Gemini ({model_target})"
            print(f"[CHAT] Using Gemini model: {model_target}")
            client = get_gemini_client(api_keys)
            
            gemini_system_instruction = final_messages[0]["content"] if final_messages and final_messages[0]["role"] == "system" else ""
            gemini_contents = []
            for m in final_messages:
                if m["role"] != "system":
                    parts = [{"text": m["content"]}]
                    r = "user" if m["role"] == "user" else "model"
                    gemini_contents.append({"role": r, "parts": parts})
                    
            from google.genai import types
            chat_response = client.models.generate_content(
                model=model_target,
                contents=gemini_contents,
                config=types.GenerateContentConfig(system_instruction=gemini_system_instruction)
            )
            final_answer = chat_response.text
        else:
            model_target = active_model or "mistral-small-latest"
            model_used = f"Mistral ({model_target})"
            print(f"[CHAT] Generating with Mistral model: {model_target}")
            client = get_mistral_client(api_keys)
            chat_response = client.chat.complete(
                model=model_target,
                messages=final_messages,
            )
            final_answer = chat_response.choices[0].message.content
        
        # [NEW] Post-process to strip any leaked numeric footnotes [19], [1]
        import re
        final_answer = re.sub(r'\[\d{1,3}\]', '', final_answer)
        
        # [FIX] Extract citations from the answer before translation
        # Matches patterns like [db-block-12], [nb-block-5], [pin-SOCIAL-WINTER-OF-25], etc.
    # [FIX] Expanded citation pattern to support source-URL and pin-tX- IDs
        citation_pattern = r'\[((?:bi|nb|db|br|source)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+|source-[a-zA-Z0-9\.\:/%-]+)(?:\s*,\s*(?:(?:bi|nb|db|br|source)-block-[a-zA-Z0-9-]+|pin-[a-zA-Z0-9-]+|source-[a-zA-Z0-9\.\:/%-]+))*\]'
        citations_raw = re.findall(citation_pattern, final_answer, re.IGNORECASE)
        
        # Flatten and deduplicate citations
        citations_set = set()
        for citation_group in citations_raw:
            # Split by comma if there are multiple citations in one bracket
            ids = [cid.strip() for cid in re.split(r',', citation_group)]
            citations_set.update(ids)
        
        citations_list = [{"blockId": cid} for cid in sorted(citations_set)]
        
        # [NEW] Post-Translation via Lingo.dev if output_lang is specified
        print(f"[CHAT] Post-generation check: output_lang={output_lang}")
        if output_lang and output_lang not in ["auto", "en", "unknown"]:
            print(f"[CHAT] Applying post-generation Lingo.dev translation to: {output_lang}")
            from rag_pipeline import translate_text_lingo
            translated_answer, _, was_translated = translate_text_lingo(final_answer, target_lang=output_lang, api_keys=api_keys)
            if translated_answer:
                final_answer = translated_answer
                print(f"[CHAT] Translation applied (was_translated={was_translated}, len={len(final_answer)})")
                
        result = {
            "answer": final_answer,
            "citations": citations_list,
            "context_found": bool(context),
            "sources": ["Current Page"] if is_direct_context else [],
            "model_used": model_used,
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

def chat_logic_stream(query: str, page_content: str | None = None, content_blocks: list[dict] | None = None, site_id: str | None = None, history: list[dict] | None = None, session_id: str | None = None, api_keys: dict = None, search_query: str | None = None, query_lang: str | None = None, output_lang: str = "auto", query_notebook: bool = False, persona_id: str | None = None):
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

    # [FIX] Detect pinned tabs to use a more lenient system instruction
    has_pinned = any(b.get("id", "").startswith(("pin-", "source-")) for b in (content_blocks or []))
    
    if has_pinned:
        # Lenient mode for pinned tabs — the user expects answers from their pinned pages
        system_instruction = f"""{lang_instruction}You are a helpful AI assistant for the Snapmind browser extension.

RULES:
1. Answer using the provided CONTEXT from the user's pinned tabs and database.
2. Synthesize and summarize the available information to best answer the user's question.
3. If the CONTEXT contains relevant information, USE IT — even if it's fragmented or partial.
4. Only say "I don't have that information" if the CONTEXT is completely empty or entirely unrelated to the question.
5. DO NOT hallucinate facts not present in the CONTEXT, but DO connect and summarize what IS there.
6. [GENERATIVE UI] If the user explicitly asks for a process, workflow, architecture, diagram, or sequence of events, you MUST output a Mermaid.js diagram. Wrap it strictly in a ```mermaid\\n ... \\n``` block.
   CRITICAL MERMAID RULES:
   - YOU MUST EXCLUSIVELY USE 'graph TD' or 'graph LR'. 
   - NEVER use 'sequenceDiagram', 'gantt', or commas in node names.
   - Keep the syntax strictly valid.

At the end of your response, suggest 2-3 short (max 10 words), engaging follow-up questions ONLY if answerable from the CONTEXT. Format as 'Suggested Follow-ups:' with each in **bold**.

SPECIAL INSTRUCTION: If the user is asking about correlations or connections between bookmarks/references, you MUST look for legal, causal, or prerequisite links. Give a deep reasoning, not just a surface-level summary."""
    else:
        system_instruction = f"""{lang_instruction}You are a helpful and conversational AI research assistant for the Snapmind browser extension.
Your GOAL is to answer the user's question directly and intelligently using ONLY the provided CONTEXT.

<POLISH_RULES>
1. **Be Conversational**: Answer like a human assistant. Avoid overly robotic or formal document structures unless explicitly asked for a report.
2. **NO META-ANALYSIS**: Do NOT explain the "Snapmind rules," "Notebook Mode inferences," or describe how your internal retrieval works. Just provide the answer.
3. **Direct Answers**: Immediately address the user's query. Do NOT use headers like "### Key Inferences from Notebook Mode" or "### Example Scenarios" unless they are part of the actual data in the context.
4. **Context Only**: ONLY answer using information from the provided CONTEXT. DO NOT use external knowledge or make assumptions.
5. **Direct Fallback**: If the CONTEXT lacks the answer, output ONLY: "I don't have that information in the current research context". Nothing else.
6. [GENERATIVE UI] If the user explicitly asks for a process, workflow, architecture, diagram, or sequence of events, you MUST output a Mermaid.js diagram. Wrap it strictly in a ```mermaid\n ... \n``` block.
7. **Suggested Follow-ups**: At the very end, suggest 2-3 short, engaging follow-up questions ONLY if answerable from the CONTEXT. Format as '**Suggested Follow-ups:**' with each in **bold**.
</POLISH_RULES>

SPECIAL INSTRUCTION: If the user asks about correlations or connections between bookmarks/references, look for legal, causal, or prerequisite links. Give a deep reasoning based on the content."""

    print(f"[CHAT-STREAM] System Instruction Language Rule: {lang_instruction.strip() or 'None'}")

    if persona_id:
        try:
            from database import get_db_pool
            pool = get_db_pool()
            if pool:
                with pool.connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT system_prompt_addon FROM personas WHERE id = %s", (persona_id,))
                        res = cur.fetchone()
                        if res:
                            system_instruction = f"=== CUSTOM PERSONA ===\n{res[0]}\n=====================\n\n" + system_instruction
        except Exception as e:
            print(f"Error loading persona {persona_id}: {e}")

    citation_instruction = ""
    context = ""
    is_direct_context = False

    context_parts = []
    
    import time as _time
    _t0 = _time.time()
    
    # [NEW] Cross-Lingual Comparison Logic
    # [FIX] Only trigger expensive translation path when user EXPLICITLY asks for comparison
    # Previously, has_pinned_sources made this always True for pinned tabs, causing 10-45s Lingo.dev delays
    query_lower = query.lower()
    is_comparison_query = any(kw in query_lower for kw in ["compare", "contrast", "difference between", "vs ", "versus"])
    lingo_feature_prompt = ""
    
    if content_blocks and isinstance(content_blocks, list):
        # If comparison is requested, group blocks by source and optionally translate
        if is_comparison_query:
            print("[CROSS-LINGUAL] Comparison requested, grouping sources...")
            source_map = {} # URL -> {id, blocks, text_content}
            for block in content_blocks:
                block_id = block.get("id", "unknown")
                url = block.get("url") or "Main Page"
                if url not in source_map:
                    source_map[url] = {"id": url, "blocks": [], "text_content": ""}
                
                if block_id.startswith("source-"):
                    # Header block
                    context_parts.append(f"[{block_id}] {block.get('text', '')}")
                else:
                    text = block.get("text", "")
                    if text and len(text.strip()) >= 5:
                        source_map[url]["blocks"].append(block)
                        if len(source_map[url]["text_content"]) < 4000:
                            source_map[url]["text_content"] += text + "\n"
                
            from rag_pipeline import translate_text_lingo
            for url, source in source_map.items():
                if not source["blocks"]:
                    continue
                print(f"[CROSS-LINGUAL] Processing source: {url}")
                sample_text = source["text_content"][:4000]
                translated_text, src_lang, is_trans = translate_text_lingo(sample_text, target_lang="en", api_keys=api_keys)
                
                # Append original blocks
                for block in source["blocks"]:
                     context_parts.append(f"[{block.get('id', 'unknown')}] {block.get('text', '')}")
                     
                if is_trans and src_lang != "en" and src_lang != "unknown":
                    print(f"[CROSS-LINGUAL] Source was in {src_lang}. Appending translated baseline.")
                    context_parts.append(f"\n--- [LINGO.DEV TRANSLATION BASELINE FOR {url} (Original: {src_lang})] ---\n{translated_text}\n--- END BASELINE ---\n")
            
            lingo_feature_prompt = """
CRITICAL COMPARISON TASK:
The user wants to compare distinct websites/pages in different languages. You have been provided with the original raw text AND a [LINGO.DEV TRANSLATION BASELINE] for the foreign language content.
1. Contrast the original sites based on their translated baseline.
2. Analyze localization differences (tone, cultural adaptations, missing/extra content).
3. Provide EXACT "Lingo.dev Feature Suggestions" tailored to any pain points or missed localization opportunities you find (e.g. culturally insensitive phrasing, UI issues from text expansion).
"""
        else:
            # 1. Structured Context (Standard Flow)
            from browser_agents import extract_highlight_snippet, generate_highlight_url
            for block in content_blocks:
                if not block.get("text") or len(block["text"].strip()) < 10:
                    continue
                block_id = block.get("id", "unknown")
                text = block.get("text", "").strip()
                url = block.get("url", "Current Page")
                
                # [FIX] Generate highlight_snippet for pinned blocks so citations can navigate
                if not block.get("highlight_snippet") and text:
                    block["highlight_snippet"] = extract_highlight_snippet(text)
                    if url and url != "Current Page":
                        block["url"] = generate_highlight_url(url, block["highlight_snippet"])
                
                # [NEW] Explicit Source Attribution for Pinned/Live Context
                context_parts.append(f"SOURCE: {url}\nID: [{block_id}]\nCONTENT: {text}")

    print(f"[PERF] Content blocks processed in {_time.time() - _t0:.2f}s")

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

    # --- STEP 4: DATABASE RETRIEVAL (Historical Context) ---
    _t1 = _time.time()
    db_context = ""
    retrieved_raw_blocks = []
    if site_id:
        print(f"[CHAT-STREAM] Querying database for site_id: {site_id}...")
        
        # [FIX] Handle comma-separated site_ids (from pinned tabs feature)
        # Same logic as get_relevant_context
        site_ids = [s.strip() for s in site_id.split(",")] if site_id else []
        
        if site_ids:
            searcher = HybridSearcher(db_pool, api_keys=api_keys)
            
            # Query each site and aggregate results
            per_site_top_k = max(SearchConfig.MATCH_COUNT, 10)
            all_site_matches = []
            seen_ids = set()
            
            for sid in site_ids:
                if not sid:
                    continue
                site_matches = searcher.search(
                    query=search_query,
                    site_id=sid,
                    top_k=per_site_top_k,
                    mode=SearchConfig.SEARCH_MODE
                )
                for m in site_matches:
                    if m['id'] not in seen_ids:
                        all_site_matches.append(m)
                        seen_ids.add(m['id'])
            
            # Sort by score descending
            all_site_matches.sort(key=lambda x: x.get('score', 0), reverse=True)
            retrieved_raw_blocks = all_site_matches[:SearchConfig.MATCH_COUNT]
            
            print(f"[CHAT-STREAM] Retrieved {len(retrieved_raw_blocks)} blocks from {len(site_ids)} sites")
            print(f"[PERF] DB search completed in {_time.time() - _t1:.2f}s")
            
            # [NEW] Phase 26: Dynamic Pinned-Site Crawling (Bypass Indexing)
            # [FIX] Skip live scrape if frontend already sent enough content via content_blocks
            pinned_text_len = sum(len(b.get('text', '')) for b in (content_blocks or []))
            total_db_chars = sum(len(b.get('content', '')) for b in retrieved_raw_blocks)
            avg_len = total_db_chars / len(retrieved_raw_blocks) if retrieved_raw_blocks else 0
            
            needs_live_scrape = (pinned_text_len < 2000) and ((len(retrieved_raw_blocks) < 3) or (avg_len < 400 and total_db_chars < 3000))
            
            if needs_live_scrape and site_ids:
                import hashlib
                import concurrent.futures
                from rag_pipeline import scrape_website_firecrawl
                from chunking import chunk_text
                
                urls_to_scrape = [sid for sid in site_ids if sid.startswith(("http://", "https://"))]
                print(f"[CHAT-STREAM] Insufficient context (pinned={pinned_text_len}, db_avg={avg_len:.0f}). Scraping {len(urls_to_scrape)} URLs in parallel...")
                
                # [FIX] Scrape in parallel instead of sequentially
                def scrape_and_chunk(url):
                    try:
                        live_text, live_title = scrape_website_firecrawl(url, api_keys=api_keys)
                        if live_text and len(live_text) > 500:
                            chunks = chunk_text(live_text, max_chars=1000, source_url=url, use_semantic=False)
                            return url, chunks[:10], live_title
                    except Exception as e:
                        print(f"[CHAT-STREAM] Dynamic scrape failed for {url}: {e}")
                    return url, [], None
                
                with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                    futures = [executor.submit(scrape_and_chunk, u) for u in urls_to_scrape]
                    for future in concurrent.futures.as_completed(futures):
                        sid, live_chunks, live_title = future.result()
                        if live_chunks:
                            url_hash = hashlib.md5(sid.encode()).hexdigest()[:6]
                            for i, chunk in enumerate(live_chunks):
                                retrieved_raw_blocks.append({
                                    'id': f"pin-block-{url_hash}-{i+1}",
                                    'content': chunk.get('content', ''),
                                    'source_url': sid,
                                    'score': 1.0,
                                    'metadata': {'title': live_title or 'Live Page Content'}
                                })
                            print(f"[CHAT-STREAM] Added {len(live_chunks)} live chunks for {sid}")
            else:
                if pinned_text_len >= 2000:
                    print(f"[CHAT-STREAM] Skipping live scrape — frontend content_blocks have {pinned_text_len} chars (sufficient)")

            # [FIX] Fallback to global search only if we still have nothing after live scrape attempts
            if not retrieved_raw_blocks and site_ids:
                print(f"[CHAT-STREAM] Still no matches (DB or Live). Falling back to global search...")
                retrieved_raw_blocks = searcher.search(
                    query=search_query,
                    site_id=None,
                    top_k=SearchConfig.MATCH_COUNT,
                    mode=SearchConfig.SEARCH_MODE
                )
        
        # [NEW] Phase 5: Optimize retrieved context
        if retrieved_raw_blocks:
            from context_optimizer import optimize_context
            optimized = optimize_context(retrieved_raw_blocks, query=search_query)
            db_context = optimized.content

    # 3. Research Notebook Context
    notebook_context = ""
    notebook_blocks = []
    if query_notebook:
        print(f"[CHAT-STREAM] Notebook correlation requested. Querying bookmarks...")
        notebook_context, notebook_blocks = get_notebook_context(search_query, session_id=session_id, api_keys=api_keys)

    # --- CONTEXT ASSEMBLY (Prioritize Live/Pinned at TOP) ---
    context_str = ""
    
    if context_parts:
        context_str += "LIVE PAGE / PINNED TABS CONTEXT (CURRENT FOCUS):\n" + "\n\n".join(context_parts) + "\n\n"
        is_direct_context = True

    if notebook_context:
        context_str += "RESEARCH NOTEBOOK CONTEXT (MOST RELEVANT BOOKMARKS):\n" + notebook_context + "\n\n"
        
    # [FIX] Always include retrieved_raw_blocks in context, regardless of optimize_context output
    # Previously, if optimize_context returned empty (due to MIN_RELEVANCE_SCORE filtering),
    # all DB blocks were silently dropped and the LLM had no data to answer from.
    if retrieved_raw_blocks:
        context_str += "DATABASE CONTEXT (HISTORICAL INDEXED DATA):\n"
        from browser_agents import extract_highlight_snippet
        import hashlib
        for i, doc in enumerate(retrieved_raw_blocks):
            content_blocks = content_blocks or []
            c_text = doc.get('content', '')
            h_snippet = extract_highlight_snippet(c_text)
            source_url = doc.get('source_url', '')
            url_hash = hashlib.md5(source_url.encode()).hexdigest()[:6] if source_url else 'unknown'
            block_id = doc.get('id', f"db-block-{url_hash}-{i+1}")
            context_str += f"SOURCE: {source_url}\nID: [{block_id}]\nCONTENT: {c_text}\n\n---\n\n"
            content_blocks.append({
                "id": block_id,
                "text": c_text,
                "highlight_snippet": h_snippet,
                "url": source_url
            })
        print(f"[CHAT-STREAM] Embedded {len(retrieved_raw_blocks)} database blocks with IDs and source URLs")
    elif db_context:
        context_str += "DATABASE CONTEXT (HISTORICAL INDEXED DATA):\n" + db_context + "\n\n"

    context = context_str.strip()
    
    # Increase context capacity for complex research
    MAX_CHARS = 20000 
    if len(context) > MAX_CHARS:
         context = context[:MAX_CHARS] + f"... [Truncated for Context Limit exceeding {MAX_CHARS} chars]"

    print(f"[CHAT-STREAM] Final context capacity: {len(context)} / {MAX_CHARS} chars")

    # [NEW] Merge Notebook Blocks for streaming response metadata
    if notebook_blocks:
        content_blocks = content_blocks or []
        content_blocks.extend(notebook_blocks)

    # Note: Truncation happened above at line 886
    print(f"[DEBUG CONTEXT] Final context length: {len(context)} chars")
    if len(context) > 0:
        print(f"[DEBUG CONTEXT] Preview: {context[:500]}...")

    # [DEBUG] Log all blocks before yielding
    print(f"[DEBUG] Total content_blocks being sent to frontend: {len(content_blocks or [])}")
    for cb in (content_blocks or []):
        print(f"  - Block ID: {cb.get('id')}, URL: {cb.get('url', 'NO_URL')}, Text length: {len(cb.get('text', ''))}")

    citation_instruction = ""
    if context:
        # [NEW] Yield all available blocks (pinned, current page, database, and notebook)
        # This ensures the frontend has metadata for all citations used in this response.
        yield json.dumps({
            "type": "retrieved_blocks",
            "blocks": content_blocks or []
        }) + "\n"
        
        cite_examples = []
        if query_notebook:
            cite_examples.append("[nb-block-1]")
        if context_parts or db_context:
            cite_examples.append("[db-block-1]")
        
        if context_parts:
            cite_examples.append("[pin-t0-5]") # Explicit pinned tab example
            cite_examples.append("[source-https://example.com]") # Explicit source header example
        
        example_str = " or ".join(cite_examples)
        
        notebook_priority = "\nPREFERENCE: Research Notebook mode is active. Prioritize information from BOOKMARK [nb-block-X] sources." if query_notebook else ""
        
        citation_instruction = f"""{notebook_priority}
CITATION RULES:
1. You MUST cite the source block ID in brackets, e.g. {example_str}, for EVERY fact you use from the context.
2. ONLY cite using IDs explicitly provided in the CONTEXT above. Use [pin-tX-Y] for pinned tabs and [source-URL] for site headers when relevant.
3. DO NOT invent, hallucinate, or guess any block IDs.
4. If multiple sources support a fact, cite all of them, e.g. [db-block-1, pin-t0-5].
5. Attach citations to the specific sentences or phrases they support.
6. Use as many distinct citations as necessary to be accurate (up to 10 for multi-tab research).
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

    # Streaming Generation
    try:
        if LLMProviderConfig.PROVIDER in ["local", "hybrid"]:
            print(f"Streaming with Local LLM (Ollama): {LLMProviderConfig.OLLAMA_GENERATION_MODEL}")
            model_used = LLMProviderConfig.OLLAMA_GENERATION_MODEL
        else:
            print(f"Streaming with Mistral model: mistral-small-latest")
            model_used = "mistral-small-latest"
        
        print(f"[PERF] Total pre-stream time: {_time.time() - _t0:.2f}s")
        
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

        active_provider = (api_keys or {}).get("llm_provider", LLMProviderConfig.PROVIDER).lower()
        active_model = (api_keys or {}).get("llm_model", "")

        full_response = ""
        
        if active_provider in ["local", "hybrid", "ollama"]:
            model_target = active_model or LLMProviderConfig.OLLAMA_GENERATION_MODEL
            model_used = f"Ollama ({model_target})"
            print(f"[LLM] Streaming with local Ollama model: {model_target}")
            stream_response = ollama_client.chat_stream(
                messages=final_messages,
                model=model_target
            )
            for text_chunk in stream_response:
                full_response += text_chunk
                if output_lang and output_lang not in ["auto", "en", "unknown"]:
                    continue
                yield json.dumps({"type": "token", "text": text_chunk}) + "\n"
                
        elif active_provider == "openai":
            model_target = active_model or "gpt-4o-mini"
            model_used = f"OpenAI ({model_target})"
            print(f"[LLM] Streaming with OpenAI model: {model_target}")
            client = get_openai_client(api_keys)
            stream_response = client.chat.completions.create(
                model=model_target,
                messages=final_messages,
                stream=True
            )
            for chunk in stream_response:
                if chunk.choices[0].delta.content is not None:
                    text_chunk = chunk.choices[0].delta.content
                    full_response += text_chunk
                    if output_lang and output_lang not in ["auto", "en", "unknown"]:
                        continue
                    yield json.dumps({"type": "token", "text": text_chunk}) + "\n"
                    
        elif active_provider == "gemini":
            model_target = active_model or "gemini-2.0-flash"
            model_used = f"Gemini ({model_target})"
            print(f"[LLM] Streaming with Gemini model: {model_target}")
            client = get_gemini_client(api_keys)
            # Gemini strictly enforces alternating user/model roles and single system instructions
            gemini_system_instruction = final_messages[0]["content"] if final_messages and final_messages[0]["role"] == "system" else ""
            gemini_contents = []
            for m in final_messages:
                if m["role"] != "system":
                    parts = [{"text": m["content"]}]
                    # Map standard roles to Gemini roles
                    r = "user" if m["role"] == "user" else "model"
                    gemini_contents.append({"role": r, "parts": parts})
                    
            from google.genai import types
            stream_response = client.models.generate_content_stream(
                model=model_target,
                contents=gemini_contents,
                config=types.GenerateContentConfig(system_instruction=gemini_system_instruction)
            )
            for chunk in stream_response:
                text_chunk = chunk.text
                full_response += text_chunk
                if output_lang and output_lang not in ["auto", "en", "unknown"]:
                    continue
                yield json.dumps({"type": "token", "text": text_chunk}) + "\n"

        else: # Standard Mistral fallback
            model_target = active_model or "mistral-small-latest"
            model_used = f"Mistral ({model_target})"
            print(f"[LLM] Streaming with Mistral model: {model_target}")
            client = get_mistral_client(api_keys)
            stream_response = client.chat.stream(
                model=model_target,
                messages=final_messages,
            )
            for chunk in stream_response:
                 if chunk.data.choices[0].delta.content:
                    text_chunk = chunk.data.choices[0].delta.content
                    full_response += text_chunk
                    if output_lang and output_lang not in ["auto", "en", "unknown"]:
                        continue
                    yield json.dumps({"type": "token", "text": text_chunk}) + "\n"
        
        # [NEW] Post-Translation via Lingo.dev for stream
        print(f"[CHAT-STREAM] Post-generation check: output_lang={output_lang}, response_len={len(full_response)}")
        if output_lang and output_lang not in ["auto", "en", "unknown"]:
             print(f"[CHAT-STREAM] Applying post-generation Lingo.dev translation to: {output_lang}")
             from rag_pipeline import translate_text_lingo
             translated_answer, _, was_translated = translate_text_lingo(full_response, target_lang=output_lang, api_keys=api_keys)
             if translated_answer and was_translated:
                 full_response = translated_answer
                 import re
                 full_response = re.sub(r'\[\d{1,3}\]', '', full_response)
                 print(f"[CHAT-STREAM] Translation applied successfully ({len(full_response)} chars)")
             elif translated_answer:
                 # Lingo returned something but is_trans was False — use it anyway since user explicitly asked
                 full_response = translated_answer
                 import re
                 full_response = re.sub(r'\[\d{1,3}\]', '', full_response)
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
        
        # Final Metadata (Usage and final status)
        yield json.dumps({
            "type": "usage",
            "context_found": bool(context),
            "model_used": model_used
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

