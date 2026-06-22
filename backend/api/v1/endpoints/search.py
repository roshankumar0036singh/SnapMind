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
        # System instruction asking the LLM to output a special string if it can't answer
        sys_instruct = (
            f"You are a helpful assistant. Use the context to answer in {request.output_lang}. "
            "If the context does NOT contain the answer, output EXACTLY the phrase: __FALLBACK_REQUIRED__ and nothing else."
        )
        answer = search_service.router.chat(
            prompt=f"Context:\n{request.page_content}\n\nQuery: {request.query}",
            system_instruction=sys_instruct
        )
        
        if "__FALLBACK_REQUIRED__" not in answer:
            # Mock SearchResult since it answered from page
            sources = [SearchResultDTO(
                id="local", url="local", content=request.page_content
            )]
            return ChatResponseDTO(
                answer=answer,
                sources=sources,
                session_id=request.session_id
            )
        # If it said fallback required, fall through to the Vector DB search below

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
        dto = SearchRequestDTO(query=request.query, session_id=request.session_id, user_id=user_id, workspace_id=request.workspace_id)
        
        fallback_triggered = False
        
        if request.page_content:
            # Yield mock block
            yield json.dumps({
                "type": "retrieved_blocks",
                "blocks": [{"id": "local", "content": "local page context"}]
            }) + "\n"
            
            # System instruction asking the LLM to output a special string if it can't answer
            sys_instruct = (
                f"You are a helpful assistant. Use the context to answer in {request.output_lang}. "
                "If the context does NOT contain the answer, output EXACTLY the phrase: __FALLBACK_REQUIRED__ and nothing else."
            )
            
            full_response = ""
            async for token in search_service.router.stream(
                prompt=f"Context:\n{request.page_content}\n\nQuery: {request.query}",
                system_instruction=sys_instruct
            ):
                full_response += token
                # If we detect the fallback string early, we stop and trigger fallback
                if "__FALLBACK_REQUIRED__" in full_response:
                    fallback_triggered = True
                    break
                
                # We buffer slightly to avoid sending partial "__FALLBACK" tokens to the user
                if len(full_response) < 25 and "__FALLBACK" in full_response:
                    continue
                elif len(full_response) >= 25 and "__FALLBACK_REQUIRED__" not in full_response:
                    # It's a real response, flush the buffer and send the token
                    yield json.dumps({"type": "token", "text": token}) + "\n"
            
            if not fallback_triggered:
                return

        # Vector DB RAG stream (either no page_content, or fallback was triggered)
        if fallback_triggered:
            yield json.dumps({
                "type": "system_message",
                "content": "No answer found on this page. Searching your knowledge base..."
            }) + "\n"
            
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

# [LOGGING] Standardized production logs for search endpoint
