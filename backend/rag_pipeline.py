import os
import asyncio
import json
from database import get_db_pool
from dotenv import load_dotenv
from typing import List, Tuple, Dict, Any
import concurrent.futures
import requests
import time
from api_clients import get_gemini_client, get_mistral_client, get_firecrawl_key, get_lingo_key, genai

# 1. Load Environment Variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Initialize Database
db_pool = get_db_pool()

FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"

# Import configuration
from config import ChunkingConfig, EmbeddingConfig, FeatureFlags

# Import semantic chunking
from chunking import chunk_text

# Import custom crawler
from custom_crawler import extract_links_from_page, crawl_multiple_pages_custom

# Import Agentic Chunking
from agentic_chunking import run_agentic_chunking

def translate_text_lingo(text: str, target_lang: str = "en", api_keys: dict = None) -> tuple[str, str, bool]:
    """
    Translates text to a target language using the Lingo.dev API via direct REST.
    Returns: (translated_text, original_lang, is_translated)
    """
    
    print(f"[LINGO] translate_text_lingo called: target_lang={target_lang}, text_len={len(text) if text else 0}")
    
    lingo_key = get_lingo_key(api_keys)
    if not lingo_key or not text or not text.strip():
        # Fallback to Mistral if no Lingo key but text exists
        if text and text.strip():
            print(f"[LINGO] No API key found (key={'SET' if lingo_key else 'MISSING'}). Falling back to Mistral for translation to {target_lang}.")
            return translate_text_mistral(text, target_lang, api_keys)
        return text.strip() if text else "", "unknown", False

        
    try:
        # 1. Detect language (single attempt, fast fail → Mistral fallback)
        src_lang = "unknown"
        try:
            detect_resp = requests.post(
                "https://engine.lingo.dev/recognize",
                headers={"Authorization": f"Bearer {lingo_key}", "Content-Type": "application/json; charset=utf-8"},
                json={"text": text[:5000]},
                timeout=5
            )
            if detect_resp.status_code == 200:
                src_lang = detect_resp.json().get("locale", "unknown")
                print(f"[LINGO] Detected source language: {src_lang}")
            else:
                print(f"[LINGO] Detection API returned {detect_resp.status_code}: {detect_resp.text[:200]}")
        except requests.exceptions.Timeout:
            print(f"[LINGO] Detection timed out (5s). Falling back to Mistral for translation to {target_lang}.")
            return translate_text_mistral(text, target_lang, api_keys)


        # Skip translation if already in target language or auto
        if target_lang == "auto":
            print(f"[LINGO] target_lang is 'auto', skipping translation.")
            return text, src_lang, False
        if src_lang == target_lang and src_lang != "unknown":
            print(f"[LINGO] Source ({src_lang}) == Target ({target_lang}), skipping translation.")
            return text, src_lang, False

        # 2. Translate
        import uuid
        # When src_lang is unknown, omit "source" to let Lingo auto-detect
        locale_payload = {"target": target_lang}
        if src_lang != "unknown":
            locale_payload["source"] = src_lang
        
        request_data = {
            "params": {"workflowId": str(uuid.uuid4()), "fast": True},
            "locale": locale_payload,
            "data": {"text": text},
        }
        
        print(f"[LINGO] Sending translation request: src={src_lang}, target={target_lang}, text_len={len(text)}")
        
        translated_text = text
        is_trans = False
        try:
            trans_resp = requests.post(
                "https://engine.lingo.dev/i18n",
                headers={"Authorization": f"Bearer {lingo_key}", "Content-Type": "application/json; charset=utf-8"},
                json=request_data,
                timeout=30
            )
            if trans_resp.status_code == 200:
                data = trans_resp.json().get("data", {})
                translated_text = data.get("text", text)
                # Use text comparison as primary indicator - if the text changed, it was translated
                is_trans = (translated_text != text and len(translated_text) > 0)
                print(f"[LINGO] Translation success: is_trans={is_trans}, output_len={len(translated_text)}")
                if is_trans:
                    print(f"[LINGO] Translation preview: '{translated_text[:100]}...'")
            else:
                print(f"[LINGO] Translation API returned {trans_resp.status_code}: {trans_resp.text[:300]}")
                print(f"[LINGO] Falling back to Mistral for translation to {target_lang}.")
                return translate_text_mistral(text, target_lang, api_keys)
        except requests.exceptions.Timeout:
            print(f"[LINGO] Translation timed out (30s). Falling back to Mistral for translation to {target_lang}.")
            return translate_text_mistral(text, target_lang, api_keys)
                
        return translated_text, src_lang, is_trans
            
    except Exception as e:
        print(f"[LINGO] REST Error: {e}. Falling back to Mistral for translation to {target_lang}...")
        import traceback
        traceback.print_exc()
        return translate_text_mistral(text, target_lang, api_keys)


