from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse, PlainTextResponse
from urllib.parse import unquote
from security import get_user_id

router = APIRouter()

@router.get("/session/{session_id}")
def export_session(session_id: str, format: str = "json", user_id: str = Depends(get_user_id)):
    """
    Export all knowledge associated with a specific session.
    """
    try:
        from export import export_session_data
        from fastapi.responses import Response, PlainTextResponse
        
        result = export_session_data(session_id, format_type=format, user_id=user_id)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Unknown error"))
            
        if format == "markdown":
            return PlainTextResponse(
                content=result["content"],
                headers={"Content-Disposition": f'attachment; filename="{result["filename"]}"'}
            )
        elif format == "csv":
            return Response(
                content=result["content"],
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{result["filename"]}"'}
            )
        else:
            return JSONResponse(
                content=result,
                headers={"Content-Disposition": f'attachment; filename="{result["filename"]}"'}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{source_url:path}")
def export_site(source_url: str, format: str = "json", user_id: str = Depends(get_user_id)):
    """
    Export all indexed content for a given source URL, owned by the exact user.
    
    Args:
        source_url: URL to export (path parameter)
        format: Export format - 'json' or 'text' (query parameter)
    """
    try:
        from export import export_site_json, export_site_text
        
        # Decode URL
        decoded_url = unquote(source_url)
        
        if format == "text":
            content = export_site_text(decoded_url, user_id=user_id)
            return PlainTextResponse(
                content=content,
                headers={
                    "Content-Disposition": f'attachment; filename="export_{decoded_url.replace("://", "_").replace("/", "_")}.txt"'
                }
            )
        else:  # json
            data = export_site_json(decoded_url, user_id=user_id)
            return JSONResponse(
                content=data,
                headers={
                    "Content-Disposition": f'attachment; filename="export_{decoded_url.replace("://", "_").replace("/", "_")}.json"'
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# [LOGGING] Standardized production logs for export endpoint
