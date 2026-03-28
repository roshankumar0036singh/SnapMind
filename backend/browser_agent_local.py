import os
import asyncio
import json
import base64
import re
import time
from playwright.async_api import async_playwright
from markdownify import markdownify as md
from browser_agents import clean_scraped_markdown, chunk_at_word_boundary, extract_highlight_snippet
from config import ModelRegistry

class LocalBrowserAgent:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self.browser = None
        self.context = None
        self.playwright = None

    async def start(self):
        print(f"[LocalBrowserAgent] Starting (headless={self.headless})...")
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(headless=self.headless)
        self.context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 800},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        return self

    async def stop(self):
        print("[LocalBrowserAgent] Stopping...")
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def search(self, query: str, limit: int = 5):
        """Perform a search using DuckDuckGo."""
        if not self.context:
            await self.start()
            
        page = await self.context.new_page()
        search_url = f"https://duckduckgo.com/?q={query}"
        print(f"[LocalBrowserAgent] Searching DuckDuckGo: {query}")
        
        try:
            await page.goto(search_url)
            # Wait for search results to load
            await page.wait_for_selector("article[data-testid='result']", timeout=15000)
            
            results = []
            elements = await page.query_selector_all("article[data-testid='result']")
            for el in elements[:limit]:
                title_el = await el.query_selector("h2")
                link_el = await el.query_selector("a[data-testid='result-title-a']")
                # Try to find snippet - DDG class names can change, so we use a more stable selector if possible
                snippet_el = await el.query_selector("div[data-result='snippet']") or await el.query_selector(".OgNoY6_D9Bpxmwqi9_Y8")
                
                if title_el and link_el:
                    title = await title_el.inner_text()
                    url = await link_el.get_attribute("href")
                    snippet = await snippet_el.inner_text() if snippet_el else ""
                    results.append({"title": title, "url": url, "snippet": snippet})
            
            return results
        except Exception as e:
            print(f"[LocalBrowserAgent] Search Error: {e}")
            return []
        finally:
            await page.close()

    async def scrape(self, url: str):
        """Scrape a URL and return markdown."""
        if not self.context:
            await self.start()
            
        page = await self.context.new_page()
        print(f"[LocalBrowserAgent] Scraping URL: {url}")
        
        try:
            # Set a standard timeout and wait for network to be somewhat idle
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            # Wait a few more seconds for dynamic content
            await asyncio.sleep(2)
            
            # Get the whole page HTML
            content_html = await page.content()
            
            # Convert to markdown
            markdown = md(content_html, heading_style="ATX")
            
            # Use the existing cleaner logic from browser_agents.py
            cleaned_md = clean_scraped_markdown(markdown)
            
            return cleaned_md
        except Exception as e:
            print(f"[LocalBrowserAgent] Scrape Error for {url}: {e}")
            return f"Error scraping {url}: {str(e)}"
        finally:
            await page.close()

    async def screenshot(self, url: str = None):
        """Take a screenshot of the current or a new page."""
        if not self.context:
            await self.start()
            
        page = None
        if url:
            page = await self.context.new_page()
            await page.goto(url, wait_until="networkidle")
        else:
            # Use the last active page if url is not provided
            pages = self.context.pages
            if pages:
                page = pages[-1]
            else:
                return None

        screenshot_bytes = await page.screenshot(full_page=False)
        if url:
            await page.close()
            
        return base64.b64encode(screenshot_bytes).decode('utf-8')

