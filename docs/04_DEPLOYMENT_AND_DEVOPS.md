# 🚀 SnapMind — Deployment Tricks, DevOps & Production Patterns

> **Prepared for**: TCS NQT Interview Preparation  
> **Focus**: Docker, CI/CD, Edge Proxy, Zero-Cost Hosting, Database Migrations  
> **Key Concepts**: Containerization, Reverse Proxy, Secrets Management, Health Checks

---

## 1. The Zero-Cost Production Stack

SnapMind runs a **full production backend** without paying a single rupee. Here's how:

| Component | Service | Cost | Why This One? |
|:---|:---|:---|:---|
| **Backend Server** | HuggingFace Spaces (Docker) | ₹0 | Free Docker hosting with GPU option |
| **Database** | Supabase Free Tier | ₹0 | PostgreSQL + pgvector + Auth |
| **Edge Proxy** | Cloudflare Workers | ₹0 | 100K free requests/day, global CDN |
| **CI/CD** | GitHub Actions | ₹0 | Auto-deploy on push |
| **Keep-Alive** | Cron-job.org | ₹0 | Prevents free tier sleep |
| **Monitoring** | Structured Logs (structlog) | ₹0 | JSON logs for debugging |

**Interview Q: How do you deploy a full-stack AI application for free?**
> Use a combination of free tiers: HuggingFace for compute, Supabase for DB, Cloudflare for edge routing. The key trick is a Cloudflare Worker that injects authentication headers, allowing a private backend but public API endpoint.

---

## 2. Docker — Containerization

### The Dockerfile

```dockerfile
# Use slim Python image (smaller = faster builds)
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Working directory
WORKDIR /app

# Install system dependencies FIRST (cached layer)
RUN apt-get update && apt-get install -y \
    gcc libpq-dev git curl \
    # Playwright dependencies for browser automation
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps (cached if requirements.txt unchanged)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser
RUN python -m playwright install chromium --with-deps

# Copy application code LAST (changes most often)
COPY . .

# Make startup script executable
RUN chmod +x /app/start.sh

EXPOSE 10000

# Entry point: run migrations, then start server
CMD ["/app/start.sh"]
```

### Docker Layer Caching — The Performance Trick

```
Layer 1: FROM python:3.11-slim            ← Cached (rarely changes)
Layer 2: apt-get install gcc libpq-dev    ← Cached (rarely changes)
Layer 3: pip install -r requirements.txt  ← Cached until deps change
Layer 4: playwright install chromium      ← Cached (rarely changes)
Layer 5: COPY . .                         ← ALWAYS rebuilds (code changes)
```

**Interview Q: Why install dependencies before copying code?**
> Docker caches each layer. If `requirements.txt` hasn't changed, Docker reuses the cached pip install layer (~2 min saved). Only the final `COPY . .` layer rebuilds on code changes (~5 seconds).

### The Startup Script (`start.sh`)

```bash
#!/bin/bash
set -e  # Exit immediately on any error

APP_PORT=${PORT:-7860}  # Use PORT env var (HF sets this) or default 7860

# Run database migrations
if [ -f "alembic.ini" ]; then
    alembic -c alembic.ini upgrade head
else
    echo "[WARNING] alembic.ini not found. Skipping migrations."
fi

# Start the server
exec uvicorn main:app --host 0.0.0.0 --port $APP_PORT --workers 1
```

**Interview Q: Why `exec uvicorn` instead of just `uvicorn`?**
> `exec` replaces the shell process with uvicorn, so uvicorn becomes PID 1. This is critical for Docker because:
> 1. Docker sends SIGTERM to PID 1 for graceful shutdown
> 2. Without `exec`, the shell is PID 1 and doesn't forward signals
> 3. Result: Container takes 10s to force-kill instead of graceful shutdown

---

## 3. Database Migrations with Alembic

### What is Alembic?

Alembic is a database migration tool for Python. It tracks schema changes as versioned "migration" files.

```
alembic/
├── versions/
│   ├── 001_create_documents_table.py
│   ├── 002_add_bookmarks_table.py
│   ├── 003_add_chat_sessions.py
│   └── 004_add_nodes_edges.py
├── env.py           # Migration environment config
└── alembic.ini      # Connection string, logging
```

### Migration Flow

```bash
# Generate a new migration from model changes
alembic revision --autogenerate -m "add credibility column"

# Apply all pending migrations (run on startup)
alembic upgrade head

# Rollback last migration
alembic downgrade -1
```

**Interview Q: Why use migrations instead of raw SQL?**
> 1. **Version control**: Each schema change is a tracked file in Git
> 2. **Reproducibility**: Any developer can recreate the exact DB state
> 3. **Rollback**: Can undo changes with `downgrade`
> 4. **CI/CD**: Migrations run automatically on deployment (`start.sh`)

---

## 4. Cloudflare Worker — The Edge Proxy Pattern

### The Problem

