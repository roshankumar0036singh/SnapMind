import logging
from typing import Any, List, Optional
from database import get_db_pool

logger = logging.getLogger(__name__)

class BaseRepository:
    """
    Base class for all repositories.
    Provides shared access to the database pool.
    """
    def __init__(self):
        self.pool = get_db_pool()
        if not self.pool:
            logger.error("[BaseRepository] Failed to initialize database pool.")

    def run_query(self, query: str, params: Optional[tuple] = None) -> List[Any]:
        """Utility for simple read-only queries."""
        try:
            with self.pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(query, params)
                    return cur.fetchall()
        except Exception as e:
            logger.error(f"[BaseRepository] Query Error: {e}")
            return []

# [STRICT_TYPES] Enforcing repository type safety