def translate_text_mistral(text: str, target_lang: str = "en", api_keys: dict = None) -> tuple[str, str, bool]:
    """
    Fallback translation using Mistral.
    """
    try:
        mistral_client = get_mistral_client(api_keys)
        if not mistral_client:
            return text, "unknown", False
            
        prompt = f"Detect the language of the following text and translate it to {target_lang}.\n" \
                 f"Output ONLY a valid JSON object with 'detected_lang' (ISO code) and 'translated_text'.\n\n" \
                 f"Text: {text}"
                 
        start_time = time.time()
        resp = mistral_client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        try:
            content = resp.choices[0].message.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()
                
            res = json.loads(content)
            src_lang = res.get("detected_lang", "unknown")

            translated = res.get("translated_text", text)
            is_trans = (src_lang != target_lang and src_lang != "unknown" and translated != text)
            
            print(f"[FALLBACK] Mistral translated from {src_lang} to {target_lang} in {time.time()-start_time:.2f}s")
            return translated, src_lang, is_trans
        except json.JSONDecodeError:
            print("[FALLBACK] Mistral returned invalid JSON")
            return text, "unknown", False
            
    except Exception as e:
        print(f"[FALLBACK] Mistral translation failed: {e}")
        return text, "unknown", False

def extract_semantic_tags(text: str, api_keys: dict = None) -> List[str]:
    """Uses Mistral to extract 3-5 core entity tags from the text."""
    try:
        mistral_client = get_mistral_client(api_keys)
        if not mistral_client or not text:
            return []
            
        response = mistral_client.chat.complete(
            model="mistral-small-latest",
            messages=[{
                "role": "system", 
                "content": "You are a semantic tag extractor. Read the text and extract 2-5 highly relevant, single-word or short-phrase technical tags (e.g. 'React', 'Git', 'Authentication', 'Python'). DO NOT include explanations, generic words like 'code' or 'tutorial', or markdown. Output strictly a JSON object with a 'tags' key containing an array of strings: {\"tags\": [\"tag1\", \"tag2\"]}."
            }, {
                "role": "user",
                "content": text[:3000] # Limit context injection to save speed/tokens
            }],
            response_format={"type": "json_object"}
        )
        
        # Parse JSON
        content = response.choices[0].message.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()
        
        import json
        tag_list = json.loads(content)
        
        # In case the model wrapped it in an object like {"tags": []}
        if isinstance(tag_list, dict):
            for val in tag_list.values():
                if isinstance(val, list):
                    return val[:5]
            return []
            
        if isinstance(tag_list, list):
            return [str(t) for t in tag_list][:5]
            
        return []
    except Exception as e:
        print(f"[TAGGING] Extraction failed: {e}")
        return []

def scrape_website_firecrawl(url: str, max_retries: int = 3, api_keys: dict = None) -> tuple[str, str | None]:
    firecrawl_key = get_firecrawl_key(api_keys)
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {firecrawl_key}"}
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                f"{FIRECRAWL_BASE_URL}/scrape",
                headers=headers,
                json={
                    "url": url,
                    "formats": ["markdown", "rawHtml"],
                    "onlyMainContent": True,
                    "includeTags": ["p", "h1", "h2", "h3", "code", "pre"],
                    "excludeTags": ["nav", "header", "footer", "script"]
                },
                timeout=45
            )
            
            if response.status_code == 200:
                data = response.json()
                data_obj = data.get('data', {})
                content = (data_obj.get('markdown') or 
                          data_obj.get('raw') or 
                          data.get('html', ''))
                
                title = data_obj.get('metadata', {}).get('title')
                
                if content and len(content) > 200:
                    return content, title
            else:
                print(f"[SCRAPE] Firecrawl error {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Scrape attempt {attempt} failed: {e}")
        
        time.sleep(2 ** attempt)
    
    print(f"[SCRAPE] Falling back to simple scrape for {url}")
    return simple_scrape_fallback(url), None