```
Chrome Extension → HuggingFace Private Space
                        ↓
                   403 FORBIDDEN
                   (requires HF Token in Authorization header)
```

You can't put the HF Token in the extension code (users can read it). You can't put it in environment variables (extensions don't have server-side env vars).

### The Solution — Cloudflare Worker as Reverse Proxy

```
Extension → Cloudflare Worker (adds HF_TOKEN) → HuggingFace Private Space
```

```javascript
export default {
  async fetch(request, env) {
    const TARGET_BASE = "https://your-space.hf.space";
    const targetUrl = new URL(request.url.pathname, TARGET_BASE);
    
    const headers = new Headers(request.headers);
    
    // TRICK 1: Preserve Supabase JWT before overwriting Authorization
    const originalAuth = request.headers.get("Authorization");
    if (originalAuth && !originalAuth.startsWith("Bearer hf_")) {
      headers.set("x-supabase-auth", originalAuth.split(" ")[1]);
    }
    
    // TRICK 2: Inject HF Token (stored as encrypted env variable)
    headers.set("Authorization", `Bearer ${env.HF_TOKEN}`);
    
    // TRICK 3: Add CORS headers for extension
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-key...",
    };
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.body
    });
    
    return new Response(response.body, {
      ...response,
      headers: { ...response.headers, ...corsHeaders }
    });
  }
};
```

### The Header Preservation Trick

```
Request from Extension:
  Authorization: Bearer eyJhbG...  (Supabase JWT)
  x-gemini-key: AIza...

Cloudflare Worker transforms:
  Authorization: Bearer hf_...     (HF Token, injected)
  x-supabase-auth: eyJhbG...      (JWT moved to custom header)
  x-gemini-key: AIza...            (passed through unchanged)

Backend receives:
  → Uses x-supabase-auth for user identification
  → HF uses Authorization for space access
  → x-gemini-key used for LLM calls
```

**Interview Q: What is a reverse proxy and why use one?**
> A reverse proxy sits between the client and server. It receives requests from clients, forwards them to the server, and returns the response. Benefits:
> 1. **Security**: Hide internal server URLs, inject auth tokens server-side
> 2. **CORS**: Add cross-origin headers at the edge
> 3. **Caching**: Cache responses at edge locations (CDN)
> 4. **Load balancing**: Distribute traffic across multiple backends

---

## 5. Health Checks & Readiness Probes

### Liveness Probe

```python
@app.get("/api/v1/health")
@limiter.exempt  # Don't rate-limit health checks
async def health_check():
    """Liveness probe — is the process running?"""
    return {"status": "healthy", "timestamp": time.time(), "service": "snapmind-rag"}
```

### Readiness Probe

```python
@app.get("/api/v1/ready")
@limiter.exempt
async def readiness_check():
    """Readiness probe — can the app serve requests?"""
    pool = get_db_pool()
    if not pool:
        return JSONResponse(status_code=503, content={
            "status": "not_ready", 
            "reason": "db_connection_failed"
        })
    return {"status": "ready"}
```

**Interview Q: What's the difference between liveness and readiness probes?**
> - **Liveness**: "Is the process alive?" → Returns 200 if the server is running. Used by container orchestrators to restart crashed containers.
> - **Readiness**: "Can it handle requests?" → Checks dependencies (DB, cache). Returns 503 if not ready. Used by load balancers to stop routing traffic to unready instances.

---

## 6. Structured Logging with structlog

```python
import structlog

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,  # Add request context
        structlog.processors.add_log_level,       # INFO, ERROR, etc.
        structlog.processors.TimeStamper(fmt="iso"),  # ISO timestamps
        structlog.processors.JSONRenderer(),       # Output as JSON
    ],
)

logger = structlog.get_logger()

# Usage in middleware:
structlog.contextvars.bind_contextvars(
    request_id=request_id,
    client_ip=request.client.host
)

# Log output (structured JSON):
# {"request_id": "abc-123", "client_ip": "1.2.3.4", "level": "info", 
#  "event": "Self-ping successful", "status": 200, "timestamp": "2024-01-01T12:00:00Z"}
```

**Interview Q: Why JSON logs over plain text logs?**
> 1. **Machine-parseable**: Can be ingested by ELK Stack, Datadog, CloudWatch
> 2. **Searchable**: Filter by `request_id`, `client_ip`, `level`
> 3. **Context propagation**: `contextvars` automatically adds request_id to all logs within a request
> 4. **No regex needed**: Unlike `"[2024-01-01] INFO: User 123 searched for 'RAG'"`, JSON fields are directly queryable

---

## 7. CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,  # ["http://localhost:5173", ...]
    allow_credentials=True,
    allow_methods=["*"],     # GET, POST, PUT, DELETE, OPTIONS
    allow_headers=["*"],     # All custom headers (x-gemini-key, etc.)
)
```

**Interview Q: What is CORS and why does it matter for a Chrome Extension?**
> CORS (Cross-Origin Resource Sharing) is a browser security policy. A Chrome Extension's content script runs on `https://example.com` but needs to call `https://your-api.hf.space`. Without CORS headers, the browser blocks the request. The server must respond with `Access-Control-Allow-Origin` to permit cross-origin calls.

