from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Request, status
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Union, Optional
from schemas import (
    BrowserRequest, IngestRequest, RepoIngestRequest, ChatRequest,
    WidgetIngestRequest, WidgetChatRequest, SuggestRequest, TranslateRequest,
    BookmarkRequest, SavePageRequest, WatchlistRequest, ReverseEngineerRequest,
    ResearchRequest, ReportRequest, PersonaRequest, GlobalSearchRequest,
    AnalyzeImageRequest
)
import uvicorn
import os
import asyncio # [NEW] Required for loops
import json # [NEW] Required for JSON manipulation
import re # [NEW] Required for URL validation
from urllib.parse import urlparse
from dotenv import load_dotenv
from supabase import create_client, Client
from mistralai import Mistral

# Import our pipeline logic
from rag_pipeline import ingest_website_logic
from search import chat_logic

load_dotenv()
from config import ModelRegistry

# --- Suppress Verbose Logging ---
import logging
logging.getLogger("google").setLevel(logging.WARNING)
logging.getLogger("google.ai").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("google_auth_httplib2").setLevel(logging.WARNING)

from contextlib import asynccontextmanager

async def background_sync_loop():
    """
    Periodically checks for pending embeddings and processes them if online.
    """
    from rag_pipeline import process_pending_embeddings
    print("[SYNC] Background Embedding Sync Task Started")
    while True:
        try:
            # Run the synchronous processing logic in a thread pool to avoid blocking Event Loop
            loop = asyncio.get_event_loop()
            # We don't pass api_keys here, it will use environment variables or be passed later if needed
            await loop.run_in_executor(None, process_pending_embeddings)
            await asyncio.sleep(360) # Re-check every 6 minutes
        except asyncio.CancelledError:
            print("[SYNC] Background Sync Task Cancelled")
            break
        except Exception as e:
            print(f"[SYNC] Error in background sync: {e}")
            await asyncio.sleep(60)

async def web_monitor_background_loop():
    """
    Periodically checks for stale URLs and generates refresh suggestions.
    """
    from web_monitor import web_monitor_loop
    await web_monitor_loop()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Run Migrations Safely
    from migrations import run_migrations
    try:
        run_migrations()
    except Exception as e:
        print(f"[FATAL] Migrations failed to run: {e}")
        
    # Startup: Start Background Tasks
    sync_task = asyncio.create_task(background_sync_loop())
    monitor_task = asyncio.create_task(web_monitor_background_loop())
    
    yield
    
    # Shutdown: Cancel Tasks
    sync_task.cancel()
    monitor_task.cancel()
    try:
        await asyncio.gather(sync_task, monitor_task, return_exceptions=True)
    except asyncio.CancelledError:
        pass

    from database import get_db_pool
    pool = get_db_pool()
    if pool:
        print("Shutting down database pool...")
        pool.close()

app = FastAPI(title="Snapmind Backend", lifespan=lifespan)

# Include modules
from evolution_api import router as evolution_router
app.include_router(evolution_router)

# Initialize Supabase (Global for Saved Pages)
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")

# Fallback: Derive Supabase URL from DATABASE_URL if missing
if not supabase_url:
    db_url = os.getenv("DATABASE_URL", "")
    if db_url and "supabase.com" in db_url:
        try:
            # Extract project ref from postgres.[ref] or similar
            project_ref = db_url.split('@')[0].split('://')[-1].split(':')[0].split('.')[-1]
            supabase_url = f"https://{project_ref}.supabase.co"
            print(f"[Supabase] Derived URL from DATABASE_URL: {supabase_url}")
        except Exception:
            pass

# --- Static Files (Phase 28) ---
from fastapi.staticfiles import StaticFiles
# Ensure static directory exists
if not os.path.exists("static"):
    os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/snapmind-widget.js")
async def get_widget_js():
    """Convenience route to serve the widget script from root."""
    return FileResponse("static/snapmind-widget.js")

supabase: Client = create_client(supabase_url or "", supabase_key or "")

# Initialize Mistral Client
mistral_api_key = os.getenv("MISTRAL_API_KEY")
mistral_client = Mistral(api_key=mistral_api_key)

# Allow CORS for Chrome Extension
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # In production, restrict to extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # To avoid breaking the React widget, we'll keep CSP relatively open but disable eval
    response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' https: http:; object-src 'none'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    import time
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    # We could also log this to a DB for the analytics view's 'latency distribution' chart
    return response

@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    # Limit body size to 50MB
    MAX_SIZE = 50 * 1024 * 1024
    if request.headers.get('content-length'):
        if int(request.headers.get('content-length')) > MAX_SIZE:
            return JSONResponse({"detail": "File too large. Maximum size is 50MB."}, status_code=413)
    return await call_next(request)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/health/ready")
def readiness_check():
    from database import get_db_pool
    pool = get_db_pool()
    if pool:
        return {"status": "ready"}
    return JSONResponse({"status": "unready", "detail": "Database not connected"}, status_code=503)

@app.get("/admin/refresh-suggestions")
async def get_refresh_suggestions():
    """
    Fetch pending URL refresh suggestions.
    """
    from database import get_db_pool
    from psycopg.rows import dict_row # Ensure correct row factory
    pool = get_db_pool()
    if not pool: return []
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM refresh_suggestions WHERE status = 'pending' ORDER BY created_at DESC")
                return cur.fetchall()
    except Exception as e:
        print(f"[API] Error fetching suggestions: {e}")
        return []

