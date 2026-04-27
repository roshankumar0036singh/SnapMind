from fastapi import APIRouter, HTTPException, Request, Depends
from schemas import BookmarkRequest
from security import get_user_id

router = APIRouter()


@router.post("")
async def create_bookmark_endpoint(
    request: BookmarkRequest, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """Saves a research snippet as a bookmark with semantic search support."""
    from database import get_db_pool
    from services.ingest_service import IngestService
    from services.llm_service import LLMService
    import json
    try:
        api_keys = {
            "gemini": req.headers.get("x-gemini-key"),
            "mistral": req.headers.get("x-mistral-key"),
        }
        llm_svc = LLMService(api_keys=api_keys)
        ingest_svc = IngestService(api_keys=api_keys)
        
        # Check for translation
        content_to_save = request.content
        if len(content_to_save) > 30:
             translated, lang, is_trans = await llm_svc.translate_lingo(content_to_save[:10000])
             content_to_save = translated
             
        # We use the internal _batch_embed which handles both Mistral and Gemini
        embedded_list = ingest_svc._batch_embed([{"content": content_to_save}], source_url=request.source_url, api_keys=api_keys)
        if not embedded_list:
             raise HTTPException(status_code=500, detail="Failed to generate embedding for bookmark")
        
        embedding = embedded_list[0]['embedding']
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO bookmarks (content, source_url, metadata, embedding, user_id, workspace_id) VALUES (%s, %s, %s, %s::halfvec, %s::uuid, %s::uuid) RETURNING id",
                    (request.content, request.source_url, json.dumps(request.metadata or {}), embedding, user_id, request.workspace_id)
                )
                bookmark_id = cur.fetchone()[0]
                conn.commit()
        return {"success": True, "id": str(bookmark_id)}
    except Exception as e:
        print(f"Error creating bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
def get_all_bookmarks_endpoint(user_id: str = Depends(get_user_id)):
    """Retrieves all bookmarks for the current user across all workspaces (Global View)."""
    from database import get_db_pool
    from psycopg.rows import dict_row
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id, content, source_url, metadata, created_at FROM bookmarks WHERE user_id = %s::uuid ORDER BY created_at DESC", 
                    (user_id,)
                )
                bookmarks = cur.fetchall()
                for b in bookmarks:
                    if b.get('created_at'):
                        b['created_at'] = b['created_at'].isoformat()
                    if b.get('id'):
                        b['id'] = str(b['id'])
        return {"success": True, "bookmarks": bookmarks}
    except Exception as e:
        print(f"Error fetching global bookmarks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{workspace_id}")
def get_bookmarks_endpoint(workspace_id: str, user_id: str = Depends(get_user_id)):
    """Retrieves all saved bookmarks for the current user and workspace."""
    from database import get_db_pool
    from psycopg.rows import dict_row
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id, content, source_url, metadata, created_at FROM bookmarks WHERE user_id = %s::uuid AND workspace_id = %s::uuid ORDER BY created_at DESC", 
                    (user_id, workspace_id)
                )
                bookmarks = cur.fetchall()
                for b in bookmarks:
                    if b.get('created_at'):
                        b['created_at'] = b['created_at'].isoformat()
                    if b.get('id'):
                        b['id'] = str(b['id'])
        return {"success": True, "bookmarks": bookmarks}
    except Exception as e:
        print(f"Error fetching bookmarks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{bookmark_id}")
def delete_bookmark_endpoint(bookmark_id: int, user_id: str = Depends(get_user_id)):
    """Deletes a specific bookmark belonging to the user."""
    from database import get_db_pool
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM bookmarks WHERE id = %s AND user_id = %s", (bookmark_id, user_id))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Bookmark not found or unauthorized")
                conn.commit()
        return {"success": True}
    except Exception as e:
        print(f"Error deleting bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# [LOGGING] Standardized production logs for bookmarks endpoint
