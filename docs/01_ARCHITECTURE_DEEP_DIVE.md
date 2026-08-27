# 📐 SnapMind — System Architecture Deep Dive

> **Prepared for**: TCS NQT Interview Preparation  
> **Project**: SnapMind — Autonomous RAG Ecosystem  
> **Stack**: FastAPI · React 19 · Supabase (PostgreSQL + pgvector) · Gemini · Mistral · Groq

---

## 1. What is SnapMind?

SnapMind is a **production-grade RAG (Retrieval-Augmented Generation) system** that transforms a browser into a context-aware research powerhouse. It:

- **Indexes** web pages, PDFs, YouTube videos, GitHub repos into a vector database
- **Searches** using a hybrid (vector + keyword) pipeline with cross-encoder reranking
- **Generates** answers grounded in indexed knowledge with inline citations
- **Builds** a knowledge graph of entities and relationships
- **Supports** 100+ languages, vision analysis, and autonomous multi-agent web research

**Interview One-Liner:**
> "SnapMind is a RAG-based AI system that scrapes, chunks, embeds, and indexes web content into a PostgreSQL vector database, then retrieves and reranks the most relevant passages to generate grounded LLM answers with source citations."

---

## 2. High-Level Architecture (3-Tier)

```
┌─────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER (Chrome Extension / Desktop / NPM)  │
│  React 19 + Vite + TailwindCSS + Cytoscape.js          │
│  Service Worker ↔ Content Script ↔ Sidepanel UI         │
└─────────────────────┬───────────────────────────────────┘
                      │  HTTP/NDJSON (REST API)
┌─────────────────────▼───────────────────────────────────┐
│  APPLICATION LAYER (FastAPI Backend)                     │
│  20+ REST Endpoints · Rate Limiting · Structured Logs   │
│  RAG Pipeline · Hybrid Search · Reranker · GraphRAG     │
│  Browser Agents · Vision · Translation · Report Gen     │
└─────────────────────┬───────────────────────────────────┘
                      │  SQL / Vector Queries / API Calls
┌─────────────────────▼───────────────────────────────────┐
│  DATA / INFRASTRUCTURE LAYER                            │
│  Supabase (PostgreSQL + pgvector) · Firecrawl           │
│  LLM APIs (Gemini, Mistral, Groq) · Lingo.dev          │
└─────────────────────────────────────────────────────────┘
```

### Interview Q: Why 3-Tier Architecture?

| Benefit | Explanation |
|:---|:---|
| **Separation of Concerns** | UI logic is isolated in the Chrome Extension; business logic in FastAPI; data in Supabase |
| **Independent Scaling** | Backend can scale horizontally without touching the extension |
| **Technology Flexibility** | Can swap Supabase for Pinecone, or React for Vue, without rewriting the pipeline |
| **Testability** | Each layer can be tested independently via mocked interfaces |

---

## 3. Backend Architecture — Module Map

```
backend/
├── main.py                  # FastAPI app factory, lifespan, middlewares
├── config.py                # Pydantic Settings (12+ config classes)
├── database.py              # psycopg3 ConnectionPool with singleton pattern
├── security.py              # Supabase JWT auth + API key auth
│
├── chunking.py              # Semantic chunker (markdown-aware)
├── agentic_chunking.py      # LLM-steered chunking via Mistral Large
├── hybrid_search.py         # Vector + Keyword search with RRF fusion
├── reranker.py              # Cohere + local cross-encoder fallback
├── context_optimizer.py     # Dedup → Filter → Compress → Truncate
├── query_processor.py       # HyDE + Multi-query generation
├── cache.py                 # Semantic similarity caching (in-memory)
│
├── llm_router.py            # Strategy pattern for 4 LLM providers
├── graph_logic.py           # GraphRAG entity extraction + DB writes
├── browser_agents.py        # Multi-agent web research orchestrator
├── credibility.py           # Source credibility scoring (0-100)
├── evolution_tracker.py     # Content version tracking + LLM diff
│
├── api/v1/endpoints/        # 20 REST endpoint modules
├── services/                # Business logic services
├── models/                  # Pydantic request/response schemas
└── Dockerfile               # Production container image
```

### Interview Q: What design patterns are used?

