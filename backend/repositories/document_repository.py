import json
import uuid
import logging
from typing import List, Dict, Any, Optional
from repositories.base_repository import BaseRepository
from database import db_retry

logger = logging.getLogger(__name__)

class DocumentRepository(BaseRepository):
    """
    Repository for interacting with the 'documents' and 'pending_embeddings' tables.
    """

    @db_retry(initial_delay=2)
    def bulk_insert(self, documents: List[Dict[str, Any]]):
        """
        Inserts multiple document chunks into the database.
        Expected format: {content, source_url, embedding, metadata, user_id, workspace_id}
        """
        if not documents:
            return

        query = """
            INSERT INTO documents (id, content, source_url, embedding, metadata, user_id, workspace_id) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        args_list = [
            (
                d.get("id") or str(uuid.uuid4()),
                d["content"],
                d["source_url"],
                d["embedding"],
                json.dumps(d.get("metadata", {})),
                d.get("user_id"),
                d.get("workspace_id")
            )
            for d in documents
        ]

        try:
            with self.pool.connection() as conn:
                with conn.cursor() as cur:
                    # Reduced batch size from 10 to 2 to prevent SSL EOF/buffer limits on massive academic pages
                    batch_size = 2
                    for i in range(0, len(args_list), batch_size):
                        batch = args_list[i:i + batch_size]
                        cur.executemany(query, batch)
                conn.commit()
            logger.info(f"[DocumentRepository] Successfully inserted {len(documents)} chunks in batches of {batch_size}.")
        except Exception as e:
            logger.error(f"[DocumentRepository] Bulk insert failed: {e}")
            raise

    def save_pending_embedding(self, content: str, source_url: str, metadata: dict, workspace_id: str, user_id: str):
        """Saves a chunk to the queue for later embedding when internet returns."""
        query = "INSERT INTO pending_embeddings (content, source_url, metadata, workspace_id, user_id) VALUES (%s, %s, %s, %s::uuid, %s::uuid)"
        try:
            with self.pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (content, source_url, json.dumps(metadata), workspace_id, user_id))
                conn.commit()
        except Exception as e:
            logger.error(f"[DocumentRepository] Failed to save pending embedding: {e}")

    def get_all_tags(self, workspace_id: Optional[str] = None, limit: int = 50, user_id: str = None) -> List[str]:
        """Retrieve unique semantic tags from the documents table. If workspace_id is None, returns tags across all user workspaces."""
        if workspace_id:
            query = """
                SELECT DISTINCT jsonb_array_elements_text(metadata->'tags') as tag 
                FROM documents 
                WHERE metadata ? 'tags' AND workspace_id = %s::uuid AND user_id = %s::uuid
                LIMIT %s
            """
            params = (workspace_id, user_id, limit)
        else:
            query = """
                SELECT DISTINCT jsonb_array_elements_text(metadata->'tags') as tag 
                FROM documents 
                WHERE metadata ? 'tags' AND user_id = %s::uuid 
                LIMIT %s
            """
            params = (user_id, limit)
            
        try:
            with self.pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    return [row[0] for row in cur.fetchall()]
        except Exception as e:
            logger.error(f"[DocumentRepository] Error retrieving global tags: {e}")
            return []

    def search_vector(
        self, 
        vector: List[float], 
        workspace_id: str,
        top_k: int = 10, 
        threshold: float = 0.2, 
        filter_source_urls: Optional[List[str]] = None,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Pure vector similarity search constrained by workspace."""
        from psycopg.rows import dict_row
        
        query = """
            SELECT 
                id, content, source_url, metadata,
                1 - (embedding <=> %(vector)s::vector) AS similarity
            FROM documents
            WHERE (%(workspace_id)s::uuid IS NULL OR workspace_id = %(workspace_id)s::uuid)
              AND (%(user_id)s::uuid IS NULL OR user_id = %(user_id)s::uuid)
              AND (%(filter_urls)s::text[] IS NULL OR source_url LIKE ANY(%(filter_urls)s::text[]))
              AND 1 - (embedding <=> %(vector)s::vector) > %(threshold)s
            ORDER BY embedding <=> %(vector)s::vector
            LIMIT %(limit)s
        """
        
        params = {
            "vector": vector,
            "workspace_id": workspace_id,
            "filter_urls": filter_source_urls,
            "threshold": threshold,
            "limit": top_k,
            "user_id": user_id
        }

        try:
            with self.pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(query, params)
                    matches = cur.fetchall()
            
            for m in matches:
                m['search_method'] = 'vector'
                m['score'] = m.get('similarity', 0)
            return matches
        except Exception as e:
            logger.error(f"[DocumentRepository] Vector search error: {e}")
            return []

    def search_hybrid(
        self,
        vector: List[float],
        query_text: str,
        workspace_id: str,
        top_k: int = 10,
        threshold: float = 0.2,
        filter_source_urls: Optional[List[str]] = None,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Hybrid search combining vector and keyword search with strict workspace isolation."""
        from psycopg.rows import dict_row
        
        params = {
            "query_embedding": vector,
            "query_text": query_text,
            "workspace_id": workspace_id,
            "user_id": user_id,
            "match_threshold": threshold,
            "match_count": top_k,
            "filter_source_urls": filter_source_urls,
            "vector_weight": vector_weight,
            "keyword_weight": keyword_weight
        }

        try:
            with self.pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    # Accepts workspace_id and user_id for strict isolation
                    # Signature matches V15: query_embedding, query_text, match_threshold, match_count, filter_source_urls, target_user_id, target_workspace_id, vector_weight, keyword_weight
                    cur.execute(
                        "SELECT * FROM hybrid_search_documents(%(query_embedding)s::vector, %(query_text)s::text, %(match_threshold)s, %(match_count)s, %(filter_source_urls)s::text[], %(user_id)s::uuid, %(workspace_id)s::uuid, %(vector_weight)s, %(keyword_weight)s)",
                        params
                    )
                    matches = cur.fetchall()
            
            for m in matches:
                m['search_method'] = 'hybrid'
                m['score'] = m.get('combined_score', 0)
            return matches
        except Exception as e:
            logger.error(f"[DocumentRepository] Hybrid search error: {e}")
            # Fallback to vector search with same isolation
            return self.search_vector(vector, workspace_id, top_k, threshold, filter_source_urls, user_id)
