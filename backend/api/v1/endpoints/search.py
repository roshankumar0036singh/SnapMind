from fastapi import APIRouter, Request, Depends
from services.search_service import SearchService
from models.dtos import ChatResponseDTO, SearchRequestDTO, SearchResultDTO
from schemas import ChatRequest
from security import get_user_id

router = APIRouter()
search_service = SearchService()

@router.post("/chat", response_model=ChatResponseDTO)
async def chat_endpoint(
    request: ChatRequest, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"), 
        "gemini": req.headers.get("x-gemini-key")
    }
    # Map to DTO if passing to search_service
    dto = SearchRequestDTO(
        query=request.query,
        session_id=request.session_id,
        user_id=user_id,
        workspace_id=request.workspace_id,
        tenant_id="default"
    )
    
    # If using local RAG via page_content, we can mock the search
    if request.page_content:
        # Mock SearchResult
        sources = [SearchResultDTO(
            id="local", url="local", content=request.page_content
        )]
        answer = search_service.router.chat(
            prompt=f"Context:\n{request.page_content}\n\nQuery: {request.query}",
            system_instruction=f"You are a helpful assistant. Use the context to answer in {request.output_lang}."
        )
        return ChatResponseDTO(
            answer=answer,
            sources=sources,
            session_id=request.session_id
        )

    return await search_service.chat(
        request=dto,
        api_keys=api_keys,
        output_lang=request.output_lang,
        history=request.history
    )
@router.post("/chat/stream")
async def chat_stream_endpoint(
    request: ChatRequest, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"), 
        "gemini": req.headers.get("x-gemini-key")
    }
    
    import json
    from config import settings
    
    async def event_generator():
        if request.page_content:
            # Yield mock block
            yield json.dumps({
                "type": "retrieved_blocks",
                "blocks": [{"id": "local", "content": "local page context"}]
            }) + "\n"
            
            async for token in search_service.router.stream(
                prompt=f"Context:\n{request.page_content}\n\nQuery: {request.query}",
                system_instruction=f"You are a helpful assistant. Use the context to answer in {request.output_lang}."
            ):
                yield json.dumps({"type": "token", "text": token}) + "\n"
        else:
            # Vector DB RAG stream
            dto = SearchRequestDTO(query=request.query, session_id=request.session_id, user_id=user_id, workspace_id=request.workspace_id)
            async for chunk in search_service.chat_stream(
                request=dto,
                api_keys=api_keys,
                output_lang=request.output_lang,
                history=request.history
            ):
                yield chunk

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )
