from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request, Depends, Header
from security import get_user_id
from services.ingest_service import IngestService
from models.dtos import IngestRequestDTO, IngestResponseDTO

router = APIRouter()
ingest_service = IngestService()

@router.post("", response_model=IngestResponseDTO)
async def ingest_endpoint(
    request: IngestRequestDTO, 
    req: Request,
    user_id: str = Depends(get_user_id),
    x_mistral_key: Optional[str] = Header(None, alias="x-mistral-key"),
    x_gemini_key: Optional[str] = Header(None, alias="x-gemini-key"),
    x_firecrawl_key: Optional[str] = Header(None, alias="x-firecrawl-key"),
    x_apify_token: Optional[str] = Header(None, alias="x-apify-token")
):
    request.user_id = user_id
    api_keys = {
        "mistral": x_mistral_key, 
        "gemini": x_gemini_key, 
        "firecrawl": x_firecrawl_key,
        "apify": x_apify_token
    }
    
    if request.stream:
        async def stream_generator():
            import asyncio
            import json
            
            # Start background task
            if request.text:
                task = asyncio.create_task(ingest_service.ingest_text(request=request, api_keys=api_keys))
            else:
                task = asyncio.create_task(ingest_service.ingest_url(request=request, api_keys=api_keys))
            
            last_status = None
            last_progress = -1
            
            # Poll status and yield NDJSON lines
            while not task.done():
                status_dto = ingest_service.get_job_status(request.session_id, user_id)
                if status_dto.status != last_status or status_dto.progress != last_progress:
                    yield json.dumps(status_dto.model_dump()) + "\n"
                    last_status = status_dto.status
                    last_progress = status_dto.progress
                await asyncio.sleep(0.5)
            
            # Yield final result
            try:
                result = task.result()
                yield json.dumps(result.model_dump()) + "\n"
            except Exception as e:
                yield json.dumps({"success": False, "message": str(e)}) + "\n"
                
        from fastapi.responses import StreamingResponse
        return StreamingResponse(stream_generator(), media_type="application/x-ndjson")

    if request.text:
        return await ingest_service.ingest_text(
            request=request,
            api_keys=api_keys
        )
    else:
        return await ingest_service.ingest_url(
            request=request,
            api_keys=api_keys
        )

@router.post("/file", response_model=IngestResponseDTO)
async def ingest_file_endpoint(
    file: UploadFile = File(...),
    target_lang: str = Form("auto"),
    session_id: Optional[str] = Form(None),
    tenant_id: str = Form("default"),
    req: Request = None,
    user_id: str = Depends(get_user_id)
):
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"), 
        "gemini": req.headers.get("x-gemini-key")
    }
    return await ingest_service.ingest_file(
        file=file, 
        api_keys=api_keys, 
        target_lang=target_lang, 
        session_id=session_id,
        tenant_id=tenant_id,
        user_id=user_id
    )

@router.post("/github", response_model=IngestResponseDTO)
async def ingest_github_endpoint(
    request: IngestRequestDTO, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    request.user_id = user_id
    # IngestRequestDTO is used here as it contains both url and session_id
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"), 
        "gemini": req.headers.get("x-gemini-key")
    }
    return await ingest_service.ingest_repo(
        repo_url=request.url, 
        api_keys=api_keys, 
        target_lang="auto", # Defaulting for now
        session_id=request.session_id,
        tenant_id=request.tenant_id,
        user_id=user_id,
        workspace_id=request.workspace_id
    )

@router.get("/status/{session_id}")
def get_session_ingest_status(session_id: str, user_id: str = Depends(get_user_id)):
    return ingest_service.get_job_status(session_id, user_id)

@router.get("/stream/{session_id}")
async def stream_job_status(session_id: str, user_id: str = Depends(get_user_id)):
    """SSE endpoint for real-time ingestion progress logs."""
    from fastapi.responses import StreamingResponse
    return StreamingResponse(ingest_service.subscribe_job_status(session_id, user_id), media_type="text/event-stream")

# [LOGGING] Standardized production logs for ingest endpoint
