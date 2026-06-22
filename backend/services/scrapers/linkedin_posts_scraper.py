import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
import random
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
import datetime

class LinkedInPostsScraper:
    """
    Scraper for LinkedIn Posts (Individual and Profile feeds).
    """

    @staticmethod
    def parse_post_content(html_content: str, post_url: str = "") -> Dict[str, Any]:
        """
        Extracts structured data from a LinkedIn post's HTML.
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # This focuses on the main post container if present, otherwise whole body
        main_content = soup.find('div', {'class': 'feed-shared-update-v2'}) or soup.find('div', {'class': 'core-rail'}) or soup
        
        # 1. Author Name
        author = "Unknown"
        author_elem = main_content.find('span', {'class': 'update-components-actor__name'}) or \
                      main_content.find('a', {'class': 'app-aware-link'})
        if author_elem:
            author = author_elem.get_text(strip=True).split('•')[0].strip()

        # 2. Author Headline
        headline = ""
        headline_elem = main_content.find('span', {'class': 'update-components-actor__description'})
        if headline_elem:
            headline = headline_elem.get_text(strip=True)

        # 3. Post Content
        content = ""
        content_elem = main_content.find('div', {'class': 'update-components-text relative update-components-update-v2__commentary'}) or \
                       main_content.find('span', {'class': 'break-words'})
        if content_elem:
            # Replace br tags with newlines for better formatting
            for br in content_elem.find_all('br'):
                br.replace_with('\n')
            content = content_elem.get_text(strip=True)

        # 4. Engagement Metrics
        likes = 0
        comments = 0
        reposts = 0
        
        social_counts = main_content.find('ul', {'class': 'social-details-social-counts'})
        if social_counts:
            text = social_counts.get_text(strip=True).lower()
            import re
            
            # Likes
            likes_match = re.search(r'([\d,km]+)\s*(?:reactions?|likes?)', text)
            if likes_match:
                likes_str = likes_match.group(1).replace(',', '')
                if 'k' in likes_str: likes = int(float(likes_str.replace('k', '')) * 1000)
                elif 'm' in likes_str: likes = int(float(likes_str.replace('m', '')) * 1000000)
                else: likes = int(likes_str)
                
            # Comments
            comments_match = re.search(r'([\d,km]+)\s*comments?', text)
            if comments_match:
                comments_str = comments_match.group(1).replace(',', '')
                if 'k' in comments_str: comments = int(float(comments_str.replace('k', '')) * 1000)
                elif 'm' in comments_str: comments = int(float(comments_str.replace('m', '')) * 1000000)
                else: comments = int(comments_str)
                
            # Reposts
            reposts_match = re.search(r'([\d,km]+)\s*reposts?', text)
            if reposts_match:
                reposts_str = reposts_match.group(1).replace(',', '')
                if 'k' in reposts_str: reposts = int(float(reposts_str.replace('k', '')) * 1000)
                elif 'm' in reposts_str: reposts = int(float(reposts_str.replace('m', '')) * 1000000)
                else: reposts = int(reposts_str)

        # 5. Hashtags
        hashtags = []
        if content:
            import re
            hashtags = re.findall(r'#\w+', content)

        # 6. Date
        posted_at = "Unknown"
        date_elem = main_content.find('span', {'class': 'update-components-actor__sub-description'})
        if date_elem:
            posted_at = date_elem.get_text(strip=True).split('•')[0].strip()

        return {
            "author": author,
            "author_headline": headline,
            "content": content,
            "post_url": post_url,
            "likes": likes,
            "comments": comments,
            "reposts": reposts,
            "hashtags": hashtags,
            "posted_at": posted_at,
            "scraped_at": datetime.datetime.now().isoformat()
        }

    @staticmethod
    async def scrape_post(url: str) -> tuple[Dict[str, Any] | None, str | None]:
        """
        Runs the scraper in a separate thread with its own ProactorEventLoop.
        This handles headless scraping of a single post URL (public posts).
        """
        import threading
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor() as pool:
            return await loop.run_in_executor(pool, LinkedInPostsScraper._run_isolated_scrape, url)

    @staticmethod
    def _run_isolated_scrape(url: str) -> tuple[Dict[str, Any] | None, str | None]:
        import sys
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            return new_loop.run_until_complete(LinkedInPostsScraper._scrape_async(url))
        finally:
            new_loop.close()

    @staticmethod
    async def _scrape_async(url: str) -> tuple[Dict[str, Any] | None, str | None]:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            stealth_cfg = Stealth()
            await stealth_cfg.apply_stealth_async(page)
            
            try:
                print(f"[LinkedInPostsScraper] Navigating to {url}...")
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                
                await asyncio.sleep(random.uniform(2.0, 4.0))
                
                title = await page.title()
                content_text = await page.content()
                
                if "Sign Up | LinkedIn" in title or "Join LinkedIn" in content_text or "authwall" in page.url:
                    print(f"[LinkedInPostsScraper] WARNING: Hit Auth Wall for {url}.")
                    return None, "Auth Wall Detected"
                
                # Human-Mimetic Scrolling
                for _ in range(3):
                    await page.mouse.wheel(0, random.randint(300, 700))
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                
                # Extract and parse
                html_content = await page.content()
                parsed_data = LinkedInPostsScraper.parse_post_content(html_content, post_url=url)
                
                # If content is empty but we didn't hit a generic wall, we might need a different parser approach
                if not parsed_data["content"]:
                    return None, "Could not extract post content. Post might be protected."
                    
                return parsed_data, None

            except Exception as e:
                print(f"[LinkedInPostsScraper] ERROR scraping {url}: {e}")
                return None, str(e)
            finally:
                await browser.close()
