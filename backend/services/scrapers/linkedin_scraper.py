import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth
import random

class LinkedInCustomScraper:
    """
    High-Fidelity LinkedIn Scraper using Playwright and Stealth.
    Designed to bypass auth walls and extract professional data.
    """
    
    @staticmethod
    async def scrape(url: str) -> tuple[str, str | None]:
        """
        Runs the scraper in a separate thread with its own ProactorEventLoop.
        This is the only 100% reliable way to run Playwright on Windows + FastAPI.
        """
        import threading
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_running_loop()
        with ThreadPoolExecutor() as pool:
            return await loop.run_in_executor(pool, LinkedInCustomScraper._run_isolated_scrape, url)

    @staticmethod
    def _run_isolated_scrape(url: str) -> tuple[str, str | None]:
        """Synchronous wrapper to be run in a separate thread."""
        import sys
        if sys.platform == 'win32':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        
        # Use a fresh event loop for this thread
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            return new_loop.run_until_complete(LinkedInCustomScraper._scrape_async(url))
        finally:
            new_loop.close()

    @staticmethod
    async def _scrape_async(url: str) -> tuple[str, str | None]:
        """The actual async scraping logic."""
        async with async_playwright() as p:
            # 1. Launch Browser with Stealth
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # Use the correct Stealth class and async apply method
            stealth_cfg = Stealth()
            await stealth_cfg.apply_stealth_async(page)
            
            try:
                # 2. Navigate to URL with a human-like delay
                print(f"[LinkedInScraper] Navigating to {url}...")
                await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                
                # Wait for potential redirects or dynamic content
                await asyncio.sleep(random.uniform(2.0, 4.0))
                
                # 3. Check for Auth Wall
                title = await page.title()
                content_text = await page.content()
                
                if "Sign Up | LinkedIn" in title or "Join LinkedIn" in content_text or "authwall" in page.url:
                    print(f"[LinkedInScraper] WARNING: Hit Auth Wall for {url}. Attempting to extract partial data.")
                
                # 4. Human-Mimetic Scrolling to trigger lazy loading
                print(f"[LinkedInScraper] Performing human-mimetic scrolling...")
                for _ in range(3):
                    await page.mouse.wheel(0, random.randint(300, 700))
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                
                # 5. Extract Core Content using specific selectors
                # Targeting the main profile container to avoid noise
                selectors = [
                    'main.scaffold-layout__main',
                    'section.pv-top-card',
                    '.pv-profile-section',
                    '#profile-content'
                ]
                
                extracted_content = ""
                profile_title = title
                
                for selector in selectors:
                    element = await page.query_selector(selector)
                    if element:
                        text = await element.inner_text()
                        if len(text) > 200:
                            extracted_content += f"\n--- {selector} ---\n{text}\n"
                
                # Fallback to body if specific selectors fail
                if not extracted_content:
                    extracted_content = await page.inner_text("body")
                
                print(f"[LinkedInScraper] Extraction complete. Length: {len(extracted_content)}")
                return extracted_content, profile_title

            except Exception as e:
                print(f"[LinkedInScraper] ERROR scraping {url}: {e}")
                return "", None
            finally:
                await browser.close()

if __name__ == "__main__":
    # Test script
    test_url = "https://in.linkedin.com/in/vinay-titarmare-56a4b72ba"
    async def run_test():
        content, title = await LinkedInCustomScraper.scrape(test_url)
        print(f"Title: {title}")
        print(f"Content Length: {len(content)}")
        print(content[:500])
    
    asyncio.run(run_test())
