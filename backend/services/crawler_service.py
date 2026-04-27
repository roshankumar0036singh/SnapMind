import httpx
import asyncio
import os
from typing import List, Dict, Any, Tuple, Optional
from api_clients import get_firecrawl_key, check_connectivity

class CrawlerService:
    """
    Service for web scraping and crawling using Firecrawl.
    Supports asynchronous high-performance single-page and multi-page crawling.
    """
    
    API_BASE_URL = "https://api.firecrawl.dev/v1"
    
    # Persistent client for connection pooling
    _client = httpx.AsyncClient(
        timeout=httpx.Timeout(60.0, connect=10.0),
        limits=httpx.Limits(max_keepalive_connections=20, max_connections=50),
        follow_redirects=True,
        headers={"User-Agent": "SnapMind-Crawler/2.0"}
    )

    @classmethod
    async def scrape_url(cls, url: str, api_keys: dict = None, max_retries: int = 2) -> tuple[str, str | None]:
        """Scrape a single URL with direct high-fidelity routing for specific platforms."""
        
        # [NEW] Direct High-Fidelity LinkedIn Routing
        if "linkedin.com" in url:
            print(f"[CrawlerService] Direct High-Fidelity LinkedIn routing for {url}...")
            from services.scrapers.linkedin_scraper import LinkedInCustomScraper
            try:
                content, title = await LinkedInCustomScraper.scrape(url)
                if content and len(content) > 500:
                    return content, title
            except Exception as le:
                print(f"[CrawlerService] LinkedIn Custom Scraper failed: {le}")
                # Fall through to standard flow if custom fails
        firecrawl_key = get_firecrawl_key(api_keys)
        
        if not firecrawl_key:
            print(f"[CrawlerService] WARNING: No Firecrawl key. Using simple fallback.")
            return await cls.simple_scrape_fallback(url), None
        
        endpoint = f"{cls.API_BASE_URL}/scrape"
        payload = {
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True
        }
        headers = {
            "Authorization": f"Bearer {firecrawl_key}",
            "Content-Type": "application/json"
        }

        for attempt in range(max_retries):
            try:
                response = await cls._client.post(endpoint, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json().get('data', {})
                    markdown = data.get('markdown', '')
                    metadata = data.get('metadata', {})
                    title = metadata.get('title') or metadata.get('ogTitle')
                    if markdown:
                        return str(markdown), title
                
                print(f"[CrawlerService] Firecrawl error {response.status_code} (Attempt {attempt+1})")
                
                # Secondary: Jina Reader Fallback
                try:
                    print(f"[CrawlerService] Attempting Jina premium fallback for {url}...")
                    from services.scrapers.jina_scraper import JinaScraper
                    jina = JinaScraper()
                    content, title = await jina.scrape(url)
                    if content:
                        return content, title
                except Exception as je:
                    print(f"[CrawlerService] Jina fallback failed: {je}")

            except Exception as e:
                print(f"[CrawlerService] Attempt {attempt+1} failed: {e}")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(2 * (attempt + 1))
        
        return await cls.simple_scrape_fallback(url), None

    @classmethod
    async def jina_scrape_fallback(cls, url: str, api_keys: dict = None) -> tuple[str, str | None]:
        """Premium fallback using r.jina.ai."""
        jina_key = (api_keys or {}).get("jina") or os.getenv("JINA_API_KEY")
        if not jina_key:
            return "", None
            
        jina_url = f"https://r.jina.ai/{url}"
        headers = {
            "Authorization": f"Bearer {jina_key}",
            "X-With-Images-Summary": "true",
            "X-Target-Language": "en"
        }
        try:
            resp = await cls._client.get(jina_url, headers=headers, timeout=30.0)
            if resp.status_code == 200:
                # Extract title from potential Jina metadata or first line
                content = resp.text
                title = None
                if content.startswith("Title: "):
                    title = content.split("\n")[0].replace("Title: ", "").strip()
                return content, title
        except Exception as e:
            print(f"[CrawlerService] Jina fallback failed: {e}")
        return "", None

    @classmethod
    async def crawl_site(cls, url: str, max_pages: int = 50, max_depth: int = 3, api_keys: dict = None) -> List[Dict[str, str]]:
        """Crawl multiple pages using Firecrawl with optimized async polling."""
        firecrawl_key = get_firecrawl_key(api_keys)
        if not firecrawl_key:
            content, title = await cls.scrape_url(url, api_keys)
            return [{'url': url, 'content': content, 'title': title}] if content else []

        try:
            endpoint = f"{cls.API_BASE_URL}/crawl"
            headers = {
                "Authorization": f"Bearer {firecrawl_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "url": url,
                "limit": max_pages,
                "scrapeOptions": {
                    "formats": ["markdown"],
                    "onlyMainContent": True
                }
            }
            
            start_resp = await cls._client.post(endpoint, headers=headers, json=payload)
            if start_resp.status_code not in [200, 201]:
                return []
            
            job_id = start_resp.json().get('id')
            if not job_id: return []

            print(f"[CrawlerService] Crawl job active: {job_id}")

            # Smart polling with adaptive intervals
            poll_intervals = [2, 3, 5, 10, 15, 20, 30]
            max_wait = 900 # 15 min
            elapsed = 0
            
            idx = 0
            while elapsed < max_wait:
                interval = poll_intervals[idx] if idx < len(poll_intervals) else 30
                await asyncio.sleep(interval)
                elapsed += interval
                idx += 1
                
                status_url = f"{cls.API_BASE_URL}/crawl/{job_id}"
                status_resp = await cls._client.get(status_url, headers=headers)
                if status_resp.status_code != 200: continue
                
                status_data = status_resp.json()
                status = status_data.get('status')
                
                if status == 'completed':
                    data = status_data.get('data', [])
                    results = []
                    for item in data:
                        content = item.get('markdown')
                        if content:
                            results.append({
                                'url': item.get('metadata', {}).get('sourceURL') or item.get('url'),
                                'content': str(content),
                                'title': item.get('metadata', {}).get('title') or "Crawled Page"
                            })
                    return results
                elif status in ['failed', 'cancelled']:
                    break
            
            return []
        except Exception as e:
            print(f"[CrawlerService] Crawl error: {e}")
            return []

    @classmethod
    async def simple_scrape_fallback(cls, url: str) -> str:
        """🛡️ Async BeautifulSoup fallback."""
        try:
            from bs4 import BeautifulSoup
            response = await cls._client.get(url, timeout=20.0)
            soup = BeautifulSoup(response.content, 'html.parser')
            for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                tag.decompose()
            main_content = soup.find('main') or soup.find('article') or soup.body
            text = main_content.get_text(separator='\n', strip=True)
            return text[:50000]
        except:
            return ""

