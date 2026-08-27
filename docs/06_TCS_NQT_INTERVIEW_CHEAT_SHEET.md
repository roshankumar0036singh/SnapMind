# 🎯 SnapMind — TCS NQT Interview Cheat Sheet

> **Format**: Rapid Q&A with one-line answers and short code snippets  
> **Coverage**: Python, FastAPI, PostgreSQL, Docker, Design Patterns, Data Structures, System Design  
> **Based on**: Actual SnapMind codebase concepts

---

## Section 1: Python Fundamentals (Used in SnapMind)

### Q1: What is a decorator in Python?
A function that wraps another function to add behavior without modifying it.

```python
# SnapMind's @db_retry decorator
def db_retry(max_retries=15, initial_delay=3):
    def decorator(func):
        def wrapper(*args, **kwargs):
            for i in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    time.sleep(initial_delay * (i + 1))
            raise e
        return wrapper
    return decorator

@db_retry(max_retries=5)
def save_to_db(data):
    # If this fails, it retries up to 5 times
    pass
```

### Q2: What is a dataclass?
A decorator that auto-generates `__init__`, `__repr__`, `__eq__` for data-holding classes.

```python
from dataclasses import dataclass

@dataclass
class CacheEntry:
    query: str
    results: list
    timestamp: datetime
    hit_count: int = 0  # Default value
```

### Q3: What are `*args` and `**kwargs`?
- `*args`: Variable positional arguments (tuple)
- `**kwargs`: Variable keyword arguments (dict)

```python
def db_retry(max_retries=15, initial_delay=3):
    def decorator(func):
        def wrapper(*args, **kwargs):  # Accepts any arguments
            return func(*args, **kwargs)  # Forwards them to the original function
        return wrapper
    return decorator
```

### Q4: What is `asyncio` and why use it?
`asyncio` provides asynchronous I/O — non-blocking concurrent execution.

```python
import asyncio

# Sync: Blocks while waiting for response
response = requests.get("https://api.example.com")  # Waits 2s, thread blocked

# Async: Yields control while waiting
response = await httpx.AsyncClient().get("https://api.example.com")  # Waits 2s, other tasks run
```

**SnapMind uses async for:** API calls, DB queries, LLM streaming, file I/O

### Q5: What is `threading.Lock()` and why is it needed?
Prevents race conditions when multiple threads access shared data.

```python
import threading

_db_pool = None
_pool_lock = threading.Lock()

def get_db_pool():
    global _db_pool
    with _pool_lock:  # Only one thread enters this block at a time
        if _db_pool is None:
            _db_pool = create_pool()
    return _db_pool
```

### Q6: What is a context manager (`with` statement)?
Ensures resources are properly acquired and released.

```python
# Database connection — auto-returns to pool when done
with pool.connection() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM documents")
        results = cur.fetchall()
# Connection automatically returned to pool here
```

### Q7: What is list comprehension?
Concise way to create lists from iterables.

```python
# Filter chunks smaller than min_size
chunks = [c for c in chunks if len(c.content.strip()) >= 200]

# Extract text content for reranking
doc_texts = [doc.get('content', '') for doc in documents]
```

### Q8: What is `@property` in Python?
Defines a method that acts like an attribute (getter).

```python
class SnapMindSettings:
    @property
    def context_limit(self) -> int:
        """Legacy alias — access as settings.context_limit (no parentheses)"""
        return self.context.max_context_length
    
    @property
    def is_configured(self) -> bool:
        return all([os.getenv("GEMINI_API_KEY"), os.getenv("GROQ_API_KEY")])
```

### Q9: What is a generator in Python?
A function that `yield`s values lazily (one at a time) instead of returning all at once.

```python
# LLM streaming — yields one token at a time
def stream(self, messages):
    stream_response = client.chat.stream(model="mistral-small", messages=messages)
    for chunk in stream_response:
        if chunk.data.choices[0].delta.content:
            yield chunk.data.choices[0].delta.content  # Yields "Hello", " world", "!"
```

