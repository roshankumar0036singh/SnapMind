import json
import asyncio
import uuid
from typing import Dict, Any, List
from database import get_db_pool
from chunking import chunk_text
from config import settings
from utils import normalize_url
from services.crawler_service import CrawlerService
from services.ingest_service import IngestService

async def ingest_multipage_logic(url: str, max_pages: int = 50, max_depth: int = 3, api_keys: dict = None) -> Dict[str, Any]:
    """
    Crawl and ingest multiple pages from a website for general RAG usage.
    """
    try:
        # Normalize URL
        normalized_url = normalize_url(url)
        
        # Crawl multiple pages using CrawlerService (Firecrawl)
        pages = CrawlerService.crawl_site(normalized_url, max_pages, max_depth, api_keys=api_keys)
        
        if not pages:
            return {
                "success": False,
                "message": "Failed to crawl any pages",
                "pages_crawled": 0
            }
        
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
                # In current settings, we assume semantic chunking is prioritized if enabled
                chunks = chunk_text(content, use_semantic=getattr(settings.chunking, 'use_semantic', True))
                
                # Embed chunks
                ingest_svc = IngestService(api_keys=api_keys)
                embedded_chunks = ingest_svc._parallel_embed(
                    chunks,
                    source_url=page_url,
                    api_keys=api_keys
                )
                
                # Store in database
                if embedded_chunks:
                    db_pool = get_db_pool()
                    if db_pool:
                        with db_pool.connection() as conn:
                            with conn.cursor() as cur:
                                args_list = [
                                    (
                                        d.get("content"), 
                                        d.get("source_url"), 
                                        d.get("embedding"), 
                                        json.dumps(d.get("metadata", {}))
                                    ) for d in embedded_chunks
                                ]
                                
                                # Batch insertion
                                BATCH_SIZE = 50
                                for i in range(0, len(args_list), BATCH_SIZE):
                                    batch = args_list[i : i + BATCH_SIZE]
                                    cur.executemany(
                                        "INSERT INTO documents (content, source_url, embedding, metadata) VALUES (%s, %s, %s, %s)",
                                        batch
                                    )
                            conn.commit()
                        total_chunks += len(embedded_chunks)
                        print(f"[MULTIPAGE] ✅ Stored {len(embedded_chunks)} chunks from {page_url}")
                
            except Exception as e:
                print(f"[MULTIPAGE] ❌ Failed to process {page_url}: {e}")
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
            "base_url": normalized_url
        }
        
    except Exception as e:
        print(f"[MULTIPAGE] Error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": f"Multi-page ingestion failed: {str(e)}",
            "pages_crawled": 0
        }
