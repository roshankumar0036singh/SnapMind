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

    `ReasoningExecutor.execute_chain` is an *async generator* (it yields
    `{"type": "thought"|"final", ...}` events), so it has to be iterated, not
    awaited. This route drains it and returns the terminal `final` event plus the
    thoughts it passed through, which keeps the single-JSON contract the MCP
    server's `handle_deep_research` depends on. Use `/deep-research/stream` when
    the caller wants the events as they happen.
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

    final = None
    thoughts = []
    async for event in executor.execute_chain(plan, query):
        if event.get("type") == "final":
            final = event
        else:
            thoughts.append(event)

    if final is None:
        raise HTTPException(status_code=500, detail="Reasoning chain produced no answer")

    return {**final, "plan": plan, "thoughts": thoughts}


@router.post("/deep-research/stream")
async def deep_research_stream_endpoint(
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Same reasoning chain, streamed as NDJSON — one JSON object per line, in the
    order `execute_chain` yields them, terminated by the `final` event.

    A multi-hop run takes minutes, and its per-step `thought` events are the only
    honest progress signal the pipeline produces, so a UI that wants a live
    timeline reads it from here rather than guessing at stage timings.
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

    from reasoning_chain import ReasoningPlanner, ReasoningExecutor
    planner = ReasoningPlanner(api_keys)
    executor = ReasoningExecutor(api_keys, session_id=session_id, output_lang=target_lang)

    async def emit():
        import json as _json
        try:
            plan = planner.plan(query)
            yield _json.dumps({"type": "plan", "plan": plan}) + "\n"
            async for event in executor.execute_chain(plan, query):
                yield _json.dumps(event) + "\n"
        except Exception as e:
            print(f"[API] Deep research stream failed: {e}")
            yield _json.dumps({"type": "error", "error": str(e)}) + "\n"

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        emit(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.post("/scrape")
async def live_scrape_endpoint(
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Instantly scrape a URL into markdown without indexing it to the DB.
    """
    data = await req.json()
    url = data.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    api_keys = {
        "firecrawl": req.headers.get("x-firecrawl-key"),
    }
    
    from services.crawler_service import CrawlerService
    content, title = await CrawlerService.scrape_url(url, api_keys)
    
    if not content:
        raise HTTPException(status_code=500, detail="Failed to scrape URL")
        
    return {
        "success": True,
        "url": url,
        "title": title,
        "markdown": content
    }

@router.post("/person_intelligence")
async def person_intelligence_endpoint(
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Execute OSINT profiling directly using the BrowserOrchestrator in 'person' mode.
    """
    data = await req.json()
    query = data.get("query")
    session_id = data.get("session_id", "mcp-osint-session")
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
        
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "firecrawl": req.headers.get("x-firecrawl-key"),
    }
    
    from browser_agents import BrowserOrchestrator
    # We use 'person' mode to trigger the OSINT path
    orchestrator = BrowserOrchestrator(
        api_keys=api_keys, 
        session_id=session_id,
        user_id=user_id,
        research_mode="person"
    )
    
    result = await orchestrator.run(query)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

@router.post("/debate")
async def debate_endpoint(
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Adversarial RAG: Runs two BrowserOrchestrators concurrently with opposing prompts,
    and merges their findings into a debate format.
    """
    data = await req.json()
    topic = data.get("topic")
    session_id = data.get("session_id", "mcp-debate-session")
    
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required")
        
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "firecrawl": req.headers.get("x-firecrawl-key"),
    }
    
    import asyncio
    from browser_agents import BrowserOrchestrator
    from llm_router import LLMRouter
    
    # Instance 1: Proponent
    proponent = BrowserOrchestrator(
        api_keys=api_keys, session_id=f"{session_id}-pro", user_id=user_id, output_lang="English"
    )
    # Instance 2: Skeptic
    skeptic = BrowserOrchestrator(
        api_keys=api_keys, session_id=f"{session_id}-con", user_id=user_id, output_lang="English"
    )
    
    pro_query = f"Research and find strong evidence, data, and arguments SUPPORTING the premise: {topic}. Be extremely persuasive."
    con_query = f"Research and find strong evidence, data, and arguments AGAINST the premise: {topic}. Be extremely skeptical."
    
    pro_task = asyncio.create_task(proponent.run(pro_query))
    con_task = asyncio.create_task(skeptic.run(con_query))
    
    results = await asyncio.gather(pro_task, con_task)
    pro_res, con_res = results
    
    # Synthesize the debate
    router_llm = LLMRouter(api_keys)
    debate_prompt = f"""You are a neutral debate moderator. You have been provided with two adversarial research reports on the topic: "{topic}".
    
    Report 1 (Supporting): {pro_res.get('answer', 'Failed to generate')}
    Report 2 (Opposing): {con_res.get('answer', 'Failed to generate')}
    
    Write a structured back-and-forth debate transcript summarizing the strongest points from both sides, followed by a neutral, fact-based conclusion.
    """
    
    try:
        debate_transcript = router_llm.chat(prompt=debate_prompt, role="You are a professional debate moderator.")
    except Exception as e:
        debate_transcript = f"Error generating debate transcript: {str(e)}\n\nProponent:\n{pro_res.get('answer')}\n\nSkeptic:\n{con_res.get('answer')}"
        
    # Citations are dicts (`{blockId, snippet, highlightUrl}` — browser_agents.py:606),
    # so `set()` could not dedupe them: it raised `TypeError: unhashable type: 'dict'`
    # and took the whole endpoint down with it after both agents had already run.
    # Dedupe on the highlight URL instead, keeping the order the two agents produced.
    combined_sources = []
    seen_citations = set()
    for citation in list(pro_res.get("citations", [])) + list(con_res.get("citations", [])):
        key = (
            citation.get("highlightUrl") or citation.get("snippet") or citation.get("blockId")
            if isinstance(citation, dict)
            else citation
        )
        if key in seen_citations:
            continue
        seen_citations.add(key)
        combined_sources.append(citation)

    return {
        "success": True,
        "topic": topic,
        "answer": debate_transcript,
        "sources": combined_sources,
        "pro_sources": pro_res.get("citations", []),
        "con_sources": con_res.get("citations", [])
    }

@router.post("/cross_lingual")
async def cross_lingual_endpoint(
    req: Request,
    user_id: str = Depends(get_user_id)
):
    """
    The Babel Fish: Explicitly research in a foreign language and translate the final answer back.
    """
    data = await req.json()
    query = data.get("query")
    search_lang = data.get("search_lang", "Mandarin Chinese")
    target_lang = data.get("target_lang", "English")
    session_id = data.get("session_id", "mcp-babel-session")
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
        
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "firecrawl": req.headers.get("x-firecrawl-key"),
        "lingodev": req.headers.get("x-lingodev-key")
    }
    
    # Translate query to search_lang
    try:
        from api_clients import get_lingo_key
        from llm_router import LLMRouter
        # We can use LingoDev or LLMRouter for simple translation
        router_llm = LLMRouter(api_keys)
        translated_query = router_llm.chat(
            prompt=f"Translate the following search query into {search_lang}. Output ONLY the translated text, nothing else.\n\nQuery: {query}",
            role="You are a highly accurate translator."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to translate query: {str(e)}")
        
    print(f"[Babel Fish] Original: {query} -> Translated: {translated_query}")
    
    from browser_agents import BrowserOrchestrator
    orchestrator = BrowserOrchestrator(
        api_keys=api_keys, 
        session_id=session_id,
        user_id=user_id,
        output_lang=target_lang # Instruct the final synthesis to be in target_lang
    )
    
    # We force the orchestrator to search using the translated language
    result = await orchestrator.run(f"Search strictly in {search_lang}: {translated_query}")
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return {
        "success": True,
        "original_query": query,
        "translated_query": translated_query,
        "search_lang": search_lang,
        "target_lang": target_lang,
        "answer": result.get("answer"),
        "sources": result.get("citations", [])
    }

# [LOGGING] Standardized production logs for research endpoint