---

## 8. Rate Limiting with SlowAPI

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

# Global rate limiter keyed by client IP
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["5/minute"]
)

# Per-endpoint limits
@app.post("/ingest")
@limiter.limit("5/minute")  # Max 5 ingestion requests per minute per IP
async def ingest(request: Request):
    pass

@app.post("/chat/stream")
@limiter.limit("10/minute")  # More generous for chat
async def chat_stream(request: Request):
    pass

# Exempt health checks from rate limiting
@app.get("/api/v1/health")
@limiter.exempt
async def health():
    pass
```

**Interview Q: What happens when a user hits the rate limit?**
> SlowAPI returns HTTP `429 Too Many Requests` with a `Retry-After` header indicating when the user can try again. This protects:
> 1. The server from resource exhaustion
> 2. LLM API quotas from being burned by one user
> 3. The database from connection saturation

---

## 9. Global Exception Handler — Error Tracking

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = str(uuid.uuid4())
    logger.error("Unhandled Exception", 
                 error_id=error_id, 
                 error=str(exc), 
                 path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error_id": error_id,
            "message": "Contact support with this error ID."
        }
    )
```

**Why error_id?**
> 1. User sees: "Error ID: abc-123-def"
> 2. Developer searches logs: `grep "abc-123-def" logs.json`
> 3. Finds exact stack trace, request path, client IP
> 4. **Never expose internal errors to users** (security risk — reveals file paths, DB structure)

---

## 10. MCP Server Deployment (Smithery)

```yaml
# smithery.yaml — MCP Server configuration
registry: https://smithery.ai
name: snapmind-mcp
version: 2.0.0
description: "18+ tools for semantic search, research, knowledge graph..."

install:
  - cd mcp-server && pip install -e .

run:
  - snapmind-mcp

configSchema:
  properties:
    SNAPMIND_BACKEND_URL:
      type: string
      default: https://snapmind-gateway.roshankumar30080.workers.dev
    GEMINI_API_KEY:
      type: string
      description: "(Optional) Gemini API Key"
```

**Interview Q: What is MCP and why publish to Smithery?**
> MCP (Model Context Protocol) is Anthropic's open standard for AI tool integration. Publishing to Smithery means any AI agent (Claude Desktop, Cursor, etc.) can install `snapmind-mcp` and use SnapMind's 18 tools (search, research, translate, etc.) directly from their AI chat.

---

## 11. Windows Asyncio Fix — Platform Compatibility

```python
import sys
import asyncio

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
```

**Interview Q: Why is this needed?**
> Windows uses the `SelectorEventLoop` by default, which doesn't support subprocess management (needed for `yt-dlp` and `git clone`). `ProactorEventLoop` uses Windows' IOCP (I/O Completion Ports) for proper async subprocess support.

---

## 12. Production Middleware — Request Tracking

```python
@app.middleware("http")
async def production_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    # Bind request context to all logs
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        client_ip=request.client.host
    )
    
    # Enforce 50MB request size limit
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 50 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"detail": "Content too large"})
    
    response = await call_next(request)
    
    # Add performance + security headers
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    
    return response
```

**What each header does:**

| Header | Purpose |
|:---|:---|
| `X-Process-Time` | Performance monitoring (how long the request took) |
| `X-Request-ID` | Correlate client errors with server logs |
| `X-Content-Type-Options: nosniff` | Prevent browser from guessing MIME types (XSS prevention) |
| `X-Frame-Options: DENY` | Prevent the page from being embedded in an iframe (clickjacking) |

---

## 13. Interview Quick-Fire — DevOps

| Question | Answer |
|:---|:---|
| **What is Docker?** | Containerization platform that packages app + dependencies into an isolated image |
| **What is a Dockerfile?** | Blueprint for building a Docker image (instructions: FROM, COPY, RUN, CMD) |
| **What is ASGI?** | Asynchronous Server Gateway Interface — Python's async web standard (uvicorn implements it) |
| **Why uvicorn over gunicorn?** | Uvicorn is async-native (ASGI). Gunicorn is WSGI (sync). FastAPI needs ASGI |
| **What is a health check?** | Endpoint that returns 200 if the service is alive, used by orchestrators for monitoring |
| **What is CI/CD?** | Continuous Integration / Continuous Deployment — automate testing and deployment on code push |
| **What is an edge proxy?** | Server at the network edge (close to users) that handles routing, auth, caching |
| **What is TLS/SSL?** | Transport Layer Security — encrypts HTTP traffic (HTTPS). Cloudflare provides free certs |
| **What is a migration?** | Versioned database schema change tracked in code (Alembic generates these) |
| **What is IOCP?** | I/O Completion Ports — Windows' async I/O mechanism used by ProactorEventLoop |