| Pattern | Where | Code Example |
|:---|:---|:---|
| **Singleton** | `database.py` — connection pool | `_db_pool` with `threading.Lock()` |
| **Strategy** | `llm_router.py` — LLM providers | `BaseLLMProvider` → `MistralProvider`, `GeminiProvider` |
| **Factory** | `hybrid_search.py` | `create_hybrid_searcher(db_pool)` |
| **Decorator** | `database.py` — retry logic | `@db_retry(max_retries=15)` |
| **Template Method** | `reranker.py` | `BaseReranker.rerank()` abstract interface |
| **Chain of Responsibility** | Reranker fallback | Cohere → Local → Original order |
| **Observer** | Evolution tracker | Monitors content changes across versions |

---

## 4. Data Flow — End-to-End RAG Pipeline

### 4.1 Ingestion Flow (Write Path)

```
User clicks "Index this page" in Extension
        │
        ▼
[Content Script] extracts DOM text
        │
        ▼
[Background Service Worker] sends POST /api/v1/ingest
        │
        ▼
[FastAPI Endpoint] validates request + rate limiting
        │
        ▼
[Scraper] Firecrawl API (primary) → BeautifulSoup (fallback)
        │
        ▼
[Translator] Lingo.dev detects language → translates to English if needed
        │
        ▼
[Chunker] SemanticChunker splits by markdown headers + sentence boundaries
          (Optional: AgenticChunker uses Mistral Large for semantic boundaries)
        │
        ▼
[Embedder] Gemini/Mistral embeds each chunk → 3072-dim vector
        │
        ▼
[DB Writer] INSERT INTO documents (content, source_url, embedding, metadata)
        │
        ▼
[GraphRAG] Background thread extracts entities → INSERT INTO nodes, edges
        │
        ▼
[Credibility] Scores source (0-100) → stored in metadata.credibility_score
```

**Key Code — Embedding Generation:**

```python
# Using Google Gemini for embeddings
from google import genai

client = genai.Client(api_key="YOUR_KEY")
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents="What is RAG?",
)
embedding = result.embeddings[0].values  # 3072-dim float list
```

### 4.2 Query Flow (Read Path)

```
User types "What is RAG?" in chat
        │
        ▼
[Query Processor] classify → HyDE hypothetical doc → Multi-query variations
        │
        ▼
[Semantic Cache] check if similar query was answered (cosine sim > 0.95)
        │  HIT → return cached response
        │  MISS ↓
        ▼
[Hybrid Search] 70% vector cosine similarity + 30% PostgreSQL FTS (BM25)
        │
        ▼
[Reranker] Cross-encoder re-scores top 15 → selects top 5
        │
        ▼
[Context Optimizer] Dedup → Relevance filter → Compress → Truncate to 8000 chars
        │
        ▼
[GraphRAG] Extracts entities from query → fetches related edges → appends context
        │
        ▼
[LLM Router] Selects provider (Mistral/Gemini/Ollama) → generates answer
        │
        ▼
[Citation Engine] Adds inline citations [db-block-1], [nb-block-2]
        │
        ▼
[NDJSON Streamer] Streams response token-by-token to extension
```

---

## 5. Component Deep Dive

### 5.1 FastAPI Application Factory (`main.py`)

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP: Initialize DB pool, start keep-alive ping
    get_db_pool()
    ping_task = asyncio.create_task(server_ping_loop())
    yield
    # SHUTDOWN: Cancel ping, close pool
    ping_task.cancel()
    pool = get_db_pool()
    if pool: pool.close()

app = FastAPI(title="SnapMind RAG API", version="2.0.0", lifespan=lifespan)
```

**Interview Q: What is a lifespan context manager in FastAPI?**
> It replaces the deprecated `@app.on_event("startup")` and `@app.on_event("shutdown")`. The code before `yield` runs at startup, and after `yield` runs at shutdown. It ensures proper resource cleanup (DB pool closure).

### 5.2 Configuration with Pydantic Settings (`config.py`)

```python
from pydantic_settings import BaseSettings
from pydantic import Field

class SearchSettings(BaseSettings):
    mode: str = Field("hybrid", env="SEARCH_MODE")
    match_threshold: float = Field(0.2, env="MATCH_THRESHOLD")
    vector_weight: float = Field(0.7, env="VECTOR_WEIGHT")
    keyword_weight: float = Field(0.3, env="KEYWORD_WEIGHT")

class SnapMindSettings(BaseSettings):
    search: SearchSettings = SearchSettings()
    # ... 7 more nested settings classes
    rate_limit_per_minute: int = Field(5, env="RATE_LIMIT_PER_MINUTE")

