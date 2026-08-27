from fastapi import APIRouter, Depends, HTTPException, Request
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

class SuggestRequest(BaseModel):
    """Context for follow-up question generation. Every field is optional."""
    page_content: Optional[str] = None
    url: Optional[str] = None
    site_id: Optional[str] = None
    query: Optional[str] = None
    answer: Optional[str] = None
    workspace_id: Optional[str] = None
    output_lang: str = "auto"


def _parse_suggestions(raw: str, limit: int = 4) -> List[str]:
    """
    Pull a list of questions out of an LLM response. Models return a JSON array
    most of the time and a bulleted list the rest of the time, so accept both.
    """
    import re

    text = (raw or "").strip()
    if not text:
        return []

    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, list):
                items = [str(x).strip() for x in parsed if str(x).strip()]
                if items:
                    return items[:limit]
        except Exception:
            pass

    lines = []
    for line in text.splitlines():
        cleaned = re.sub(r'^\s*(?:[-*•]|\d+[.)])\s*', '', line).strip().strip('"')
        if len(cleaned) > 8:
            lines.append(cleaned)
    return lines[:limit]


@router.post("/suggest")
async def suggest_questions(
    request: SuggestRequest,
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Generate short follow-up questions for the chat composer.

    Called with `page_content` for a page the user is looking at, or with
    `query`/`answer` to continue an existing conversation. Failures return an
    empty list rather than an error: suggestions are a nicety, never a blocker.
    """
    try:
        from services.search_service import SearchService

        api_keys = {
            "mistral": req.headers.get("x-mistral-key"),
            "gemini": req.headers.get("x-gemini-key"),
        }
        service = SearchService(api_keys={k: v for k, v in api_keys.items() if v})

        if request.page_content:
            context = f"CONTENT:\n{request.page_content[:6000]}"
        elif request.answer or request.query:
            context = (
                f"PREVIOUS QUESTION: {request.query or '(unknown)'}\n\n"
                f"PREVIOUS ANSWER:\n{(request.answer or '')[:4000]}"
            )
        else:
            # Nothing to go on — sample the workspace so the chips are still grounded.
            pool = get_db_pool()
            from psycopg.rows import dict_row
            with pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    if request.workspace_id:
                        cur.execute(
                            """
                            SELECT LEFT(content, 400) AS content FROM documents
                            WHERE user_id = %s AND workspace_id = %s::uuid
                            ORDER BY created_at DESC LIMIT 6
                            """,
                            (user_id, request.workspace_id)
                        )
                    else:
                        cur.execute(
                            """
                            SELECT LEFT(content, 400) AS content FROM documents
                            WHERE user_id = %s ORDER BY created_at DESC LIMIT 6
                            """,
                            (user_id,)
                        )
                    rows = cur.fetchall()
            if not rows:
                return {"success": True, "suggestions": []}
            context = "KNOWLEDGE BASE EXCERPTS:\n" + "\n---\n".join(
                r.get("content", "") for r in rows
            )

        lang = "the same language as the content" if request.output_lang == "auto" else request.output_lang

        system_instruction = (
            "You generate follow-up questions for a research assistant. "
            "Return ONLY a JSON array of 4 strings. No prose, no numbering, no keys. "
            "Each question must be under 12 words, specific to the material, and answerable from it. "
            f"Write them in {lang}."
        )

        raw = service.router.chat(
            prompt=f"{context}\n\nReturn the JSON array of 4 questions now.",
            system_instruction=system_instruction
        )

        return {"success": True, "suggestions": _parse_suggestions(raw)}
    except Exception as e:
        logger.warning(f"Suggestion generation failed: {str(e)}")
        return {"success": True, "suggestions": []}


@router.get("/sessions")
async def get_chat_sessions(
    workspace_id: Optional[str] = None,
    user_id: str = Depends(get_user_id)
):
    """Get all chat sessions for a user (optionally filtered by workspace)."""
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            from psycopg.rows import dict_row
            with conn.cursor(row_factory=dict_row) as cur:
                if workspace_id:
                    cur.execute(
                        "SELECT id as session_id, title, updated_at FROM chat_sessions WHERE user_id = %s AND workspace_id = %s ORDER BY updated_at DESC",
                        (user_id, workspace_id)
                    )
                else:
                    cur.execute(
                        "SELECT id as session_id, title, updated_at FROM chat_sessions WHERE user_id = %s ORDER BY updated_at DESC",
                        (user_id,)
                    )
                return cur.fetchall()
    except Exception as e:
        logger.error(f"Failed to fetch chat sessions: {str(e)}")
        return []

class RenameSessionRequest(BaseModel):
    title: str


@router.patch("/sessions/{session_id}")
async def rename_chat_session(
    session_id: str,
    request: RenameSessionRequest,
    user_id: str = Depends(get_user_id)
):
    """Rename a chat session."""
    title = request.title.strip()[:120]
    if not title:
        return {"success": False, "error": "Title cannot be empty"}
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE chat_sessions SET title = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s",
                    (title, session_id, user_id)
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Session not found.")
                conn.commit()
        return {"success": True, "session_id": session_id, "title": title}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to rename chat session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    user_id: str = Depends(get_user_id)
):
    """Delete a chat session."""
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM chat_sessions WHERE id = %s AND user_id = %s",
                    (session_id, user_id)
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Session not found.")
                conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete chat session {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    user_id: str = Depends(get_user_id)
):
    """Get a specific chat session."""
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            from psycopg.rows import dict_row
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id as session_id, title, messages, updated_at FROM chat_sessions WHERE id = %s AND user_id = %s",
                    (session_id, user_id)
                )
                return cur.fetchone()
    except Exception as e:
        logger.error(f"Failed to fetch chat session {session_id}: {str(e)}")
        return None
