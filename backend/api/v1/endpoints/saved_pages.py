from fastapi import APIRouter, HTTPException, Depends, Request
from schemas import SavePageRequest
from security import get_user_id
import json

router = APIRouter()

@router.get("")
def get_all_saved_pages(user_id: str = Depends(get_user_id)):
    """Retrieves all saved pages for the user across all workspaces (Global View)."""
    from database import get_db_pool
    from psycopg.rows import dict_row
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id, original_url, title, summary, folder_name, keywords, emotions, created_at "
                    "FROM saved_pages WHERE user_id = %s::uuid ORDER BY created_at DESC", 
                    (user_id,)
                )
                pages = cur.fetchall()
                for p in pages:
                    if p.get('created_at'):
                        p['created_at'] = p['created_at'].isoformat()
                    if p.get('id'):
                        p['id'] = str(p['id'])
        return {"success": True, "data": pages}
    except Exception as e:
        print(f"[API] Error getting global saved pages: {e}")
        return {"success": False, "data": []}


@router.get("/{workspace_id}")
def get_saved_pages(workspace_id: str, user_id: str = Depends(get_user_id)):
    """Retrieves saved pages isolated by user_id and workspace_id."""
    from database import get_db_pool
    from psycopg.rows import dict_row
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id, original_url, title, summary, folder_name, keywords, emotions, created_at "
                    "FROM saved_pages WHERE user_id = %s::uuid AND workspace_id = %s::uuid ORDER BY created_at DESC", 
                    (user_id, workspace_id)
                )
                pages = cur.fetchall()
                for p in pages:
                    if p.get('created_at'):
                        p['created_at'] = p['created_at'].isoformat()
                    if p.get('id'):
                        p['id'] = str(p['id'])
        return {"success": True, "data": pages}
    except Exception as e:
        print(f"[API] Error getting saved pages: {e}")
        return {"success": False, "data": []}

@router.post("")
async def save_page(request: SavePageRequest, req: Request, user_id: str = Depends(get_user_id)):
    """Processes and saves a webpage into the saved_pages table."""
    from database import get_db_pool
    from services.llm_service import LLMService
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
    }
    llm_svc = LLMService(api_keys=api_keys)
    
    try:
        # Check for translation
        # [OPTIMIZATION] Only translate if it looks like foreign content
        content_to_save = request.text
        if len(content_to_save) > 50:
             translated, lang, is_trans = await llm_svc.translate_lingo(content_to_save[:10000])
             content_to_save = translated
        
        title = "Saved Page"
        summary = content_to_save[:300] + "..." if len(content_to_save) > 300 else content_to_save
        keywords = ["extracted", "saved"]
        emotions = ["neutral"]
        
        # Try to use an LLM if possible
        mistral_key = api_keys.get("mistral")
        if mistral_key:
            try:
                from api_clients import get_mistral_client
                from config import settings
                client = get_mistral_client(api_keys)
                prompt = f"Analyze the following webpage text and extract a concise title, a 2-3 sentence summary, 3-5 keywords, and 1-2 emotional tones. Return ONLY a JSON object with keys: 'title', 'summary', 'keywords' (list of strings), and 'emotions' (list of strings).\n\nText:\n{request.text[:4000]}"
                response = client.chat.complete(
                    model=settings.models.mistral_large,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                res_text = response.choices[0].message.content.strip()
                if res_text.startswith("```json"):
                    res_text = res_text[7:-3]
                if res_text.startswith("```"):
                    res_text = res_text[3:-3]
                data = json.loads(res_text)
                title = data.get("title", title)
                summary = data.get("summary", summary)
                keywords = data.get("keywords", keywords)
                emotions = data.get("emotions", emotions)
            except Exception as e:
                print(f"Error during Mistral AI extraction for saved page: {e}")

        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO saved_pages (user_id, workspace_id, original_url, title, summary, folder_name, keywords, emotions) "
                    "VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s) RETURNING id",
                    (user_id, request.workspace_id, request.url, title, summary, request.folder_name or "General", keywords, emotions)
                )
                page_id = cur.fetchone()[0]
                conn.commit()

        return {"success": True, "id": str(page_id)}
    except Exception as e:
        print(f"[API] Error saving page: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{page_id}")
def delete_saved_page(page_id: str, workspace_id: str, user_id: str = Depends(get_user_id)):
    """Deletes a saved page ensuring user/workspace ownership."""
    from database import get_db_pool
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM saved_pages WHERE id = %s::uuid AND user_id = %s::uuid AND workspace_id = %s::uuid",
                    (page_id, user_id, workspace_id)
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Page not found or unauthorized")
                conn.commit()
        return {"success": True}
    except Exception as e:
        print(f"[API] Error deleting page: {e}")
        raise HTTPException(status_code=500, detail=str(e))
