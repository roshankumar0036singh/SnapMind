# ⚠️ SnapMind — Tradeoffs, Failure Points & Scalability Analysis

> **Prepared for**: TCS NQT Interview Preparation  
> **Focus**: What breaks under load, design tradeoffs, bottleneck analysis  
> **Key Topics**: Connection pooling, rate limiting, cold starts, LLM costs, consistency

---

## 1. Architecture Tradeoffs — Every Decision Has a Cost

### 1.1 Hybrid Search (70/30 Vector/Keyword Split)

| Decision | Benefit | Cost |
|:---|:---|:---|
| **70% vector weight** | Catches synonyms, paraphrases, conceptual matches | Misses exact technical terms if vector is weak |
| **30% keyword weight** | Catches exact names, IDs, code identifiers | Adds PostgreSQL FTS overhead (~10ms extra) |
| **Fixed 70/30 ratio** | Simple, predictable behavior | Not optimal for all queries (code queries need more keyword weight) |

**What would break:** If a user searches "RFC 2616" (exact identifier), the keyword portion (30%) might not surface it if the vector portion pulls back unrelated HTTP docs.

**Better approach (future):** Dynamic weight adjustment based on query classification:
```python
if query_type == 'code':
    vector_weight, keyword_weight = 0.4, 0.6  # Favor exact matching
elif query_type == 'conceptual':
    vector_weight, keyword_weight = 0.85, 0.15  # Favor semantics
```

---

### 1.2 In-Memory Cache vs Redis

| Approach | SnapMind Uses | Alternative |
|:---|:---|:---|
| **In-Memory Dict** | ✅ Current | Redis / Memcached |
| **Pros** | Zero latency, no infra cost | Shared across workers, persistent |
| **Cons** | Lost on restart, not shared across workers | Extra infra, ~1ms latency |

**When this breaks:** If you scale to **multiple Uvicorn workers** (`--workers 4`), each worker has its own cache. User A's query cached in Worker 1 is invisible to Worker 2 → cache miss rate doubles.

```python
# Current: Process-local cache (works with 1 worker)
_cache_instance = None  # Global variable in single process

# Fix for multi-worker: Redis-backed cache
import redis
r = redis.Redis(host='localhost', port=6379)
r.setex(f"cache:{query_hash}", 3600, json.dumps(results))
```

**Why SnapMind chose in-memory:** Free tier deployment uses `--workers 1` (single worker). Redis would add another service to maintain for zero benefit in single-worker mode.

---

### 1.3 Single Worker vs Multiple Workers

```bash
# Current production startup (start.sh)
exec uvicorn main:app --host 0.0.0.0 --port $APP_PORT --workers 1
```

| Metric | 1 Worker | 4 Workers |
|:---|:---|:---|
| **Concurrent Users** | ~10-20 (async I/O helps) | ~40-80 |
| **CPU Utilization** | 1 core max | 4 cores |
| **Memory** | ~200MB | ~800MB |
| **DB Pool Sharing** | Single pool (50 conns) | 4 pools × 50 = 200 conns (exceeds Supabase limit!) |
| **Cache Sharing** | Works perfectly | Broken (process-local) |
| **Global State** | Consistent | Inconsistent (each worker has own `settings`) |

**Interview Q: Why not use multiple workers?**
> 1. **Supabase free tier** allows only 60 concurrent DB connections. With 4 workers × 50 max connections = 200, which exceeds the limit.
> 2. **In-memory cache** doesn't share across workers.
> 3. **Global singletons** (DB pool, settings) are per-process.
> 4. **FastAPI async** handles concurrent I/O efficiently with a single worker.

---

### 1.4 Synchronous vs Asynchronous LLM Calls

```python
# SnapMind's approach: Mixed sync/async

# Sync: Simple generation (blocks thread)
response = client.chat.complete(model="mistral-small", messages=[...])

# Async: Streaming (non-blocking)
async for chunk in provider.stream(system_content, messages):
    yield chunk

# Background thread: Heavy operations dispatched to ThreadPoolExecutor
loop = asyncio.get_running_loop()
await loop.run_in_executor(executor, heavy_graph_extraction, text)
```