def crawl_website_firecrawl(url: str, max_pages: int = 50, max_depth: int = 3, api_keys: dict = None) -> List[Dict[str, str]]:
    """
    Crawl multiple pages using Firecrawl Crawl API.
    
    Args:
        url: Starting URL
        max_pages: Maximum number of pages to crawl
        max_depth: Maximum crawl depth
        
    Returns:
        List of {url, content} dictionaries
    """
    firecrawl_key = get_firecrawl_key(api_keys)
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {firecrawl_key}"}
    
    print(f"[CRAWL] Starting multi-page crawl: {url} (max_pages={max_pages}, max_depth={max_depth})")
    
    # Firecrawl requires maxDepth to be absolute. Calculate start depth to avoid BAD_REQUEST.
    url_depth = max(0, url.count('/') - 2)
    actual_max_depth = max(max_depth, url_depth + 2)
    
    try:
        # Start crawl job
        response = requests.post(
            f"{FIRECRAWL_BASE_URL}/crawl",
            headers=headers,
            json={
                "url": url,
                "limit": max_pages,
                "maxDepth": actual_max_depth,
                "scrapeOptions": {
                    "formats": ["markdown"],
                    "onlyMainContent": True
                }
            },
            timeout=60
        )
        
        if response.status_code != 200:
            print(f"[CRAWL] Failed to start crawl: {response.status_code}")
            print(f"[CRAWL] Response: {response.text}")
            # Fallback to single page scraping
            print(f"[CRAWL] Falling back to single-page scrape")
            content = scrape_website_firecrawl(url)
            if content:
                return [{'url': url, 'content': content}]
            return []
        
        data = response.json()
        print(f"[CRAWL] DEBUG: Start response: {data}")
        job_id = data.get('jobId') or data.get('id')
        
        if not job_id:
            print("[CRAWL] No job ID returned")
            print(f"[CRAWL] Response: {data}")
            # Fallback to single page
            print(f"[CRAWL] Falling back to single-page scrape")
            content, title = scrape_website_firecrawl(url)
            if content:
                return [{'url': url, 'content': content, 'title': title}]
            return []
        
        print(f"[CRAWL] Job started: {job_id}")
        
        # Poll for completion (max 5 minutes)
        max_wait = 300  # 5 minutes
        poll_interval = 5  # 5 seconds
        elapsed = 0
        
        while elapsed < max_wait:
            time.sleep(poll_interval)
            elapsed += poll_interval
            
            # Check status
            status_response = requests.get(
                f"{FIRECRAWL_BASE_URL}/crawl/{job_id}",
                headers=headers,
                timeout=30
            )
            
            if status_response.status_code != 200:
                print(f"[CRAWL] Status check failed: {status_response.status_code}")
                continue
            
            status_data = status_response.json()
            status = status_data.get('status')
            completed = status_data.get('completed', 0)
            total = status_data.get('total', 0)
            
            print(f"[CRAWL] Status: {status}, Progress: {completed}/{total}")
            
            if status == 'completed':
                # v1 API returns data directly in the response
                crawled_pages = status_data.get('data', [])
                
                print(f"[CRAWL] DEBUG: Found {len(crawled_pages)} pages in response")
                print(f"[CRAWL] DEBUG: Response keys: {status_data.keys()}")
                
                results = []
                for page in crawled_pages:
                    page_url = page.get('url', '') or page.get('metadata', {}).get('sourceURL', '')
                    # v1 API uses 'markdown' field
                    markdown = page.get('markdown', '')
                    
                    if markdown and len(markdown) > 200:
                        results.append({
                            'url': page_url,
                            'content': markdown,
                            'title': page.get('metadata', {}).get('title')
                        })
                
                print(f"[CRAWL] Completed: {len(results)} pages crawled")
                
                # If only 1 page was crawled, use custom crawler
                if len(results) <= 1 and max_pages > 1:
                    print(f"[CRAWL] Only 1 page found by Firecrawl, trying custom crawler...")
                    custom_results = crawl_multiple_pages_custom(url, max_pages)
                    if len(custom_results) > len(results):
                        print(f"[CRAWL] Custom crawler found {len(custom_results)} pages, using those instead")
                        return custom_results
                
                # If still no results, fallback to single-page scrape
                if len(results) == 0:
                    print(f"[CRAWL] WARNING: No valid pages found. Full response: {status_data}")
                    print(f"[CRAWL] Falling back to single-page scrape for: {url}")
                    content, title = scrape_website_firecrawl(url)
                    if content:
                        return [{'url': url, 'content': content, 'title': title}]
                
                return results
            
            elif status == 'failed':
                print(f"[CRAWL] Job failed")
                return []
        
        print(f"[CRAWL] Timeout after {max_wait}s")
        return []
        
    except Exception as e:
        print(f"[CRAWL] Error: {e}")
        import traceback
        traceback.print_exc()
        return []


