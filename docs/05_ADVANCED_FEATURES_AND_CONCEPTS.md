# 🧠 SnapMind — Advanced Features & Interview Concepts

> **Prepared for**: TCS NQT Interview Preparation  
> **Focus**: GraphRAG, Multi-Agent Systems, Vision AI, Translation, LLM Routing, Credibility Scoring  
> **Key Concepts**: Knowledge Graphs, Browser Agents, Strategy Pattern, NDJSON Streaming

---

## 1. Knowledge Graph (GraphRAG)

### What is GraphRAG?

Standard RAG fails at **multi-hop reasoning** — questions that require connecting information across multiple documents.

```
Standard RAG: "Who is the CEO of the company that acquired XYZ?"
  Step 1: Search for "CEO" → Finds CEOs of random companies
  Step 2: No connection between "XYZ acquisition" and "CEO name"
  → FAILS (can't walk across documents)

GraphRAG: Same query
  Step 1: Query graph → Finds edge: "XYZ" --acquired_by--> "ABC Corp"
  Step 2: Query graph → Finds edge: "ABC Corp" --ceo--> "Jane Doe"
  → SUCCESS: "Jane Doe is the CEO of ABC Corp, which acquired XYZ"
```

### Entity Extraction with LLM

```python
def extract_graph_data(text, api_keys=None):
    """Uses Mistral Large in JSON mode to extract entities and relations."""
    
    system_prompt = """You are a knowledge graph extractor.
    Extract entities (nodes) and relationships (edges).
    
    Output JSON:
    {
      "nodes": [{"name": "Python", "type": "concept"}],
      "edges": [{"source": "FastAPI", "target": "Python", "relation": "built_with"}]
    }"""
    
    response = client.chat.complete(
        model="mistral-large-latest",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract from:\n\n{text[:8000]}"}
        ],
        response_format={"type": "json_object"}  # Forces valid JSON output
    )
    
    return json.loads(response.choices[0].message.content)
```

### Graph Storage — UPSERT with Deadlock Protection

```python
GRAPH_LOCK = threading.Lock()  # Global mutex

@db_retry(max_retries=15, initial_delay=3)
def insert_graph_data(graph_data, source_url, session_id):
    with GRAPH_LOCK:  # Serialize writes
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Sort nodes alphabetically → prevents lock-order deadlocks
                nodes = sorted(graph_data["nodes"], key=lambda x: x["name"])
                
                for node in nodes:
                    cur.execute(
                        "INSERT INTO nodes (name, entity_type) "
                        "VALUES (%s, %s) "
                        "ON CONFLICT (name) DO UPDATE "
                        "SET entity_type = EXCLUDED.entity_type "
                        "RETURNING id",
                        (node["name"], node.get("type", "concept"))
                    )
                    node_id = cur.fetchone()[0]
                
                for edge in graph_data["edges"]:
                    cur.execute(
                        "INSERT INTO edges (source_node_id, target_node_id, relation) "
                        "VALUES (%s, %s, %s)",
                        (node_id_map[edge["source"]], node_id_map[edge["target"]], edge["relation"])
                    )
            conn.commit()
```

### Graph Context Injection

```python
def get_graph_context(query, api_keys=None):
    """Augments RAG context with graph relationships."""
    
    # 1. Extract entities from query using LLM
    entities = extract_entities_from_query(query)  # ["Python", "FastAPI"]
    
    # 2. Query graph for related edges
    sql = """
        SELECT n1.name, e.relation, n2.name
        FROM edges e
        JOIN nodes n1 ON e.source_node_id = n1.id
        JOIN nodes n2 ON e.target_node_id = n2.id
        WHERE n1.name ILIKE %s OR n2.name ILIKE %s
        LIMIT 15
    """
    
    # 3. Format as text for LLM
    return """
    ### Knowledge Graph Relationships
    - FastAPI built_with Python
    - FastAPI created_by Sebastián Ramírez
    - uvicorn implements ASGI
    """
```