@app.post("/admin/refresh-url")
async def trigger_refresh(request: dict):
    """
    Manually trigger a re-index for a suggested URL.
    """
    url = request.get("url")
    if not url: raise HTTPException(status_code=400, detail="URL is required")
    
    from rag_pipeline import ingest_website_logic
    from database import get_db_pool
    
    # Re-ingest (this will overwrite/update documents for this URL)
    result = await ingest_website_logic(url) 
    
    if result.get("success"):
        pool = get_db_pool()
        if pool:
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("UPDATE refresh_suggestions SET status = 'completed' WHERE url = %s", (url,))
                    conn.commit()
    return result



# --- Models moved to schemas.py ---

@app.get("/monitor/watched_urls")
async def get_watched_urls():
    from database import get_db_pool
    from psycopg.rows import dict_row
    pool = get_db_pool()
    if not pool: return []
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, url, created_at FROM watched_urls ORDER BY created_at DESC")
                return cur.fetchall()
    except Exception as e:
        print(f"[API] Error fetching watched urls: {e}")
        return []

@app.post("/monitor/watched_urls")
async def add_watched_url(req: WatchlistRequest):
    from database import get_db_pool
    pool = get_db_pool()
    if not pool: raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO watched_urls (url) VALUES (%s) ON CONFLICT (url) DO NOTHING",
                    (req.url,)
                )
                conn.commit()
                return {"success": True, "message": "Added to watchlist"}
    except Exception as e:
        print(f"[API] Error adding watched url: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/monitor/watched_urls")
async def delete_watched_url(url: str):
    from database import get_db_pool
    pool = get_db_pool()
    if not pool: raise HTTPException(status_code=500, detail="Database unavailable")
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM watched_urls WHERE url = %s", (url,))
                conn.commit()
                return {"success": True, "message": "Removed from watchlist"}
    except Exception as e:
        print(f"[API] Error deleting watched url: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/analytics")
async def get_analytics():
    """
    Get library statistics and usage analytics.
    """
    from database import get_db_pool
    pool = get_db_pool()
    if not pool: return {"error": "No database connection"}
    
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Counts
                cur.execute("SELECT COUNT(*) FROM documents")
                doc_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM bookmarks")
                bookmark_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM chat_sessions")
                session_count = cur.fetchone()[0]
                
                # 2. Storage stats (approximate)
                cur.execute("SELECT pg_size_pretty(pg_total_relation_size('documents'))")
                storage_size = cur.fetchone()[0]
                
                # 3. Last indexed items
                cur.execute("SELECT source_url, created_at FROM documents ORDER BY created_at DESC LIMIT 5")
                recent = cur.fetchall()
                
                return {
                    "docs": doc_count,
                    "bookmarks": bookmark_count,
                    "sessions": session_count,
                    "storage": storage_size,
                    "recent": [{"url": r[0], "date": r[1]} for r in recent],
                    "health": "excellent"
                }
    except Exception as e:
        print(f"[API] Analytics error: {e}")
        return {"error": str(e)}

@app.post("/admin/export")
async def export_endpoint(request: dict):
    """
    Export the entire knowledge base to a local JSON file.
    """
    from export_import import export_data
    # Default to home directory or a specific SnapMind folder
    default_path = os.path.expanduser("~/snapmind_export.json")
    target_path = request.get("path", default_path)
    return export_data(target_path)

@app.post("/admin/import")
async def import_endpoint(request: dict):
    """
    Import knowledge base from a local JSON file.
    """
    from export_import import import_data
    target_path = request.get("path")
    if not target_path or not os.path.exists(target_path):
        raise HTTPException(status_code=400, detail="Import file not found at specified path.")
    return import_data(target_path)

# --- Model moved to schemas.py ---

@app.post("/developer/reverse_engineer")
async def reverse_engineer_endpoint(request: ReverseEngineerRequest, req: Request):
    """
    Reverse-engineers a captured UI element into React + Tailwind code.
    """
    gemini_key = req.headers.get("x-gemini-key")
    if not gemini_key:
        return {"success": False, "error": "Gemini API key required for AI-to-Code synthesis."}
    
    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel(ModelRegistry.GEMINI_FLASH)
    
    system_prompt = """You are an elite Senior Frontend Engineer. Your task is to reverse-engineer a provided HTML snippet and its computed styles into a professional-grade React component.

GUIDELINES:
1. Use React (Functional Components, Hooks if needed).
2. Use Tailwind CSS for all styling.
3. Ensure the component is clean, semantic, and responsive.
4. Extract logical sub-components if the element is complex.
5. Use Lucide-React for icons if applicable.
6. Provide ONLY the code block, no conversational filler.
"""
    
    full_prompt = f"{system_prompt}\n\nTARGET HTML:\n{request.html}\n\nCOMPUTED STYLES:\n{str(request.styles)}\n\nUSER INSTRUCTION: {request.prompt}"
    
    try:
        response = model.generate_content(full_prompt)
        return {"success": True, "code": response.text}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/")
def read_root():
    return {"status": "ok", "service": "snapmind-rag"}

