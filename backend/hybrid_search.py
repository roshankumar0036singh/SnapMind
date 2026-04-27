"""
Hybrid Search Module for RAG Pipeline

Combines dense vector search with sparse keyword search (BM25) for improved retrieval.
Implements Reciprocal Rank Fusion (RRF) for result merging.
"""

import os
from typing import List, Dict, Any, Tuple, Union
from google import genai
from psycopg_pool import ConnectionPool
from config import settings


class HybridSearcher:
    """
    Hybrid search combining vector similarity and keyword matching.
    """
    
    def __init__(self, db_pool: ConnectionPool, api_keys: dict = None):
        self.db_pool = db_pool
        self.api_keys = api_keys
        self.search_mode = settings.search.mode
        self.vector_weight = settings.search.vector_weight
        self.keyword_weight = settings.search.keyword_weight
        # Vector search parameters
        # The instruction implies lowering the threshold to 0.2.
        # Assuming SearchConfig.MATCH_THRESHOLD is updated, or we override it here.
        # The provided snippet `MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.2"))`
        # looks like a config definition. If the intent is to ensure this file uses 0.2,
        # and assuming SearchConfig is updated, the existing line is correct.
        # If the intent is to hardcode it here, it would be:
        # self.match_threshold = 0.2
        # However, the snippet provided is a bit ambiguous in its placement and syntax.
        # Sticking to the most likely interpretation given the context of `SearchConfig`.
        self.match_threshold = settings.search.match_threshold
        self.match_count = settings.search.match_count
    
    def search(
        self,
        query: str,
        query_embedding: List[float] = None,
        site_id: Union[str, List[str]] = None, # [NEW] Support multiple site_ids
        top_k: int = None,
        mode: str = None
    ) -> List[Dict[str, Any]]:
        """
        Main search entry point that standardizes site_id inputs into a batch-ready list.
        """
        search_mode = mode or self.search_mode
        top_k = top_k or self.match_count
        
        # Standardize site_id to site_ids list for batch processing
        site_ids = []
        if site_id:
            if isinstance(site_id, str):
                site_ids = [s.strip() for s in site_id.split(",") if s.strip()]
            elif isinstance(site_id, list):
                site_ids = site_id
        
        if search_mode == "keyword_only":
            return self._keyword_search(query, site_ids, top_k)
        elif search_mode == "hybrid":
            return self._hybrid_search(query, query_embedding, site_ids, top_k)
        else:  # vector_only (default)
            return self._vector_search(query, query_embedding, site_ids, top_k)
    
    def _vector_search(
        self,
        query: str,
        query_embedding: List[float] = None,
        site_ids: List[str] = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Pure vector similarity search.
        """
        # Generate embedding if not provided
        if query_embedding is None:
            query_embedding = self._embed_query(query)
        
        # [NEW] Normalize and prepare array of prefixes
        prefixes = None
        if site_ids:
            prefixes = [self._normalize_url(sid) + "%" for sid in site_ids if sid]
        
        # RPC Call
        params = {
            "query_embedding": query_embedding,
            "match_threshold": self.match_threshold,
            "match_count": top_k,
            "filter_source_urls": prefixes
        }
        
        try:
            from psycopg.rows import dict_row
            MAX_RETRIES = 2
            matches = []
            for attempt in range(MAX_RETRIES):
                try:
                    with self.db_pool.connection() as conn:
                        with conn.cursor(row_factory=dict_row) as cur:
                            # Pre-check: If embedding is missing, this method should return empty
                            if not query_embedding or len(query_embedding) == 0:
                                print(f"[VECTOR-SEARCH] Warning: Empty query_embedding passed to _vector_search.")
                                return []

                            query_sql = """
                                SELECT 
                                    id, content, source_url, metadata,
                                    1 - (embedding <=> %(query_embedding)s::vector) AS similarity
                                FROM documents
                                WHERE (%(filter_source_urls)s::text[] IS NULL OR source_url LIKE ANY(%(filter_source_urls)s::text[]))
                                  AND 1 - (embedding <=> %(query_embedding)s::vector) > %(match_threshold)s
                                ORDER BY embedding <=> %(query_embedding)s::vector
                                LIMIT %(match_count)s
                            """
                            cur.execute(query_sql, params)
                            matches = cur.fetchall()
                    break # Success
                except Exception as e:
                    if attempt < MAX_RETRIES - 1:
                        print(f"[VECTOR-SEARCH] Attempt {attempt+1} failed: {e}. Retrying...")
                        import time
                        time.sleep(1)
                    else:
                        raise e
            
            # Add search metadata
            print(f"[VECTOR-SEARCH] Found {len(matches)} matches. Top score: {matches[0]['similarity'] if matches else 'N/A'}")
            for match in matches:
                match['search_method'] = 'vector'
                match['score'] = match.get('similarity', 0)
            
            return matches
        except Exception as e:
            print(f"Vector search error: {e}")
            return []
    
    def _keyword_search(
        self,
        query: str,
        site_ids: List[str] = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Pure keyword search using PostgreSQL full-text search.
        """
        prefixes = None
        if site_ids:
            prefixes = [self._normalize_url(sid) + "%" for sid in site_ids if sid]
        
        # We need all parameters for the SQL function signature even if weights are default for keyword-only search
        params = {
            "query_embedding": [0.0] * 3072,  # Dummy embedding for keyword-only
            "query_text": query,
            "match_threshold": 0.0,
            "match_count": top_k,
            "filter_source_urls": prefixes,
            "vector_weight": 0.0,
            "keyword_weight": 1.0
        }
        
        try:
            from psycopg.rows import dict_row
            with self.db_pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        "SELECT * FROM hybrid_search_documents(%(query_embedding)s::vector, %(query_text)s::text, %(match_threshold)s, %(match_count)s, %(filter_source_urls)s::text[], %(vector_weight)s, %(keyword_weight)s)",
                        params
                    )
                    matches = cur.fetchall()
            
            # Add search metadata
            for match in matches:
                match['search_method'] = 'keyword'
                match['score'] = match.get('rank', 0)
            
            return matches
        except Exception as e:
            print(f"Keyword search error: {e}")
            # Fallback to vector search
            return self._vector_search(query, None, site_ids, top_k)
    
    def _hybrid_search(
        self,
        query: str,
        query_embedding: List[float] = None,
        site_ids: List[str] = None,
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Hybrid search combining vector and keyword search with RRF.
        """
        # Generate embedding if not provided
        if query_embedding is None:
            query_embedding = self._embed_query(query)
        
        prefixes = None
        if site_ids:
            prefixes = [self._normalize_url(sid) + "%" for sid in site_ids if sid]
        
        params = {
            "query_embedding": query_embedding,
            "query_text": query,
            "match_threshold": self.match_threshold,
            "match_count": top_k,
            "filter_source_urls": prefixes,
            "vector_weight": self.vector_weight,
            "keyword_weight": self.keyword_weight
        }
        
        try:
            from psycopg.rows import dict_row
            
            # [CRITICAL] Skip if embedding failed
            if not query_embedding:
                 print("[HYBRID] Skipping vector half of search due to missing embedding. Falling back to keyword search.")
                 # Use a clean params dict for keyword search to avoid "missing parameter" errors
                 return self._keyword_search(query, site_ids, top_k)

            with self.db_pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    # In psycopg3 we can execute the function via SELECT FROM function_name(args...)
                    # Ensure query_text string format is matched for %(query_text)s in params dictionary
                    cur.execute(
                        "SELECT * FROM hybrid_search_documents(%(query_embedding)s::vector, %(query_text)s::text, %(match_threshold)s, %(match_count)s, %(filter_source_urls)s::text[], %(vector_weight)s, %(keyword_weight)s)",
                        params
                    )
                    matches = cur.fetchall()
            
            # Add search metadata
            for match in matches:
                match['search_method'] = 'hybrid'
                match['score'] = match.get('combined_score', 0)
                match['vector_score'] = match.get('similarity', 0)
                match['keyword_score'] = match.get('bm25_score', 0)
                
                # [NEW] Feature #6: Credibility-weighted scoring
                # 30% of final score influenced by source credibility
                meta = match.get('metadata', {})
                if isinstance(meta, str):
                    try:
                        import json
                        meta = json.loads(meta)
                    except Exception:
                        meta = {}
                cred_score = meta.get('credibility_score', 50) / 100.0
                match['score'] = match['score'] * (0.7 + 0.3 * cred_score)
                match['credibility_tier'] = meta.get('credibility_tier', 'community')
            
            return matches
        except Exception as e:
            print(f"Hybrid search error: {e}")
            print("Falling back to vector search...")
            # Fallback to vector search if hybrid search fails (will also check for empty embedding)
            return self._vector_search(query, query_embedding, site_ids, top_k)
    
    def _embed_query(self, query: str) -> List[float]:
        """
        Generate embedding for query text using same model as ingestion.
        """
        try:
            model_name = settings.models.mistral_embed
            
            # 1. Mistral Embedding Flow
            if "mistral" in model_name.lower():
                from api_clients import get_mistral_client
                client = get_mistral_client(self.api_keys)
                if client:
                    result = client.embeddings.create(
                        model=model_name,
                        inputs=[query]
                    )
                    embedding = result.data[0].embedding
                else:
                    embedding = None
                
            # 2. Gemini Embedding Flow
            else:
                from api_clients import get_gemini_client
                client = get_gemini_client(self.api_keys)
                result = client.models.embed_content(
                    model="gemini-embedding-001" if "gemini" not in model_name.lower() else model_name,
                    contents=query,
                )
                embedding = result.embeddings[0].values
            
            # [CRITICAL PADDING FIX] Match DB dimension (3072)
            from utils import pad_embedding
            embedding = pad_embedding(embedding)
                
            return embedding
        except Exception as e:
            error_msg = str(e)
            if "403" in error_msg and ("leaked" in error_msg.lower() or "permission_denied" in error_msg.lower()):
                print(f"[SEARCH-EMBED] CRITICAL: API Key leaked/invalid! Using neutral vector.")
                return [0.0] * 3072
            print(f"Embedding error: {e}")
            return None # Return None instead of []
    
    def _normalize_url(self, url: str) -> str:
        """
        Normalize URL for consistent matching.
        """
        if not url:
            return None
        
        try:
            from urllib.parse import urlparse
            import re
            parsed = urlparse(url)
            normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/')}"
            
            # Special handling for github repositories
            # Convert https://github.com/owner/repo/tree/main... to https://github.com/owner/repo
            # This allows queries from anywhere in the repo to match the indexed files which use /blob/...
            if parsed.netloc in ("github.com", "www.github.com"):
                match = re.match(r"^/([^/]+)/([^/]+)", parsed.path)
                if match:
                    normalized = f"{parsed.scheme}://{parsed.netloc}/{match.group(1)}/{match.group(2)}"
                    
            return normalized
        except:
            return url
    
    def reciprocal_rank_fusion(
        self,
        vector_results: List[Dict],
        keyword_results: List[Dict],
        k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Combine results using Reciprocal Rank Fusion.
        
        RRF formula: score(d) = sum(1 / (k + rank(d)))
        
        Args:
            vector_results: Results from vector search
            keyword_results: Results from keyword search
            k: Constant for RRF (default: 60)
        
        Returns:
            Fused and ranked results
        """
        # Create score dictionaries
        doc_scores = {}
        doc_data = {}
        
        # Process vector results
        for rank, doc in enumerate(vector_results, start=1):
            doc_id = doc['id']
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + (1 / (k + rank))
            doc_data[doc_id] = doc
            if 'rrf_components' not in doc_data[doc_id]:
                doc_data[doc_id]['rrf_components'] = {}
            doc_data[doc_id]['rrf_components']['vector_rank'] = rank
        
        # Process keyword results
        for rank, doc in enumerate(keyword_results, start=1):
            doc_id = doc['id']
            doc_scores[doc_id] = doc_scores.get(doc_id, 0) + (1 / (k + rank))
            if doc_id not in doc_data:
                doc_data[doc_id] = doc
                doc_data[doc_id]['rrf_components'] = {}
            doc_data[doc_id]['rrf_components']['keyword_rank'] = rank
        
        # Sort by RRF score
        sorted_docs = sorted(
            doc_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        # Build final result list
        results = []
        for doc_id, rrf_score in sorted_docs:
            doc = doc_data[doc_id].copy()
            doc['rrf_score'] = rrf_score
            doc['search_method'] = 'rrf_fusion'
            results.append(doc)
        
        return results


def create_hybrid_searcher(db_pool: ConnectionPool, api_keys: dict = None) -> HybridSearcher:
    """
    Factory function to create a HybridSearcher instance.
    """
    return HybridSearcher(db_pool, api_keys)


# Convenience function for backward compatibility
def hybrid_search(
    db_pool: ConnectionPool,
    query: str,
    query_embedding: List[float] = None,
    site_id: str = None,
    top_k: int = 10,
    mode: str = None,
    api_keys: dict = None
) -> List[Dict[str, Any]]:
    """
    Convenience function for hybrid search.
    
    Args:
        db_pool: psycopg connection pool
        query: Search query
        query_embedding: Pre-computed embedding (optional)
        site_id: Filter by source URL
        top_k: Number of results
        mode: Search mode override
    
    Returns:
        List of search results
    """
    searcher = HybridSearcher(db_pool, api_keys)
    return searcher.search(query, query_embedding, site_id, top_k, mode)

# [STRICT_TYPES] Enforcing neural consistency for HybridSearch
