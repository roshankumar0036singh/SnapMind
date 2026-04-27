from typing import Optional
from fastapi import APIRouter, Request, Header, Depends
from schemas import WidgetIngestRequest, WidgetChatRequest

router = APIRouter()

@router.post("/ingest")
async def widget_ingest(
    request: WidgetIngestRequest, 
    req: Request,
    x_gemini_key: Optional[str] = Header(None, alias="x-gemini-key"),
    x_mistral_key: Optional[str] = Header(None, alias="x-mistral-key"),
    x_firecrawl_key: Optional[str] = Header(None, alias="x-firecrawl-key"),
    x_apify_token: Optional[str] = Header(None, alias="x-apify-token")
):
    """
    Multipage ingestion for website chatbot widgets.
    """
    gemini_key = x_gemini_key or request.api_key
    mistral_key = x_mistral_key
    apify_token = x_apify_token

    api_keys = {
        "gemini": gemini_key,
        "mistral": mistral_key,
        "apify": apify_token
    }

    from widget_logic import ingest_widget_multipage
    result = await ingest_widget_multipage(
        url=request.url,
        widget_id=request.widget_id,
        max_pages=request.max_pages,
        max_depth=request.max_depth,
        api_keys=api_keys
    )
    return result

@router.post("/chat")
async def widget_chat(request: WidgetChatRequest, req: Request):
    """
    Chat endpoint for website chatbot widgets.
    """
    gemini_key = req.headers.get("x-gemini-key") or request.api_key
    mistral_key = req.headers.get("x-mistral-key")

    api_keys = {
        "gemini": gemini_key,
        "mistral": mistral_key,
    }

    from widget_logic import widget_chat_logic
    result = await widget_chat_logic(
        query=request.query,
        widget_id=request.widget_id,
        session_id=request.session_id,
        api_keys=api_keys
    )
    return result