settings = SnapMindSettings()  # Global singleton
```

**Interview Q: Why Pydantic Settings over `os.getenv()`?**
> - **Type validation**: Automatically casts `"0.7"` → `float`, `"5"` → `int`
> - **Default values**: Built-in fallbacks without `or` chains
> - **Documentation**: Field descriptions serve as config docs
> - **Testability**: Override settings in tests without touching env vars

### 5.3 Database Connection Pool — Singleton Pattern (`database.py`)

```python
import threading
from psycopg_pool import ConnectionPool

_db_pool = None
_pool_lock = threading.Lock()

def get_db_pool():
    global _db_pool
    if _db_pool is not None:
        return _db_pool
    with _pool_lock:              # Thread-safe double-checked locking
        if _db_pool is None:
            _db_pool = ConnectionPool(
                DATABASE_URL,
                min_size=5,       # Pre-warm 5 connections
                max_size=50,      # Scale up to 50 under load
                max_idle=10,      # Close idle connections after 10
                max_lifetime=60,  # Recycle connections every 60s
                timeout=60.0,     # Wait 60s for a connection
            )
    return _db_pool
```

**Interview Q: Why connection pooling? Why not create a new connection per request?**
> - **TCP overhead**: PostgreSQL connections require a TCP handshake + TLS + auth (~50ms each)
> - **Connection limits**: Supabase free tier allows max 60 concurrent connections
> - **Memory**: Each PostgreSQL connection uses ~10MB of RAM on the server
> - **Pooling** reuses existing connections, reducing latency from ~50ms to ~0.1ms

### 5.4 Retry with Exponential Backoff — Decorator Pattern

```python
def db_retry(max_retries=15, initial_delay=3):
    def decorator(func):
        def wrapper(*args, **kwargs):
            delay = initial_delay
            for i in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (DeadlockDetected, OperationalError) as e:
                    if i == max_retries - 1:
                        raise e
                    sleep_time = (delay * (i + 1)) + random.uniform(0.5, 1.5)
                    time.sleep(sleep_time)
        return wrapper
    return decorator

@db_retry(max_retries=15, initial_delay=3)
def insert_graph_data(graph_data, source_url, session_id):
    # DB write logic here
    pass
```

**Interview Q: Why exponential backoff with jitter?**
> - **Exponential**: Each retry waits longer (3s, 6s, 9s...) to avoid overwhelming a recovering DB
> - **Jitter** (`random.uniform(0.5, 1.5)`): Prevents "thundering herd" — 100 failed requests don't all retry at the exact same time

---

## 6. Security Architecture

```
Extension → Cloudflare Worker Proxy → HuggingFace Private Space → FastAPI
                    │
                    ├── Preserves Supabase JWT in x-supabase-auth header
                    └── Injects HF Token for private space access
```

### Authentication Methods (3 Layers)

| Method | Header | Use Case |
|:---|:---|:---|
| **Supabase JWT** | `Authorization: Bearer <jwt>` | Extension users (email/password login) |
| **Personal API Key** | `x-api-key: <key>` | MCP Server / CLI access |
| **BYOK API Keys** | `x-gemini-key`, `x-mistral-key`, etc. | User-provided LLM keys |

### Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["5/minute"])

@app.post("/ingest")
@limiter.limit("5/minute")
async def ingest_endpoint(request: Request):
    pass
```

**Interview Q: What is rate limiting and why is it needed?**
> Rate limiting restricts the number of API requests per client per time window. It prevents:
> - **DoS attacks**: Malicious users flooding the server
> - **API cost explosion**: Each LLM call costs money (Gemini, Mistral)
> - **Resource exhaustion**: DB connection pool running out

---

## 7. Chrome Extension Architecture

```
extension/
├── src/
│   ├── sidepanel/       # React UI (chat, settings, graph)
│   │   └── App.jsx      # Main component (134K)
│   ├── background/      # Service Worker (always running)
│   │   ├── index.js     # Chrome API orchestrator
│   │   ├── api.js       # Backend HTTP client (42K)
│   │   └── capture.js   # Screenshot capture
│   ├── content/         # Injected into web pages
│   │   ├── extractor.js # DOM content extraction
│   │   ├── highlighter.js # Text fragment highlighting
│   │   └── selection.js # Text selection handling
│   └── shared/
│       └── utils.js     # Shared utilities
```

### Chrome Extension Messaging Pattern

