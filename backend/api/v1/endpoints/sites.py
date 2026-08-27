from fastapi import APIRouter, HTTPException, Depends
from security import get_user_id

router = APIRouter()

# One row per source_url, with the extras the web Library needs (chunk count and
# semantic tags). The LATERAL unnest multiplies rows per tag, so the chunk count
# has to be COUNT(DISTINCT id) rather than COUNT(*).
LIST_SITES_SQL = """
    SELECT
        d.source_url,
        MAX(d.created_at)                       AS created_at,
        MIN(d.created_at)                       AS first_indexed_at,
        COUNT(DISTINCT d.id)                    AS chunk_count,
        MAX(d.metadata->>'original_lang')       AS original_lang,
        MAX(d.metadata->>'translated')          AS translated,
        MAX(d.metadata->>'title')               AS title,
        MAX(d.workspace_id::text)               AS workspace_id,
        COALESCE(
            jsonb_agg(DISTINCT tag) FILTER (WHERE tag IS NOT NULL),
            '[]'::jsonb
        )                                       AS tags
    FROM documents d
    LEFT JOIN LATERAL jsonb_array_elements_text(
        CASE
            WHEN jsonb_typeof(d.metadata->'tags') = 'array' THEN d.metadata->'tags'
            ELSE '[]'::jsonb
        END
    ) AS tag ON TRUE
    WHERE d.source_url IS NOT NULL AND d.user_id = %s
    GROUP BY d.source_url
    ORDER BY 2 DESC
"""

@router.get("")
def list_sites(user_id: str = Depends(get_user_id)):
    """Returns list of indexed sites from unique source URLs."""
    try:
        from database import get_db_pool
        from psycopg.rows import dict_row
        db_pool = get_db_pool()

        sites = []
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(LIST_SITES_SQL, (user_id,))
                for doc in cur.fetchall():
                    url = doc.get('source_url')
                    if not url:
                        continue
                    tags = doc.get('tags') or []
                    if not isinstance(tags, list):
                        tags = []
                    sites.append({
                        "id": url,
                        "url": url,
                        # Fall back to the URL so existing clients keep a title.
                        "title": doc.get('title') or url,
                        "last_updated_at": str(doc.get('created_at')),
                        "first_indexed_at": str(doc.get('first_indexed_at')),
                        "chunk_count": doc.get('chunk_count') or 0,
                        "tags": [t for t in tags if isinstance(t, str)],
                        "workspace_id": doc.get('workspace_id'),
                        "original_lang": doc.get('original_lang'),
                        "translated": str(doc.get('translated')).lower() == 'true'
                    })

        sites.sort(key=lambda x: x['last_updated_at'], reverse=True)

        return {"success": True, "sites": sites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chunks/{site_id:path}")
def list_site_chunks(
    site_id: str,
    limit: int = 200,
    offset: int = 0,
    user_id: str = Depends(get_user_id)
):
    """
    Indexed chunks for one source, without the embedding column.

    /export/{source_url} returns the same rows *including* the 3072-dim vector
    serialised as text, which is far too heavy to render in a UI. This is the
    read path for inspecting a source; /export stays the download path.
    """
    from urllib.parse import unquote
    source_url = unquote(site_id)
    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    try:
        from database import get_db_pool
        from psycopg.rows import dict_row
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT COUNT(*) AS total FROM documents WHERE source_url = %s AND user_id = %s",
                    (source_url, user_id)
                )
                total = (cur.fetchone() or {}).get('total', 0)

                cur.execute(
                    """
                    SELECT id::text, content, metadata, created_at::text
                    FROM documents
                    WHERE source_url = %s AND user_id = %s
                    ORDER BY created_at ASC, id ASC
                    LIMIT %s OFFSET %s
                    """,
                    (source_url, user_id, limit, offset)
                )
                chunks = cur.fetchall()

        return {
            "success": True,
            "url": source_url,
            "total": total,
            "chunks": chunks
        }
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