**Tradeoff:**
| Approach | When Used | Risk |
|:---|:---|:---|
| **Sync in async endpoint** | Simple single-turn RAG | Blocks the event loop → other requests wait |
| **`run_in_executor()`** | Graph extraction, embedding | Thread pool exhaustion if too many concurrent requests |
| **True async (`await`)** | Streaming, Gemini SDK | Requires async-compatible SDK |

---

## 2. Points of Failure Under Load

### 2.1 Database Connection Pool Exhaustion

**The Bottleneck:**
```
Supabase Free Tier: MAX 60 connections
SnapMind Pool Config: min=5, max=50
Available for other services: 10

Under load:
  50 concurrent searches × 1 connection each = 50 connections used
  + 5 background graph writes = 55 connections
  + 3 ingestion workers = 58 connections
  → Pool timeout! New requests wait 60s → 504 Gateway Timeout
```

**The Fix in Code:**

```python
# Connection pool with timeout
_db_pool = ConnectionPool(
    DATABASE_URL,
    min_size=5,        # Pre-warm 5 connections
    max_size=50,       # Hard cap
    timeout=60.0,      # Wait 60s for a connection before failing
    max_lifetime=60,   # Recycle connections every 60s (prevent stale)
)
```

**Mitigation Strategies:**
1. **Connection timeout**: Requests fail fast (60s) instead of hanging forever
2. **`max_lifetime=60`**: Stale connections are recycled, preventing "connection reset by peer"
3. **Keepalive settings**: TCP keepalives detect dead connections early

```python
kwargs_dict = {
    "keepalives": 1,             # Enable TCP keepalives
    "keepalives_idle": 20,       # Send keepalive after 20s idle
    "keepalives_interval": 5,    # Retry every 5s
    "keepalives_count": 3,       # Give up after 3 failures
    "tcp_user_timeout": 60000,   # Total TCP timeout: 60s
}
```

### 2.2 LLM API Rate Limits & Costs

```
Gemini Free Tier:   15 requests/minute, 1500/day
Mistral Free Tier:  ~2 requests/second
Groq Free Tier:     30 requests/minute

Under load (50 users searching simultaneously):
  50 embedding calls (Gemini)   → RATE LIMITED after 15
  50 generation calls (Mistral) → RATE LIMITED after ~2/sec
  50 reranking calls (Cohere)   → RATE LIMITED
```

**The Fallback Chain:**

```python
# LLM Router — Strategy Pattern with fallback
class LLMRouter:
    _providers = {
        "mistral": MistralProvider,   # Primary
        "gemini": GeminiProvider,     # Secondary
        "ollama": OllamaProvider,     # Local fallback (no API cost)
    }
    
    @classmethod
    def get_provider(cls, api_keys):
        provider = api_keys.get("llm_provider", "cloud")
        if provider in ["local", "hybrid", "ollama"]:
            return OllamaProvider(...)  # No rate limit!
        elif provider == "gemini":
            return GeminiProvider(...)
        else:
            return MistralProvider(...)  # Default
```

**Reranker Fallback:**
```
Cohere API (cloud, best quality)
    ↓ [API error / rate limit]
Local Cross-Encoder (CPU, no API cost)
    ↓ [import error / model download failed]
Original order (no reranking)
```

### 2.3 Cold Starts on Free Hosting

**The Problem:**
```
HuggingFace Free Spaces:
  - Container sleeps after 48 hours of inactivity
  - Cold start takes 30-120 seconds (download image, start uvicorn)
  - First request after sleep → 504 timeout
```

**SnapMind's Solution — Triple Keep-Alive:**

```python
# 1. Self-ping loop (inside the app)
async def server_ping_loop():
    """Pings itself every 5 minutes to stay alive."""
    await asyncio.sleep(60)  # Wait for startup
    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            await asyncio.sleep(300)  # 5 minutes
            await client.get("http://127.0.0.1:7860/api/v1/health")
```

```yaml
# 2. External cron (Cron-job.org)
URL: https://your-space.hf.space/api/v1/health
Interval: Every 15 minutes
```

```yaml
# 3. GitHub Actions heartbeat
name: Space Heartbeat
on:
  schedule:
    - cron: '*/15 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://your-space.hf.space/api/v1/health
```

