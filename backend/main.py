from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv

# Import our pipeline logic
from rag_pipeline import ingest_website_logic
from search import chat_logic

load_dotenv()

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    from database import get_db_pool
    pool = get_db_pool()
    if pool:
        print("Shutting down database pool...")
        pool.close()

app = FastAPI(title="Snapmind Backend", lifespan=lifespan)

# Allow CORS for Chrome Extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    url: str
    text_content: str | None = None # [NEW] For Visual/Manual Ingest
    crawl_mode: str = "single"  # "single" or "multi"
    max_pages: int = 50  # For multi-page crawling
    max_depth: int = 3   # For multi-page crawling
    target_lang: str = "auto"  # [NEW] Language for Lingo.dev translation
    session_id: str | None = None # [NEW] Phase 25: Conversation-Scoped Graph

class RepoIngestRequest(BaseModel):
    repo_url: str
    target_lang: str = "auto"
    session_id: str | None = None # [NEW] Phase 25: Conversation-Scoped Graph

class ChatRequest(BaseModel):
    query: str
    search_query: str | None = None # [NEW] Pre-translated query for searching
    query_lang: str | None = None   # [NEW] Original language of the query
    output_lang: str = "auto"       # [NEW] Forced Output Language (Feature 5)
    context_url: str | None = None
    page_content: str | None = None  # [NEW] Allow direct text context
    content_blocks: list[dict] | None = None # [NEW] Structured blocks for citation
    site_id: str | None = None # [NEW] Phase 3: Context Switching (UUID)
    history: list[dict] | None = None # [NEW] Conversational History
    session_id: str | None = None # [NEW] Phase 5: Semantic Chat Memory
    query_notebook: bool = False # [NEW] Phase 20: Research Notebook Correlation
class SuggestRequest(BaseModel):
    page_content: str | None = None
    url: str | None = None
    site_id: str | None = None

class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "auto"

class BookmarkRequest(BaseModel):
    content: str
    source_url: str | None = None
    metadata: dict | None = None

@app.get("/")
def health_check():
    """Minimal health check for Hugging Face health monitor."""
    return {"status": "ok", "service": "Snapmind Backend"}

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
            "supabase_url": "SET" if os.getenv("DATABASE_URL") else "MISSING"
        }
    }

@app.post("/ingest")
async def ingest_endpoint(request: IngestRequest, req: Request):
    """
    Ingests a URL (via Firecrawl) OR raw text (e.g. VLM output) into the RAG database.
    Supports both single-page and multi-page crawling.
    Processes synchronously so the frontend can display completion status.
    """
    print(f"Accepted ingestion request: {request.url} (mode: {request.crawl_mode})")
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
        "firecrawl": req.headers.get("x-firecrawl-key")
    }
    
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

@app.post("/ingest/file")
async def ingest_file_endpoint(
    req: Request,
    file: UploadFile = File(...),
    site_url: str = Form(None),
    target_language: str = Form("auto"),
    session_id: str = Form(None)
):
    """
    Accepts locally uploaded files (PDF, DOCX, CSV, TXT), parses their content,
    translates them if requested, and ingests them into the RAG database.
    """
    file_bytes = await file.read()
    filename = file.filename
    content_type = file.content_type
    
    api_keys = {
        "gemini": req.headers.get("x-gemini-key"),
        "mistral": req.headers.get("x-mistral-key"),
        "lingodev": req.headers.get("x-lingodev-key"),
    }
    
    # Use provided site URL as the "source", or default to a fake file:// URL
    source_url = site_url if site_url else f"file://{filename}"
    
    print(f"Accepted file upload for processing: {filename} ({content_type}) -> Source: {source_url}, Target Lang: {target_language}")
    
    from rag_pipeline import ingest_file_logic
    result = ingest_file_logic(source_url, file_bytes, filename, content_type, target_lang=target_language, api_keys=api_keys, session_id=session_id)
    
    return result

@app.post("/ingest/github")
def ingest_github_endpoint(request: RepoIngestRequest, req: Request, background_tasks: BackgroundTasks):
    """
    Ingest a full GitHub repository in the background.
    Returns a job_id that can be polled via GET /ingest/status/{job_id}.
    """
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

@app.post("/chat/stream")
async def chat_stream_endpoint(request: ChatRequest, req: Request):
    """
    Streaming Chat Endpoint. Returns NDJSON.
    """
    from fastapi.responses import StreamingResponse
    from search import chat_logic_stream
    
    print(f"Stream query: {request.query} (Site ID: {request.site_id})")
    
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
            request.site_id, 
            request.history, 
            request.session_id, 
            api_keys=api_keys,
            search_query=request.search_query,
            query_lang=request.query_lang,
            output_lang=request.output_lang,
            query_notebook=request.query_notebook
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

class AnalyzeImageRequest(BaseModel):
    image_data: str # Base64 string
    prompt: str | None = None
    mode: str = "qa" # [NEW] "qa" or "extraction"

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
    
    result = analyze_image_logic(image_bytes, request.prompt, request.mode, api_keys=api_keys)
    
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

@app.delete("/sites/{site_id}")
def delete_site(site_id: str):
    """Deletes all documents for a given source URL."""
    try:
        from database import get_db_pool
        db_pool = get_db_pool()
        # Delete all documents with this source_url
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM documents WHERE source_url = %s", (site_id,))
            conn.commit()
        return {"success": True, "deleted_url": site_id}
    except Exception as e:
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
                           (SELECT content FROM chat_sessions WHERE session_id = e.session_id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as title,
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

if __name__ == "__main__":
    # Local development uses port 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

