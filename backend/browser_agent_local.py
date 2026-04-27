import os
import asyncio
import json
import base64
import re
import time
from playwright.async_api import async_playwright
from markdownify import markdownify as md
from browser_agents import clean_scraped_markdown, chunk_at_word_boundary, extract_highlight_snippet
from config import settings

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
        """Scrape a URL and return markdown. Falls back to Jina Reader if Playwright fails."""
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
            
            # If Playwright got meaningful content, return it
            if cleaned_md and len(cleaned_md) > 200:
                return cleaned_md
            
            # If content is too short, fall through to Jina
            print(f"[LocalBrowserAgent] Playwright got insufficient content ({len(cleaned_md)} chars), trying Jina...")
            
        except Exception as e:
            print(f"[LocalBrowserAgent] Playwright failed for {url}: {e}")
        finally:
            await page.close()
        
        # Fallback: Jina Reader (free, works great for academic papers)
        return await self._jina_reader_fallback(url)

    @staticmethod
    async def _jina_reader_fallback(url: str) -> str:
        """Use Jina Reader (r.jina.ai) as a free fallback scraper."""
        try:
            import httpx
            jina_url = f"https://r.jina.ai/{url}"
            headers = {
                "Accept": "text/markdown", 
                "X-No-Cache": "true",
                "X-Engine": "browser", # Requested highest output quality setting
                "X-Return-Format": "markdown"
            }
            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                resp = await client.get(jina_url, headers=headers)
                if resp.status_code == 200:
                    content = resp.text.strip()
                    if content and len(content) > 100:
                        print(f"[Jina] Successfully scraped {url} ({len(content)} chars)")
                        return clean_scraped_markdown(content)
        except Exception as e:
            print(f"[Jina] Fallback failed for {url}: {e}")
        return ""

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

    async def download_pdf(self, url: str) -> tuple[bytes, str]:
        """Navigate to a URL, wait for download, and return bytes + filename."""
        if not self.context:
            await self.start()
            
        page = await self.context.new_page()
        print(f"[LocalBrowserAgent] Attempting PDF download from: {url}")
        
        try:
            # ArXiv specific optimization: if it's an abstract page, try to find the PDF link
            if "arxiv.org/abs/" in url:
                pdf_url = url.replace("/abs/", "/pdf/")
                if not pdf_url.endswith(".pdf"):
                    pdf_url += ".pdf"
                url = pdf_url

            async with page.expect_download(timeout=60000) as download_info:
                await page.goto(url)
            
            download = await download_info.value
            filename = download.suggested_filename
            # Read bytes into memory directly
            # Note: Playwright's download.path() might be local, but we want the bytes
            # We can use a temp path then read it
            temp_path = await download.path()
            with open(temp_path, "rb") as f:
                data = f.read()
            
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
            return data, filename
        except Exception as e:
            print(f"[LocalBrowserAgent] Download Error: {e}")
            return None, str(e)
        finally:
            await page.close()