**Interview Q: Why all three? Isn't one enough?**
> - Self-ping only works when the container is already running
> - External cron is the primary keep-alive (forces HF to spin up if sleeping)
> - GitHub Actions is a backup if Cron-job.org goes down
> - Belt-and-suspenders approach for 99.9% uptime on a free tier

### 2.4 GraphRAG Deadlock Under Concurrent Writes

**The Problem:**
```
Thread A: INSERT INTO nodes (name='Python') ... RETURNING id
Thread B: INSERT INTO nodes (name='FastAPI') ... RETURNING id
Thread A: INSERT INTO edges (Python → FastAPI) ... WAITING for lock on 'FastAPI'
Thread B: INSERT INTO edges (FastAPI → Python) ... WAITING for lock on 'Python'
→ DEADLOCK! Both threads wait forever.
```

**SnapMind's Solution:**

```python
# 1. Global lock to serialize ALL graph writes
GRAPH_LOCK = threading.Lock()

@db_retry(max_retries=15, initial_delay=3)
def insert_graph_data(graph_data, source_url, session_id):
    with GRAPH_LOCK:  # Only one thread writes at a time
        with pool.connection() as conn:
            # Sort nodes alphabetically to prevent lock-order deadlocks
            nodes = graph_data.get("nodes", [])
            nodes.sort(key=lambda x: x.get("name", ""))
            
            # UPSERT nodes (INSERT ... ON CONFLICT DO UPDATE)
            for node in nodes:
                cur.execute(
                    "INSERT INTO nodes (name, entity_type) VALUES (%s, %s) "
                    "ON CONFLICT (name) DO UPDATE SET entity_type = EXCLUDED.entity_type "
                    "RETURNING id",
                    (node['name'], node['type'])
                )
```

**Interview Q: What is a deadlock and how do you prevent it?**
> A deadlock occurs when two or more threads each hold a resource the other needs, and neither can proceed. Prevention strategies:
> 1. **Lock ordering**: Always acquire locks in the same order (alphabetical node names)
> 2. **Global mutex**: `GRAPH_LOCK` ensures only one thread writes at a time
> 3. **Retry with backoff**: `@db_retry` catches `DeadlockDetected` and retries after a delay
> 4. **Timeouts**: `SET statement_timeout = '60s'` prevents infinite waits

### 2.5 Embedding API Failure — Neutral Vector Fallback

```python
def _embed_query(self, query):
    try:
        embedding = client.models.embed_content(model="gemini-embedding-001", ...)
        return pad_embedding(embedding)
    except Exception as e:
        if "403" in str(e):
            print("API Key invalid! Using neutral vector.")
            return [0.0] * 3072  # Zero vector → matches nothing strongly
        return None  # None signals "skip vector search"
```

**What happens with a zero vector:**
- Cosine similarity with any real vector ≈ 0 (no meaningful match)
- Hybrid search falls back to keyword-only mode
- User still gets results, just from keyword search

---

## 3. Scalability Bottlenecks — What Breaks at 1000 Users

### 3.1 Bottleneck Analysis

```
                        CURRENT (10 users)    AT SCALE (1000 users)
                        ──────────────────    ─────────────────────
LLM API calls/min       5-10                  500-1000 (RATE LIMITED)
DB connections           5-10 active           50+ (POOL EXHAUSTED)
Memory (embeddings)      ~100MB                ~10GB (OOM risk)
Search latency           100-200ms             2-5s (queue buildup)
Ingestion throughput     1-2 pages/sec         50+ pages/sec needed
Cache hit rate           ~20%                  ~60% (more repeated queries)
```

### 3.2 Scaling Strategy (If Budget Allowed)

```
Current Architecture:          Scaled Architecture:
                               
[Extension] → [1 Worker]      [Extension] → [Load Balancer]
      ↓                              ↓
[Supabase Free]                [4 Workers] ← [Redis Cache]
                                     ↓
                               [Supabase Pro + Read Replicas]
                                     ↓
                               [Dedicated Vector DB (Pinecone)]
```

| Change | Cost | Impact |
|:---|:---|:---|
| **Redis cache** | $0 (free tier) / $15/mo | Shared cache across workers |
| **Multiple workers** | $0 (same server) | 4x concurrent capacity |
| **Supabase Pro** | $25/mo | 500 connections, 8GB, point-in-time recovery |
| **Read replicas** | $50/mo | Separate read/write traffic |
| **Dedicated vector DB** | $70/mo (Pinecone) | Billion-scale vector search |
| **Embedding batching** | $0 (code change) | 10x fewer API calls |