@app.post("/api/save_page")
async def save_page(data: SavePageRequest):
    """
    Analyzes and saves a web page to Supabase 'snapmind_saved_pages' table.
    Used by the browser extension.
    """
    try:
        import logging
        logger = logging.getLogger("uvicorn.error")
        
        if not data.text or len(data.text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Text too short or empty")

        logger.info(f"[EXTENSION] Analyzing content from {data.url}...")

        # 1. Analyze with Mistral
        system_prompt = """You are a highly capable content analyzer. Given text extracted from a webpage, return a perfectly formatted JSON object with these EXACT fields:
- "title": A concise, descriptive title (max 80 chars) defining the subject.
- "summary": A clear 2-3 sentence summary (max 250 chars) capturing the key insight.
- "keywords": Array of 3-5 specific topic keywords.
- "emotions": Array of 1-3 detected tones (e.g., "Informative", "Exciting", "Thoughtful", "Motivational").

Respond ONLY with valid JSON. No markdown ticks, no explanation."""

        # Truncate text if it's too huge (~8000 chars context)
        text_truncated = data.text[:8000]

        response = mistral_client.chat.complete(
            model="mistral-large-latest",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text_truncated}
            ],
            response_format={"type": "json_object"},
            temperature=0.3
        )

        raw_json = response.choices[0].message.content
        
        # 2. Parse Mistral output
        try:
            analysis = json.loads(raw_json)
        except json.JSONDecodeError:
            logger.error(f"[EXTENSION] Mistral return invalid JSON: {raw_json}")
            raise HTTPException(status_code=500, detail="Mistral AI returned invalid JSON.")

        # 3. Save to Supabase
        db_record = {
            "original_url": data.url,
            "title": analysis.get("title", "Untitled Content"),
            "summary": analysis.get("summary", "No summary generated."),
            "keywords": analysis.get("keywords", []),
            "emotions": analysis.get("emotions", []),
            "source_text": text_truncated,
            "folder_name": data.folder_name
        }

        logger.info("[EXTENSION] Saving to Supabase 'snapmind_saved_pages' table...")
        insert_response = supabase.table("snapmind_saved_pages").insert(db_record).execute()
        
        if not insert_response.data:
            logger.error(f"[EXTENSION] Supabase error: {insert_response}")
            raise HTTPException(status_code=500, detail="Failed to insert record into Supabase")

        return {"success": True, "data": insert_response.data[0]}

    except Exception as e:
        logger = logging.getLogger("uvicorn.error")
        logger.error(f"[EXTENSION] Error in save_page: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get_pages")
def get_pages():
    """
    Fetch all saved pages from Supabase.
    """
    try:
        # Fetch pages, order by created_at DESC
        result = supabase.table("snapmind_saved_pages").select("*").order("created_at", desc=True).execute()
        return {"success": True, "data": result.data}
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.error(f"[EXTENSION] Error fetching pages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/mcp/manifest")
def mcp_manifest():
    """Returns a manifest of available tools and resources for MCP integration."""
    return {
        "status": "ok",
        "mcp_version": "1.0.0",
        "tools": [
            {"name": "snapmind_search", "description": "Semantic RAG search"},
            {"name": "snapmind_chat", "description": "Conversational Q&A"},
            {"name": "snapmind_ingest_url", "description": "Index websites"},
            {"name": "snapmind_ingest_file", "description": "Index local files"},
            {"name": "snapmind_ingest_repo", "description": "Index GitHub repos"},
            {"name": "snapmind_web_research", "description": "Multi-agent research"},
            {"name": "snapmind_list_personas", "description": "Discover custom personas"},
            {"name": "snapmind_get_analytics", "description": "Library statistics"}
        ],
        "resources": [
            "snapmind://kb/stats",
            "snapmind://kb/tags"
        ]
    }

@app.get("/bridge/status")
def bridge_status():
    """Endpoint for Chrome Extension to verify it's connected to the local desktop app."""
    return {"status": "connected", "mode": "local", "features": ["files", "offline", "hybrid_llm"]}

@app.get("/debug/health")
def health_check_debug():
    """Detailed diagnostics for debugging."""
    import sys
    import os
    import pkgutil
    import importlib.metadata
    from typing import Any
    
    m_info: dict[str, Any] = {"status": "NOT FOUND"}
    try:
        import mistralai
        m_info["status"] = "Imported"
        m_info["file"] = getattr(mistralai, "__file__", "None (Namespace)")
        m_info["path"] = getattr(mistralai, "__path__", [])
        m_info["version"] = importlib.metadata.version("mistralai")
        m_info["submodules"] = [name for _, name, _ in pkgutil.iter_modules(m_info["path"])]
        m_info["dir_preview"] = dir(mistralai)[:20]
    except Exception as e:
        m_info["error"] = str(e)
    
    # Check for local shadows
    shadows = {
        "folder": "Yes" if os.path.exists("./mistralai") else "No",
        "file": "Yes" if os.path.exists("./mistralai.py") else "No"
    }

    return {
        "status": "ok", 
        "service": "Snapmind Backend",
        "diagnostics": {
            "python_version": sys.version,
            "mistralai": m_info,
            "local_shadows": shadows,
            "DATABASE_URL": "SET" if os.getenv("DATABASE_URL") else "MISSING"
        }
    }
# --- Model moved to schemas.py ---

@app.post("/browser/research")
async def research_endpoint(request: ResearchRequest, req: Request):
    """
    Multi-Agent Browser Mode Entry Point
    """
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
        "firecrawl": req.headers.get("x-firecrawl-key"),
        "groq": req.headers.get("x-groq-key"),
    }
    
    # [NEW] Phase 3: Desktop Local Browser Agent Fallback
    from config import LLMProviderConfig
    if LLMProviderConfig.PROVIDER in ["local", "hybrid"]:
        print("[main] Using LocalBrowserOrchestrator (Desktop Native)")
        from browser_agent_local import LocalBrowserOrchestrator
        orchestrator = LocalBrowserOrchestrator(
            api_keys=api_keys,
            session_id=request.session_id,
            output_lang=request.output_lang,
            query_notebook=request.query_notebook,
            image_data=request.image_data,
            visible=request.visible
        )
        result = await orchestrator.run(request.query)
    else:
        from browser_agents import BrowserOrchestrator
        orchestrator = BrowserOrchestrator(
            api_keys=api_keys, 
            session_id=request.session_id,
            output_lang=request.output_lang,
            query_notebook=request.query_notebook,
            image_data=request.image_data
        )
        # BrowserOrchestrator.run is synchronous
        result = orchestrator.run(request.query)
    
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
        
    return result

# --- Model moved to schemas.py ---

