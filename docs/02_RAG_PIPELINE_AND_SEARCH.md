# 🔍 SnapMind — RAG Pipeline & Search Engine Internals

> **Prepared for**: TCS NQT Interview Preparation  
> **Focus**: Chunking, Embeddings, Hybrid Search, Reranking, Context Optimization  
> **Key Concepts**: Vector Search, BM25, RRF, Cross-Encoder, HyDE, Semantic Caching

---

## 1. The RAG Pipeline — What and Why

**RAG (Retrieval-Augmented Generation)** solves the biggest LLM problem: **hallucination**.

```
Traditional LLM:  "Who is the CEO of XYZ Corp?"  →  "John Smith" (might be wrong)

RAG-Enhanced LLM:
  1. Search vector DB for documents about "XYZ Corp"
  2. Retrieve: "According to our 2024 filing, Jane Doe became CEO..."
  3. Generate: "Based on indexed documents, Jane Doe is the CEO of XYZ Corp [db-block-1]"
```

**Interview Q: What problem does RAG solve?**
> RAG grounds LLM responses in actual data, preventing hallucination. Instead of relying on training data (which may be outdated), the LLM receives fresh, relevant context from a vector database.

---

## 2. Semantic Chunking

### Why Chunk?

LLMs have **context window limits** (e.g., 32K tokens for Mistral). You can't feed an entire 500-page PDF. Chunking breaks documents into digestible pieces that can be:
1. Individually embedded (converted to vectors)
2. Selectively retrieved (only relevant chunks)
3. Efficiently stored (each chunk ≈ 800 chars)

### SnapMind's Semantic Chunker

```python
@dataclass
class ChunkConfig:
    min_chunk_size: int = 200      # Don't create chunks < 200 chars
    target_chunk_size: int = 800   # Aim for ~800 chars
    max_chunk_size: int = 1200     # Never exceed 1200 chars
    overlap_percentage: float = 0.25  # 25% overlap between chunks
    preserve_code_blocks: bool = True
    preserve_tables: bool = True

class SemanticChunker:
    def chunk_text(self, text, source_url=""):
        if self._is_markdown(text):
            return self._chunk_markdown(text, source_url)
        else:
            return self._chunk_plain_text(text, source_url)
```

### Chunking Strategy (Markdown-Aware)

```
Step 1: Detect content type (markdown vs plain text)
Step 2: Extract & protect code blocks/tables (replace with placeholders)
Step 3: Split by markdown headers (##, ###, etc.)
Step 4: For each section:
         if section < max_chunk_size → keep as single chunk
         else → split by sentence boundaries with overlap
Step 5: Restore protected blocks
Step 6: Filter out chunks < min_chunk_size
```

**Interview Q: Why preserve code blocks during chunking?**
> Code blocks have strict formatting (indentation matters). Splitting a function mid-line would make it meaningless. The chunker extracts code blocks as atomic units and reinserts them after splitting.

### Overlap — Why 25%?

```
Chunk 1: "Machine learning is a subset of AI. It uses statistical methods..."
Chunk 2: "...It uses statistical methods to learn from data. Deep learning..."
          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ (25% overlap)
```

> **Without overlap**: A query about "statistical methods in deep learning" might miss both chunks because the relevant context spans the boundary.  
> **With overlap**: The overlapping sentences ensure the concept is captured in at least one chunk.

### Agentic Chunking (LLM-Steered)

```python
async def run_agentic_chunking(text, api_keys, target_chunk_size=1000):
    """Uses Mistral Large to determine optimal chunk boundaries."""
    # 1. Macro-split into ~10K char segments
    # 2. Process each segment in parallel (asyncio.Semaphore(10))
    # 3. LLM returns JSON: {"chunk_content": "...", "reasoning": "..."}
    
    prompt = """
    You are an expert text architect. Split text into a semantically 
    complete chunk. The chunk MUST be an EXACT SUBSTRING of the text.
    Output: {"chunk_content": "...", "reasoning": "..."}
    """
```

