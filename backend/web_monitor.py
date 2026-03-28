import asyncio
import hashlib
import json
from datetime import datetime, timedelta
from database import get_db_pool
from api_clients import check_connectivity
from rag_pipeline import ingest_website_logic

def get_content_hash(text):
    return hashlib.md5(text.encode('utf-8')).hexdigest()

def is_web_monitor_enabled():
    """Checks the database to see if web monitoring is enabled."""
    from database import get_db_pool
    pool = get_db_pool()
    if not pool: return True # Default to True if DB is unavailable
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT value FROM settings WHERE key = 'web_monitor_enabled'")
                row = cur.fetchone()
                if row:
                    # value is JSONB, so it might be a string "true" or boolean true
                    val = row[0]
                    if isinstance(val, str):
                        return val.lower() == "true"
                    return bool(val)
        return True
    except Exception as e:
        print(f"[WEB-MONITOR] Error checking settings: {e}")
        return True

async def check_for_updates():
    """
    Checks indexed URLs and compares their current content with stored content.
    If significant changes are detected, a refresh suggestion is created.
    """
    pool = get_db_pool()
    if not pool: return

    try:
        # [NEW] Check if enabled before running
        if not is_web_monitor_enabled():
            return

        if not check_connectivity():
            return

        with pool.connection() as conn:
            with conn.cursor(row_factory=None) as cur:
                # 1. Identify URLs that the user has explicitly added to the watchlist.
                # Cross-reference with 'refresh_suggestions' to avoid duplicates.
                cur.execute("""
                    SELECT url 
                    FROM watched_urls 
                    WHERE url NOT IN (SELECT url FROM refresh_suggestions WHERE status = 'pending')
                    ORDER BY created_at ASC 
                    LIMIT 5
                """)
                urls = cur.fetchall()

                if not urls:
                    return

                print(f"[WEB-MONITOR] Checking {len(urls)} URLs for updates...")

                for (url,) in urls:
                    try:
                        print(f"[WEB-MONITOR] Fetching {url} for change detection...")
                        from api_clients import get_firecrawl_key
                        from browser_agents import FirecrawlScraper
                        
                        scraper = FirecrawlScraper(get_firecrawl_key({}))

                        content = scraper.extract(url)
                        
                        if not content or "Error" in content or "Exception" in content:
                            print(f"[WEB-MONITOR] Scraping failed for {url}: {content[:50]}...")
                            continue
                            
                        new_hash = get_content_hash(content)
                        
                        # Check existing hash
                        cur.execute("SELECT content_hash FROM web_monitor_state WHERE url = %s", (url,))
                        row = cur.fetchone()
                        
                        if not row:
                            # First time seeing this, just store it
                            print(f"[WEB-MONITOR] Storing initial hash for {url}")
                            cur.execute("""
                                INSERT INTO web_monitor_state (url, content_hash) 
                                VALUES (%s, %s)
                            """, (url, new_hash))
                        elif row[0] != new_hash:
                            # Content has changed!
                            print(f"[WEB-MONITOR] 🚨 Change detected for {url}! Suggesting refresh.")
                            cur.execute("""
                                INSERT INTO refresh_suggestions (url, last_fingerprint, reason, status)
                                VALUES (%s, %s, %s, 'pending')
                                ON CONFLICT (url) DO UPDATE SET 
                                    status = 'pending', 
                                    last_fingerprint = %s,
                                    reason = %s,
                                    last_visited = CURRENT_TIMESTAMP
                            """, (url, row[0], "Content changed (Hash mismatch)", row[0], "Content changed"))
                            
                            # Update the state
                            cur.execute("""
                                UPDATE web_monitor_state 
                                SET content_hash = %s, change_detected_at = CURRENT_TIMESTAMP, last_checked = CURRENT_TIMESTAMP
                                WHERE url = %s
                            """, (new_hash, url))
                        else:
                            # No change
                            print(f"[WEB-MONITOR] No change for {url}.")
                            cur.execute("UPDATE web_monitor_state SET last_checked = CURRENT_TIMESTAMP WHERE url = %s", (url,))
                        
                        conn.commit()

                    except Exception as e:
                        print(f"[WEB-MONITOR] Error checking {url}: {e}")
                        conn.rollback()

    except Exception as e:
        print(f"[WEB-MONITOR] Critical error in check_for_updates: {e}")

async def web_monitor_loop():
    """
    Infinite loop for the web monitoring service.
    """
    print("[WEB-MONITOR] Started")
    while True:
        try:
            await check_for_updates()
            # Wait 6 hours between checks to avoid spamming
            await asyncio.sleep(21600) 
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[WEB-MONITOR] Loop error: {e}")
            await asyncio.sleep(600)
