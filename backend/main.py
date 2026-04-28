import os
import time
import uuid
import httpx
import sys

import asyncio
# [FIX] Windows Asyncio Subprocess Support
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Feature Imports
from config import settings
from database import get_db_pool

# 1. Structured Logging Configuration
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger()

# 2. Rate Limiting Setup
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.rate_limit_per_minute}/minute"])

# 3. Background Keep-Alive (Self-Ping)
async def server_ping_loop():
    """Keeps the server from going dormant on Railway/Render free tiers."""
    # Wait a bit for startup to finish
    await asyncio.sleep(60)
    
    url = f"{settings.server_url}/api/v1/health"
    logger.info("Starting self-ping keep-alive loop", interval="5m", target=url)
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            try:
                await asyncio.sleep(300) # 5 minutes
                response = await client.get(url)
                logger.info("Self-ping successful", status=response.status_code)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Self-ping failed", error=str(e))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("SnapMind Backend Starting", version="2.0.0-production")
    
    # Initialize DB pool
    get_db_pool()
    
    # Start Keep-Alive Loop in background
    ping_task = asyncio.create_task(server_ping_loop())
    
    yield
    
    # Shutdown
    logger.info("SnapMind Backend Shutting Down")
    ping_task.cancel()
    try:
        # We wait briefly for the task to acknowledge the cancellation
        await asyncio.wait_for(ping_task, timeout=2.0)
    except (asyncio.CancelledError, Exception):
        # CancelledError is expected here as we just called ping_task.cancel()
        pass
    
    pool = get_db_pool()
    if pool:
        pool.close()

app = FastAPI(
    title="SnapMind RAG API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# 4. Rate Limit Handlers
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 5. Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = str(uuid.uuid4())
    logger.error("Unhandled Exception", error_id=error_id, error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error_id": error_id,
            "message": "An unexpected error occurred. Please contact support with the error ID."
        }
    )

# 6. Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def production_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    # Bind request identity to logging
    structlog.contextvars.bind_contextvars(request_id=request_id, client_ip=request.client.host)
    
    # Enforce request size limit (50MB)
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 50 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"detail": "Content too large"})
    
    response: Response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    
    return response

# 7. Health & Readiness Endpoints
@app.get("/api/v1/health")
@limiter.exempt 
async def health_check():
    """Liveness probe."""
    return {"status": "healthy", "timestamp": time.time(), "service": "snapmind-rag"}

@app.get("/api/v1/ready")
@limiter.exempt
async def readiness_check():
    """Readiness probe: check DB connection."""
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={"status": "not_ready", "reason": "db_connection_failed"})
    return {"status": "ready"}

# 8. Feature Routers
from api.v1.endpoints import (
    ingest, search, bookmarks, workspaces, 
    graph, research, saved_pages, tags,
    translate, vision, widget, sites,
    personas, export, admin, status
)

app.include_router(status.router, prefix="/api/v1/status", tags=["System Health"])
app.include_router(ingest.router, prefix="/api/v1/ingest", tags=["Ingestion"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search & Chat"])
app.include_router(bookmarks.router, prefix="/api/v1/bookmarks", tags=["Research"])
app.include_router(workspaces.router, prefix="/api/v1/workspaces", tags=["Workspace"])
app.include_router(graph.router, prefix="/api/v1/graph", tags=["Knowledge Graph"])
app.include_router(research.router, prefix="/api/v1/research", tags=["Deep Research"])
app.include_router(saved_pages.router, prefix="/api/v1/saved-pages", tags=["Personal Data"])
app.include_router(tags.router, prefix="/api/v1/tags", tags=["Organization"])
app.include_router(translate.router, prefix="/api/v1/translate", tags=["Linguistics"])
app.include_router(vision.router, prefix="/api/v1/vision", tags=["Vision Analysis"])
app.include_router(widget.router, prefix="/api/v1/widget", tags=["Embeddables"])
app.include_router(sites.router, prefix="/api/v1/sites", tags=["Site Management"])
app.include_router(personas.router, prefix="/api/v1/personas", tags=["Agent Personas"])
app.include_router(export.router, prefix="/api/v1/export", tags=["Data Export"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Administration"])

# Legacy Compatibility Routes
@app.post("/ingest")
@limiter.limit("5/minute")
async def legacy_ingest_endpoint(request: Request, background_tasks: BackgroundTasks):
    # This avoids breaking old extensions while we migrate them
    from security import get_user_id
    try:
        user_id = await get_user_id(request) # This logic might need tweak depending on security.py
        return await ingest.legacy_ingest_wrapper(request, background_tasks, user_id)
    except Exception:
        return await ingest.legacy_ingest_wrapper(request, background_tasks, "anonymous")

@app.get("/")
def read_root():
    return {"status": "SnapMind Backend Active", "version": "2.0.0", "docs": "/api/docs"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
