import os
import json
import time
import requests
import re
from pydantic import BaseModel
from api_clients import get_mistral_client, get_firecrawl_key
from config import ContextConfig

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
        
        # Filter single short words (nav items like "Search", "Menu")
        if len(stripped.split()) == 1 and len(stripped) < 20:
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
        
        # Filter lines starting with > that contain URLs (quoted URLs from forums)
        if stripped.startswith('>') and 'http' in stripped and len(stripped.split()) < 5:
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
    def __init__(self, api_keys: dict, session_id: str = None, output_lang: str = "auto", query_notebook: bool = False, image_data: str = None):
        self.api_keys = api_keys
        self.session_id = session_id
        self.output_lang = output_lang
        self.query_notebook = query_notebook
        self.image_data = image_data
        
        self.analyzer = QueryAnalyzer(api_keys)
        self.searcher = SearchAgent(get_firecrawl_key(api_keys))
        self.ranker = RankerAgent(api_keys)
        self.slicer = SlicerAgent(api_keys)
        self.scraper = FirecrawlScraper(get_firecrawl_key(api_keys))

    def run(self, user_query: str) -> dict:
        print(f"[BrowserOrchestrator] Starting for query: {user_query}")
        
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
        search_queries = self.analyzer.analyze(user_query)
        print(f"[BrowserOrchestrator] Generated search queries: {search_queries}")
        
        # 2. RAG-FIRST Decision
        # [NEW] Only check local memory/notebook if query_notebook is True
        notebook_str = ""
        nb_blocks = []
        if self.query_notebook:
            # We check local memory/notebook to see if we can skip a fresh web crawl
            # [FIX] Use the primary refined search query for better semantic matching in the notebook
            nb_query = search_queries[0] if search_queries else user_query
            print(f"[BrowserOrchestrator] Checking RAG for existing knowledge using query: {nb_query}")
            from search import get_notebook_context
            notebook_str, nb_blocks = get_notebook_context(nb_query, api_keys=self.api_keys, limit=8)
            
            if notebook_str:
                print(f"[BrowserOrchestrator] Found {len(nb_blocks)} relevant blocks in local RAG.")
                scraped_contexts.append(f"--- LOCAL MEMORY CONTEXT ---\n{notebook_str}\n-----------------------------")
                for b in nb_blocks:
                    citations.append({
                        "blockId": b["id"], 
                        "snippet": "Local Memory", 
                        "highlightUrl": b.get("highlightUrl", b.get("url", ""))
                    })
                    blocks.append(b)

        # Skip web search if we have significant local context (> 4000 chars)
        skip_web_search = len(notebook_str) > 4000
        
        if not skip_web_search:
            print("[BrowserOrchestrator] Local context insufficient. Searching Web...")
            # 3. Search Web
            raw_results = []
            for q in search_queries:
                raw_results.extend(self.searcher.search(q))
                
        system_prompt = f"""You are a professional AI research orchestrator. Your goal is to synthesize information from multiple web sources into a high-quality, executive-level response.

CRITICAL RULES:
1. **Tone & Style**: Adopt a professional, objective, and analytical tone. Use clear headings, bold key terms, and bullet points. Avoid conversational filler.
2. **Contextual Grounding**: ONLY answer using provided research blocks. Do not use external knowledge.
3. **Citations**: Integrate citations ([db-block-X]) at the end of relevant sentences to ground your facts. Use EXACT block IDs from the context.
4. **No Information**: If the context doesn't have the answer, state that the research did not provide sufficient information.
5. **Formatting**: Use Markdown for structure.

At the end of your response, suggest 2-3 concise, professional follow-up questions."""

        from rag_pipeline import ingest_text_logic
        import threading
        # Generate a unique run ID to avoid block collisions in the frontend
        import time
        run_id = int(time.time()) % 10000
        
        print(f"[BrowserOrchestrator] Found {len(raw_results)} total raw results")
        
        # 4. Rank Results
        top_urls = self.ranker.rank(user_query, raw_results)
        print(f"[BrowserOrchestrator] Ranked to top URLs: {top_urls}")
        
        # 5. Scrape & Background Ingest
        global_chunk_counter = 1
            
        for idx, url in enumerate(top_urls):
            print(f"[BrowserOrchestrator] Scraping {url}...")
            data = self.scraper.extract(url)
            
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
                    blocks.append({"id": sub_block_id, "text": c_text, "highlight_snippet": h_snippet, "url": highlight_url})
                
                # Background ingest into vector DB
                threading.Thread(
                    target=ingest_text_logic,
                    args=(url, data),
                    kwargs={
                        "api_keys": self.api_keys, 
                        "session_id": self.session_id,
                        "extra_metadata": {"source_type": "browser_search"}
                    },
                    daemon=True
                ).start()
        else:
            print("[BrowserOrchestrator] Skipping web search. Found sufficient local memory.")

        # 6. Final Context Synthesis
        # Respect ContextConfig.MAX_CONTEXT_LENGTH (8000)
        final_contexts = []
        current_len = 0
        limit = ContextConfig.MAX_CONTEXT_LENGTH
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
            from search import LANG_MAP
            lang_name = LANG_MAP.get(self.output_lang, self.output_lang)
            lang_instruction = f"\n\nCRITICAL: You MUST translate and output your entire final response securely into {lang_name}."
            
        # Call Mistral for Final Synthesis
        client = get_mistral_client(self.api_keys)
        # [BUGFIX] Use final_contexts (truncated) instead of scraped_contexts (unlimited)
        context_str = "\n\n---\n\n".join(final_contexts)
        prompt = f"""You are an advanced Browser Assistant.
Answer the user's query comprehensively using ONLY the provided scraped web context.
When you use information from a source, append the unique block ID tag inline exactly like `[br-block-{run_id}-1]` as found in the Context headings.
DO NOT use standard Markdown footnotes (e.g. `[1]`, `[2]`). You MUST strictly output the raw tag exactly as provided.
Do not make up URLs.{lang_instruction}
        
Context:
{context_str}

User Query: {user_query}
"""
        try:
            response = client.chat.complete(
                model='mistral-large-latest',
                messages=[{"role": "user", "content": prompt}]
            )
            raw_answer = response.choices[0].message.content.strip()
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
                
            final_answer = final_answer.strip()
            
        except Exception as e:
            error_str = str(e)
            if "Status 429" in error_str or "Rate limit" in error_str:
                final_answer = "Error: Rate limit exceeded. Please try again in a moment."
            else:
                final_answer = f"Error generating final response: {error_str}"
            
        return {
            "answer": final_answer,
            "citations": citations,
            "blocks": blocks
        }

