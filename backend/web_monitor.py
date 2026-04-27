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

async def generate_diff_summary(old_content: str, new_content: str) -> str:
    """Use Mistral Small to summarize what changed."""
    from api_clients import get_mistral_client
    from config import settings
    client = get_mistral_client({})
    if not client:
        return "Content changed (Hash mismatch)"
        
    prompt = f"""Compare these two versions of a webpage and summarize what changed in 2-3 bullet points.
    
OLD VERSION (first 3000 chars):
{old_content[:3000]}

NEW VERSION (first 3000 chars):
{new_content[:3000]}

Output ONLY the bullet-point changes. Be specific about what was added, removed, or modified."""
    
    try:
        response = client.chat.complete(
            model=settings.models.mistral_small,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[WEB-MONITOR] Diff generation failed: {e}")
        return "Content changed (Hash mismatch)"

async def check_for_updates():
    """
    Checks indexed URLs and compares their current content with stored content.
    If significant changes are detected, logs a new snapshot in content_versions 
    and creates a refresh suggestion.
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
                        
                        scraper = FirecrawlScraper({"firecrawlKey": get_firecrawl_key({})})

                        content = await scraper.scrape(url)
                        
                        if not content or "Error" in content or "Exception" in content:
                            print(f"[WEB-MONITOR] Scraping failed for {url}: {content[:50] if content else 'None'}...")
                            continue
                            
                        new_hash = get_content_hash(content)
                        
                        # Check existing hash and snapshot
                        cur.execute("SELECT content_hash FROM web_monitor_state WHERE url = %s", (url,))
                        row = cur.fetchone()
                        
                        if not row:
                            # First time seeing this, store it and create baseline version
                            print(f"[WEB-MONITOR] Storing initial hash for {url}")
                            cur.execute("""
                                INSERT INTO web_monitor_state (url, content_hash) 
                                VALUES (%s, %s)
                            """, (url, new_hash))
                            
                            cur.execute("""
                                INSERT INTO content_versions (source_url, content_hash, content_snapshot, diff_summary, version_number)
                                VALUES (%s, %s, %s, %s, 1)
                            """, (url, new_hash, content, "Baseline index"))
                        elif row[0] != new_hash:
                            # Content has changed!
                            print(f"[WEB-MONITOR] 🚨 Change detected for {url}! Generating diff.")
                            
                            # Get previous content snapshot to compare against
                            cur.execute("""
                                SELECT content_snapshot, version_number FROM content_versions 
                                WHERE source_url = %s ORDER BY version_number DESC LIMIT 1
                            """, (url,))
                            ver_row = cur.fetchone()
                            
                            prev_content = ver_row[0] if ver_row else ""
                            prev_version = ver_row[1] if ver_row else 0
                            
                            # Generate AI diff
                            diff_summary = await generate_diff_summary(prev_content, content)
                            print(f"[WEB-MONITOR] Diff: {diff_summary}")
                            
                            # Store new version
                            new_version = prev_version + 1
                            cur.execute("""
                                INSERT INTO content_versions (source_url, content_hash, content_snapshot, diff_summary, version_number)
                                VALUES (%s, %s, %s, %s, %s)
                            """, (url, new_hash, content, diff_summary, new_version))
                            
                            # Suggest refresh
                            cur.execute("""
                                INSERT INTO refresh_suggestions (url, last_fingerprint, reason, status)
                                VALUES (%s, %s, %s, 'pending')
                                ON CONFLICT (url) DO UPDATE SET 
                                    status = 'pending', 
                                    last_fingerprint = %s,
                                    reason = %s,
                                    last_visited = CURRENT_TIMESTAMP
                            """, (url, row[0], diff_summary, row[0], diff_summary))
                            
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
