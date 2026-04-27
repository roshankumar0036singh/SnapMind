import os
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request, Depends
from security import get_user_id
from schemas import ResearchRequest, ReportRequest

router = APIRouter()

@router.post("/research")
async def research_endpoint(
    request: ResearchRequest, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Multi-Agent Browser Mode Entry Point.
    """
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
        "apify": req.headers.get("x-apify-token"),
        "groq": req.headers.get("x-groq-key"),
    }
    from browser_agents import BrowserOrchestrator
    orchestrator = BrowserOrchestrator(
        api_keys=api_keys, 
        session_id=request.session_id,
        user_id=user_id,
        workspace_id=request.workspace_id,
        output_lang=request.output_lang,
        query_notebook=request.query_notebook,
        image_data=request.image_data,
        research_mode=request.research_mode
    )
    
    result = await orchestrator.run(request.query)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.post("/generate_report")
async def generate_report_endpoint(
    request: ReportRequest, 
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Generate and download a comprehensive research report spanning multiple sessions.
    """
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"),
        "gemini": req.headers.get("x-gemini-key")
    }
    from report_generator import ReportGenerator
    generator = ReportGenerator(api_keys)
    
    file_path = generator.generate(
        session_ids=request.session_ids, 
        query=request.query, 
        workspace_id=request.workspace_id,
        source_urls=request.source_urls,
        output_lang=request.output_lang,
        user_id=user_id
    )
    
    from fastapi.responses import JSONResponse, FileResponse
    from fastapi import status
    
    if file_path == "INGESTION_PENDING":
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "pending", "message": "Research ingestion is still in progress."})
        
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Failed to generate report")
        
    # Use the first session ID for the filename
    fname = f"Research_Report_{request.session_ids[0]}.docx"
    return FileResponse(file_path, filename=fname)

@router.post("/deep-research")
async def deep_research_endpoint(
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Explicit multi-hop reasoning endpoint. Decomposes a query into sub-questions 
    and executes a reasoning chain across web and local sources.
    """
    data = await req.json()
    query = data.get("query")
    session_id = data.get("session_id")
    target_lang = data.get("target_language", "auto")
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "groq": req.headers.get("x-groq-key"),
    }
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
        
    print(f"[API] Starting Deep Research for: {query[:50]}...")
    
    from reasoning_chain import ReasoningPlanner, ReasoningExecutor
    planner = ReasoningPlanner(api_keys)
    executor = ReasoningExecutor(api_keys, session_id=session_id, output_lang=target_lang)
    
    plan = planner.plan(query)
    result = await executor.execute_chain(plan, query)
    
    return result
