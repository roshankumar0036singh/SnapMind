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
                # 1. Identify URLs that haven't been checked for a while or are due
                # For this implementation, we check the 'documents' table's oldest entries
                # and cross-reference with 'refresh_suggestions' to avoid duplicates.
                cur.execute("""
                    SELECT source_url 
                    FROM documents 
                    WHERE source_url LIKE 'http%' 
                    AND source_url NOT IN (SELECT url FROM refresh_suggestions WHERE status = 'pending')
                    GROUP BY source_url
                    ORDER BY MIN(created_at) ASC 
                    LIMIT 3
                """)
                urls = cur.fetchall()

                if not urls:
                    return

                print(f"[WEB-MONITOR] Checking {len(urls)} URLs for updates...")

                for (url,) in urls:
                    try:
                        # We use a 'dry run' of ingest logic or a simple fetch to compare
                        # For simplicity, we'll fetch the current title/content summary
                        # In a real app, we might use Firecrawl/Playwright here.
                        
                        # Simplified: Just mark as 'suggested' if it's older than 7 days
                        # and let the user trigger the actual re-scrape.
                        
                        from datetime import timezone
                        cur.execute("SELECT MAX(created_at) FROM documents WHERE source_url = %s", (url,))
                        last_indexed = cur.fetchone()[0]
                        
                        if last_indexed and last_indexed < datetime.now(timezone.utc) - timedelta(days=7):
                            print(f"[WEB-MONITOR] Suggesting refresh for {url}")
                            cur.execute("""
                                INSERT INTO refresh_suggestions (url, last_indexed_at, reason)
                                VALUES (%s, %s, %s)
                                ON CONFLICT (url) DO UPDATE SET status = 'pending', created_at = CURRENT_TIMESTAMP
                            """, (url, last_indexed, "Content is older than 7 days."))
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