### Q10: What is the Global Interpreter Lock (GIL)?
Python's GIL allows only one thread to execute Python bytecode at a time.

```python
# GIL is NOT a problem for I/O-bound tasks (network, DB, file)
# → Threading works fine (threads release GIL during I/O waits)

# GIL IS a problem for CPU-bound tasks (matrix operations, heavy computation)
# → Use multiprocessing or asyncio instead

# SnapMind uses ThreadPoolExecutor for I/O-heavy graph extraction:
executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="GraphExt")
loop.run_in_executor(executor, extract_graph_data, text)
```

---

## Section 2: FastAPI & Web Concepts

### Q11: What is FastAPI?
A modern Python web framework for building APIs with automatic validation and documentation.

```python
from fastapi import FastAPI, Request
from pydantic import BaseModel

app = FastAPI()

class SearchRequest(BaseModel):
    query: str
    site_id: str = None  # Optional with default

@app.post("/api/v1/search")
async def search(request: SearchRequest):
    return {"results": [...]}
```

### Q12: What is ASGI vs WSGI?
- **WSGI**: Synchronous (Flask, Django) — one request at a time per worker
- **ASGI**: Asynchronous (FastAPI, Starlette) — handles concurrent I/O

### Q13: What is middleware?
Code that runs before/after every request (logging, auth, CORS).

```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start)
    return response
```

### Q14: What is CORS?
Cross-Origin Resource Sharing — allows/denies web requests from different domains.

### Q15: What is Pydantic?
Data validation library that enforces types at runtime.

```python
from pydantic import BaseModel, Field

class ChunkConfig(BaseModel):
    min_size: int = Field(200, ge=50, le=1000)  # Must be 50-1000
    overlap: float = Field(0.25, ge=0.0, le=0.5)  # Must be 0-50%
```

---

## Section 3: Database & SQL

### Q16: What is a connection pool?
Pre-created set of reusable DB connections (avoids TCP handshake per request).

### Q17: What is pgvector?
PostgreSQL extension that adds vector data type and similarity search operators.

```sql
-- Cosine distance operator: <=>
SELECT content, 1 - (embedding <=> query_vector::vector) AS similarity
FROM documents
ORDER BY embedding <=> query_vector::vector
LIMIT 5;
```

### Q18: What is an HNSW index?
Hierarchical Navigable Small World — a graph-based approximate nearest neighbor index.
- **Build time**: O(n log n)
- **Query time**: O(log n)
- **Recall**: 95-99%

### Q19: What is Full-Text Search (FTS)?
PostgreSQL's built-in text search using inverted indexes.

```sql
-- Create FTS index
CREATE INDEX idx_fts ON documents USING GIN (to_tsvector('english', content));

-- Query
SELECT * FROM documents 
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'machine learning');
```

### Q20: What is JSONB?
Binary JSON storage in PostgreSQL — supports indexing and querying nested fields.

```sql
-- Store metadata as JSONB
INSERT INTO documents (content, metadata) VALUES ('...', '{"tags": ["python", "ai"]}');

-- Query JSONB fields
SELECT * FROM documents WHERE metadata->>'credibility_tier' = 'verified';
```

### Q21: What is database normalization?
Organizing data to reduce redundancy. SnapMind uses:
- **1NF**: No repeating groups (each column has atomic values)
- **2NF**: No partial dependencies (all columns depend on full PK)
- **3NF**: No transitive dependencies

### Q22: What is a foreign key?
A column that references the primary key of another table.

```sql
CREATE TABLE edges (
    source_node_id INTEGER REFERENCES nodes(id),  -- FK to nodes
    target_node_id INTEGER REFERENCES nodes(id),   -- FK to nodes
    relation TEXT NOT NULL
);
```

---

## Section 4: Design Patterns

### Q23: What is the Singleton Pattern?
Ensures only one instance of a class exists (used for DB pool).

```python
_instance = None
_lock = threading.Lock()

def get_instance():
    global _instance
    with _lock:
        if _instance is None:
            _instance = ExpensiveResource()
    return _instance
```