@app.post("/browser/generate_report")
async def generate_report_endpoint(request: ReportRequest, req: Request):
    """
    Generate and download a comprehensive research report.
    """
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"),
        "gemini": req.headers.get("x-gemini-key")
    }
    from report_generator import ReportGenerator
    generator = ReportGenerator(api_keys)
    
    file_path = generator.generate(request.session_id, request.query, source_urls=request.source_urls)
    
    from fastapi import Response, status
    if file_path == "INGESTION_PENDING":
        return JSONResponse(status_code=status.HTTP_202_ACCEPTED, content={"status": "pending", "message": "Research ingestion is still in progress. Please wait a moment and try again."})
        
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="Failed to generate report")
        
    from fastapi.responses import FileResponse
    return FileResponse(
        path=file_path,
        filename=f"SnapMind_Report_{request.session_id}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

@app.get("/api/ingest/status/{session_id}")
def get_session_ingest_status(session_id: str):
    from rag_pipeline import get_job_status
    return get_job_status(session_id)

@app.get("/api/jobs/stream/{session_id}")
async def stream_job_status(session_id: str):
    """SSE endpoint for real-time ingestion progress logs."""
    from fastapi.responses import StreamingResponse
    from rag_pipeline import subscribe_job_status
    return StreamingResponse(subscribe_job_status(session_id), media_type="text/event-stream")

@app.post("/ingest")
async def ingest_endpoint(request: IngestRequest, req: Request):
    """
    Ingests a URL (via Firecrawl) OR raw text (e.g. VLM output) into the RAG database.
    Supports both single-page and multi-page crawling.
    Processes synchronously so the frontend can display completion status.
    """
    try:
        print(f"Accepted ingestion request: {request.url} (mode: {request.crawl_mode})")
        
        # Validate URL
        if not request.url or not isinstance(request.url, str) or len(request.url.strip()) == 0:
            return {"success": False, "error": "Invalid or missing URL"}
        
        # Collect API keys from headers
        api_keys = {
            "gemini": req.headers.get("x-gemini-key"),
            "mistral": req.headers.get("x-mistral-key"),
            "lingodev": req.headers.get("x-lingodev-key"),
            "firecrawl": req.headers.get("x-firecrawl-key")
        }
        
        # Log API key status for debugging
        for key_name, key_value in api_keys.items():
            if key_value:
                print(f"[INGEST] ✓ {key_name} key provided")
            else:
                print(f"[INGEST] ✗ {key_name} key MISSING (env fallback will be used)")
        
        if request.stream:
            from fastapi.responses import StreamingResponse
            import threading
            
            async def event_generator():
                q = asyncio.Queue()
                loop = asyncio.get_running_loop()
                
                def yield_callback(status: str, message: str, progress: int = 0):
                    event = {"status": status, "message": message, "progress": progress}
                    try:
                        asyncio.run_coroutine_threadsafe(q.put(event), loop)
                    except RuntimeError:
                        pass
                
                result_container = {}
                def run_logic():
                    try:
                        if request.text_content:
                            from rag_pipeline import ingest_text_logic
                            res = ingest_text_logic(request.url, request.text_content, api_keys=api_keys, session_id=request.session_id, yield_callback=yield_callback)
                        elif request.crawl_mode == "multi":
                            from rag_pipeline import ingest_multipage_logic
                            res = ingest_multipage_logic(
                                request.url,
                                request.max_pages,
                                request.max_depth,
                                api_keys,
                                session_id=request.session_id,
                                yield_callback=yield_callback
                            )
                        else:
                            from rag_pipeline import ingest_website_logic
                            res = ingest_website_logic(request.url, api_keys, target_lang=request.target_lang, session_id=request.session_id, yield_callback=yield_callback)
                        result_container["result"] = res
                    except Exception as e:
                        result_container["error"] = str(e)
                    finally:
                        try:
                            asyncio.run_coroutine_threadsafe(q.put(None), loop)
                        except: pass
                
                thread = threading.Thread(target=run_logic, daemon=True)
                thread.start()
                
                while True:
                    item = await q.get()
                    if item is None:
                        break
                    yield json.dumps(item) + "\n"
                    
                if "error" in result_container:
                    yield json.dumps({"success": False, "error": result_container["error"]}) + "\n"
                else:
                    yield json.dumps(result_container.get("result", {})) + "\n"

            return StreamingResponse(event_generator(), media_type="application/x-ndjson")

        # Synchronous execution if streaming is not requested
        if request.text_content:
            # Direct ingestion
            from rag_pipeline import ingest_text_logic
            return ingest_text_logic(request.url, request.text_content, api_keys=api_keys, session_id=request.session_id)
        elif request.crawl_mode == "multi":
            # Multi-page crawling
            from rag_pipeline import ingest_multipage_logic
            return ingest_multipage_logic(
                request.url,
            request.max_pages,
            request.max_depth,
            api_keys,
            session_id=request.session_id
        )
        else:
            # Single-page crawling (default)
            from rag_pipeline import ingest_website_logic
            return ingest_website_logic(request.url, api_keys, target_lang=request.target_lang, session_id=request.session_id)
    
    except ValueError as ve:
        print(f"[INGEST] Validation error: {ve}")
        return {"success": False, "error": f"Validation error: {str(ve)}"}
    except Exception as e:
        print(f"[INGEST] FATAL ERROR in endpoint: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": f"Ingestion failed: {type(e).__name__}: {str(e)}"}

@app.post("/ingest/file")
async def ingest_file_endpoint(
    req: Request,
    file: UploadFile = File(...),
    site_url: str = Form(None),
    target_language: str = Form("auto"),
    session_id: str = Form(None)
):
    """
    Accepts locally uploaded files (PDF, DOCX, CSV, TXT, MP3, WAV, MP4), parses their content,
    translates them if requested, and ingests them into the RAG database.
    """
    file_bytes = await file.read()
    filename = file.filename
    content_type = file.content_type
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
        "groq": req.headers.get("x-groq-key"),
    }
    
    # Use provided site URL as the "source", or default to a fake file:// URL
    source_url = site_url if site_url else f"file://{filename}"
    
    print(f"Accepted file upload for processing: {filename} ({content_type}) -> Source: {source_url}, Target Lang: {target_language}")
    
    from rag_pipeline import ingest_file_logic
    result = ingest_file_logic(source_url, file_bytes, filename, content_type, target_lang=target_language, api_keys=api_keys, session_id=session_id)
    
    return result