**Interview Q: What is "agentic chunking" and when would you use it?**
> Regular chunking uses regex/rules. Agentic chunking uses an LLM to understand semantic boundaries (e.g., "this paragraph starts a new concept"). It's slower but produces higher-quality chunks for complex documents like legal contracts or scientific papers.

---

## 3. Embeddings — Converting Text to Vectors

### What is an Embedding?

An embedding converts text into a **dense numerical vector** (array of floats). Semantically similar texts have similar vectors.

```python
# "What is machine learning?" → [0.012, -0.045, 0.089, ..., 0.034]  (3072 floats)
# "Explain ML concepts"       → [0.011, -0.043, 0.091, ..., 0.032]  (very similar!)
# "Recipe for chocolate cake" → [0.891, 0.234, -0.567, ..., 0.123]  (very different)
```

### SnapMind's Embedding Pipeline

```python
from google import genai

client = genai.Client(api_key=api_key)
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents="What is machine learning?",
)
embedding = result.embeddings[0].values  # List[float] of length 3072
```

### Embedding Dimension Padding

```python
def pad_embedding(embedding, target_dim=3072):
    """Pads embedding to match DB column dimension."""
    if len(embedding) < target_dim:
        embedding.extend([0.0] * (target_dim - len(embedding)))
    return embedding[:target_dim]
```

