import uuid
import logging
from typing import List, Dict, Any, Optional
from repositories.base_repository import BaseRepository
from database import db_retry

logger = logging.getLogger(__name__)

class WorkspaceRepository(BaseRepository):
    """
    Repository for interacting with the 'workspaces' table.
    """

    @db_retry()
    def create(self, name: str, owner_id: str, metadata: dict = None) -> str:
        """Creates a new workspace and returns its ID."""
        from psycopg.types.json import Json
        ws_id = str(uuid.uuid4())
        
        query = """
            INSERT INTO workspaces (id, name, owner_id, metadata)
            VALUES (%(id)s::uuid, %(name)s, %(owner_id)s::uuid, %(metadata)s::jsonb)
            RETURNING id
        """
        params = {
            "id": ws_id,
            "name": name,
            "owner_id": owner_id,
            "metadata": Json(metadata or {})
        }
        
        try:
            with self.pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                conn.commit()
            return ws_id
        except Exception as e:
            logger.error(f"[WorkspaceRepository] Create failed: {e}")
            raise

    def get_by_owner(self, owner_id: str) -> List[Dict[str, Any]]:
        """Retrieves all workspaces owned by a specific user."""
        from psycopg.rows import dict_row
        query = "SELECT * FROM workspaces WHERE owner_id = %s ORDER BY created_at DESC"
        try:
            with self.pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(query, (owner_id,))
                    return cur.fetchall()
        except Exception as e:
            logger.error(f"[WorkspaceRepository] List failed: {e}")
            return []

    def get_by_id(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a workspace by its unique ID."""
        from psycopg.rows import dict_row
        query = "SELECT * FROM workspaces WHERE id = %s"
        try:
            with self.pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(query, (workspace_id,))
                    return cur.fetchone()
        except Exception as e:
            logger.error(f"[WorkspaceRepository] Get failed: {e}")
            return None

    def delete(self, workspace_id: str, owner_id: str) -> bool:
        """Deletes a workspace (owner only)."""
        query = "DELETE FROM workspaces WHERE id = %s AND owner_id = %s"
        try:
            with self.pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, (workspace_id, owner_id))
                    count = cur.rowcount
                conn.commit()
            return count > 0
        except Exception as e:
            logger.error(f"[WorkspaceRepository] Delete failed: {e}")
            return False