def simple_scrape_fallback(url: str) -> str:
    """🛡️ BeautifulSoup fallback"""
    try:
        from bs4 import BeautifulSoup
        
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(response.content, 'html.parser')
        
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()
        
        main_content = soup.find('main') or soup.find('article') or soup.body
        text = main_content.get_text(separator='\n', strip=True)
        return text[:50000]
        
    except:
        return ""

def embed_single_chunk(chunk: str, api_keys: dict = None) -> Tuple[str, List[float]]:
    try:
        model_name = EmbeddingConfig.EMBEDDING_MODEL
        
        # 1. Mistral Embedding Flow
        if "mistral" in model_name.lower():
            mistral_client = get_mistral_client(api_keys)
            if mistral_client:
                # Mistral SDK usage: mistral_client.embeddings.create(model="mistral-embed", inputs=[chunk])
                result = mistral_client.embeddings.create(
                    model=model_name,
                    inputs=[chunk]
                )
                embedding = result.data[0].embedding
                if not embedding or len(embedding) == 0:
                    raise ValueError("Empty embedding returned from Mistral")
                return (chunk, embedding)
        
        # 2. Gemini Embedding Flow (Fallback or Default)
        gemini_client = get_gemini_client(api_keys)
        result = gemini_client.models.embed_content(
            model="gemini-embedding-001" if "gemini" not in model_name.lower() else model_name,
            contents=chunk,
        )
        
        embedding = result.embeddings[0].values
        
        if not embedding or len(embedding) == 0:
            raise ValueError("Empty embedding returned from Gemini")
        
        return (chunk, embedding)
    except Exception as e:
        print(f"Embedding error for chunk: {e}")
        raise

def parallel_embed_chunks(chunks: List[dict], max_workers: int = None, source_url: str = "", api_keys: dict = None, page_title: str = None) -> List[dict]:
    """
    Embed chunks in parallel using ThreadPoolExecutor.
    
    Args:
        chunks: List of chunk dictionaries with 'content' and optional 'metadata'
        max_workers: Maximum number of parallel workers
        source_url: Source URL for the chunks
        page_title: Title of the page (to be added to metadata)
        
    Returns:
        List of dictionaries ready for database insertion
    """
    if max_workers is None:
        max_workers = EmbeddingConfig.MAX_EMBEDDING_WORKERS
    
    data_list = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Extract content from chunks
        chunk_contents = [chunk.get('content', '') for chunk in chunks]
        
        # Submit all embedding tasks
        future_to_chunk = {
            executor.submit(embed_single_chunk, content, api_keys): (content, chunks[i])
            for i, content in enumerate(chunk_contents)
        }
        
        # Collect results
        for future in concurrent.futures.as_completed(future_to_chunk):
            try:
                content, embedding = future.result()
                original_chunk = future_to_chunk[future][1]
                metadata = original_chunk.get('metadata', {})
                
                # [NEW] Inject title if provided
                if page_title:
                    metadata['title'] = page_title
                
                data_list.append({
                    "content": content,
                    "embedding": embedding,
                    "source_url": source_url,
                    "metadata": metadata
                })
            except Exception as e:
                print(f"Failed to embed chunk: {e}")
                continue
    
    return data_list

def normalize_url(url: str) -> str:
    """Normalize URL for consistent storage. Preserves query strings (e.g. YouTube ?v=...)."""
    try:
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(url)
        # Rebuild URL: keep scheme, netloc, stripped path, params, query, and NO fragment
        normalized = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path.rstrip('/'),
            parsed.params,
            parsed.query,   # IMPORTANT: preserve query string (e.g. ?v=xxxx for YouTube)
            ''              # strip fragment (#anchor)
        ))
        return normalized
    except:
        return url