@app.post("/api/deep-research")
async def deep_research_endpoint(req: Request):
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
    
    # 1. Plan the chain
    # We might pass a context hint if we have a current site open
    plan = planner.plan(query)
    
    # 2. Execute the chain
    result = executor.execute_chain(plan, query)
    
    return result

def is_github_repo_url(url: str) -> bool:
    """
    Validates if a URL points to a GitHub repository base.
    Rejects documentation, features, or specific file/blob/tree paths.
    """
    if not url or not isinstance(url, str):
        return False
        
    try:
        # Normalize: remove trailing slash and .git suffix
        clean_url = url.strip().rstrip('/')
        if clean_url.endswith('.git'):
            clean_url = clean_url[:-4]
            
        parsed = urlparse(clean_url)
        # Domain check
        if parsed.netloc.lower() not in ['github.com', 'www.github.com']:
            return False
            
        # Path check: /owner/repo
        path_parts = [p for p in parsed.path.split('/') if p]
        
        # Must have exactly 2 parts: owner and repo
        if len(path_parts) != 2:
            return False
            
        # Reject reserved keywords that aren't real owners/repos
        reserved = {
            'features', 'marketplace', 'pricing', 'explore', 'trending', 
            'docs', 'site-policy', 'organizations', 'settings', 'notifications'
        }
        if path_parts[0].lower() in reserved:
            return False
            
        return True
    except:
        return False

@app.post("/ingest/github")
def ingest_github_endpoint(request: RepoIngestRequest, req: Request, background_tasks: BackgroundTasks):
    """
    Ingest a full GitHub repository in the background.
    Returns a job_id that can be polled via GET /ingest/status/{job_id}.
    """
    # [FIX] Validate URL before starting background task
    if not is_github_repo_url(request.repo_url):
        print(f"[GITHUB_INGEST] Rejected invalid repository URL: {request.repo_url}")
        raise HTTPException(
            status_code=400, 
            detail="URL is not a valid GitHub repository. Please provide a base repository URL (e.g., https://github.com/user/repo)."
        )

    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
    }
    
    # Create a job row in the database for status tracking
    from database import get_db_pool
    job_id = None
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO ingestion_jobs (url, status, message) VALUES (%s, %s, %s) RETURNING job_id",
                    (request.repo_url, "processing", "Cloning and indexing repository...")
                )
                job_id = cur.fetchone()[0]
            conn.commit()
    except Exception as e:
        print(f"[GITHUB_INGEST] Warning: Could not create job row: {e}. Run database_migration_jobs.sql first.")
    
    from repo_ingester import ingest_repository
    background_tasks.add_task(ingest_repository, request.repo_url, request.target_lang, api_keys, job_id, request.session_id)
    
    return {
        "success": True, 
        "message": f"Started background ingestion for repository: {request.repo_url}",
        "job_id": job_id
    }


@app.get("/ingest/status/{job_id}")
def get_ingestion_status(job_id: int):
    """
    Poll the status of a background ingestion job.
    Returns: { status: 'processing' | 'completed' | 'failed', message, files_processed, chunks_count }
    """
    from database import get_db_pool
    from psycopg.rows import dict_row
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT status, message, files_processed, chunks_count FROM ingestion_jobs WHERE job_id = %s",
                    (job_id,)
                )
                row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"success": True, **row}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[INGEST_STATUS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
def chat_endpoint(request: ChatRequest, req: Request):
    """
    Chat with the RAG knowledge base OR current page content.
    """
    print(f"Chat query: {request.query} (Site ID: {request.site_id})")
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
    }
    
    # Pass page_content to logic if present
    answer = chat_logic(
        request.query, 
        request.page_content, 
        request.content_blocks, 
        request.site_id, 
        request.history, 
        request.session_id, 
        api_keys=api_keys,
        search_query=request.search_query,
        query_lang=request.query_lang,
        output_lang=request.output_lang,
        query_notebook=request.query_notebook
    )
    
    if "error" in answer:
        raise HTTPException(status_code=500, detail=answer["error"])
        
    return answer

@app.post("/translate")
def translate_endpoint(request: TranslateRequest, req: Request):
    """
    Translates text using the backend Lingo.dev proxy with Mistral fallback.
    """
    # Log incoming request for debugging translation invocation
    print(f"[TRANSLATE_ENDPOINT] Request received. target_lang={request.target_lang}, text_preview={request.text[:80] if request.text else ''}")
    print(f"[TRANSLATE_ENDPOINT] Headers present: x-gemini-key={'x-gemini-key' in req.headers}, x-mistral-key={'x-mistral-key' in req.headers}, x-lingodev-key={'x-lingodev-key' in req.headers}")

    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key")
    }
    from rag_pipeline import translate_text_lingo
    translated_text, original_lang, is_translated = translate_text_lingo(
        request.text, 
        request.target_lang, 
        api_keys
    )
    return {
        "translatedText": translated_text,
        "originalLang": original_lang,
        "isTranslated": is_translated
    }

