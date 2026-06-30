from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from database import get_db_pool
from security import get_user_id
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class SyncChatRequest(BaseModel):
    session_id: str
    title: str
    messages: List[Dict[str, Any]]
    workspace_id: Optional[str] = None

@router.post("/sync")
async def sync_chat_session(
    request: SyncChatRequest,
    user_id: str = Depends(get_user_id)
):
    """
    Upsert a chat session into the database for history and MCP export.
    """
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Upsert into chat_sessions
                cur.execute(
                    """
                    INSERT INTO chat_sessions (id, title, messages, user_id, workspace_id, updated_at)
                    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        messages = EXCLUDED.messages,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        request.session_id,
                        request.title,
                        json.dumps(request.messages),
                        user_id,
                        request.workspace_id
                    )
                )
                conn.commit()
        return {"success": True, "session_id": request.session_id}
    except Exception as e:
        logger.error(f"Failed to sync chat session: {str(e)}")
        return {"success": False, "error": str(e)}