def ingest_website_logic(url: str, api_keys: dict = None, target_lang: str = "auto", session_id: str = None) -> Dict[str, Any]:
    """Backend logic for ingesting a website."""
    global FeatureFlags
    
    # Normalize URL for consistent storage
    try:
        normalized_url = normalize_url(url)
        print(f"[INGEST] Normalizing URL: {url[:100]}...")
    except Exception as e:
        print(f"[INGEST] URL normalization failed: {e}")
        normalized_url = url
        
    # [NEW] Phase 19: Ingestion Job Tracking
    job_id = None
    if db_pool:
        try:
            with db_pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO ingestion_jobs (url, status, message) VALUES (%s, %s, %s) RETURNING job_id",
                        (normalized_url, "processing", "Scraping and indexing website...")
                    )
                    job_id = cur.fetchone()[0]
                conn.commit()
        except Exception as e:
            print(f"[INGEST] Warning: Could not create job row: {e}")

    def update_job_status(status, message, chunks=0):
        if job_id and db_pool:
            try:
                with db_pool.connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "UPDATE ingestion_jobs SET status = %s, message = %s, chunks_count = %s WHERE job_id = %s",
                            (status, message, chunks, job_id)
                        )
                    conn.commit()
            except Exception as e:
                print(f"[INGEST] Warning: Could not update job status: {e}")
    if "youtube.com" in url.lower() or "youtu.be" in url.lower():
        print(f"[INGEST] YouTube URL detected. Routing to transcript parser...")
        from youtube_parser import get_youtube_transcript
        success, text_content, error_msg, yt_title = get_youtube_transcript(url)
        
        if success:
            # Pass the requested language so Lingo.dev translates the transcript
            print(f"[INGEST] Passing YouTube transcript to ingest_text_logic (target_lang={target_lang}, session={session_id})")
            res = ingest_text_logic(normalized_url, text_content, target_lang=target_lang, api_keys=api_keys, session_id=session_id, page_title=yt_title)
            if res.get("success"):
                update_job_status("completed", res.get("message", "Success"), res.get("chunks_count", 0))
            else:
                update_job_status("failed", res.get("error", "YouTube ingestion failed"))
            return res
        else:
            update_job_status("failed", f"YouTube Transcript error: {error_msg}")
            return {"success": False, "error": f"YouTube Transcript error: {error_msg}"}

    # [NEW] Twitter/X Thread Interception
    if "twitter.com" in url.lower() or "x.com" in url.lower():
        print(f"[INGEST] Twitter/X URL detected. Routing to thread parser...")
        from twitter_parser import get_twitter_thread
        success, thread_content, error_msg = get_twitter_thread(url)
        
        if success:
            print(f"[INGEST] Passing Twitter thread to ingest_text_logic (target_lang={target_lang}, session={session_id})")
            res = ingest_text_logic(normalized_url, thread_content, target_lang=target_lang, api_keys=api_keys, session_id=session_id)
            if res.get("success"):
                update_job_status("completed", res.get("message", "Success"), res.get("chunks_count", 0))
            else:
                update_job_status("failed", res.get("error", "Twitter ingestion failed"))
            return res
        else:
            update_job_status("failed", f"Twitter Thread error: {error_msg}")
            return {"success": False, "error": f"Twitter Thread error: {error_msg}"}
    
    # 1. Extract content
    markdown_content, page_title = scrape_website_firecrawl(url, api_keys=api_keys)
    
    if not markdown_content or len(markdown_content) < 100:
        update_job_status("failed", "Insufficient content found (Page protected or empty)")
        return {"success": False, "error": "Insufficient content found. The page might be protected or empty."}
    
    # 2. Extract semantic tags
    print(f"[INGEST] Extracting semantic tags via Mistral...")
    extracted_tags = extract_semantic_tags(markdown_content, api_keys=api_keys)
    
    # [NEW] Phase 13: GraphRAG Extraction
    if FeatureFlags.GRAPHRAG_ENABLED:
        from graph_logic import extract_graph_data, insert_graph_data
        print(f"[INGEST] Extracting GraphRAG data...")
        graph_data = extract_graph_data(markdown_content, api_keys=api_keys)
        if graph_data.get("nodes") or graph_data.get("edges"):
            insert_graph_data(graph_data, normalized_url, session_id=session_id)

    # 2.5: Translate content via Lingo.dev
    markdown_content, original_lang, is_translated = translate_text_lingo(markdown_content, target_lang=target_lang, api_keys=api_keys)
    
    # 3. Chunk with semantic chunking (configurable via FeatureFlags)
    chunks = chunk_text(
        markdown_content, 
        max_chars=ChunkingConfig.TARGET_CHUNK_SIZE,
        source_url=normalized_url,
        use_semantic=FeatureFlags.PHASE_1_SEMANTIC_CHUNKING
    )
    
    if not chunks:
        update_job_status("failed", "No valid chunks created from content")
        return {"success": False, "error": "No valid chunks created from the scraped content."}
    
    print(f"[INGEST] Created {len(chunks)} chunks")
    
    # Inject translation metadata and tags
    for chunk in chunks:
        if "metadata" not in chunk:
            chunk["metadata"] = {}
        chunk["metadata"]["tags"] = extracted_tags
        chunk["metadata"]["original_lang"] = original_lang
        chunk["metadata"]["translated"] = is_translated
    
    data_list = parallel_embed_chunks(
        chunks,
        max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
        source_url=normalized_url,
        api_keys=api_keys,
        page_title=page_title
    )
    
    if not data_list:
        update_job_status("failed", "Failed to create embeddings")
        return {"success": False, "message": "Failed to create embeddings."}
    
    # 4. Bulk insert
    try:
        if not db_pool:
            update_job_status("failed", "Database not configured on server")
            return {"success": False, "error": "Database not configured on server."}
            
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                args_list = [
                    (d["content"], d["source_url"], d["embedding"], json.dumps(d["metadata"]))
                    for d in data_list
                ]
                cur.executemany(
                    "INSERT INTO documents (content, source_url, embedding, metadata) VALUES (%s, %s, %s, %s)",
                    args_list,
                    returning=False
                )
            conn.commit()
            
        return {
            "success": True, 
            "message": f"Successfully ingested {len(data_list)} chunks.",
            "chunks_count": len(data_list),
            "source_url": normalized_url
        }
    except Exception as e:
        import traceback
        print(f"[INGEST FATAL ERROR] {e}")
        traceback.print_exc()
        update_job_status("failed", f"Fatal error: {str(e)}")
        return {"success": False, "error": f"Fatal ingestion error: {str(e)}"}