**Interview Q: What is `ON CONFLICT DO UPDATE` (UPSERT)?**
> It combines INSERT and UPDATE. If a row with the same unique key already exists, it updates it instead of throwing a duplicate key error. This is essential for graph data where the same entity (e.g., "Python") may be extracted from multiple documents.

---

## 2. Multi-Agent Browser Research System

### Agent Pipeline

```
User: "What are the latest FastAPI performance benchmarks?"
    │
    ▼
┌─────────────────────────────────────────────────┐
│  QueryAnalyzer (Mistral Small)                  │
│  → "FastAPI 2024 benchmark results TechEmpower" │
│  → "FastAPI vs Django performance comparison"   │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  SearchAgent (Firecrawl Search API)             │
│  → Returns 5 URLs per query (10 total)          │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  RankerAgent (Mistral Small)                    │
│  → LLM scores relevance of each URL             │
│  → Selects top 3 most relevant                  │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  FirecrawlScraper                               │
│  → Scrapes full page content from top 3 URLs    │
│  → Clean markdown extraction                    │
└─────────────────────┬───────────────────────────┘
                      │         │
                      │         ▼ (Background)
                      │    [RAG Ingest] → Auto-index for future queries
                      ▼
┌─────────────────────────────────────────────────┐
│  SlicerAgent (Mistral Small)                    │
│  → Extracts most relevant ~6000 char window     │
│  → Removes navigation, boilerplate              │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  SynthesisAgent (Mistral Large)                 │
│  → Generates cited response from sliced content │
│  → Inline citations: [br-block-run123-1]        │
└─────────────────────────────────────────────────┘
```

### The RAG-First Decision

```python
# Before web search, check local knowledge
if len(local_context) > 4000:
    # Enough local context — skip expensive web search
    return generate_from_local_context(local_context)
else:
    # Insufficient local context — trigger multi-agent web research
    return run_browser_agents(query)
```

### Boilerplate Cleaning — The `clean_scraped_markdown` Function

```python
def clean_scraped_markdown(text):
    """Heuristic-based boilerplate removal."""
    
    # 1. Strip numeric footnotes [1], [23]
    text = re.sub(r'\[\d{1,3}\]', '', text)
    
    # 2. Strip image markdown ![](...)
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    
    # 3. Find "True Start" of content (skip nav/menu/breadcrumbs)
    for i, line in enumerate(lines[:30]):
        if re.match(r'^#+\s+', line):  # First heading
            start_idx = i
            break
        if len(line) > 120 and link_count < 2:  # First real paragraph
            start_idx = i
            break
    
    # 4. Filter high link-density lines (sidebars)
    for line in lines:
        link_count = len(re.findall(r'\[.*?\]\(.*?\)', line))
        word_count = len(line.split())
        link_density = link_count / max(1, word_count // 3)
        if link_density >= 1.0:  # More links than words → it's a menu
            continue  # Skip this line
        final_lines.append(line)
    
    return '\n'.join(final_lines)
```

**Interview Q: What is a multi-agent system?**
> A system where multiple specialized AI agents collaborate. Each agent has a specific role (search, rank, scrape, synthesize) and passes its output to the next. Benefits:
> 1. **Specialization**: Each agent is optimized for one task
> 2. **Modularity**: Can swap agents independently
> 3. **Quality**: Pipeline progressively refines results

---

## 3. LLM Router — Strategy Pattern

### The Pattern

```python
class BaseLLMProvider:
    """Abstract base class — defines the interface"""
    def generate(self, system_content, messages, query): raise NotImplementedError
    def stream(self, system_content, messages): raise NotImplementedError
    async def generate_async(self, system_content, messages, query): raise NotImplementedError

class MistralProvider(BaseLLMProvider):
    def generate(self, system_content, messages, query):
        client = get_mistral_client(self.api_keys)
        response = client.chat.complete(model=self.model_target, messages=messages)
        return response.choices[0].message.content

class GeminiProvider(BaseLLMProvider):
    def generate(self, system_content, messages, query):
        client = get_gemini_client(self.api_keys)
        # Gemini uses different message format
        sys_inst, contents = self._format_gemini_messages(messages)
        response = client.models.generate_content(model=self.model_target, contents=contents)
        return response.text

class OllamaProvider(BaseLLMProvider):
    def generate(self, system_content, messages, query):
        return ollama_client.generate(prompt=query, model=self.model_target)
```