# --- Custom Agent Personas ---

# --- Model moved to schemas.py ---

@app.get("/personas")
def get_personas_endpoint():
    try:
        from database import get_db_pool
        from psycopg.rows import dict_row
        pool = get_db_pool()
        if not pool: return {"success": False, "personas": []}
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, name, system_prompt_addon FROM personas ORDER BY created_at ASC")
                rows = cur.fetchall()
                for r in rows: r['id'] = str(r['id'])
        return {"success": True, "personas": rows}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/personas")
def create_persona_endpoint(request: PersonaRequest):
    try:
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO personas (name, system_prompt_addon) VALUES (%s, %s) RETURNING id",
                    (request.name, request.system_prompt_addon)
                )
                pid = cur.fetchone()[0]
                conn.commit()
        return {"success": True, "id": str(pid)}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/personas/{persona_id}")
def delete_persona_endpoint(persona_id: str):
    try:
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM personas WHERE id = %s", (persona_id,))
                conn.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest, req: Request):
    """
    Streaming Chat Endpoint. Returns NDJSON.
    """
    from fastapi.responses import StreamingResponse
    from search import chat_logic_stream
    
    # [NEW] Default to request.query if site_id is missing to avoid AttributeError
    s_id = getattr(request, 'site_id', None)
    print(f"Stream query: {request.query} (Site ID: {s_id})")
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
    }
    return StreamingResponse(
        chat_logic_stream(
            request.query, 
            request.page_content, 
            request.content_blocks, 
            s_id, 
            request.history, 
            request.session_id, 
            api_keys=api_keys,
            output_lang=request.output_lang
        ),
        media_type="application/x-ndjson"
    )

@app.post("/chat/suggest")
async def chat_suggest_endpoint(request: SuggestRequest, req: Request):
    """
    Generates 3 contextual suggestions for the user to ask based on the current page.
    """
    from search import get_chat_suggestions
    
    api_keys = {
        "mistral": req.headers.get("x-mistral-key"),
        "gemini": req.headers.get("x-gemini-key")
    }
    
    res = get_chat_suggestions(request.page_content, request.url, request.site_id, api_keys)
    return res
# --- Model moved to schemas.py ---

@app.post("/search/global")
def global_search_endpoint(request: GlobalSearchRequest, req: Request):
    """
    Performs a semantic search across all knowledge domains (documents, bookmarks, sessions).
    """
    from search import search_global
    try:
        api_keys = {
            "gemini": req.headers.get("x-gemini-key"),
            "mistral": req.headers.get("x-mistral-key"),
            "lingodev": req.headers.get("x-lingodev-key"),
        }
        results = search_global(request.query, limit=request.limit, api_keys=api_keys)
        return {"success": True, "results": results}
    except Exception as e:
        print(f"Error in global search: {e}")
        return {"success": False, "results": [], "error": str(e)}

@app.get("/tags")
def get_tags_endpoint():
    """
    Retrieve all unique semantic tags currently stored in the database.
    """
    from search import get_all_tags
    try:
        tags = get_all_tags(limit=100)
        return {"success": True, "tags": tags}
    except Exception as e:
        print(f"Error fetching tags: {e}")
        return {"success": False, "tags": [], "error": str(e)}

# --- Model moved to schemas.py ---

@app.post("/analyze-image")
def analyze_image_endpoint(request: AnalyzeImageRequest, req: Request):
    """
    Analyzes an image using Vision model.
    """
    from vision import analyze_image_logic
    import base64

    # Decode base64
    try:
        # Check if header exists (data:image/jpeg;base64,)
        if "," in request.image_data:
            image_data = request.image_data.split(",")[1]
        else:
            image_data = request.image_data
            
        image_bytes = base64.b64decode(image_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

    print(f"Analyze request: {request.prompt} (Mode: {request.mode})")
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
    }
    
    result = analyze_image_logic(image_bytes, request.prompt, request.mode, api_keys=api_keys, target_lang=request.target_lang)
    
    if not result.get("success", False):
        error_detail = result.get("error") or result.get("answer") or "Unknown vision error"
        raise HTTPException(status_code=500, detail=error_detail)
        
    return result

# --- Phase 19: Citation Bookmarking APIs ---

@app.post("/bookmarks")
def create_bookmark_endpoint(request: BookmarkRequest, req: Request):
    """Saves a research snippet as a bookmark with semantic search support."""
    from database import get_db_pool
    from rag_pipeline import embed_single_chunk
    import json
    try:
        api_keys = {
            "gemini": req.headers.get("x-gemini-key"),
            "mistral": req.headers.get("x-mistral-key"),
        }
        
        # [NEW] Generate semantic embedding for the snippet
        _, embedding = embed_single_chunk(request.content, api_keys=api_keys)
        
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO bookmarks (content, source_url, metadata, embedding) VALUES (%s, %s, %s, %s::halfvec) RETURNING id",
                    (request.content, request.source_url, json.dumps(request.metadata or {}), embedding)
                )
                bookmark_id = cur.fetchone()[0]
                conn.commit()
        return {"success": True, "id": bookmark_id}
    except Exception as e:
        print(f"Error creating bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/bookmarks")
def get_bookmarks_endpoint():
    """Retrieves all saved bookmarks."""
    from database import get_db_pool
    from psycopg.rows import dict_row
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            # We use dict_row to return JSON-friendly dictionaries
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, content, source_url, metadata, created_at FROM bookmarks ORDER BY created_at DESC")
                bookmarks = cur.fetchall()
                # Convert datetime to string for JSON serialization
                for b in bookmarks:
                    if b.get('created_at'):
                        b['created_at'] = b['created_at'].isoformat()
        return {"success": True, "bookmarks": bookmarks}
    except Exception as e:
        print(f"Error fetching bookmarks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/bookmarks/{bookmark_id}")