def ingest_text_logic(url: str, text_content: str, target_lang: str = "auto", api_keys: dict = None, extra_metadata: dict = None, session_id: str = None, page_title: str = None) -> Dict[str, Any]:
    """Ingest raw text content (e.g., from VLM extraction)."""
    global FeatureFlags
    try:
        normalized_url = normalize_url(url)
        print(f"[INGEST_TEXT] Processing text for: {normalized_url}")
        
        if not text_content or len(text_content.strip()) < 10:
            return {"success": False, "message": "Insufficient text content."}
        
        # 1. Translate content via Lingo.dev (Translate BEFORE chunking for correct embeddings)
        print(f"[INGEST_TEXT] Checking for translation (target: {target_lang})...")
        translated_text, original_lang, is_translated = translate_text_lingo(text_content, target_lang=target_lang, api_keys=api_keys)
        
        # Use translated text for everything else
        if is_translated:
            print(f"[INGEST_TEXT] Translated from {original_lang} to {target_lang}.")
            text_content = translated_text

        # 2. Chunk the (possibly translated) text
        if FeatureFlags.PHASE_15_AGENTIC_CHUNKING:
            print("[INGEST_TEXT] Using Agentic Semantic Chunking...")
            chunks = run_agentic_chunking(
                text_content, 
                api_keys=api_keys, 
                target_chunk_size=ChunkingConfig.AGENTIC_CHUNKING_TARGET_SIZE
            )
        else:
            chunks = chunk_text(
                text_content,
                max_chars=ChunkingConfig.TARGET_CHUNK_SIZE,
                source_url=normalized_url,
                use_semantic=FeatureFlags.PHASE_1_SEMANTIC_CHUNKING
            )
        
        if not chunks:
            return {"success": False, "error": "No valid chunks created from text."}
        
        print(f"[INGEST_TEXT] Created {len(chunks)} chunks")
        
        # 3. Extract Semantic Tags
        print("[INGEST_TEXT] Extracting semantic tags via Mistral...")
        extracted_tags = extract_semantic_tags(text_content, api_keys=api_keys)
        print(f"[INGEST_TEXT] Graph Tags Found: {extracted_tags}")
        
        # [NEW] Phase 13: GraphRAG Extraction
        if FeatureFlags.GRAPHRAG_ENABLED:
            from graph_logic import extract_graph_data, insert_graph_data
            graph_data = extract_graph_data(text_content, api_keys=api_keys)
            if graph_data.get("nodes") or graph_data.get("edges"):
                insert_graph_data(graph_data, normalized_url, session_id=session_id)
        
        # Inject tags and translation data into the chunks BEFORE embedding
        for chunk in chunks:
            if "metadata" not in chunk:
                chunk["metadata"] = {}
            chunk["metadata"]["tags"] = extracted_tags
            chunk["metadata"]["original_lang"] = original_lang
            chunk["metadata"]["translated"] = is_translated
            
            # [NEW] Phase 14: Merge extra metadata (e.g. source_type: image)
            if extra_metadata:
                chunk["metadata"].update(extra_metadata)
            
        data_list = parallel_embed_chunks(
            chunks,
            max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
            source_url=normalized_url,
            api_keys=api_keys,
            page_title=page_title
        )
        
        if not data_list:
            return {"success": False, "message": "Failed to create embeddings."}

        # 5. Bulk insert
        if not db_pool: return {"success": False, "message": "Database not configured"}
            
        with db_pool.connection() as conn:
            with conn.cursor() as cur:
                args_list = [
                    (d.get("content"), d.get("source_url"), d.get("embedding"), json.dumps(d.get("metadata", {})))
                    for d in data_list
                ]
                cur.executemany(
                    "INSERT INTO documents (content, source_url, embedding, metadata) VALUES (%s, %s, %s, %s)",
                    args_list,
                    returning=False
                )
            conn.commit()
            
        return {
            "success": True, 
            "message": f"Successfully ingested {len(data_list)} chunks.",
            "chunks_count": len(data_list),
            "source_url": normalized_url
        }
    except Exception as e:
        import traceback
        print(f"[INGEST_TEXT FATAL ERROR] {e}")
        traceback.print_exc()
        return {"success": False, "error": f"Fatal text ingestion error: {str(e)}"}
    