class LocalBrowserOrchestrator:
    """
    A local-first version of BrowserOrchestrator that replaces Firecrawl 
    with Playwright (LocalBrowserAgent).
    """
    def __init__(self, api_keys: dict, session_id: str = None, user_id: str = None, output_lang: str = "auto", query_notebook: bool = False, image_data: str = None, visible: bool = False, research_mode: str = "general"):
        self.api_keys = api_keys
        self.session_id = session_id
        self.user_id = user_id
        self.output_lang = output_lang
        self.query_notebook = query_notebook
        self.image_data = image_data
        self.visible = visible
        self.research_mode = research_mode # [NEW] Phase 18/19: "general", "scholar", or "legal"
        
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
            if self.research_mode == 'scholar':
                # Add academic constraints to search queries
                search_queries = [f"{q} filetype:pdf site:arxiv.org OR site:semanticscholar.org" for q in search_queries]
            elif self.research_mode == 'legal':
                # [NEW] Phase 19: Legal Research Augmentation
                search_queries = [f"{q} site:gov OR site:nic.in OR site:official-gazette.gov OR \"Act\" OR \"Regulation\" OR \"Official Notification\"" for q in search_queries]
            
            print(f"[LocalBrowserOrchestrator] Generated search queries ({self.research_mode}): {search_queries}")
            
            # 2. RAG Check (omitted for brevity)
            
            # 3. Search & Acquire Content
            raw_results = []
            for q in search_queries:
                search_res = await self.agent.search(q)
                raw_results.extend(search_res)
            
            if self.research_mode == 'scholar' and raw_results:
                # Filter for likely PDF links or landing pages
                # For ArXiv, DDG results usually point to /abs/ landing page
                scholar_results = []
                for res in raw_results:
                    if "arxiv.org" in res['url'] or "pdf" in res['url'].lower():
                        scholar_results.append(res)
                
                if scholar_results:
                    print(f"[LocalBrowserOrchestrator] Academic mode: Downloading papers from {len(scholar_results[:1])} sources...")
                    for res in scholar_results[:1]: # Start with top 1 for stability
                        pdf_bytes, filename = await self.agent.download_pdf(res['url'])
                        if pdf_bytes:
                            print(f"[LocalBrowserOrchestrator] Successfully acquired paper: {filename}")
                            # Silent In-Memory Ingest
                            from services.ingest_service import IngestService
                            ingest_svc = IngestService(api_keys=self.api_keys)
                            await ingest_svc.ingest_bytes(
                                data=pdf_bytes, 
                                filename=filename, 
                                api_keys=self.api_keys, 
                                session_id=self.session_id,
                                user_id=self.user_id,
                                workspace_id=None # Default or active
                            )
                            # Add a placeholder context to signal that we have the paper
                            scraped_contexts.append(f"--- SCHOLARLY PAPER INGESTED: {filename} ---")
            
            print(f"[LocalBrowserOrchestrator] Found {len(raw_results)} total raw results")
            
            # [NEW] If research_mode == 'scholar' and we ingested something, we perform a second pass search in the index
            if self.research_mode == 'scholar' and scraped_contexts:
                print("[LocalBrowserOrchestrator] Performing grounded RAG search across ingested research papers...")
                from services.search_service import SearchService
                search_svc = SearchService(api_keys=self.api_keys)
                # Search exclusively in this session's context
                rag_results = await search_svc.global_search(user_query, limit=12, user_id=self.user_id)
                for r in rag_results:
                    scraped_contexts.append(f"[{r.id}] Source: {r.url}\n{r.content}")
                    citations.append({"blockId": r.id, "snippet": r.url, "highlightUrl": r.url})
                    blocks.append({"id": r.id, "text": r.content, "url": r.url})

            # 4. Rank Results (for non-scholar or fallback)
            if self.research_mode != 'scholar' or not scraped_contexts:
                top_urls = self.ranker.rank(user_query, raw_results)
                print(f"[LocalBrowserOrchestrator] Ranked to top URLs: {top_urls}")
            
            # 5. Scrape & Background Ingest
            global_chunk_counter = 1
            from services.ingest_service import IngestService
            from models.dtos import IngestRequestDTO
            
            for idx, url in enumerate(top_urls):
                print(f"[LocalBrowserOrchestrator] Scraping {url}...")
                data = await self.agent.scrape(url)
                
                if not data or len(data) < 200:
                    print(f"[LocalBrowserOrchestrator] Skipping {url} — all scrapers returned insufficient content ({len(data) if data else 0} chars)")
                    continue
                
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
            from config import settings
            final_contexts = []
            current_len = 0
            limit = settings.context_limit
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
                from utils import LANG_MAP
                lang_name = LANG_MAP.get(self.output_lang, self.output_lang)
                lang_instruction = f"\n\nCRITICAL: You MUST translate and output your entire final response securely into {lang_name}."

            persona_instruction = "You are an advanced Browser Assistant."
            if self.research_mode == 'scholar':
                persona_instruction = "You are an Academic Research Assistant. Analyze the provided research papers and web contexts with scientific rigor. Prioritize methodology, results, and peer-reviewed data."
            elif self.research_mode == 'legal':
                persona_instruction = "You are a Legal Research Assistant. Analyze the provided government policies, acts, and regulations with extreme precision. Focus on statutory language, effective dates, and official notifications. Cite specific articles or sections if present in the text."

            prompt = f"""{persona_instruction}
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
                model=settings.models.mistral_large,
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
        from services.ingest_service import IngestService
        from models.dtos import IngestRequestDTO
        
        svc = IngestService(api_keys=self.api_keys)
        req = IngestRequestDTO(
            url=url,
            text=text,
            session_id=self.session_id,
            user_id=self.user_id
        )
        await svc.ingest_text(req, self.api_keys)
