import os
import json
import time
import requests
import re
import asyncio
import httpx
from typing import Dict
from pydantic import BaseModel
from api_clients import (
    get_mistral_client,
    get_firecrawl_key,
    get_lingo_key,
    get_serper_key,
    get_gemini_client,
    get_openai_client,
    get_groq_client,
    get_cohere_client,
    check_connectivity
)
from config import settings
from llm_router import LLMRouter

def clean_scraped_markdown(text: str) -> str:
    """General-purpose heuristic to strip navigation boilerplate and breadcrumbs."""
    if not text: return ""
    
    # 1. Strip numeric footnotes like [1], [23]
    text = re.sub(r'\[\d{1,3}\]', '', text)
    
    # [NEW] 2. Strip image markdown entirely ![]()
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    
    # [NEW] 3. Strip lines that look like naked URLs or file paths
    # Matches strings with multiple slashes and no spaces (common in Git-SCM navigation)
    text = re.sub(r'(?m)^[^\s]*\/[^\s]*\/[^\s]*$', '', text)
    
    lines = text.split('\n')
    
    # 4. Heuristic: Find the "True Start" of content
    start_idx = 0
    nav_keywords = {'menu', 'search', 'navigation', 'chapters', 'breadcrumb', 'sidebar', 'table of contents'}
    for i, line in enumerate(lines[:30]): # Only check first 30 lines
        clean_line = line.strip().lower()
        if not clean_line: continue
        
        # Skip if line contains nav keywords
        if any(kw in clean_line for kw in nav_keywords):
            continue

        # Priority 1: First Heading (# Title, ## Subtitle, etc)
        if re.match(r'^#+\s+', clean_line):
            start_idx = i
            break
            
        # Priority 2: First significant paragraph (>120 chars) that isn't a list/nav item
        if len(clean_line) > 120 and not re.match(r'^[1\-*\s\.\d\[]', clean_line):
            # Final check: link density of this specific line
            links = re.findall(r'\[.*?\]\(.*?\)', line)
            if len(links) < 2: # Real paragraphs usually don't have many links at the very start
                start_idx = i
                break
            
    if start_idx > 0:
        lines = lines[start_idx:]
        text = "\n".join(lines)
    
    # 5. Strip breadcrumb-like sequences (Link > Link > Page)
    text = re.sub(r'\[.*?\]\(.*?\)\s*[\>»\|\.\-]\s*\[.*?\]\(.*?\)', '', text)
    
    # 6. Filter high link-density lines (sidebars/menus)
    final_lines = []
    consecutive_link_lines = 0
    
    for line in text.split('\n'):
        stripped = line.strip()
        if len(stripped) < 3: continue
        
        # Filter lines that are just path fragments
        if '/' in line and ' ' not in line and len(line) > 10:
            continue
        
        # Filter horizontal rules
        if re.match(r'^[-_*]{3,}$', stripped):
            continue
        
        # Filter common navigational noise "Next", "Previous", "Home", etc.
        if stripped.lower() in ["next", "previous", "home", "search", "menu", "contact", "about"]:
            continue
            
        link_count = len(re.findall(r'\[.*?\]\(.*?\)', line))
        word_count = len(line.split())
        
        # Aggressive link density filter
        if word_count > 0:
            link_density = link_count / max(1, word_count // 3) # Roughly 3 words per link is still a menu
            if link_density >= 1.0 or (link_count > 0 and word_count <= 4):
                consecutive_link_lines += 1
                if consecutive_link_lines > 2: # Drop blocks of links
                    continue
            else:
                consecutive_link_lines = 0
        
        # Filter lines that look like image filenames
        if re.search(r'\.(png|jpg|jpeg|gif|svg|webp)$', stripped, re.I):
            continue
            
        final_lines.append(line)
        
    return "\n".join(final_lines).strip()

def extract_highlight_snippet(chunk_text: str, max_len=250) -> str:
    """Extract the first clean prose sentence from a markdown chunk for page highlighting."""
    for line in chunk_text.split('\n'):
        # Strip ALL markdown formatting including headers
        clean = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', line)  # [text](url) -> text
        clean = re.sub(r'[*_~`]', '', clean)                     # Bold/italic/code
        clean = re.sub(r'^#+\s*', '', clean)                      # Strip leading # headers
        clean = re.sub(r'^\s*[\-\*]\s+', '', clean)               # Strip list markers
        clean = clean.strip()
        
        # Skip short lines and URL-heavy lines
        if not clean or len(clean) < 30: continue
        if clean.count('http') > 1: continue
        # Skip lines that are just numbers/dots (like "1.1" or "Article 1")
        if re.match(r'^[\d\.\s]+$', clean): continue
        
        # Found a good sentence — truncate at word boundary
        if len(clean) > max_len:
            last_space = clean.rfind(' ', 0, max_len)
            clean = clean[:last_space] if last_space > 100 else clean[:max_len]
        return clean
    
    # Fallback: aggressively clean the first 300 chars
    fallback = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', chunk_text[:300])
    fallback = re.sub(r'[*_~`#\[\]\(\)]', '', fallback).strip()
    return ' '.join(fallback.split())[:max_len]

def generate_highlight_url(page_url: str, highlight_text: str) -> str:
    """
    Generate a URL fragment that can be used to highlight specific text on a page.
    Uses the Text Fragments feature (https://web.dev/text-fragments/) which creates
    a URL like: https://example.com/page#:~:text=highlight%20text
    """
    if not page_url or not highlight_text:
        return page_url or ""
    
    try:
        from urllib.parse import urlencode, quote, urlparse, urlunparse
        
        # Clean and normalize the highlight text
        # Only use the first 100 chars to avoid overly long fragments
        clean_text = highlight_text.strip()[:100]
        
        # URL encode the text for the fragment
        # Text fragments use ~:text= prefix
        encoded_text = quote(clean_text, safe='')
        
        # Parse the URL to append fragment
        parsed = urlparse(page_url)
        
        # Create the text fragment
        text_fragment = f":~:text={encoded_text}"
        
        # Reconstruct URL with the fragment
        new_url = urlunparse((
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            text_fragment  # fragment
        ))
        
        return new_url
    except Exception as e:
        print(f"[HIGHLIGHT] Error generating highlight URL: {e}")
        return page_url  # Fallback to original URL if something goes wrong

# Helper for intelligent chunking
def chunk_at_word_boundary(text: str, chunk_size: int = 2000) -> list[str]:
    chunks = []
    idx = 0
    while idx < len(text):
        if len(text) - idx <= chunk_size:
            chunks.append(text[idx:])
            break
            
        # Try to find a newline near the chunk boundary
        end = idx + chunk_size
        nl_pos = text.rfind('\n', idx, end)
        if nl_pos > idx + (chunk_size // 2):
            chunks.append(text[idx:nl_pos].strip())
            idx = nl_pos + 1
            continue
            
        # Fallback to space
        space_pos = text.rfind(' ', idx, end)
        if space_pos > idx + (chunk_size // 2):
            chunks.append(text[idx:space_pos].strip())
            idx = space_pos + 1
            continue
            
        # Hard break if no space found
        chunks.append(text[idx:end].strip())
        idx = end
        
    return [c for c in chunks if c]

try:
    from duckduckgo_search import DDGS
except ImportError:
    DDGS = None

class BrowserOrchestrator:
    def __init__(self, api_keys: dict, session_id: str = None, user_id: str = None, workspace_id: str = None, output_lang: str = "auto", query_notebook: bool = False, image_data: str = None, research_mode: str = "general"):
        self.api_keys = api_keys
        self.session_id = session_id
        self.user_id = user_id
        self.workspace_id = workspace_id
        self.output_lang = output_lang
        self.query_notebook = query_notebook
        self.image_data = image_data
        self.research_mode = research_mode
        
        self.analyzer = QueryAnalyzer(api_keys)
        # Firecrawl Integration (Reverted from Apify)
        from api_clients import get_firecrawl_key
        self.searcher = SearchAgent(get_firecrawl_key(api_keys))
        self.ranker = RankerAgent(api_keys)
        self.slicer = SlicerAgent(api_keys)
        from services.crawler_service import CrawlerService
        self.crawler_service = CrawlerService
        self.scraper = self.crawler_service
        self.scraper_agent = self.crawler_service # Alias for compatibility
    async def run(self, user_query: str) -> dict:
        print(f"[BrowserOrchestrator] Starting for query: {user_query}")
        
        # [NEW] Feature #5: Check if query requires multi-hop reasoning
        from reasoning_chain import is_multi_hop_query
        if is_multi_hop_query(user_query, self.api_keys):
            print(f"[BrowserOrchestrator] Detecting multi-hop reasoning required for: {user_query}")
            from reasoning_chain import ReasoningPlanner, ReasoningExecutor
            planner = ReasoningPlanner(self.api_keys)
            executor = ReasoningExecutor(self.api_keys, self.session_id, self.output_lang)
            plan = planner.plan(user_query)
            # execute_chain is an async generator, iterate to get the final result
            final_result = {}
            async for chunk in executor.execute_chain(plan, user_query):
                if chunk.get("type") == "thought":
                    print(f"[REASONING] {chunk.get('thought')}")
                if chunk.get("type") == "final":
                    final_result = {
                        "answer": chunk.get("answer"),
                        "citations": chunk.get("citations") or [],
                        "blocks": chunk.get("blocks") or [],
                        "chain": chunk.get("chain") or []
                    }
            return final_result
        
        # [FIX] Initialize missing variables
        scraped_contexts = []
        citations = []
        blocks = []
        global_chunk_counter = 0
        processed_urls = set() # [NEW] Track URLs we already have data for
        
        # Generates a unique run ID to avoid block collisions in the frontend
        run_id = int(time.time()) % 10000
        
        # 0. Handle Multimodal Image Data using Groq
        if self.image_data:
            try:
                import base64
                from vision import analyze_image_logic
                print("[BrowserOrchestrator] Found image_data, analyzing with Groq via vision.py...")
                b64 = self.image_data.split(",")[1] if "," in self.image_data else self.image_data
                image_bytes = base64.b64decode(b64)
                vision_res = analyze_image_logic(image_bytes, user_prompt=user_query, mode="qa", api_keys=self.api_keys)
                if vision_res.get("success"):
                    user_query = f"{user_query}\n\n[Visual Context from user's screen]: {vision_res['answer']}"
                    print("[BrowserOrchestrator] Successfully integrated visual context into query.")
            except Exception as e:
                print(f"[BrowserOrchestrator] Failed to analyze image: {e}")
                
        # 1. Analyze query
        search_queries = self.analyzer.analyze(user_query, research_mode=self.research_mode)
        print(f"[BrowserOrchestrator] Generated search queries: {search_queries}")
        
        # 2. RAG-FIRST Decision
        # [NEW] Only check local memory/notebook if query_notebook is True
        # Normalize query for local retrieval
        def normalize_url(u):
            if not u: return u
            return u.strip().lower().rstrip('/')
            
        nb_query = user_query # [FIX] Use the raw user_query for local RAG to get better matches
        
        # [NEW] Extract target name for persona validation
        target_name = ""
        if self.research_mode == 'person':
            # Try to extract from search queries first (highest accuracy)
            if search_queries:
                name_q = search_queries[0]
                target_name = name_q.replace('site:linkedin.com/in/', '').replace('"', '').strip()
            
            # Fallback to heuristic if search queries are generic
            if not target_name or target_name.lower() in ["name", "person"]:
                name_match = re.search(r'(?:for|of|summarize)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)', user_query)
                if name_match:
                    target_name = name_match.group(1)
        
        # [NEW] Force local context retrieval for Sync Finalization queries
        is_sync_finalization = any(kw in user_query.lower() for kw in ['finalize', 'successfully synced', 'linkedin profile has been synced'])
        
        if self.query_notebook or is_sync_finalization:
            print(f"[BrowserOrchestrator] Retrieving local/synced context for query: {nb_query}")
            from services.search_service import SearchService
            from models.dtos import SearchRequestDTO
            
            try:
                search_svc = SearchService(api_keys=self.api_keys)
                # Search for the person's name in the local session data
                nb_req = SearchRequestDTO(
                    query=nb_query, 
                    session_id=self.session_id, 
                    user_id=self.user_id,
                    workspace_id=self.workspace_id,
                    limit=10
                )
                res = await search_svc.chat(nb_req, api_keys=self.api_keys, skip_reasoning=True)
                
                if res.answer and len(res.answer) > 50 and not is_sync_finalization:
                    # [MOD] Only inject summary if it's NOT a finalization query
                    # For finalization, we want the LLM to read the RAW blocks (res.sources) instead of a potentially stale summary answer.
                    scraped_contexts.append(f"[Local Knowledge / Synced Profile Summary]\n{res.answer}")
                    print(f"[BrowserOrchestrator] Successfully injected {len(res.answer)} chars of local summary.")
                
                # Also inject the raw blocks for citation
                for s in res.sources:
                    if s.url:
                        processed_urls.add(normalize_url(s.url))
                    if s.content and len(s.content) > 100:
                        # [NEW] Persona Filter: Only keep blocks that actually mention the target person
                        # [FIX] Trust 'local' synced data; only filter automated scrapes for noise
                        # SearchResultDTO uses .metadata.get('source_type')
                        source_type = s.metadata.get('source_type', 'unknown')
                        is_local = source_type == 'local' or is_sync_finalization
                        if self.research_mode == 'person' and target_name and not is_local:
                            name_parts = [p.lower() for p in target_name.split() if len(p) > 2]
                            if name_parts and not any(p in s.content.lower() for p in name_parts):
                                print(f"[BrowserOrchestrator] Skipping unrelated persona block from {s.url} (No match for {target_name})")
                                continue

                        sub_block_id = f"br-block-local-{global_chunk_counter}"
                        global_chunk_counter += 1
                        scraped_contexts.append(f"[{sub_block_id}] Source URL: {s.url}\n{s.content}")
                        blocks.append({
                            "id": sub_block_id,
                            "text": s.content,
                            "url": s.url,
                            "source_type": "local"
                        })
            except Exception as e:
                print(f"[BrowserOrchestrator] Local context retrieval failed: {e}")
            
            # [NEW] Check for direct document matches even without a "chat" answer
            if is_sync_finalization:
               try:
                   search_svc = SearchService(api_keys=self.api_keys)
                   nb_results = await search_svc.global_search(nb_query, workspace_id=self.workspace_id, limit=8, user_id=self.user_id) 
                   if nb_results:
                       print(f"[BrowserOrchestrator] Found {len(nb_results)} relevant blocks in local RAG.")
                       relevant_blocks_count = 0
                       for r in nb_results:
                           content_lower = r.content.lower()
                           
                           # [FIX] Trust 'local' synced data; only filter automated scrapes for walls
                           source_type = r.metadata.get('source_type', 'unknown')
                           is_automated = source_type != 'local'
                           
                           wall_keywords = ["login to view", "join linkedin", "sign in | linkedin", "inaccessible profile", "auth wall"]
                           if is_automated and any(kw in content_lower for kw in wall_keywords):
                               print(f"[BrowserOrchestrator] Ignoring poisoning block from {r.url} (Automated Wall detected).")
                               continue

                           # [NEW] Persona Name Match
                           # [FIX] Trust sync finalization context; only filter noisy automated hits
                           if self.research_mode == 'person' and target_name and not is_sync_finalization:
                               name_parts = [p.lower() for p in target_name.split() if len(p) > 2]
                               if name_parts and not any(p in content_lower for p in name_parts):
                                   print(f"[BrowserOrchestrator] Skipping unrelated global block from {r.url} (No match for {target_name})")
                                   continue
                                   
                           processed_urls.add(normalize_url(r.url))
                           sub_block_id = f"br-block-force-{global_chunk_counter}"
                           global_chunk_counter += 1
                           scraped_contexts.append(f"[{sub_block_id}] Source URL: {r.url}\n{r.content}")
                           blocks.append({
                               "id": sub_block_id,
                               "text": r.content,
                               "url": r.url,
                               "source_type": "local"
                           })
                           relevant_blocks_count += 1
                       print(f"[BrowserOrchestrator] Retained {relevant_blocks_count} high-confidence persona blocks.")

               except Exception as e:
                   print(f"[BrowserOrchestrator] Forced global search failed: {e}")

        # Skip web search if we have significant local context (> 4000 chars)
        local_context_size = sum(len(c) for c in scraped_contexts)
        skip_web_search = local_context_size > 4000
        
        if not skip_web_search:
            print("[BrowserOrchestrator] Local context insufficient. Searching Web...")
            # 3. Search Web
            raw_results = []
            for q in search_queries:
                # [REVERTED] Firecrawl Search replaces Apify
                firecrawl_res = self.searcher.search(q)
                if firecrawl_res:
                    raw_results.extend(firecrawl_res)
                else:
                    print(f"[BrowserOrchestrator] Firecrawl Search failed for \"{q}\". No fallback search provided as per user settings.")
 
            print(f"[BrowserOrchestrator] Found {len(raw_results)} total raw results")
            
            # [NEW] Person Intelligence Branch
            if self.research_mode == 'person':
                print("[BrowserOrchestrator] Running Person Intelligence Analysis...")
                linkedin_results = [r for r in raw_results if 'linkedin.com/in/' in r['url']]
                
                if not linkedin_results:
                    print("[BrowserOrchestrator] No LinkedIn profile found.")
                    return {
                        "answer": "NEED_CLARIFICATION: I couldn't find a unique LinkedIn profile for this person. Could you provide a company, location, or their LinkedIn URL to help me narrow it down?",
                        "citations": [],
                        "blocks": [],
                        "status": "needs_more_info"
                    }
                
                # Prioritize the first LinkedIn result
                top_urls = [linkedin_results[0]['url']]
                print(f"[BrowserOrchestrator] Prioritizing LinkedIn profile: {top_urls[0]}")
            else:
                # 4. Rank Results (General Mode)
                top_urls = self.ranker.rank(user_query, raw_results)
                print(f"[BrowserOrchestrator] Ranked to top URLs: {top_urls}")
            
            # 5. Scrape & Background Ingest
            global_chunk_counter = 1
            from services.ingest_service import IngestService
            from models.dtos import IngestRequestDTO
            import threading
            
            def bg_ingest(url, content, title=None, metadata=None):
                svc = IngestService(api_keys=self.api_keys)
                req = IngestRequestDTO(
                    url=url,
                    text=content,
                    title=title or "Web Content",
                    session_id=self.session_id,
                    user_id=self.user_id
                )
                # Ensure asyncio is available in the thread
                import asyncio as _asyncio
                loop = _asyncio.new_event_loop()
                _asyncio.set_event_loop(loop)
                loop.run_until_complete(svc.ingest_text(req, self.api_keys))
                loop.close()
                
            for idx, url in enumerate(top_urls):
                norm_url = normalize_url(url)
                if norm_url in processed_urls:
                    print(f"[BrowserOrchestrator] Skipping {url} - already in synced context (normalized).")
                    continue
                    
                print(f"[BrowserOrchestrator] Scraping {url}...")

                # [NEW] YouTube-aware path: use transcript parser instead of scraper
                is_yt = 'youtube.com/watch' in url or 'youtu.be/' in url
                if is_yt:
                    try:
                        from youtube_parser import get_youtube_transcript, extract_video_id
                        yt_ok, yt_text, yt_err, yt_title = get_youtube_transcript(url)
                        yt_vid_id = extract_video_id(url)
                        if yt_ok and yt_text and len(yt_text) > 200:
                            import urllib.parse
                            yt_chunks = chunk_at_word_boundary(yt_text[:30000], 2000)
                            for c_text in yt_chunks:
                                if len(c_text) < 50:
                                    continue
                                sub_block_id = f"br-block-{run_id}-{global_chunk_counter}"
                                global_chunk_counter += 1

                                # Extract first [MM:SS] timestamp from this chunk
                                import re as _re2
                                ts_match = _re2.search(r'\[(\d{2}):(\d{2})\]', c_text)
                                ts_secs = 0
                                if ts_match:
                                    ts_secs = int(ts_match.group(1)) * 60 + int(ts_match.group(2))
                                yt_deep_link = f"https://www.youtube.com/watch?v={yt_vid_id}&t={ts_secs}s" if yt_vid_id else url

                                scraped_contexts.append(f"[{sub_block_id}] Source URL: {url}\n{c_text}")
                                h_snippet = extract_highlight_snippet(c_text)
                                citations.append({"blockId": sub_block_id, "snippet": url, "highlightUrl": yt_deep_link})
                                blocks.append({
                                    "id": sub_block_id,
                                    "text": c_text,
                                    "highlight_snippet": h_snippet,
                                    "url": yt_deep_link,
                                    "source_type": "youtube",
                                    "youtubeUrl": yt_deep_link,
                                    "timestamp_seconds": ts_secs,
                                    "title": yt_title or "YouTube Video"
                                })
                            # Background ingest
                            threading.Thread(
                                target=bg_ingest,
                                args=(url, yt_text, yt_title),
                                daemon=True
                            ).start()
                        else:
                            print(f"[BrowserOrchestrator] YouTube transcript failed for {url}: {yt_err}")
                    except Exception as _yt_e:
                        print(f"[BrowserOrchestrator] YouTube route error for {url}: {_yt_e}")
                    continue  # Skip for YouTube URLs

                print(f"[BrowserOrchestrator] Extracting: {url}...")
                
                # Standard Scraping Pipeline (Specialized LinkedIn -> Firecrawl -> Jina -> BS4)
                data, _title = await self.scraper.scrape_url(url, self.api_keys)
                
                # [MOD] Custom Scraper already handles walls. No early return needed.
                is_linkedin_wall = 'linkedin.com' in url and any(kw in data.lower() for kw in ["sign up | linkedin", "join linkedin", "security verification", "authwall", "agree & join"])
                if is_linkedin_wall:
                    print(f"[BrowserOrchestrator] LinkedIn Auth Wall detected for {url}. Continuing with extracted fragments...")

                # [NEW] Check for scraping errors (including 502/504 Bad Gateway)
                if not data or "Error" in data:
                    print(f"[BrowserOrchestrator] Skipping {url} due to scraping issues.")
                    continue
 
                if len(data) > 200:
                    # [NEW] Clean markdown before chunking to remove navigation noise
                    data = clean_scraped_markdown(data)
                    
                    # Chunk the data so the LLM cites specific sections, enabling accurate highlighting
                    short_data = data[:30000] # Broader coverage limit
                    import urllib.parse
                    
                    c_chunks = chunk_at_word_boundary(short_data, 2000)
                    for c_text in c_chunks:
                        if len(c_text) < 50:
                            continue
                            
                        sub_block_id = f"br-block-{run_id}-{global_chunk_counter}"
                        global_chunk_counter += 1
                        scraped_contexts.append(f"[{sub_block_id}] Source URL: {url}\n{c_text}")
                        
                        # Extract a clean prose snippet for accurate page highlighting
                        h_snippet = extract_highlight_snippet(c_text)
                        safe_h_snippet = urllib.parse.quote(h_snippet[:80])  # Fragment URLs have length limits
                        highlight_url = f"{url}#:~:text={safe_h_snippet}"
 
                        citations.append({"blockId": sub_block_id, "snippet": url, "highlightUrl": highlight_url})
                        blocks.append({
                            "id": sub_block_id,
                            "text": c_text,
                            "highlight_snippet": h_snippet,
                            "url": highlight_url,
                            "source_type": "web"
                        })
                    
                    # Background ingest into vector DB
                    threading.Thread(
                        target=bg_ingest,
                        args=(url, data),
                        daemon=True
                    ).start()

                    # [NEW] Person Intelligence Breadcrumb Extraction (Expanded)
                    if self.research_mode == 'person' and 'linkedin.com/in/' in url:
                        print("[BrowserOrchestrator] Extracting digital breadcrumbs from LinkedIn...")
                        import re
                        # Find GitHub, Twitter/X, and Portfolio/Personal sites
                        profile_patterns = [
                            r'github\.com\/[a-zA-Z0-9_-]+',
                            r'(?:twitter\.com|x\.com)\/[a-zA-Z0-9_-]+',
                            r'leetcode\.com\/(?:u\/)?[a-zA-Z0-9_-]+',
                            r'hackerrank\.com\/[a-zA-Z0-9_-]+',
                            r'kaggle\.com\/[a-zA-Z0-9_-]+',
                            r'producthunt\.com\/@[a-zA-Z0-9_-]+',
                            r'linktr\.ee\/[a-zA-Z0-9_-]+',
                            r'bento\.me\/[a-zA-Z0-9_-]+',
                            r'[a-zA-Z0-9_-]+\.substack\.com',
                            r'medium\.com\/@[a-zA-Z0-9_-]+',
                            r'dribbble\.com\/[a-zA-Z0-9_-]+',
                            r'behance\.net\/[a-zA-Z0-9_-]+',
                            r'polywork\.com\/[a-zA-Z0-9_-]+'
                        ]
                        
                        discovered_urls = []
                        for pattern in profile_patterns:
                            matches = list(set(re.findall(pattern, data)))
                            for m in matches:
                                prefix = "" if m.startswith("http") else "https://"
                                discovered_urls.append(f"{prefix}{m}")
                                
                        # Aggressive "Personal Website" discovery (looking for [domain].com in contact info or bio)
                        # We look for links wrapped in common patterns if they aren't social media
                        website_matches = re.findall(r'(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9\-]+\.(?:com|org|io|dev|me|net))\/?', data)
                        social_domains = ['linkedin', 'fb', 'facebook', 'instagram', 'googletagmanager', 'google-analytics', 'gstatic', 'wp', 'gravatar', 'googletravel', 'doubleclick']
                        for domain_match in website_matches:
                            if not any(sd in domain_match.lower() for sd in social_domains):
                                d_url = f"https://{domain_match}"
                                if d_url not in discovered_urls:
                                    discovered_urls.append(d_url)

                        if discovered_urls:
                            print(f"[BrowserOrchestrator] Discovered linked profiles: {discovered_urls}. Adding to scrape queue.")
                            # Add to top_urls dynamically if not already there
                            for d_url in discovered_urls:
                                if d_url not in top_urls:
                                    top_urls.insert(1, d_url) # Priority 1 (after LinkedIn)
            
            # Deduplicate top_urls in case breadcrumbs added duplicates
            top_urls = list(dict.fromkeys(top_urls))
        else:
            print("[BrowserOrchestrator] Skipping web search. Found sufficient local memory.")

        # 6. Final Context Synthesis
        # Respect ContextConfig.MAX_CONTEXT_LENGTH (8000)
        final_contexts = []
        current_len = 0
        limit = settings.context_limit
        for ctx in scraped_contexts:
            if current_len + len(ctx) > limit:
                if current_len == 0:
                    final_contexts.append(ctx[:limit])
                break
            final_contexts.append(ctx)
            current_len += len(ctx)
            
        context_str = "\n\n---\n\n".join(final_contexts)
        print(f"[BrowserOrchestrator] final context size: {len(context_str)} characters.")
        
        if not scraped_contexts:
            return {
                "answer": "Failed to retrieve any relevant web or local content for your query.",
                "citations": [],
                "blocks": []
            }
            
        # Target Language Handling
        lang_instruction = ""
        if self.output_lang and self.output_lang != "auto":
            from utils import LANG_MAP
            lang_name = LANG_MAP.get(self.output_lang, self.output_lang)
            lang_instruction = f"\n\nCRITICAL: You MUST translate and output your entire final response securely into {lang_name}."
            
        # Call LLMRouter for Final Synthesis
        router = LLMRouter(self.api_keys)
        # [BUGFIX] Use final_contexts (truncated) instead of scraped_contexts (unlimited)
        context_str = "\n\n---\n\n".join(final_contexts)
        
        persona_instruction = "You are an advanced Browser Assistant."
        if self.research_mode == 'scholar':
            persona_instruction = "You are an Academic Research Assistant. Analyze the provided research papers and web contexts with scientific rigor. Prioritize methodology, results, and peer-reviewed data."
        elif self.research_mode == 'legal':
            persona_instruction = "You are a Legal Research Assistant. Analyze the provided government policies, acts, and regulations with extreme precision. Focus on statutory language, effective dates, and official notifications. Cite specific articles or sections if present in the text."
        elif self.research_mode == 'person':
            persona_instruction = """You are a Digital Investigator and Executive Researcher. 
Your goal is to synthesize a structured 'Person Dossier' from the provided digital footprint (LinkedIn, GitHub, Twitter, etc.).
Structure your response into the following sections:
1. Executive Summary (Role, Current Location, Unique Value Proposition).
2. Career Trajectory (Key roles and companies).
3. Technical Fingerprint (Top languages and project focus - cross-reference GitHub if available).
4. Public Persona (Insights from social media takes or blog posts).
5. Digital Footprint (Verified links).

IMPORTANT: Prioritize [br-block-local-*] and [br-block-force-*] sources. These are verified manual syncs from the user's browser. 
Even if you see generic LinkedIn templates or 'Join' buttons in these blocks, look DEEPER for actual professional data (Work history, Education, About section). 
If the text contains specific job titles, companies, or cities, SYNTHESIZE them. 
Only return 'NEED_CLARIFICATION' if the context is ENTIRELY restricted to a login/redirect page with NO personalized data."""

        prompt = f"""{persona_instruction}
Answer the user's query comprehensively using ONLY the provided scraped web context.
When you use information from a source, append the unique block ID tag inline exactly like [br-block-{run_id}-1] as found in the Context headings.
DO NOT use backticks for citations. DO NOT use standard Markdown footnotes (e.g. [1], [2]). 
You MUST strictly output the raw tag exactly as provided.
If the user's query asks for a diagram, flowchart, sequence, or structural explanation, use Mermaid syntax inside a ```mermaid code block to visualize the information accurately.
Do not make up URLs.{lang_instruction}
        
Context:
{context_str}

User Query: {user_query}
"""
        try:
            raw_answer = router.chat(
                prompt=prompt,
                model_id=settings.models.mistral_large
            )
            # 1. Strip Emojis and standard Markdown footnotes
            import re
            # Strip emojis
            final_answer = re.sub(r'[\U00010000-\U0010ffff]', '', raw_answer)
            # Strip [1], [17] style footnotes but NOT [br-block-...] or [db-block-...]
            # Regex catches any brackets containing only digits (0-999)
            final_answer = re.sub(r'\[\d{1,3}\]', '', final_answer)
            # Catch space before citation too
            final_answer = final_answer.replace(' []', '').replace('[]', '')
            
            # 2. Advanced stripping of redundant quotes, leading dots, colons, or "markdown tags"
            # Remove surrounding block quotes if LLM hallucinated them
            if final_answer.startswith('```') and final_answer.endswith('```'):
                lines = final_answer.split('\n')
                if len(lines) > 2:
                    final_answer = "\n".join(lines[1:-1]).strip()
            
            # Remove surrounding quotes
            if final_answer.startswith('"') and final_answer.endswith('"'):
                final_answer = final_answer[1:-1].strip()
                
            # Aggressive strip of leading/trailing artifacts
            # We use a loop to handle multiple redundant characters like ". . ."
            while final_answer and final_answer[0] in '.: \n\t"\'@':
                final_answer = final_answer[1:]
            
            # For the end, be more careful not to strip a single closing period of a sentence,
            # but do strip redundant whitespace or multiple periods/quotes.
            while final_answer and (final_answer[-1] in ' \n\t"\'@' or final_answer.endswith('..')):
                final_answer = final_answer[:-1]
                
            # [NEW] Detect 'needs_browser_sync' in LLM answer (Post-Synthesis Detection)
            res_status = None
            locked_url = None
            
            # If the LLM generates a text mentioning the wall/login, we bridge the status
            wall_keywords = ["login wall", "sign-up wall", "blocking automated access", "directly from your browser tab"]
            if any(kw in final_answer.lower() for kw in wall_keywords) or final_answer.startswith("NEED_CLARIFICATION"):
                res_status = "needs_browser_sync"
                # Remove ugly technical prefix if present
                final_answer = final_answer.replace("NEED_CLARIFICATION:", "").replace("NEED_CLARIFICATION", "").strip()
                
                # Attempt to extract the URL mentioned back to the front-end for the Sync Button
                import re as _re3
                li_url_match = _re3.search(r'https?://[a-z0-9\.]*linkedin\.com/in/[a-zA-Z0-9\-_]+', final_answer)
                if li_url_match:
                    locked_url = li_url_match.group(0)
                    # Linkify it for the markdown renderer if not already linkified
                    if f"({locked_url})" not in final_answer and f"[{locked_url}]" not in final_answer:
                        final_answer = final_answer.replace(locked_url, f"[{locked_url}]({locked_url})")
            
            # [FIX] Force status to "completed" if it's a sync finalization query to stop redundant UI prompts
            is_sync_finalization = any(kw in user_query.lower() for kw in ['finalize', 'successfully synced', 'linkedin profile has been synced'])
            if is_sync_finalization:
                res_status = "completed"
                
            print(f"[BrowserOrchestrator] Final Response Analysis: status={res_status}, locked_url={locked_url}")
            
        except Exception as e:
            error_str = str(e)
            if "Status 429" in error_str or "Rate limit" in error_str:
                final_answer = "Error: Rate limit exceeded. Please try again in a moment."
            else:
                final_answer = f"Error generating final response: {error_str}"
            res_status = "completed" if any(kw in user_query.lower() for kw in ['finalize', 'successfully synced']) else None
            locked_url = None
            
        return {
            "answer": final_answer,
            "citations": citations,
            "blocks": blocks,
            "status": res_status or "completed",
            "locked_url": locked_url
        }


class QueryAnalyzer:
    def __init__(self, api_keys: dict):
        self.api_keys = api_keys

    def analyze(self, query: str, research_mode: str = "general") -> list[str]:
        router = LLMRouter(self.api_keys)
        
        persona_instructions = "The user wants to find information on the web."
        if research_mode == 'person':
            persona_instructions = """The user wants to research a specific person. 
Your goal is to generate highly targeted search queries to build a professional dossier.
One query MUST be for LinkedIn (e.g. \"Name\" site:linkedin.com/in/). 
The second should target another digital footprint like GitHub, Twitter, or a personal website. 

CRITICAL: If the query mentions 'Finalize the research' or 'LinkedIn profile has been synced', DO NOT use placeholder terms like "Name", "Role", or "Company". Extract the candidate's actual name from the query text (e.g. "Finalize research for: John Doe" -> Search for "John Doe"). 
If no name is found, do NOT generate generic search queries like 'Search for Name'. Instead, skip the search or return specific queries based on context.
"""
            
        prompt = f"""You are a query analysis agent.
{persona_instructions}
Generate 1 to 2 highly specific search queries. 
Output ONLY a JSON array of strings. No markdown formatting.
        
User Query: {query}
"""
        try:
            content = router.chat(
                prompt=prompt,
                model_id=settings.models.mistral_small,
                response_format={"type": "json_object"}
            )
            queries = json.loads(content)
            if isinstance(queries, list):
                return queries[:2]
        except Exception as e:
            print(f"[QueryAnalyzer] Error: {e}")
        return [query]

class FirecrawlScraper:
    """Dedicated scraper using Firecrawl (Reverted from Apify) with Jina Reader fallback"""
    def __init__(self, api_keys: Dict[str, str] = None):
        self.api_key = get_firecrawl_key(api_keys)
        self.base_url = "https://api.firecrawl.dev/v1"

    async def scrape(self, url: str) -> str:
        # 1. Try Firecrawl first
        if self.api_key:
            try:
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {"url": url, "formats": ["markdown"], "onlyMainContent": True}
                
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(f"{self.base_url}/scrape", headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json().get('data', {})
                        md_text = data.get('markdown', '')
                        if md_text and len(md_text) > 200:
                            return md_text
                    
                    if resp.status_code in [403, 401]:
                        print(f"[Firecrawl] Scrape hit 403/401 for {url}, attempting Jina premium fallback...")
            except Exception as e:
                print(f"[Firecrawl] Scrape failed for {url}: {e}")
        
        # 2. Jina Reader fallback (Premium Extraction)
        jina_content = await self._jina_reader_fallback(url)
        if jina_content:
            # Check for login wall in Jina content
            wall_keywords = ["login to view", "join linkedin", "sign in | linkedin", "agree & join", "auth wall"]
            if any(kw in jina_content.lower()[:2000] for kw in wall_keywords):
                print(f"[Scraper] Jina extracted content, but detected a login wall for {url}")
                return "ERROR_AUTH_WALL"
            return jina_content
        
        # 3. Direct HTTP + BeautifulSoup fallback (Last Resort)
        print(f"[Scraper] All premium scrapers failed for {url}, trying direct HTTP fallback...")
        return await self._simple_scrape_fallback(url)

    @staticmethod
    async def _jina_reader_fallback(url: str) -> str:
        """Use Jina Reader (r.jina.ai) as a free fallback scraper."""
        try:
            import os
            jina_url = f"https://r.jina.ai/{url}"
            headers = {
                "Accept": "text/markdown",
                "X-No-Cache": "true",
                "X-Engine": "browser", # Requested highest output quality setting
                "X-Return-Format": "markdown"
            }
            
            # Use API key if available for higher limits/stability
            jina_key = os.getenv("JINA_API_KEY", "")
            if jina_key:
                headers["Authorization"] = f"Bearer {jina_key}"

            async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as client:
                resp = await client.get(jina_url, headers=headers)
                if resp.status_code == 200:
                    content = resp.text.strip()
                    if content and len(content) > 100:
                        print(f"[Jina] Successfully scraped {url} ({len(content)} chars)")
                        return content
        except Exception as e:
            print(f"[Jina] Fallback failed for {url}: {e}")
        return ""

    @staticmethod
    async def _simple_scrape_fallback(url: str) -> str:
        """Direct HTTP + BeautifulSoup fallback."""
        try:
            from bs4 import BeautifulSoup
            async with httpx.AsyncClient(
                timeout=20.0,
                follow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            ) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.content, 'html.parser')
                    for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
                        tag.decompose()
                    main = soup.find('main') or soup.find('article') or soup.body
                    if main:
                        text = main.get_text(separator='\n', strip=True)
                        if len(text) > 200:
                            print(f"[DirectScrape] Successfully scraped {url} ({len(text)} chars)")
                            return text[:50000]
        except Exception as e:
            print(f"[DirectScrape] Fallback failed for {url}: {e}")
        return ""

class SlicerAgent:
    def __init__(self, api_keys: dict):
        self.api_keys = api_keys

    def slice(self, query: str, content: str, target_chars: int = 6000) -> str:
        """
        Uses a lightweight model to identify and extract the most relevant 
        window of text from a larger document.
        """
        if not content or len(content) <= target_chars:
            return content
            
        print(f"[SlicerAgent] Slicing {len(content)} chars down to {target_chars} for relevance...")
        router = LLMRouter(self.api_keys)
        # Use a smaller window for the slicer to improve speed and reduce disconnection risk
        input_context = content[:12000]
        
        prompt = f"""You are a content filtering agent.
From the provided text content, extract the most highly relevant section (approx {target_chars} characters) that answers the user's query.
Preserve the original wording. If there are multiple disconnected relevant sections, combine them with '...'.
Output ONLY the extracted text.

User Query: {query}

Content:
{input_context}
"""
        try:
            sliced_text = router.chat(
                prompt=prompt,
                model_id=settings.models.mistral_small
            )
            if not sliced_text:
                return content[:target_chars]
            return sliced_text[:target_chars]
        except Exception as e:
            print(f"[SlicerAgent] Slicing failed: {e}")
            return content[:target_chars]

class SearchAgent:
    """Dedicated search using Firecrawl /search endpoint (Reverted from Apify)"""
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Updated to Firecrawl's v2 API since v1 was deprecated and threw 404s
        self.base_url = "https://api.firecrawl.dev/v2/search"

    def search(self, query: str) -> list[dict]:
        if not self.api_key:
            print("[SearchAgent] Warning: No Firecrawl API Key provided for search.")
            return []
            
        print(f"[SearchAgent] Performing Firecrawl Search for: {query}")
        
        payload = {
            "query": query,
            "limit": 5
        }
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            resp = requests.post(
                self.base_url, 
                headers=headers,
                json=payload, 
                timeout=45
            )
            if resp.status_code == 200:
                data = resp.json()
                
                # If Firecrawl returns a stringified JSON body, parse it
                if isinstance(data, str):
                    import json
                    try:
                        data = json.loads(data)
                    except json.JSONDecodeError:
                        print(f"[SearchAgent] Failed to decode string response: {data}")
                        return []
                
                results = []
                items = []
                
                if isinstance(data, dict):
                    inner_data = data.get('data', [])
                    # Firecrawl v2 returns results nested inside a "web" key
                    if isinstance(inner_data, dict):
                        items = inner_data.get('web', []) or inner_data.get('results', []) or []
                    elif isinstance(inner_data, list):
                        items = inner_data
                elif isinstance(data, list):
                    items = data
                
                for item in items:
                    if isinstance(item, dict):
                        results.append({
                            "title": item.get('title', 'Web Result'),
                            "url": item.get('url', ''),
                            "snippet": item.get('description', '') or item.get('snippet', '')
                        })
                return results
            print(f"[SearchAgent] Firecrawl Search Error {resp.status_code}: {resp.text}")
            return []
        except Exception as e:
            print(f"[SearchAgent] Exception during Firecrawl search: {e}")
            return []

class RankerAgent:
    def __init__(self, api_keys: dict):
        self.api_keys = api_keys

    def rank(self, user_query: str, results: list[dict]) -> list[str]:
        if not results:
            return []
            
        # Deduplicate URLs
        unique_results = []
        seen = set()
        for r in results:
            if r['url'] not in seen:
                seen.add(r['url'])
                unique_results.append(r)
                
        # If very few, just return them
        if len(unique_results) <= 3:
            return [r['url'] for r in unique_results]
            
        client = get_mistral_client(self.api_keys)
        
        # Prepare context for LLM
        items_str = ""
        for idx, res in enumerate(unique_results):
            items_str += f"""ID: {idx}
Title: {res['title']}
Snippet: {res['snippet']}
URL: {res['url']}
---
"""
        prompt = f"""You are a search ranking agent.
Evaluate the following search results against the original user query.
Select the top 3 most relevant, authoritative, and helpful results.
Output ONLY a JSON array of integers representing the IDs of the selected results (e.g. [0, 2, 4]). No other text.

User Query: {user_query}

Results:
{items_str}
"""
        try:
            response = client.chat.complete(
                model=settings.models.mistral_small,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.choices[0].message.content.strip()
            import re
            # Extract anything that looks like a JSON array [0, 1, 2]
            array_match = re.search(r'\[\s*\d+\s*(?:,\s*\d+\s*)*\]', text)
            if array_match:
                ids = json.loads(array_match.group(0))
            else:
                # Fallback: find all numbers in the response
                ids = [int(n) for n in re.findall(r'\d+', text)]
            
            # filter and map to URLs
            top_urls = []
            for i in ids:
                if 0 <= i < len(unique_results):
                    top_urls.append(unique_results[i]['url'])
            
            # [STABILIZED] If no rankings found, return top 3 original results
            if not top_urls:
                print("[RankerAgent] Warning: No rankings selected by LLM. Falling back to top results.")
                return [r['url'] for r in unique_results[:3]]
                
            return top_urls[:3]
        except Exception as e:
            print(f"[RankerAgent] Ranking failed: {e}. Falling back to top results.")
            return [r['url'] for r in unique_results[:3]]

class ApifyScraper:
    """Replacement for FirecrawlScraper using specialized Apify actors."""
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def extract(self, url: str) -> str:
        if self.api_key:
            # Re-use the CrawlerService routing logic for consistency
            from services.crawler_service import CrawlerService
            content, title = await CrawlerService.scrape_url(url, {"apify": self.api_key})
            if content:
                return content
            print(f"[ApifyScraper] Actor failed, trying simple fallback...")

        # Priority 2: Direct HTTP Fallback
        print(f"[ApifyScraper] Attempting direct HTTP fallback for {url}...")
        try:
            async with httpx.AsyncClient(headers={'User-Agent': 'Mozilla/5.0'}, timeout=15) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    from bs4 import BeautifulSoup
                    soup = BeautifulSoup(resp.content, 'html.parser')
                
                # Strip scripts and styles
                for script in soup(["script", "style", "nav", "footer"]):
                    script.extract()
                    
                text = soup.get_text(separator=' ')
                # Basic cleaning
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                return "\n".join(chunk for chunk in chunks if chunk)
            return f"Error: Scraper status {resp.status_code}"
        except Exception as e:
            return f"Error: Direct fetch failed: {str(e)}"

class JinaScraper:
    """Specialized scraper using r.jina.ai for LinkedIn and other hard targets."""
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def extract(self, url: str) -> str:
        if not self.api_key:
            return ""
            
        print(f"[JinaScraper] Attempting direct extraction for: {url}")
        jina_url = f"https://r.jina.ai/{url}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-With-Images-Summary": "true",
            "X-Target-Language": "en"
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(jina_url, headers=headers)
                if response.status_code == 200:
                    content = response.text
                    # Check for login wall
                    wall_keywords = ["login to view", "join linkedin", "sign in | linkedin", "agree & join", "auth wall"]
                    if any(kw in content.lower()[:2000] for kw in wall_keywords):
                        print(f"[JinaScraper] Warning: Extraction hit a login wall for {url}")
                        return "ERROR_AUTH_WALL"
                    return content
                print(f"[JinaScraper] Failed with status {response.status_code}")
                return ""
        except Exception as e:
            print(f"[JinaScraper] Error: {e}")
            return ""

class JinaSearchAgent:
    """Fallback search agent using Jina Search (s.jina.ai)."""
    def __init__(self, api_keys: dict = None):
        self.api_keys = api_keys or {}

    def search(self, query: str) -> list[dict]:
        try:
            import os
            import requests
            import urllib.parse
            
            # Using env var for local backend
            jina_key = self.api_keys.get("jina", os.getenv("JINA_API_KEY", ""))
            
            if not jina_key:
                print("[JinaSearchAgent] Warning: No JINA_API_KEY provided. Jina Search requires authentication.")
                return []
                
            encoded_query = urllib.parse.quote(query)
            url = f"https://s.jina.ai/{encoded_query}"
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {jina_key}"
            }
            
            resp = requests.get(url, headers=headers, timeout=30.0)

            if resp.status_code == 200:
                data = resp.json()
                results = []
                # Jina returns a list under 'data' key
                for item in data.get('data', [])[:5]:
                    results.append({
                        "title": item.get('title', 'Unknown'),
                        "url": item.get('url', ''),
                        "snippet": item.get('description', '') or item.get('content', '')
                    })
                return results
            print(f"[JinaSearchAgent] Failed with status {resp.status_code}: {resp.text}")
            return []
        except Exception as e:
            print(f"[JinaSearchAgent] Error: {e}")
            return []