class QueryAnalyzer:
    def __init__(self, api_keys: dict):
        self.api_keys = api_keys

    def analyze(self, query: str) -> list[str]:
        client = get_mistral_client(self.api_keys)
        prompt = f"""You are a query analysis agent.
The user wants to find information on the web.
Generate 1 to 2 highly specific, long-tail search queries that target precise technical details or data points for the user's need. Avoid generic terms.
Output ONLY a JSON array of strings. No markdown formatting.
        
User Query: {query}
"""
        try:
            response = client.chat.complete(
                model='mistral-small-latest',
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.choices[0].message.content.strip()
            # clean markdown ticks if any
            if text.startswith("```json"):
                text = text[7:-3].strip()
            elif text.startswith("```"):
                text = text[3:-3].strip()
                
            queries = json.loads(text)
            if isinstance(queries, list):
                return queries[:2]
        except Exception as e:
            print(f"[QueryAnalyzer] Error: {e}")
        return [query]

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
        client = get_mistral_client(self.api_keys)
        if not client:
            return content[:target_chars]

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
        # Simple Retry Loop
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                response = client.chat.complete(
                    model='mistral-small-latest',
                    messages=[{"role": "user", "content": prompt}]
                )
                sliced_text = response.choices[0].message.content.strip()
                # If we get a valid but empty response, fallback
                if not sliced_text:
                    return content[:target_chars]
                return sliced_text[:target_chars]
            except Exception as e:
                print(f"[SlicerAgent] Attempt {attempt+1} failed: {e}")
                if attempt < max_retries:
                    import time
                    time.sleep(1) # Small backoff
                else:
                    print(f"[SlicerAgent] Final fallback: Returning first {target_chars} chars.")
                    return content[:target_chars]
        return content[:target_chars]

class SearchAgent:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def search(self, query: str) -> list[dict]:
        if not self.api_key:
            print("[SearchAgent] Warning: No Firecrawl API Key provided for search fallback.")
            return []
            
        print(f"[SearchAgent] Performing Firecrawl Search for: {query}")
        endpoint = "https://api.firecrawl.dev/v1/search"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "query": query,
            "limit": 5
        }
        
        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=20)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    search_results = data.get("data", [])
                    results = []
                    for r in search_results:
                        results.append({
                            "title": r.get('title', 'Search Result'),
                            "url": r.get('url', ''),
                            "snippet": r.get('description', '') or r.get('snippet', '')
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
                model='mistral-small-latest',
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.choices[0].message.content.strip()
            # clean markdown ticks if any
            if text.startswith("```json"):
                text = text[7:-3].strip()
            elif text.startswith("```"):
                text = text[3:-3].strip()
                
            ids = json.loads(text)
            top_urls = [unique_results[i]['url'] for i in ids if 0 <= i < len(unique_results)]
            return top_urls[:3]
        except Exception as e:
            print(f"[RankerAgent] Error: {e}")
            return [r['url'] for r in unique_results[:3]]

class FirecrawlScraper:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def extract(self, url: str) -> str:
        if not self.api_key:
            print("[FirecrawlScraper] Warning: No Firecrawl API Key provided.")
            return "No text available due to missing Firecrawl API Key."
            
        endpoint = "https://api.firecrawl.dev/v1/scrape"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True
        }
        
        try:
            resp = requests.post(endpoint, json=payload, headers=headers, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("success"):
                    return data.get("data", {}).get("markdown", "")
            
            # [NEW] Specific handling for 502 Bad Gateway or 504 Gateway Timeout
            if resp.status_code in [502, 504]:
                print(f"[FirecrawlScraper] UPSTREAM ERROR {resp.status_code}: Service is temporarily overloaded.")
                return f"Error: The scraping service (Firecrawl) is temporarily unavailable (Status {resp.status_code}). Please try again in 1-2 minutes."

            print(f"[FirecrawlScraper] Error {resp.status_code} for {url}: {resp.text}")
            return f"Error: Received {resp.status_code} from scraper."
        except Exception as e:
            print(f"[FirecrawlScraper] Exception extracting {url}: {e}")
            return f"Exception: {str(e)}"