**Interview Q: Why pad embeddings to 3072 dimensions?**
> Different models produce different embedding sizes (Mistral: 1024, Gemini: 3072). The PostgreSQL `vector(3072)` column has a fixed dimension. Shorter embeddings are zero-padded to fit, preserving cosine similarity (padding with zeros doesn't change the angle).

### Cosine Similarity — How Search Works

```python
def cosine_similarity(vec1, vec2):
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    mag1 = sum(a ** 2 for a in vec1) ** 0.5
    mag2 = sum(b ** 2 for b in vec2) ** 0.5
    return dot_product / (mag1 * mag2)  # Returns 0.0 to 1.0
```

| Similarity | Meaning |
|:---|:---|
| 1.0 | Identical meaning |
| 0.8-0.9 | Very related (synonym, paraphrase) |
| 0.5-0.7 | Somewhat related (same topic) |
| < 0.3 | Unrelated |

**In PostgreSQL (pgvector):**
```sql
-- Distance operator: <=> (cosine distance = 1 - cosine similarity)
SELECT content, 1 - (embedding <=> query_embedding::vector) AS similarity
FROM documents
WHERE 1 - (embedding <=> query_embedding::vector) > 0.2
ORDER BY embedding <=> query_embedding::vector
LIMIT 10;
```

---

## 4. Hybrid Search — Vector + Keyword Fusion

### Why Hybrid? The Failure Modes

| Search Type | Strength | Weakness | Example |
|:---|:---|:---|:---|
| **Vector Search** | Captures meaning, synonyms | Misses exact names, IDs | "FastAPI" might match "web framework" but miss exact term |
| **Keyword Search (BM25)** | Exact term matching | No semantic understanding | "ML" won't match "machine learning" |
| **Hybrid** | Best of both worlds | Slightly more compute | Catches both meaning AND exact terms |

### SnapMind's Hybrid Search Implementation

```python
class HybridSearcher:
    def __init__(self, db_pool, api_keys=None):
        self.vector_weight = 0.7   # 70% vector influence
        self.keyword_weight = 0.3  # 30% keyword influence
    
    def _hybrid_search(self, query, query_embedding, site_ids, top_k):
        """Calls PostgreSQL function that fuses both search types."""
        params = {
            "query_embedding": query_embedding,
            "query_text": query,
            "match_threshold": 0.2,
            "match_count": top_k,
            "vector_weight": 0.7,
            "keyword_weight": 0.3
        }
        
        with self.db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT * FROM hybrid_search_documents("
                    "%(query_embedding)s::vector, %(query_text)s::text, "
                    "%(match_threshold)s, %(match_count)s, "
                    "%(filter_source_urls)s::text[], "
                    "%(vector_weight)s, %(keyword_weight)s)",
                    params
                )
                return cur.fetchall()
```

### The PostgreSQL Function — Weighted Fusion

```sql
-- Scoring formula inside hybrid_search_documents()
combined_score = (COALESCE(similarity, 0) × vector_weight) 
               + (COALESCE(bm25_score, 0) × keyword_weight × 10)

-- Full-text search uses PostgreSQL's built-in ts_rank:
bm25_score = ts_rank(
    to_tsvector('english', content),
    plainto_tsquery('english', query_text)
)
```

### Reciprocal Rank Fusion (RRF)

```python
def reciprocal_rank_fusion(self, vector_results, keyword_results, k=60):
    """
    RRF formula: score(d) = sum(1 / (k + rank(d)))
    
    k=60 is standard. Higher k = less emphasis on top ranks.
    """
    doc_scores = {}
    
    for rank, doc in enumerate(vector_results, start=1):
        doc_scores[doc['id']] = 1 / (k + rank)
    
    for rank, doc in enumerate(keyword_results, start=1):
        doc_scores[doc['id']] = doc_scores.get(doc['id'], 0) + 1 / (k + rank)
    
    return sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
```

**Interview Q: Why RRF over simple averaging?**
> - **RRF is rank-based**, not score-based. Different search engines produce scores on different scales (cosine sim: 0-1, BM25: 0-100+). You can't directly average them.
> - **RRF normalizes by rank position**, making it model-agnostic and robust.

### Credibility-Weighted Scoring

```python
# 30% of final score is influenced by source credibility
cred_score = metadata.get('credibility_score', 50) / 100.0
match['score'] = match['score'] * (0.7 + 0.3 * cred_score)
```

> A result from `docs.python.org` (credibility: 90) gets a boost, while a random blog (credibility: 30) gets penalized.

---

## 5. Cross-Encoder Reranking

### Why Rerank?

**Initial retrieval** (vector search) is fast but approximate. **Reranking** is slow but accurate.

```
Vector Search (fast, O(log n) with HNSW)
    → Returns 15 candidates (some may be irrelevant)

Cross-Encoder Reranking (slower, O(n) per query)
    → Scores each candidate against the query
    → Returns top 5 truly relevant results
```

### SnapMind's Reranker — Chain of Responsibility

```python
class Reranker:
    """Automatic fallback chain: Cohere → Local → Original order"""
    
    def rerank(self, query, documents, top_k=5):
        try:
            # 1. Try Cohere API (best quality, cloud-based)
            if self.cohere_reranker:
                return self.cohere_reranker.rerank(query, documents, top_k)
            # 2. Try local cross-encoder (no API cost, CPU-based)
            elif self.local_reranker:
                return self.local_reranker.rerank(query, documents, top_k)
        except Exception:
            # 3. Fallback to local if Cohere fails
            self._init_local()
            return self.local_reranker.rerank(query, documents, top_k)
        # 4. If everything fails, return original order
        return documents[:top_k]
```

### How Cross-Encoder Works

```python
class LocalCrossEncoderReranker:
    def __init__(self):
        from sentence_transformers import CrossEncoder
        self.model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    
    def rerank(self, query, documents, top_k=5):
        # Create (query, document) pairs
        pairs = [[query, doc['content']] for doc in documents]
        
        # Score all pairs (the model sees query + doc together)
        scores = self.model.predict(pairs)
        
        # Sort by score
        scored = sorted(zip(documents, scores), key=lambda x: x[1], reverse=True)
        return scored[:top_k]
```

**Interview Q: Bi-encoder vs Cross-encoder — what's the difference?**

| Feature | Bi-Encoder | Cross-Encoder |
|:---|:---|:---|
| **How it works** | Encodes query and doc separately, then compares | Encodes query + doc together as one input |
| **Speed** | Fast (can precompute doc embeddings) | Slow (must recompute for each pair) |
| **Accuracy** | Good | Better (sees full context) |
| **Use case** | Initial retrieval (vector search) | Reranking top-K candidates |

---

## 6. Context Optimization

After retrieval and reranking, the context is optimized before sending to the LLM.

### Four-Step Pipeline

```python
class ContextOptimizer:
    def optimize_context(self, chunks, query=None):
        # Step 1: Remove duplicates (Jaccard > 90% = duplicate)
        chunks = self.remove_duplicates(chunks)
        
        # Step 2: Filter by relevance score
        chunks = self.filter_by_relevance(chunks, query)
        
        # Step 3: Compress each chunk (strip boilerplate)
        for chunk in chunks:
            chunk['content'] = self.compress_chunk(chunk['content'])
        
        # Step 4: Smart truncation to fit token budget
        chunks = self.smart_truncate(chunks)
        
        return OptimizedContext(
            content=...,
            original_tokens=original_tokens,
            optimized_tokens=optimized_tokens,
            compression_ratio=compression_ratio
        )
```

### Deduplication — Jaccard Similarity

```python
def _similarity_ratio(self, text1, text2):
    """Jaccard similarity: |A ∩ B| / |A ∪ B|"""
    words1 = set(text1.split())
    words2 = set(text2.split())
    intersection = words1 & words2
    union = words1 | words2
    return len(intersection) / len(union)
    # > 0.9 means 90%+ words are the same → DUPLICATE
```

**Interview Q: Why Jaccard over cosine for deduplication?**
> Jaccard works on word sets (no ML model needed). It's fast, simple, and perfect for detecting near-duplicate text. Cosine similarity on embeddings is overkill for dedup — two chunks with 90% word overlap are almost certainly duplicates.

### Smart Truncation — Priority-Ordered Selection

```python
def smart_truncate(self, chunks, max_tokens=8000):
    # Sort by relevance score (highest first)
    sorted_chunks = sorted(chunks, key=lambda x: x.get('score', 0), reverse=True)
    
    selected = []
    total_tokens = 0
    
    for chunk in sorted_chunks:
        chunk_tokens = len(chunk['content']) // 4  # ~4 chars per token
        if total_tokens + chunk_tokens <= max_tokens:
            selected.append(chunk)
            total_tokens += chunk_tokens
        elif max_tokens - total_tokens > 100:
            # Partially include if meaningful space remains
            chars_to_keep = (max_tokens - total_tokens) * 4
            chunk['content'] = chunk['content'][:chars_to_keep] + "..."
            selected.append(chunk)
            break
    
    return selected
```

---

## 7. Query Enhancement — HyDE & Multi-Query

### HyDE (Hypothetical Document Embeddings)

```python
def generate_hyde_document(self, query):
    """
    Problem: "What is RAG?" (short query) → poor embedding
    Solution: Generate a hypothetical answer, embed THAT instead
    
    "What is RAG?" → LLM generates:
    "RAG is a technique that combines retrieval from a knowledge base 
     with language model generation to produce grounded responses..."
    → Embed THIS (longer, richer text) for better vector search
    """
    prompt = f"Generate a concise answer to: {query}"
    response = mistral.chat.complete(model="mistral-small", ...)
    return response.choices[0].message.content
```

### Multi-Query Generation

```python
def generate_query_variations(self, query, num_variations=3):
    """
    Original: "How does RAG work?"
    
    Generated variations:
    1. "What is the architecture of retrieval-augmented generation?"
    2. "Explain the RAG pipeline process step by step"
    3. "How does a RAG system retrieve and generate answers?"
    
    → Search with ALL 4 queries → merge results → better recall
    """
```

**Interview Q: When would HyDE hurt performance?**
> HyDE can hurt when the LLM generates a wrong hypothetical answer. If the query is about a very specific, niche topic not in the LLM's training data, the hypothetical document could be misleading, pulling back irrelevant results.

---

## 8. Semantic Caching

```python
class SemanticCache:
    def __init__(self):
        self.cache = {}  # {key: CacheEntry}
        self.similarity_threshold = 0.95  # Only cache hit if > 95% similar
        self.ttl_general = 3600           # 1 hour for general queries
        self.ttl_indexed = 86400          # 24 hours for indexed queries
    
    def get(self, query, query_embedding, site_id=None):
        # 1. Try exact match (MD5 hash of query+site_id)
        exact_key = hashlib.md5(f"{query}:{site_id}".encode()).hexdigest()
        if exact_key in self.cache:
            return self.cache[exact_key].results
        
        # 2. Try semantic match (cosine similarity > 0.95)
        for entry in self.cache.values():
            similarity = cosine_similarity(query_embedding, entry.query_embedding)
            if similarity >= 0.95:
                return entry.results  # CACHE HIT!
        
        return None  # CACHE MISS
```

**Interview Q: Why 0.95 threshold for semantic caching?**
> - **Too low (0.8)**: "What is Python?" matches "What is JavaScript?" — wrong cached answer
> - **Too high (0.99)**: Almost never hits — defeats the purpose of caching
> - **0.95**: Only matches near-identical queries like "What is RAG?" ↔ "what is RAG" ↔ "What's RAG?"

---

## 9. Database Schema — Interview Ready

### Core Table: `documents`

```sql
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source_url TEXT,
    embedding vector(3072),          -- pgvector column
    metadata JSONB DEFAULT '{}',      -- tags, credibility, heading info
    user_id TEXT,
    workspace_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Critical Indexes
CREATE INDEX idx_documents_embedding ON documents 
    USING hnsw (embedding vector_cosine_ops);  -- ANN search

CREATE INDEX idx_documents_content_fts ON documents 
    USING GIN (to_tsvector('english', content)); -- Full-text search

CREATE INDEX idx_documents_source_url ON documents (source_url); -- Site filtering
```

**Interview Q: What is HNSW index and why not brute-force search?**
> - **Brute-force**: Compare query vector against ALL vectors → O(n) → 100ms for 1M docs
> - **HNSW**: Builds a multi-layer graph. Search starts at top (sparse) layer, drills down → O(log n) → 1-5ms for 1M docs
> - **Tradeoff**: HNSW uses more RAM and ~95-99% recall (misses some results), but is 100x faster

### Knowledge Graph Tables

```sql
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT DEFAULT 'concept',  -- person, org, concept, object
    user_id TEXT,
    workspace_id TEXT,
    UNIQUE(name, user_id, workspace_id)
);

CREATE TABLE edges (
    id SERIAL PRIMARY KEY,
    source_node_id INTEGER REFERENCES nodes(id),
    target_node_id INTEGER REFERENCES nodes(id),
    relation TEXT NOT NULL,  -- "works_for", "located_in", "part_of"
    source_url TEXT,
    session_id TEXT,
    user_id TEXT,
    workspace_id TEXT
);
```

---

## 10. Interview Quick-Fire Answers

| Question | Answer |
|:---|:---|
| What is the embedding dimension? | 3072 (Gemini) or 1024 (Mistral), padded to 3072 |
| How many chunks per document? | ~10-50 depending on document size (800 chars/chunk) |
| What's the retrieval latency? | ~50-200ms (hybrid search + rerank) |
| How do you handle multilingual search? | Translate query to English → vector search → translate response back |
| What if the vector DB is down? | Keyword-only fallback via PostgreSQL FTS |
| What if the LLM API is down? | Fallback chain: Mistral → Gemini → Ollama (local) |
| How do you prevent duplicate ingestion? | URL normalization + content hash dedup |
| What's the max context sent to LLM? | 8000 characters (~2000 tokens) |
| How does citation work? | Each chunk gets ID `[db-block-N]`, LLM instructed to cite by ID |