### Q24: What is the Strategy Pattern?
Interchangeable algorithms selected at runtime.

```python
# LLMRouter selects Mistral, Gemini, or Ollama based on config
provider = LLMRouter.get_provider({"llm_provider": "gemini"})
response = provider.generate(system_prompt, messages, query)
```

### Q25: What is the Factory Pattern?
Creates objects without specifying the exact class.

```python
def create_hybrid_searcher(db_pool, api_keys=None):
    return HybridSearcher(db_pool, api_keys)
```

### Q26: What is the Chain of Responsibility?
Request passes through a chain of handlers until one handles it.

```
Cohere Reranker → [Error?] → Local Cross-Encoder → [Error?] → Original Order
```

### Q27: What is the Observer Pattern?
Objects subscribe to events and get notified of changes.

```python
# EvolutionTracker observes content changes
result = await tracker.track_change(url, content, user_id)
# Returns: {"status": "updated", "diff_summary": "Added new section on..."}
```

---

## Section 5: Data Structures & Algorithms

### Q28: What is cosine similarity?
Measures the angle between two vectors (0 = orthogonal, 1 = identical).

```python
def cosine_similarity(A, B):
    dot = sum(a*b for a, b in zip(A, B))
    magA = sum(a**2 for a in A) ** 0.5
    magB = sum(b**2 for b in B) ** 0.5
    return dot / (magA * magB)
```

### Q29: What is Jaccard similarity?
Set overlap measure: `|A ∩ B| / |A ∪ B|`

```python
def jaccard(text1, text2):
    words1, words2 = set(text1.split()), set(text2.split())
    return len(words1 & words2) / len(words1 | words2)
```

### Q30: What is a hash table?
Key-value store with O(1) average lookup (Python `dict`).

```python
# SnapMind's semantic cache uses dict for O(1) exact-match lookup
self.cache: Dict[str, CacheEntry] = {}
cache_key = hashlib.md5(f"{query}:{site_id}".encode()).hexdigest()
```

### Q31: What is exponential backoff?
Retry strategy with increasing delays: 3s, 6s, 9s, 12s...

```python
sleep_time = (delay * (attempt + 1)) + random.uniform(0.5, 1.5)
# Jitter prevents thundering herd
```

### Q32: What is BFS/DFS? (Used in multi-page crawling)
- **BFS** (Breadth-First): Visit all pages at depth 1, then depth 2, etc.
- **DFS** (Depth-First): Follow links deeply before backtracking.

SnapMind uses **BFS** for multi-page crawling (3 levels deep, 50 pages max).

---

## Section 6: System Design

### Q33: Design a URL shortener
```
Client → API → Generate short code → Store in DB → Return short URL
Short URL → Lookup in DB → Redirect to original URL
```

### Q34: Design a chat application
```
Client → WebSocket → Server → Broadcast to recipients
         ↓
      Message stored in DB with embedding for semantic recall
```

### Q35: Design a search engine
```
Index: Content → Chunk → Embed → Store (pgvector)
Query: Query → Embed → Vector Search → Rerank → Generate answer
```
**This is literally what SnapMind does!**

### Q36: What is horizontal vs vertical scaling?
- **Vertical**: Bigger machine (more RAM/CPU)
- **Horizontal**: More machines (load balancer distributes traffic)

SnapMind currently uses vertical (single worker, bigger HF Space).

### Q37: What is CAP theorem?
A distributed system can provide only 2 of 3: Consistency, Availability, Partition tolerance.

SnapMind chooses **CA** (Consistency + Availability) via single PostgreSQL instance.

---

## Section 7: Docker & DevOps

### Q38: What is Docker?
Containerization platform — packages app + dependencies into isolated images.

### Q39: Dockerfile keywords
| Keyword | Purpose | Example |
|:---|:---|:---|
| `FROM` | Base image | `FROM python:3.11-slim` |
| `WORKDIR` | Set working directory | `WORKDIR /app` |
| `COPY` | Copy files into container | `COPY requirements.txt .` |
| `RUN` | Execute command during build | `RUN pip install -r requirements.txt` |
| `CMD` | Default command to run | `CMD ["python", "main.py"]` |
| `EXPOSE` | Document port (metadata only) | `EXPOSE 8000` |
| `ENV` | Set environment variable | `ENV PYTHONUNBUFFERED=1` |