### The Router

```python
class LLMRouter:
    _providers = {
        "mistral": MistralProvider,
        "gemini": GeminiProvider,
        "ollama": OllamaProvider,
        "openai": OpenAIProvider,
    }
    
    @classmethod
    def get_provider(cls, api_keys=None):
        provider_name = api_keys.get("llm_provider", "cloud")
        
        if provider_name in ["local", "hybrid", "ollama"]:
            return OllamaProvider(api_keys, "llama3.2", "Ollama (llama3.2)")
        elif provider_name == "gemini":
            return GeminiProvider(api_keys, "gemini-2.0-flash", "Gemini Flash")
        else:
            return MistralProvider(api_keys, "mistral-small-latest", "Mistral Small")
```

**Interview Q: What is the Strategy Pattern?**
> A behavioral design pattern that defines a family of algorithms (LLM providers), encapsulates each one, and makes them interchangeable. The client (LLMRouter) selects the appropriate strategy at runtime without knowing implementation details.

### Streaming with NDJSON

```python
async def stream(self, prompt, system_instruction, model_id=None, history=None):
    """Generator that yields text chunks for NDJSON streaming."""
    provider = self.get_provider(keys)
    messages = [{"role": "system", "content": system_instruction}]
    messages.append({"role": "user", "content": prompt})
    
    for chunk in provider.stream(system_instruction, messages):
        if chunk:
            yield chunk  # Frontend renders each chunk immediately
```

**Interview Q: What is NDJSON streaming?**
> Newline-Delimited JSON — each line is a complete JSON object, sent as the LLM generates tokens:
```
{"type": "token", "content": "Machine"}
{"type": "token", "content": " learning"}
{"type": "token", "content": " is"}
{"type": "done", "model": "mistral-small"}
```
> Benefits: User sees response building in real-time instead of waiting 5-10s for complete generation.

---

## 4. Source Credibility Scoring

### The Scoring System (0-100)