def ingest_file_logic(source_url: str, file_bytes: bytes, filename: str, content_type: str, target_lang: str = "auto", api_keys: dict = None, session_id: str = None, page_title: str = None) -> Dict[str, Any]:
    """Parse local binary files to text, chunk, and embed them just like web text."""
    import io
    
    text_content = ""
    print(f"[INGEST_FILE] Parsing {filename} ({content_type})")
    
    try:
        if content_type == "application/pdf" or filename.endswith(".pdf"):
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n\n"
                
        elif content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"] or filename.endswith(".docx"):
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text_content += para.text + "\n"
                
        elif content_type in ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] or filename.endswith((".csv", ".xls", ".xlsx")):
            import pandas as pd
            if filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(file_bytes))
            else:
                df = pd.read_excel(io.BytesIO(file_bytes))
            text_content = df.to_markdown(index=False)
            
        elif content_type.startswith("text/") or filename.endswith((".txt", ".md", ".json")):
            text_content = file_bytes.decode("utf-8")
        elif content_type.startswith("image/") or filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            # [NEW] Phase 14: Multimodal Vision RAG
            from vision import analyze_image_logic
            print(f"[INGEST_FILE] Image detected. Analyzing with Vision Model...")
            vision_res = analyze_image_logic(file_bytes, "Describe this image in extreme detail for a RAG knowledge base. Extract all facts, labels, and visible text.", mode="qa", api_keys=api_keys)
            if vision_res.get("success"):
                text_content = f"--- VISUAL DESCRIPTION OF {filename} ---\n\n" + vision_res.get("answer", "")
            else:
                return {"success": False, "message": f"Vision analysis failed: {vision_res.get('answer')}"}
        else:
            return {"success": False, "message": f"Unsupported file type: {content_type}"}
        
        # Tag as image if applicable
        extra_metadata = {}
        if content_type.startswith("image/") or filename.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            extra_metadata = {"source_type": "image", "original_filename": filename}
        
    except Exception as e:
        print(f"[INGEST_FILE] Error parsing {filename}: {e}")
        return {"success": False, "message": f"Error parsing file: {str(e)}"}
        
    print(f"[INGEST_FILE] Parsed/Analyzed {len(text_content)} characters. Forwarding to text pipeline...")
    
    # Send the raw extracted text downstream to chunk & embed
    return ingest_text_logic(source_url, text_content, target_lang=target_lang, api_keys=api_keys, extra_metadata=extra_metadata, session_id=session_id, page_title=page_title or filename)