### 3.3 Request Size Limit

```python
@app.middleware("http")
async def production_middleware(request: Request, call_next):
    # Enforce 50MB request size limit
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 50 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"detail": "Content too large"})
```

**Why 50MB?** Large file uploads (PDFs, repos) need room, but allowing unlimited sizes invites abuse (someone uploads a 10GB file, exhausting memory).

---

## 4. Security Vulnerabilities & Mitigations

### 4.1 BYOK (Bring Your Own Key) Model

```python
# API keys are passed in request headers — NOT stored on server
headers = {
    "x-gemini-key": "user's own API key",
    "x-mistral-key": "user's own API key",
}
```

| Risk | Mitigation |
|:---|:---|
| Keys transmitted in plaintext | HTTPS enforced (TLS encryption in transit) |
| Keys visible in browser DevTools | Extension stores keys in `chrome.storage.local` (encrypted at rest) |
| Keys logged in server logs | Structured logging excludes headers |
| Server admin can read keys | Keys are transient (not stored in DB); server processes them in memory only |

### 4.2 SQL Injection Prevention

```python
# SAFE: Parameterized queries (psycopg3 style)
cur.execute(
    "SELECT * FROM documents WHERE source_url LIKE %s",
    (f"%{user_input}%",)
)

# UNSAFE (never do this):
cur.execute(f"SELECT * FROM documents WHERE source_url LIKE '%{user_input}%'")
```

### 4.3 Security Headers

```python
response.headers["X-Content-Type-Options"] = "nosniff"  # Prevent MIME sniffing
response.headers["X-Frame-Options"] = "DENY"            # Prevent clickjacking
response.headers["X-Request-ID"] = request_id           # Trace requests
```

---

## 5. Failure Recovery Matrix

| Failure | Detection | Recovery | User Impact |
|:---|:---|:---|:---|
| **DB connection lost** | `psycopg.OperationalError` | `@db_retry` with 15 retries + backoff | Delayed response (3-45s) |
| **Embedding API down** | 403/500 from Gemini | Zero vector fallback → keyword search | Reduced search quality |
| **LLM API down** | Timeout / 5xx | Fallback chain: Mistral → Gemini → Ollama | May use different model |
| **Reranker API down** | Cohere error | Local cross-encoder → original order | Slightly worse ranking |
| **Firecrawl down** | 502/504 | BeautifulSoup fallback scraper | Slower, less clean scraping |
| **Translation API down** | Lingo.dev timeout | Mistral JSON-mode translation | Slightly worse translation |
| **Container restart** | Health check fails | Self-ping + cron keep-alive | 30-120s cold start |
| **Cache corrupted** | Thread-safe lock prevents | Clear cache, rebuild on demand | Temporary speed decrease |

---

## 6. Interview Quick-Fire — Tradeoffs

| Question | Answer |
|:---|:---|
| **Single vs Multi-worker?** | Single — avoids DB pool exhaustion and cache sharing issues on free tier |
| **In-memory vs Redis cache?** | In-memory — zero cost, fine for single worker. Redis needed for multi-worker |
| **Cohere vs Local reranker?** | Both — Cohere for quality, local as free fallback |
| **Fixed vs dynamic search weights?** | Fixed 70/30 — simpler to debug. Dynamic would need query classifier |
| **Monolith vs microservices?** | Monolith — one Docker container is simpler to deploy/debug on free tier |
| **REST vs GraphQL?** | REST — simpler for CRUD + streaming (NDJSON). GraphQL adds complexity |
| **pgvector vs Pinecone?** | pgvector — free, integrated with PostgreSQL. Pinecone is better at >1M vectors |
| **1 DB for everything?** | Yes — Supabase handles vectors, relational, FTS in one. Avoids data sync issues |
| **Sync vs Async ingestion?** | Async (BackgroundTasks) — user gets immediate response, processing continues |
| **HNSW vs IVFFlat index?** | HNSW — better recall (95-99% vs 80-90%), slightly more memory |