```python
class CredibilityScorer:
    TIER_1_DOMAINS = {  # 85-100 score
        'nature.com', 'arxiv.org', 'docs.python.org',
        'learn.microsoft.com', 'pytorch.org', 'openai.com'
    }
    
    TIER_2_DOMAINS = {  # 50-70 score
        'wikipedia.org', 'stackoverflow.com', 'github.com',
        'medium.com', 'techcrunch.com', 'bbc.com'
    }
    
    def score(self, source_url, content="", metadata=None):
        factors = {}
        
        # Factor 1: Domain authority (0-40 pts)
        domain = extract_domain(source_url)
        if domain in self.TIER_1_DOMAINS:
            factors['domain_authority'] = 40
        elif domain in self.TIER_2_DOMAINS:
            factors['domain_authority'] = 25
        
        # Factor 2: HTTPS (0-10 pts)
        factors['https_bonus'] = 10 if source_url.startswith('https') else 0
        
        # Factor 3: Content depth (0-25 pts)
        word_count = len(content.split())
        has_headings = bool(re.search(r'^#{1,3}\s', content, re.MULTILINE))
        has_code = '```' in content
        factors['content_depth'] = min(25, word_count // 200 + (4 if has_headings else 0))
        
        # Factor 4: URL quality (0-10 pts)
        if '/docs/' in url or '/api/' in url:
            factors['url_quality'] = 5
        
        # Factor 5: Freshness (0-15 pts)
        factors['freshness'] = 10  # Default moderate
        
        total = sum(factors.values())  # Max: 100
        
        if total >= 70: tier = 'verified'
        elif total >= 50: tier = 'trusted'
        elif total >= 30: tier = 'community'
        else: tier = 'unverified'
        
        return {"score": total, "tier": tier, "factors": factors}
```

### How Credibility Affects Search

```python
# In hybrid_search.py — credibility-weighted scoring
cred_score = metadata.get('credibility_score', 50) / 100.0
match['score'] = match['score'] * (0.7 + 0.3 * cred_score)

# Example:
# docs.python.org (cred=90): score * (0.7 + 0.3 * 0.9) = score * 0.97 (almost no penalty)
# random-blog.com (cred=30): score * (0.7 + 0.3 * 0.3) = score * 0.79 (21% penalty)
```

---

## 5. Content Evolution Tracking

```python
class EvolutionTracker:
    """Detects changes in re-ingested sources and stores version history."""
    
    async def track_change(self, url, content, user_id, workspace_id):
        new_hash = hashlib.md5(content.encode()).hexdigest()
        
        # Check if content changed since last ingestion
        saved_page = db.query("SELECT current_hash FROM saved_pages WHERE url = %s", url)
        
        if saved_page['current_hash'] == new_hash:
            return {"status": "unchanged"}  # No re-ingestion needed
        
        # Content CHANGED! Generate diff summary
        prev_content = db.query("SELECT content FROM content_versions WHERE url = %s ORDER BY created_at DESC LIMIT 1", url)
        
        # Use LLM to summarize what changed
        diff_summary = await self._generate_diff_summary(prev_content, content)
        # → "Added a new section on security. Updated API version from v1 to v2."
        
        # Store version snapshot
        db.insert("content_versions", {
            "source_url": url,
            "content": content,
            "content_hash": new_hash,
            "diff_summary": diff_summary,
            "version_number": prev_version + 1
        })
        
        return {"status": "updated", "version": prev_version + 1, "diff_summary": diff_summary}
```

**Interview Q: Why track content versions?**
> Research sources change over time (Wikipedia edits, documentation updates). Version tracking:
> 1. Prevents re-indexing unchanged content (saves API costs)
> 2. Generates change summaries (user knows what's new)
> 3. Maintains history for audit trails

---

## 6. Vision Analysis (Multimodal)

```python
# Using Groq's Llama 4 Scout for vision
from groq import Groq

client = Groq(api_key=groq_key)

response = client.chat.completions.create(
    model="meta-llama/llama-4-scout-17b-16e-instruct",
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": "Describe this screenshot"},
            {"type": "image_url", "image_url": {
                "url": f"data:image/png;base64,{base64_image}"
            }}
        ]
    }]
)

analysis = response.choices[0].message.content
```

### Vision + Browser Agent Integration

```python
# When user provides a screenshot with their query:
if image_data:
    # 1. Analyze image first
    vision_context = analyze_image(image_data, query)
    
    # 2. Use vision analysis as additional context for web search
    enriched_query = f"{query}\n\nVisual context: {vision_context}"
    
    # 3. Run browser agents with enriched query
    result = await browser_orchestrator.research(enriched_query)
```

---

## 7. Multi-Language Translation Pipeline

```python
# Translation flow:
# 1. Rapid English pre-check (regex, no API call)
def is_likely_english(text):
    non_ascii = sum(1 for c in text if ord(c) > 127)
    return non_ascii / len(text) < 0.2  # < 20% non-ASCII = probably English

# 2. Primary: Lingo.dev API (fast, high quality)
async with httpx.AsyncClient(timeout=90.0, http2=True) as client:
    response = await client.post(
        "https://api.lingo.dev/v1/translate",
        headers={"Authorization": f"Bearer {lingo_key}"},
        json={"text": text, "source": "auto", "target": "en"}
    )

# 3. Fallback: Mistral JSON-mode translation
if lingo_failed:
    response = mistral.chat.complete(
        model="mistral-small",
        messages=[{"role": "user", "content": f"Translate to English: {text}"}],
        response_format={"type": "json_object"}
    )
```

**Interview Q: Why translate before embedding?**
> Embeddings are language-sensitive. "machine learning" and "机器学习" produce very different vectors. Translating to English first ensures all content is in the same semantic space, making vector search accurate across languages.

---

## 8. Research Report Generator

```python
from docx import Document
from docx.shared import Pt, Inches