def ingest_multipage_logic(url: str, max_pages: int = 50, max_depth: int = 3, api_keys: dict = None, session_id: str = None) -> Dict[str, Any]:
    """
    Crawl and ingest multiple pages from a website.
    
    Args:
        url: Starting URL
        max_pages: Maximum pages to crawl
        max_depth: Maximum crawl depth
        
    Returns:
        Dict with success status and statistics
    """
    global FeatureFlags
    try:
        # Normalize URL
        normalized_url = normalize_url(url)
        
        # Crawl multiple pages
        pages = crawl_website_firecrawl(normalized_url, max_pages, max_depth, api_keys=api_keys)
        
        if not pages:
            return {
                "success": False,
                "message": "Failed to crawl any pages",
                "pages_crawled": 0
            }

        # [NEW] Phase 19: Ingestion Job Tracking
        job_id = None
        if db_pool:
            try:
                with db_pool.connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO ingestion_jobs (url, status, message) VALUES (%s, %s, %s) RETURNING job_id",
                            (normalized_url, "processing", f"Cloning and indexing {len(pages)} pages...")
                        )
                        job_id = cur.fetchone()[0]
                    conn.commit()
            except Exception as e:
                print(f"[MULTIPAGE] Warning: Could not create job row: {e}")

        def update_job_status(status, message, chunks=0):
            if job_id and db_pool:
                try:
                    with db_pool.connection() as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE ingestion_jobs SET status = %s, message = %s, chunks_count = %s WHERE job_id = %s",
                                (status, message, chunks, job_id)
                            )
                        conn.commit()
                except Exception as e:
                    print(f"[MULTIPAGE] Warning: Could not update job status: {e}")

        print(f"[MULTIPAGE] Crawled {len(pages)} pages, starting ingestion...")
        
        total_chunks = 0
        failed_pages = 0
        
        # Process each page
        for idx, page in enumerate(pages, 1):
            page_url = page['url']
            content = page['content']
            
            print(f"[MULTIPAGE] Processing page {idx}/{len(pages)}: {page_url}")
            
            try:
                # Use semantic chunking
                if FeatureFlags.PHASE_1_SEMANTIC_CHUNKING and ChunkingConfig.SEMANTIC_CHUNKING_ENABLED:
                    chunks = chunk_text(content, max_chars=ChunkingConfig.TARGET_CHUNK_SIZE, source_url=page_url)
                else:
                    # Legacy chunking
                    chunk_size = 1000
                    chunks = [{'content': content[i:i+chunk_size]} for i in range(0, len(content), chunk_size)]
                    
                print(f"[MULTIPAGE] Extracting semantic tags via Mistral...")
                extracted_tags = extract_semantic_tags(content, api_keys=api_keys)
                
                # [NEW] Phase 13: GraphRAG Extraction
                if FeatureFlags.GRAPHRAG_ENABLED:
                    from graph_logic import extract_graph_data, insert_graph_data
                    print(f"[MULTIPAGE] Extracting GraphRAG data for {page_url}...")
                    graph_data = extract_graph_data(content, api_keys=api_keys)
                    if graph_data.get("nodes") or graph_data.get("edges"):
                        insert_graph_data(graph_data, page_url, session_id=session_id)

                for chunk in chunks:
                    if "metadata" not in chunk:
                        chunk["metadata"] = {}
                    chunk["metadata"]["tags"] = extracted_tags
                
                # Embed chunks
                embedded_chunks = parallel_embed_chunks(
                    chunks,
                    max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
                    source_url=page_url,
                    api_keys=api_keys,
                    page_title=page.get('title')
                )
                
                # Store in database
                if embedded_chunks:
                    if db_pool:
                        with db_pool.connection() as conn:
                            with conn.cursor() as cur:
                                args_list = [
                                    (d.get("content"), d.get("source_url"), d.get("embedding"), json.dumps(d.get("metadata", {})))
                                    for d in embedded_chunks
                                ]
                                cur.executemany(
                                    "INSERT INTO documents (content, source_url, embedding, metadata) VALUES (%s, %s, %s, %s)",
                                    args_list
                                )
                            conn.commit()
                        total_chunks += len(embedded_chunks)
                        print(f"[MULTIPAGE] ✅ Stored {len(embedded_chunks)} chunks from {page_url}")
                    else:
                        print(f"[MULTIPAGE] ❌ DB connection not configured for {page_url}")
                
            except Exception as e:
                print(f"[MULTIPAGE] ❌ Failed to process {page_url}: {e}")
                failed_pages += 1
                continue
        
        success_pages = len(pages) - failed_pages
        update_job_status("completed", f"Successfully indexed {success_pages} pages ({total_chunks} chunks)", total_chunks)
        
        return {
            "success": True,
            "message": f"Successfully crawled and indexed {success_pages}/{len(pages)} pages",
            "pages_crawled": len(pages),
            "pages_indexed": success_pages,
            "pages_failed": failed_pages,
            "total_chunks": total_chunks,
            "base_url": normalized_url
        }
        
    except Exception as e:
        print(f"[MULTIPAGE] Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Multi-page ingestion failed: {str(e)}",
            "pages_crawled": 0
        }