class LocalBrowserOrchestrator:
    """
    A local-first version of BrowserOrchestrator that replaces Firecrawl 
    with Playwright (LocalBrowserAgent).
    """
    def __init__(self, api_keys: dict, session_id: str = None, output_lang: str = "auto", query_notebook: bool = False, image_data: str = None, visible: bool = False):
        self.api_keys = api_keys
        self.session_id = session_id
        self.output_lang = output_lang
        self.query_notebook = query_notebook
        self.image_data = image_data
        self.visible = visible
        
        # We still use the existing AI-based analyzer, ranker, and slicer
        from browser_agents import QueryAnalyzer, RankerAgent, SlicerAgent
        self.analyzer = QueryAnalyzer(api_keys)
        self.ranker = RankerAgent(api_keys)
        self.slicer = SlicerAgent(api_keys)
        
        # Local Agent replaces SearchAgent and FirecrawlScraper
        self.agent = LocalBrowserAgent(headless=not visible)

    async def run(self, user_query: str) -> dict:
        print(f"[LocalBrowserOrchestrator] Starting for query: {user_query}")
        
        await self.agent.start()
        
        try:
            scraped_contexts = []
            citations = []
            blocks = []
            run_id = int(time.time()) % 10000
            
            # 1. Analyze query
            search_queries = self.analyzer.analyze(user_query)
            print(f"[LocalBrowserOrchestrator] Generated search queries: {search_queries}")
            
            # 2. RAG Check (omitted for brevity here but can be added back)
            
            # 3. Search Web via Playwright
            raw_results = []
            for q in search_queries:
                search_res = await self.agent.search(q)
                raw_results.extend(search_res)
            
            print(f"[LocalBrowserOrchestrator] Found {len(raw_results)} total raw results")
            
            # 4. Rank Results
            top_urls = self.ranker.rank(user_query, raw_results)
            print(f"[LocalBrowserOrchestrator] Ranked to top URLs: {top_urls}")
            
            # 5. Scrape & Background Ingest
            global_chunk_counter = 1
            from rag_pipeline import ingest_text_logic
            
            for idx, url in enumerate(top_urls):
                print(f"[LocalBrowserOrchestrator] Scraping {url}...")
                data = await self.agent.scrape(url)
                
                if not data or "Error" in data:
                    continue

                if len(data) > 200:
                    # Logic mirrored from BrowserOrchestrator
                    short_data = data[:30000]
                    import urllib.parse
                    
                    c_chunks = chunk_at_word_boundary(short_data, 2000)
                    for c_text in c_chunks:
                        if len(c_text) < 50:
                            continue
                            
                        sub_block_id = f"br-block-{run_id}-{global_chunk_counter}"
                        global_chunk_counter += 1
                        scraped_contexts.append(f"[{sub_block_id}] Source URL: {url}\n{c_text}")
                        
                        h_snippet = extract_highlight_snippet(c_text)
                        safe_h_snippet = urllib.parse.quote(h_snippet[:80])
                        highlight_url = f"{url}#:~:text={safe_h_snippet}"

                        citations.append({"blockId": sub_block_id, "snippet": url, "highlightUrl": highlight_url})
                        blocks.append({"id": sub_block_id, "text": c_text, "highlight_snippet": h_snippet, "url": highlight_url})
                    
                    # Background ingest
                    # Use a separate task since it involves sync calls (currently)
                    asyncio.create_task(self._async_ingest_wrapper(url, data))
            
            # 6. Final Context Synthesis (Mirrored from BrowserOrchestrator)
            from config import ContextConfig
            final_contexts = []
            current_len = 0
            limit = ContextConfig.MAX_CONTEXT_LENGTH
            for ctx in scraped_contexts:
                if current_len + len(ctx) > limit:
                    break
                final_contexts.append(ctx)
                current_len += len(ctx)
                
            context_str = "\n\n---\n\n".join(final_contexts)
            
            if not scraped_contexts:
                return {
                    "answer": "Failed to retrieve any relevant content locally.",
                    "citations": [],
                    "blocks": []
                }
                
            # Call Mistral for Final Synthesis (this is sync usually, so wrap it)
            from api_clients import get_mistral_client
            client = get_mistral_client(self.api_keys)
            
            lang_instruction = ""
            if self.output_lang and self.output_lang != "auto":
                from search import LANG_MAP
                lang_name = LANG_MAP.get(self.output_lang, self.output_lang)
                lang_instruction = f"\n\nCRITICAL: You MUST translate and output your entire final response securely into {lang_name}."

            prompt = f"""You are an advanced Browser Assistant.
Answer the user's query comprehensively using ONLY the provided scraped web context.
When you use information from a source, append the unique block ID tag inline exactly like [br-block-{run_id}-1] as found in the Context headings.
DO NOT use backticks for citations. 
You MUST strictly output the raw tag exactly as provided.{lang_instruction}
        
Context:
{context_str}

User Query: {user_query}
"""
            # mistral-large-latest via run_in_executor if needed, but here we'll just call it
            response = client.chat.complete(
                model=ModelRegistry.MISTRAL_LARGE,
                messages=[{"role": "user", "content": prompt}]
            )
            raw_answer = response.choices[0].message.content.strip()
            
            # Post-processing copied from BrowserOrchestrator
            final_answer = re.sub(r'\[\d{1,3}\]', '', raw_answer)
            final_answer = final_answer.replace(' []', '').replace('[]', '').strip()
            
            return {
                "answer": final_answer,
                "citations": citations,
                "blocks": blocks
            }
            
        finally:
            await self.agent.stop()

    async def _async_ingest_wrapper(self, url, text):
        """Wrapper to run the synchronous ingest_text_logic in a thread."""
        from rag_pipeline import ingest_text_logic
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: ingest_text_logic(
            url, text, 
            api_keys=self.api_keys, 
            session_id=self.session_id,
            extra_metadata={"source_type": "local_browser_agent"}
        ))
