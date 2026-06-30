import json
import asyncio
from typing import Dict, Any, List
from database import get_db_pool
from chunking import chunk_text
from config import settings
from utils import normalize_url
from services.crawler_service import CrawlerService
from services.ingest_service import IngestService

async def ingest_widget_multipage(url: str, widget_id: str, max_pages: int = 10, max_depth: int = 3, api_keys: dict = None) -> Dict[str, Any]:
    """
    Crawl and ingest multiple pages from a website specifically for a widget.
    Stores data in widget_documents table.
    """
    try:
        # Normalize URL
        normalized_url = normalize_url(url)
        
        # Crawl multiple pages
        pages = await CrawlerService.crawl_site(normalized_url, max_pages, max_depth, api_keys=api_keys)
        
        if not pages:
            return {
                "success": False,
                "message": "Failed to crawl any pages",
                "pages_crawled": 0
            }
        
        print(f"[WIDGET-INGEST] Crawled {len(pages)} pages for widget {widget_id}, starting ingestion...")
        
        total_chunks = 0
        failed_pages = 0
        
        # Clear existing documents for this widget_id to avoid duplication if re-ingesting
        db_pool = get_db_pool()
        if db_pool:
            with db_pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("DELETE FROM widget_documents WHERE widget_id = %s", (widget_id,))
                conn.commit()

        # Process each page
        for idx, page in enumerate(pages, 1):
            page_url = page['url']
            content = page['content']
            
            print(f"[WIDGET-INGEST] Processing page {idx}/{len(pages)}: {page_url}")
            
            try:
                # Use semantic chunking
                if settings.chunking.enabled:
                    chunks = chunk_text(content)
                else:
                    # Legacy chunking
                    chunk_size = 1000
                    chunks = [{'content': content[i:i+chunk_size]} for i in range(0, len(content), chunk_size)]
                
                # Embed chunks
                ingest_svc = IngestService(api_keys=api_keys)
                embedded_chunks = await ingest_svc._batch_embed_async(
                    chunks,
                    source_url=page_url,
                    api_keys=api_keys
                )
                
                # Store in database
                if embedded_chunks:
                    if db_pool:
                        with db_pool.connection() as conn:
                            with conn.cursor() as cur:
                                args_list = [
                                    (
                                        widget_id,
                                        d.get("source_url"), 
                                        d.get("content"), 
                                        d.get("embedding"), 
                                        json.dumps(d.get("metadata", {}))
                                    ) for d in embedded_chunks
                                ]
                                
                                # Batch insertion
                                BATCH_SIZE = 50
                                for i in range(0, len(args_list), BATCH_SIZE):
                                    batch = args_list[i : i + BATCH_SIZE]
                                    cur.executemany(
                                        "INSERT INTO widget_documents (widget_id, url, content, embedding, metadata) VALUES (%s, %s, %s, %s, %s)",
                                        batch
                                    )
                            conn.commit()
                        total_chunks += len(embedded_chunks)
                        print(f"[WIDGET-INGEST] ✅ Stored {len(embedded_chunks)} chunks from {page_url}")
                
            except Exception as e:
                print(f"[WIDGET-INGEST] ❌ Failed to process {page_url}: {e}")
                failed_pages += 1
                continue
        
        success_pages = len(pages) - failed_pages
        
        return {
            "success": True,
            "message": f"Successfully crawled and indexed {success_pages}/{len(pages)} pages",
            "pages_crawled": len(pages),
            "pages_indexed": success_pages,
            "pages_failed": failed_pages,
            "total_chunks": total_chunks,
            "widget_id": widget_id
        }
        
    except Exception as e:
        print(f"[WIDGET-INGEST] Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": f"Widget multi-page ingestion failed: {str(e)}",
            "pages_crawled": 0
        }

async def widget_chat_logic(query: str, widget_id: str, session_id: str = None, api_keys: dict = None) -> Dict[str, Any]:
    """
    RAG Chat logic for the widget using widget_documents table.
    """
    from config import settings
    import os
    
    try:
        # 1. Get embedding for query
        ingest_svc = IngestService(api_keys=api_keys)
        query_embedding = ingest_svc.get_embedding(query)
        
        # 2. Hybrid Search in widget_documents
        db_pool = get_db_pool()
        context_blocks = []
        if db_pool:
            from psycopg.rows import dict_row
            with db_pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    # [FIX] Added explicit casts for pgvector and psycopg types to match function signature
                    cur.execute(
                        "SELECT * FROM hybrid_search_widget(%s::vector(3072), %s::text, %s::float, %s::int, %s::text)",
                        (query_embedding, query, 0.1, 5, widget_id)
                    )
                    context_blocks = cur.fetchall()
        
        if not context_blocks:
            # Fallback to no-context answer or specific message
            context_text = "No context found from the website."
        else:
            context_text = "\n\n".join([f"Source: {b['url']}\nContent: {b['content']}" for b in context_blocks])
        
        # 3. Generate Answer — with Mistral fallback for 429 rate limits
        answer = None
        
        # Attempt 1: Gemini
        try:
            from api_clients import get_gemini_client
            model_name = settings.models.gemini_flash
            client = get_gemini_client(api_keys=api_keys)
            
            system_prompt = f"""You are a helpful AI assistant integrated into a website via a widget. 
Your goal is to answer questions accurately based ONLY on the provided context retrieved from the website.
If the answer is not in the context, politely say that you don't know the answer based on the website content.

CONTEXT FROM WEBSITE:
{context_text}
"""
            
            response = client.models.generate_content(
                model=model_name,
                contents=[f"{system_prompt}\n\nUser Question: {query}"]
            )
            answer = response.text
            
        except Exception as gemini_err:
            error_str = str(gemini_err)
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                print(f"[WIDGET-CHAT] Gemini 429 — switching to Mistral fallback...")
                
                # Attempt 2: Mistral fallback
                try:
                    from api_clients import get_mistral_client
                    mistral_client = get_mistral_client(api_keys=api_keys)
                    if mistral_client:
                        mistral_response = mistral_client.chat.complete(
                            model=settings.models.mistral_small,
                            messages=[
                                {"role": "system", "content": f"You are a helpful AI assistant integrated into a website via a widget. Answer questions accurately based ONLY on the provided context. If the answer is not in the context, politely say you don't know.\n\nCONTEXT FROM WEBSITE:\n{context_text}"},
                                {"role": "user", "content": query}
                            ]
                        )
                        answer = mistral_response.choices[0].message.content
                        print(f"[WIDGET-CHAT] ✅ Mistral fallback succeeded.")
                    else:
                        print(f"[WIDGET-CHAT] No Mistral client available for fallback.")
                        return {"error": "AI service temporarily unavailable. Please try again in a minute."}
                except Exception as mistral_err:
                    print(f"[WIDGET-CHAT] Mistral fallback also failed: {mistral_err}")
                    return {"error": "AI service temporarily unavailable. Please try again in a minute."}
            else:
                print(f"[WIDGET-CHAT] Gemini error (non-429): {gemini_err}")
                import traceback
                traceback.print_exc()
                return {"error": str(gemini_err)}
        
        return {
            "answer": answer,
            "sources": [b['url'] for b in context_blocks]
        }
        
    except Exception as e:
        print(f"[WIDGET-CHAT] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