### Q40: What is CI/CD?
- **CI**: Automatically test code on every push
- **CD**: Automatically deploy code after tests pass

```yaml
# GitHub Actions example
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: curl https://your-space.hf.space/api/v1/health
```

---

## Section 8: Networking & Security

### Q41: What is HTTPS/TLS?
Encrypted HTTP using Transport Layer Security. Prevents eavesdropping.

### Q42: What is a JWT?
JSON Web Token — signed token for stateless authentication.
```
Header.Payload.Signature
eyJhbG...eyJzdW...SflKxw...
```

### Q43: What is SQL injection?
Malicious SQL in user input. Prevention: **parameterized queries**.

```python
# SAFE
cur.execute("SELECT * FROM docs WHERE url = %s", (user_input,))
# UNSAFE
cur.execute(f"SELECT * FROM docs WHERE url = '{user_input}'")
```

### Q44: What is rate limiting?
Restricting number of requests per client per time window.

### Q45: What is CORS?
Browser security that blocks cross-origin requests unless the server explicitly allows them.

---

## Section 9: Quick Reference Tables

### HTTP Status Codes (Used in SnapMind)

| Code | Meaning | SnapMind Usage |
|:---|:---|:---|
| 200 | OK | Successful response |
| 401 | Unauthorized | Missing/invalid Supabase JWT |
| 413 | Payload Too Large | Request > 50MB |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unhandled exception (returns error_id) |
| 503 | Service Unavailable | DB connection failed (readiness probe) |

### Time Complexity

| Operation | Complexity | SnapMind Example |
|:---|:---|:---|
| Dict lookup | O(1) | Cache exact-match |
| Binary search | O(log n) | HNSW vector search |
| Linear scan | O(n) | Semantic cache similarity check |
| Sort | O(n log n) | Reranking results |
| Nested loop | O(n²) | Jaccard dedup (all pairs) |

### REST API Methods

| Method | Purpose | Idempotent? | SnapMind Example |
|:---|:---|:---|:---|
| GET | Read | Yes | `GET /api/v1/sites` |
| POST | Create | No | `POST /api/v1/ingest` |
| PUT | Update (full) | Yes | — |
| PATCH | Update (partial) | No | — |
| DELETE | Delete | Yes | `DELETE /api/v1/sites/{id}` |

---

## Section 10: One-Line Answers for Rapid Fire

| Question | Answer |
|:---|:---|
| What is RAG? | Retrieval-Augmented Generation — ground LLM answers in retrieved context |
| What is an embedding? | Dense numerical representation of text (array of floats) |
| What is pgvector? | PostgreSQL extension for vector similarity search |
| What is FastAPI? | Modern async Python web framework with auto-docs |
| What is Docker? | Containerization platform for reproducible deployments |
| What is asyncio? | Python's built-in library for async/concurrent I/O |
| What is Pydantic? | Data validation library using Python type hints |
| What is CORS? | Browser policy for cross-origin HTTP requests |
| What is middleware? | Code that runs before/after every HTTP request |
| What is a connection pool? | Pre-created set of reusable database connections |
| What is BM25? | Term-frequency based text ranking algorithm |
| What is a cross-encoder? | Neural model that jointly scores query+document relevance |
| What is HNSW? | Graph-based approximate nearest neighbor search algorithm |
| What is exponential backoff? | Retry with increasing delays (3s, 6s, 9s...) |
| What is a feature flag? | Runtime boolean to enable/disable features |
| What is NDJSON? | Newline-delimited JSON for streaming responses |
| What is a service worker? | Background script in browser extensions for event handling |
| What is Alembic? | Database migration tool for Python |
| What is a reverse proxy? | Server that forwards requests to backend (Cloudflare Worker) |
| What is the Strategy Pattern? | Interchangeable algorithms selected at runtime |
