from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Depends
from security import get_user_id
from database import get_db_pool
from psycopg.rows import dict_row

router = APIRouter()

@router.get("/analytics")
async def get_analytics(user_id: str = Depends(get_user_id)):
    """
    Get library statistics and usage analytics.
    """
    pool = get_db_pool()
    if not pool: return {"error": "No database connection"}
    
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Counts
                cur.execute("SELECT COUNT(*) FROM documents WHERE user_id = %s", (user_id,))
                doc_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM bookmarks WHERE user_id = %s", (user_id,))
                bookmark_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM chat_sessions WHERE user_id = %s", (user_id,))
                session_count = cur.fetchone()[0]
                
                # 2. Storage stats (approximate)
                cur.execute("SELECT pg_size_pretty(pg_total_relation_size('documents'))")
                storage_size = cur.fetchone()[0]
                
                # 3. Last indexed items
                cur.execute("SELECT source_url, created_at FROM documents WHERE user_id = %s ORDER BY created_at DESC LIMIT 5", (user_id,))
                recent = cur.fetchall()
                
                return {
                    "docs": doc_count,
                    "bookmarks": bookmark_count,
                    "sessions": session_count,
                    "storage": storage_size,
                    "recent": [{"url": r[0], "date": r[1]} for r in recent],
                    "health": "excellent"
                }
    except Exception as e:
        print(f"[API] Analytics error: {e}")
        return {"error": str(e)}

@router.get("/refresh-suggestions")
async def get_refresh_suggestions(user_id: str = Depends(get_user_id)):
    pool = get_db_pool()
    if not pool: return []
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM refresh_suggestions WHERE status = 'pending' ORDER BY created_at DESC")
                return cur.fetchall()
    except Exception as e:
        print(f"[API] Error fetching suggestions: {e}")
        return []
