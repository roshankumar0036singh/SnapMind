from fastapi import APIRouter, HTTPException, Depends
from security import get_user_id

router = APIRouter()

@router.get("")
def list_sites(user_id: str = Depends(get_user_id)):
    """Returns list of indexed sites from unique source URLs."""
    try:
        from database import get_db_pool
        from psycopg.rows import dict_row
        db_pool = get_db_pool()
        
        url_map = {}
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT source_url, MAX(created_at) as created_at, MAX(metadata->>'original_lang') as original_lang, MAX(metadata->>'translated') as translated FROM documents WHERE source_url IS NOT NULL AND user_id = %s GROUP BY source_url ORDER BY 2 DESC", (user_id,))
                for doc in cur.fetchall():
                    url = doc.get('source_url')
                    if url:
                        url_map[url] = {
                            'url': url,
                            'created_at': str(doc.get('created_at')),
                            'original_lang': doc.get('original_lang'),
                            'translated': str(doc.get('translated')).lower() == 'true'
                        }
        
        sites = []
        for url, data in url_map.items():
            sites.append({
                "id": url,  
                "url": url,
                "title": url, 
                "last_updated_at": data['created_at'],
                "original_lang": data.get('original_lang'),
                "translated": data.get('translated', False)
            })
        
        sites.sort(key=lambda x: x['last_updated_at'], reverse=True)
        
        return {"success": True, "sites": sites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.delete("/{site_id:path}")
def delete_site(site_id: str, user_id: str = Depends(get_user_id)):
    """Deletes a site and all references."""
    from database import get_db_pool
    # Reconstruct the source_url if we encoded it previously
    from urllib.parse import unquote
    source_url = unquote(site_id)
    
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM documents WHERE source_url = %s AND user_id = %s", (source_url, user_id))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Site not found or not owned by user.")
                conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [LOGGING] Standardized production logs for sites endpoint
