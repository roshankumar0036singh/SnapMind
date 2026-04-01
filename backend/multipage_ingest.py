async def ingest_multipage_logic(url: str, max_pages: int = 50, max_depth: int = 3) -> Dict[str, Any]:
    """
    Crawl and ingest multiple pages from a website.
    
    Args:
        url: Starting URL
        max_pages: Maximum pages to crawl
        max_depth: Maximum crawl depth
        
    Returns:
        Dict with success status and statistics
    """
    try:
        # Normalize URL
        normalized_url = normalize_url(url)
        
        # Crawl multiple pages
        pages = crawl_website_firecrawl(normalized_url, max_pages, max_depth)
        
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
                if FeatureFlags.PHASE_1_SEMANTIC_CHUNKING and ChunkingConfig.SEMANTIC_CHUNKING_ENABLED:
                    chunks = chunk_text(content)
                else:
                    # Legacy chunking
                    chunk_size = 1000
                    chunks = [{'content': content[i:i+chunk_size]} for i in range(0, len(content), chunk_size)]
                
                # Embed chunks
                embedded_chunks = parallel_embed_chunks(
                    chunks,
                    max_workers=EmbeddingConfig.MAX_EMBEDDING_WORKERS,
                    source_url=page_url
                )
                
                # Store in database
                if embedded_chunks:
                    from database import get_db_pool
                    import json
                    db_pool = get_db_pool()
                    if db_pool:
                        with db_pool.connection() as conn:
                            with conn.cursor() as cur:
                                args_list = [(d.get("content"), d.get("source_url"), d.get("embedding"), json.dumps(d.get("metadata", {}))) for d in embedded_chunks]
                                
                                # [FIX] Batch insertion to prevent SSL bad length errors
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