def delete_bookmark_endpoint(bookmark_id: int):
    """Deletes a specific bookmark."""
    from database import get_db_pool
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM bookmarks WHERE id = %s", (bookmark_id,))
                conn.commit()
        return {"success": True}
    except Exception as e:
        print(f"Error deleting bookmark: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Phase 3: Site Management APIs (Using source_url) ---

@app.get("/sites")
def list_sites():
    """Returns list of indexed sites from unique source URLs."""
    try:
        from database import get_db_pool
        from psycopg.rows import dict_row
        db_pool = get_db_pool()
        
        # Get unique URLs with their latest timestamp
        # Query documents grouped by source_url with max created_at
        url_map = {}
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT source_url, MAX(created_at) as created_at, MAX(metadata->>'original_lang') as original_lang, MAX(metadata->>'translated') as translated FROM documents WHERE source_url IS NOT NULL GROUP BY source_url ORDER BY 2 DESC")
                for doc in cur.fetchall():
                    url = doc.get('source_url')
                    if url:
                        url_map[url] = {
                            'url': url,
                            'created_at': str(doc.get('created_at')),
                            'original_lang': doc.get('original_lang'),
                            'translated': str(doc.get('translated')).lower() == 'true'
                        }
        
        # Transform to match frontend expectations
        sites = []
        for url, data in url_map.items():
            sites.append({
                "id": url,  # Use URL as ID
                "url": url,
                "title": url,  # Could extract domain name if needed
                "last_updated_at": data['created_at'],
                "original_lang": data.get('original_lang'),
                "translated": data.get('translated', False)
            })
        
        # Sort by most recent first
        sites.sort(key=lambda x: x['last_updated_at'], reverse=True)
        
        return {"success": True, "sites": sites}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/files/ingest")
async def ingest_local_file(request: Request):
    """
    Endpoint for the desktop app to push local file content for RAG indexing.
    Includes MD5 hash check to avoid re-indexing unchanged files.
    """
    try:
        data = await request.json()
        path = data.get("path")
        content = data.get("content")
        file_hash = data.get("hash")
        api_keys = data.get("api_keys", {})

        if not path or not content:
            raise HTTPException(status_code=400, detail="Missing path or content")

        # 1. Check if file has changed
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT last_hash FROM indexed_files WHERE path = %s", (path,))
                row = cur.fetchone()
                if row and row[0] == file_hash:
                    return {"success": True, "status": "skipped", "message": "File unchanged"}

        # 2. Ingest text logic (reuse the existing RAG pipeline)
        from rag_pipeline import ingest_text_logic
        res = ingest_text_logic(
            url=f"file://{path}", 
            text_content=content, 
            api_keys=api_keys,
            page_title=os.path.basename(path)
        )

        if res.get("success"):
            # 3. Update indexed_files record
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO indexed_files (path, last_hash, status) 
                        VALUES (%s, %s, 'indexed')
                        ON CONFLICT (path) DO UPDATE SET 
                            last_hash = EXCLUDED.last_hash,
                            last_indexed = CURRENT_TIMESTAMP
                    """, (path, file_hash))
                conn.commit()

        return res

    except Exception as e:
        print(f"[FILE-INGEST] Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/settings")
def get_all_settings():
    """Retrieves all persisted application settings."""
    from database import get_db_pool
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT key, value FROM settings")
                rows = cur.fetchall()
                # Return as a dictionary of key: value
                return {row[0]: row[1] for row in rows}
    except Exception as e:
        print(f"Error fetching settings: {e}")
        return {}

@app.post("/admin/settings")
async def update_setting(request: dict):
    """Updates a specific setting. Expects {key: string, value: any}."""
    from database import get_db_pool
    key = request.get("key")
    value = request.get("value")
    if not key: raise HTTPException(status_code=400, detail="Key is required")
    
    try:
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                    (key, json.dumps(value))
                )
                conn.commit()
        return {"success": True, "key": key, "value": value}
    except Exception as e:
        print(f"Error updating setting {key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# --- Export Endpoints (Phase 4.1) ---

@app.get("/export/{source_url:path}")
def export_site(source_url: str, format: str = "json"):
    """
    Export all indexed content for a given source URL.
    
    Args:
        source_url: URL to export (path parameter)
        format: Export format - 'json' or 'text' (query parameter)
    """
    try:
        from export import export_site_json, export_site_text
        from urllib.parse import unquote
        from fastapi.responses import JSONResponse, PlainTextResponse
        
        # Decode URL
        decoded_url = unquote(source_url)
        
        if format == "text":
            content = export_site_text(decoded_url)
            return PlainTextResponse(
                content=content,
                headers={
                    "Content-Disposition": f'attachment; filename="export_{decoded_url.replace("://", "_").replace("/", "_")}.txt"'
                }
            )
        else:  # json
            data = export_site_json(decoded_url)
            return JSONResponse(
                content=data,
                headers={
                    "Content-Disposition": f'attachment; filename="export_{decoded_url.replace("://", "_").replace("/", "_")}.json"'
                }
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Debug Endpoint ---

@app.get("/graph/sessions")
async def get_graph_sessions():
    """Returns a list of chat sessions that have associated graph data."""
    try:
        from psycopg.rows import dict_row
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Select distinct sessions and join with chat_sessions to get the first message as title
                cur.execute("""
                    SELECT e.session_id, 
                           (SELECT content FROM chat_messages WHERE session_id = e.session_id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as title,
                           COUNT(e.id) as edge_count,
                           (SELECT COUNT(DISTINCT nid) FROM (SELECT source_node_id as nid FROM edges WHERE session_id = e.session_id UNION SELECT target_node_id as nid FROM edges WHERE session_id = e.session_id) as n) as node_count
                    FROM edges e
                    WHERE e.session_id IS NOT NULL
                    GROUP BY e.session_id
                    ORDER BY e.session_id DESC
                """)
                return cur.fetchall()
    except Exception as e:
        print(f"[GRAPH API] Error fetching sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph/session/{session_id}")
async def get_session_graph(session_id: str):
    """Returns nodes and edges filtered by session_id."""
    try:
        from psycopg.rows import dict_row
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Get Edges for this session
                cur.execute("""
                    SELECT e.source_node_id, e.target_node_id, e.relation, n1.name as source_name, n2.name as target_name, n1.entity_type as source_type, n2.entity_type as target_type
                    FROM edges e
                    JOIN nodes n1 ON e.source_node_id = n1.id
                    JOIN nodes n2 ON e.target_node_id = n2.id
                    WHERE e.session_id = %s
                """, (session_id,))
                edges = cur.fetchall()
                
                # Format for Cytoscape (frontend expectation)
                cy_nodes = {}
                cy_edges = []
                
                for row in edges:
                    # Source Node
                    if row["source_node_id"] not in cy_nodes:
                        cy_nodes[row["source_node_id"]] = {
                            "data": {
                                "id": str(row["source_node_id"]),
                                "label": row["source_name"],
                                "type": row["source_type"]
                            }
                        }
                    
                    # Target Node
                    if row["target_node_id"] not in cy_nodes:
                        cy_nodes[row["target_node_id"]] = {
                            "data": {
                                "id": str(row["target_node_id"]),
                                "label": row["target_name"],
                                "type": row["target_type"]
                            }
                        }
                    
                    # Edge
                    cy_edges.append({
                        "data": {
                            "source": str(row["source_node_id"]),
                            "target": str(row["target_node_id"]),
                            "label": row["relation"]
                        }
                    })
                
                return {
                    "success": True,
                    "nodes": list(cy_nodes.values()),
                    "edges": cy_edges
                }
    except Exception as e:
        print(f"[GRAPH API] Error fetching session graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/graph/data")
def get_graph_data():
    """
    Returns the full knowledge graph (nodes and edges) for visualization.
    """
    try:
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Fetch nodes
                cur.execute("SELECT id, name, entity_type, metadata FROM nodes")
                nodes = [{"id": r[0], "name": r[1], "type": r[2], "metadata": r[3]} for r in cur.fetchall()]
                
                # Fetch edges
                cur.execute("SELECT id, source_node_id, target_node_id, relation, source_url FROM edges")
                edges = [{"id": r[0], "source": r[1], "target": r[2], "relation": r[3], "source_url": r[4]} for r in cur.fetchall()]
                
        return {"success": True, "nodes": nodes, "edges": edges}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/urls")
def debug_list_urls():
    """Debug: List all unique source URLs in the database."""
    try:
        from database import get_db_pool
        db_pool = get_db_pool()
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT source_url FROM documents WHERE source_url IS NOT NULL")
                urls = [row[0] for row in cur.fetchall()]
        return {"success": True, "urls": urls, "count": len(urls)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# API to temporarily hold screenshots for cross-platform visual search
from collections import OrderedDict
import uuid

vision_cache = OrderedDict()

@app.post("/api/vision/cache")
async def cache_vision_image(request: Request):
    data = await request.json()
    cache_id = str(uuid.uuid4())
    vision_cache[cache_id] = data.get("image", "")
    # Strict FIFO cleanup to prevent memory leak
    while len(vision_cache) > 50:
        vision_cache.popitem(last=False)
    return {"cache_id": cache_id}

@app.get("/api/vision/cache/{cache_id}")
async def get_vision_image(cache_id: str):
    if cache_id in vision_cache:
        img = vision_cache[cache_id]
        return {"image": img}
    return {"error": "Not found"}

if __name__ == "__main__":
    # Local development uses port 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

# --- Widget Endpoints (Phase 28) ---

@app.post("/widget/ingest")
async def widget_ingest(request: WidgetIngestRequest, req: Request):
    """
    Multipage ingestion for website chatbot widgets.
    """
    # Collect API keys (Header prioritized, Body as fallback)
    gemini_key = req.headers.get("x-gemini-key") or request.api_key
    mistral_key = req.headers.get("x-mistral-key")
    firecrawl_key = req.headers.get("x-firecrawl-key")
    
    # Exhaustive Debug Logging
    print(f"[WIDGET-INGEST] Request headers: {dict(req.headers)}")
    if gemini_key: print(f"[WIDGET-INGEST] Gemini key detected (Source: {'Header' if req.headers.get('x-gemini-key') else 'Body'}).")
    else: print(f"[WIDGET-INGEST] WARNING: No Gemini key found in headers or body.")

    api_keys = {
        "gemini": gemini_key,
        "mistral": mistral_key,
        "firecrawl": firecrawl_key
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

@app.post("/widget/chat")
async def widget_chat(request: WidgetChatRequest, req: Request):
    """
    Chat endpoint for website chatbot widgets.
    """
    # Collect API keys (Header prioritized, Body as fallback)
    gemini_key = req.headers.get("x-gemini-key") or request.api_key
    mistral_key = req.headers.get("x-mistral-key")
    
    # Exhaustive Debug Logging
    print(f"[WIDGET-CHAT] Request headers: {dict(req.headers)}")
    if gemini_key: print(f"[WIDGET-CHAT] Gemini key detected for session {request.session_id} (Source: {'Header' if req.headers.get('x-gemini-key') else 'Body'}).")
    else: print(f"[WIDGET-CHAT] WARNING: No Gemini key found in headers or body for session {request.session_id}. Falling back to server key.")

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