```javascript
// Content Script → Background Service Worker
chrome.runtime.sendMessage({
  type: "EXTRACT_CONTENT",
  data: { url: window.location.href, text: document.body.innerText }
});

// Background → Sidepanel (via ports)
chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(async (msg) => {
    if (msg.type === "SEARCH") {
      const result = await fetch(`${SERVER_URL}/api/v1/search`, {
        method: "POST",
        body: JSON.stringify({ query: msg.query })
      });
      port.postMessage({ type: "SEARCH_RESULT", data: await result.json() });
    }
  });
});
```

**Interview Q: What is a Chrome Extension Service Worker?**
> A Service Worker is a background script that runs independently of any web page. It handles events (API calls, tab changes, context menus) even when the extension popup is closed. Unlike content scripts, it has access to all Chrome Extension APIs but cannot directly access the DOM.

---

## 8. MCP Server Architecture

SnapMind exposes an **MCP (Model Context Protocol)** server that allows AI agents (Claude, Cursor, etc.) to use SnapMind as a tool.

```
AI Agent (Claude Desktop)
    │
    ▼
MCP Protocol (stdio / SSE)
    │
    ▼
snapmind-mcp Python Package
    │  (18+ tools: search, ingest, research, translate...)
    ▼
SnapMind Backend API (/api/v1/*)
```

**Key Concept**: MCP is an open protocol by Anthropic that standardizes how AI models interact with external tools. SnapMind implements 18+ tools including `snapmind_search`, `snapmind_deep_research`, `snapmind_knowledge_graph`, etc.

---

## 9. Infrastructure & Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Worker (Edge Proxy)                         │
│  - Injects HF_TOKEN for private space auth              │
│  - Preserves Supabase JWT in x-supabase-auth            │
│  - CORS headers for extension                           │
│  - 502 gateway error handling                           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  HuggingFace Space (Docker Container)                   │
│  - Python 3.11-slim base image                          │
│  - uvicorn ASGI server (1 worker)                       │
│  - Alembic DB migrations on startup                     │
│  - Self-ping keep-alive (every 5 min)                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Supabase (Managed PostgreSQL)                          │
│  - pgvector extension for vector search                 │
│  - HNSW indexes for fast ANN queries                    │
│  - Row Level Security (RLS) policies                    │
│  - Connection pooling via Supavisor                     │
└─────────────────────────────────────────────────────────┘
```

### The "Zero-Cost Deployment" Trick

| Component | Platform | Cost |
|:---|:---|:---|
| Backend | HuggingFace Spaces (Docker) | **Free** |
| Database | Supabase Free Tier | **Free** (500MB, 60 connections) |
| Edge Proxy | Cloudflare Workers | **Free** (100K req/day) |
| DNS + CDN | Cloudflare | **Free** |
| CI/CD | GitHub Actions | **Free** |
| Keep-Alive | Cron-job.org | **Free** |

**Interview Q: How do you prevent cold starts on free hosting?**
> 1. **Self-ping loop** in `main.py` — the server pings itself every 5 minutes via `http://127.0.0.1:7860/api/v1/health`
> 2. **External cron** via Cron-job.org — hits the health endpoint every 15 minutes
> 3. **Combined effect**: HuggingFace sees constant traffic → never puts the container to sleep

---

## 10. Key Interview Terminology

| Term | Definition |
|:---|:---|
| **RAG** | Retrieval-Augmented Generation — enhancing LLM responses with retrieved context |
| **Vector Embedding** | Dense numerical representation of text (3072 dimensions in SnapMind) |
| **Cosine Similarity** | Measures angle between two vectors; 1.0 = identical, 0.0 = orthogonal |
| **pgvector** | PostgreSQL extension for vector similarity search |
| **HNSW Index** | Hierarchical Navigable Small World — approximate nearest neighbor algorithm |
| **BM25** | Best Match 25 — term-frequency based ranking algorithm used in keyword search |
| **Cross-Encoder** | Neural network that jointly encodes query + document for relevance scoring |
| **HyDE** | Hypothetical Document Embeddings — generates fake answer, embeds it for better retrieval |
| **NDJSON** | Newline-Delimited JSON — streaming protocol for real-time LLM responses |
| **CORS** | Cross-Origin Resource Sharing — browser security policy for cross-domain API calls |
| **JWT** | JSON Web Token — compact, signed token for stateless authentication |
| **ASGI** | Asynchronous Server Gateway Interface — Python's async web server standard |
| **Connection Pool** | Pre-created set of reusable database connections |
| **Exponential Backoff** | Retry strategy with increasing delays between attempts |
| **MCP** | Model Context Protocol — standard for AI tool integration |
| **GraphRAG** | Graph-enhanced RAG — uses entity relationships to answer multi-hop questions |