def generate_report(topic, documents, bookmarks):
    """Generates DOCX research paper from indexed content."""
    
    # 1. Gather ALL context (no truncation for reports)
    all_context = "\n\n".join([doc['content'] for doc in documents])
    all_bookmarks = "\n".join([b['content'] for b in bookmarks])
    
    # 2. LLM generates structured paper
    prompt = f"""Write a formal academic research paper on: {topic}
    
    Use this indexed research:
    {all_context}
    
    Include: Abstract, Introduction, Literature Review, Methodology,
    Core Analysis, Discussion, Conclusion, References
    """
    
    paper_text = mistral.chat.complete(model="mistral-large", ...)
    
    # 3. Convert Markdown → DOCX
    doc = Document()
    doc.add_heading(topic, level=0)
    
    for line in paper_text.split('\n'):
        if line.startswith('## '):
            doc.add_heading(line[3:], level=2)
        elif line.startswith('- '):
            doc.add_paragraph(line[2:], style='List Bullet')
        else:
            doc.add_paragraph(line)
    
    doc.save(f'/tmp/{topic}_report.docx')
```

---

## 9. Feature Flags — Runtime Configuration

```python
class SnapMindSettings(BaseSettings):
    # Feature flags (toggle via environment variables)
    graphrag_enabled: bool = Field(True, env="GRAPHRAG_ENABLED")
    agentic_chunking_enabled: bool = Field(True, env="AGENTIC_CHUNKING_ENABLED")
    
    # Search tuning
    search_mode: str = Field("hybrid", env="SEARCH_MODE")   # hybrid/vector_only/keyword_only
    rerank_enabled: bool = Field(True, env="RERANK_ENABLED")
    hyde_enabled: bool = Field(True, env="HYDE_ENABLED")
    
    # Cache tuning
    cache_enabled: bool = Field(True, env="CACHE_ENABLED")
    cache_similarity_threshold: float = Field(0.95, env="CACHE_SIMILARITY_THRESHOLD")
```

**Interview Q: What are feature flags?**
> Boolean configuration values that enable/disable features at runtime without code changes. Benefits:
> 1. **A/B testing**: Enable GraphRAG for 50% of users
> 2. **Gradual rollout**: Enable new feature for internal users first
> 3. **Kill switch**: Disable a buggy feature instantly via env var change
> 4. **Cost control**: Disable expensive features (reranking) if API budget runs out

---

## 10. Interview Quick-Fire — Advanced Concepts

| Question | Answer |
|:---|:---|
| **What is GraphRAG?** | Enhances RAG with knowledge graph relationships for multi-hop reasoning |
| **What is UPSERT?** | INSERT if new, UPDATE if exists (ON CONFLICT DO UPDATE) |
| **What is a deadlock?** | Two threads each holding a resource the other needs — both wait forever |
| **What is the Strategy Pattern?** | Family of interchangeable algorithms selected at runtime (LLM providers) |
| **What is NDJSON?** | Newline-Delimited JSON — each line is a complete JSON object for streaming |
| **What is HyDE?** | Generate a fake answer, embed it for better retrieval (Hypothetical Document Embeddings) |
| **What is a cross-encoder?** | Neural model that jointly scores (query, document) pairs for relevance |
| **What is Jaccard similarity?** | Set overlap: `|A ∩ B| / |A ∪ B|` — used for deduplication |
| **What is RRF?** | Reciprocal Rank Fusion — combines ranked lists: `1/(k + rank)` |
| **What is a feature flag?** | Runtime toggle for enabling/disabling features via config |
| **What is MCP?** | Model Context Protocol — standard for AI agents to use external tools |
| **What is boilerplate stripping?** | Removing navigation, menus, footers from scraped web pages |
| **What is credibility scoring?** | Heuristic 0-100 score based on domain, HTTPS, content depth |
| **What is content versioning?** | Tracking changes across re-ingested sources with diff summaries |
| **What is zero-padding?** | Appending zeros to a short vector to match DB column dimension |
