# 🧠 SnapMind: Judges' Technical Q&A Cheat Sheet

This document contains 50+ likely technical questions that hackathon/competition judges might ask about SnapMind's architecture, and the precise, engineering-focused answers you should give.

---

## 🏗️ 1. System Architecture & Concurrency

**1. How does your backend handle multiple users performing heavy ingestion simultaneously without crashing?**
*Answer:* We use strict asynchronous boundaries. FastAPI is inherently async, but heavy CPU-bound tasks like semantic chunking or GraphRAG entity extraction are dispatched to dedicated `ThreadPoolExecutor` instances (e.g., `_graph_executor`). This ensures the main event loop is never blocked, preventing 524 timeouts and keeping the UI responsive.

**2. Why did you choose FastAPI over Express.js or Django?**
*Answer:* Python is the lingua franca of AI. FastAPI provides native async support (`asyncio`), automatic Swagger docs via Pydantic, and extremely high performance using ASGI/Uvicorn. It allowed us to tightly integrate with libraries like `pgvector`, `sentence-transformers`, and `langchain` without microservice overhead.

**3. What happens if a background ingestion job fails halfway through a 50-page crawl?**
*Answer:* Our database tracks job state via the `ingestion_jobs` table. The Firecrawl scraper extracts pages asynchronously, and we process them one by one. If a page fails, we catch the exception, skip it, and continue the job. The UI polls `/ingest/status` every 500ms so the user is aware of partial completions.

**4. How are you handling rate limits from the LLM providers (Mistral, Gemini)?**
*Answer:* We implemented an exponential backoff retry decorator (`@db_retry` and `@llm_retry`). If we hit a 429 Too Many Requests error, the system sleeps for $2^n$ seconds before retrying. For embeddings, we batch texts into arrays of 100 to minimize API round trips.

**5. Why did you build this as a Chrome Extension rather than a standalone Web App?**
*Answer:* A web app forces the user to context-switch away from their research. By building a Chrome Extension, SnapMind lives natively alongside the content. We can extract DOM content (bypassing paywalls or login screens since the user is already authenticated), capture selections, and inject UI elements like highlighters directly onto the page.

---

## 🔍 2. Advanced RAG & Vector Search

**6. What is Hybrid Search and why is it better than standard Vector Search?**
*Answer:* Pure vector search (cosine similarity) is great for conceptual matching but terrible at exact keyword matching (like finding a specific ID, name, or acronym). We implemented a custom PostgreSQL function that performs both `pgvector` similarity and `ts_rank` (BM25 keyword search) simultaneously, merging the results via a weighted fusion algorithm (70% vector, 30% keyword).

**7. How do you prevent "lost in the middle" syndrome when feeding chunks to the LLM?**
*Answer:* We use a Cross-Encoder Reranker. After Hybrid Search retrieves the top 20 candidates, we pass them through Cohere's Rerank v3 API (or a local MiniLM model fallback). The reranker scores how relevant each chunk is to the specific query, allowing us to truncate the list to the absolute top 5 chunks before feeding them to the generation LLM.

**8. Explain your Context Optimization pipeline.**
*Answer:* Before sending context to the LLM, we pass it through `ContextOptimizer`. It performs 4 steps: 1) Deduplication (removing chunks with >90% Jaccard overlap), 2) Relevance Filtering (dropping chunks below a score threshold), 3) Compression (stripping copyright notices and excessive whitespace), and 4) Smart Truncation (hard cap at 8000 chars to save token costs and reduce latency).

**9. How do you chunk your documents?**
*Answer:* We use Semantic Chunking. Instead of splitting blindly by character count (which cuts sentences in half), we parse the Markdown structure. We chunk hierarchically based on headers (`##`, `###`), ensuring that code blocks and tables are never split apart. We also overlap chunks by 20% to preserve context between boundaries.

**10. What is "Agentic Chunking" and when do you use it?**
*Answer:* It's an optional mode where we use Mistral Large to analyze the document and determine the optimal split points based on topic shifts, rather than just syntax. It's slower but produces vastly superior embeddings for complex research papers.

**11. Why pgvector instead of Pinecone or Milvus?**
*Answer:* Using Supabase with `pgvector` allows us to keep our vector embeddings in the exact same database as our relational metadata (users, sessions, bookmarks). This allows us to perform complex hybrid queries (e.g., "Find this vector BUT ONLY where user_id = X and created_at > Y") in a single SQL transaction, without the synchronization nightmares of a separate vector DB.

**12. How do you handle multi-tenant data isolation in the vector database?**
*Answer:* Every embedding row has `user_id` and `workspace_id` columns. We enforce Row Level Security (RLS) policies in Supabase, and our backend queries explicitly filter `WHERE user_id = X AND workspace_id = Y`.

---

## 🕸️ 3. GraphRAG & Knowledge Graphs

**13. What problem does GraphRAG solve that Vector Search doesn't?**
*Answer:* Vector search fails at "Multi-Hop Reasoning" (e.g., "Who is the CEO of the company that acquired the startup mentioned in document A?"). GraphRAG extracts entities (Nodes) and relationships (Edges) from documents. When queried, we retrieve the sub-graph, allowing the LLM to traverse explicit relationships that might be physically far apart in the text.

**14. How do you extract the knowledge graph from raw text?**
*Answer:* During ingestion, we run a background thread that passes the text to Mistral Large using Strict JSON Mode. The prompt instructs the LLM to act as a Named Entity Recognition (NER) system, returning a JSON array of nodes (Person, Org, Concept) and edges (works_for, related_to). 

**15. How do you query the graph during a chat?**
*Answer:* When a user asks a question, we first ask the LLM to extract the entities from their query. We then do a SQL `ILIKE` search against the `nodes` table, grab all connected `edges`, format them as a Markdown table, and inject that directly into the LLM's context window alongside the vector search results.

**16. How do you handle entity resolution (e.g., "Apple" vs "Apple Inc.")?**
*Answer:* Currently, we rely on semantic clustering in the vector space, but for the graph, we normalize node names to lowercase and use fuzzy matching. A future enhancement is using LLM-based entity deduplication during the ingestion phase.

**17. What libraries do you use to visualize the graph in the UI?**
*Answer:* We use Cytoscape.js in the React frontend. It uses a force-directed physics layout engine (fcose) to beautifully render the nodes and edges we fetch from the `/graph/session/{id}` endpoint.

---

## 🛡️ 4. Ingestion Resilience & Anti-DPI

**18. YouTube blocks scraping heavily. How are you getting transcripts so reliably?**
*Answer:* YouTube uses Deep Packet Inspection (DPI) and TLS fingerprinting to block bots, often dropping connections silently (`UNEXPECTED_EOF`). We engineered a 4-Tier Fallback: 
1. `pytubefix` with an unverified SSL context and strict 15s socket timeout to bypass silent packet drops.
2. The undocumented `youtube-transcript-api`.
3. The raw YouTube InnerTube API.
4. Spawning a headless `yt-dlp` subprocess. 

**19. What if YouTube completely blocks your server IP?**
*Answer:* We are currently exploring moving the initial fetch logic directly into the Chrome Extension. Because the extension has `<all_urls>` permissions, it can make requests from the user's home IP address (which has high reputation) and bypass datacenter IP blocks entirely.

**20. How do you handle sites that require Javascript to render content?**
*Answer:* Instead of relying solely on `BeautifulSoup` (which only parses static HTML), we integrated the Firecrawl API. Firecrawl uses headless browsers to render JS, scroll down to trigger lazy-loading, and extracts clean Markdown free of boilerplate.

**21. How do you strip out junk data (navbars, footers) from web scrapes?**
*Answer:* We use a heuristic Markdown cleaner. It strips out lines with excessive links (nav menus), removes copyright boilerplate using regex, and deletes unhelpful image filename dumps. This drastically improves the signal-to-noise ratio of our vector embeddings.

**22. How do you handle GitHub repo ingestion?**
*Answer:* We use `git clone` to an ephemeral `/tmp/` directory, traverse the file tree ignoring binary files and `.gitignore` matches, read the code into memory, chunk it by functions/classes where possible, embed it, and then instantly delete the temp directory to prevent disk bloat.

---

## 🤖 5. Multi-Agent System & Browser Agent

**23. How does your Multi-Agent Browser mode work?**
*Answer:* We built an orchestrator that chains specialized LLM prompts. 
1. **QueryAnalyzer** (Mistral Small) converts the user's prompt into 2-3 search queries.
2. **SearchAgent** hits the web via Firecrawl.
3. **RankerAgent** analyzes the SERP results and picks the top 3 links.
4. **ScraperAgent** downloads the full text.
5. **SlicerAgent** extracts the most relevant 6000 characters.
6. **Synthesis** (Mistral Large) generates the final cited response.

**24. Why use multiple small agents instead of one big prompt?**
*Answer:* One massive prompt dilutes the LLM's attention (the "Lost in the Middle" problem). By chaining smaller agents, each LLM call has a single, highly-focused responsibility (e.g., "Just rank these URLs"). It's more reliable, easier to debug, and allows us to use faster/cheaper models (Mistral Small) for intermediate routing steps.

**25. How do you manage the context window across multiple agents?**
*Answer:* We strictly budget tokens. If the scraper returns 50,000 characters, we pass it to the SlicerAgent whose sole job is to return the best 6,000 characters. We ensure the final Synthesis prompt never exceeds 8,000 characters to prevent hallucination and API errors.

**26. How does the agent know whether to search the web or check local memory?**
*Answer:* It's a deterministic RAG-First routing rule. The orchestrator checks the Vector DB first. If it finds highly relevant context (>4000 chars of good matches), it skips the web search entirely to save time and API costs.

---

## 👁️ 6. Multimodal & Vision

**27. How does SnapMind analyze images on the screen?**
*Answer:* We use the Chrome Extension's `chrome.tabs.captureVisibleTab` API to take a screenshot. We crop it to the user's viewport, encode it as Base64, and send it to our backend. We then pass it to Groq's blazing-fast Llama 3/4 Vision model to perform Visual Q&A or OCR extraction.

**28. Why Groq for vision instead of Gemini 2.0?**
*Answer:* Groq uses Language Processing Units (LPUs) rather than GPUs, resulting in insanely fast inference times (often >800 tokens per second). For tasks like rapid OCR or UI analysis, Groq provides near-instantaneous feedback compared to traditional API providers.

**29. Can the agent understand diagrams?**
*Answer:* Yes. We specifically prompt the vision model to identify flowcharts, nodes, and text within shapes. It translates the visual diagram into structured text that is then fed into the RAG pipeline.

---

## 🌍 7. Translation & i18n

**30. How do you handle non-English queries in a vector database embedded in English?**
*Answer:* We implemented an aggressive translation pipeline. When a query arrives, we use a regex heuristic to check for non-ASCII characters. If detected, we use the Lingo.dev API to translate the query to English *before* embedding it. This allows a user to query an English PDF using Japanese, and we translate the final answer back to Japanese.

**31. What happens if the translation API goes down?**
*Answer:* We built a fallback mechanism. If Lingo.dev times out or throws a 500 error, we automatically fail over to Mistral in JSON mode, passing a prompt instructing it to translate the string. 

**32. How do you prevent translating things that shouldn't be translated (like code)?**
*Answer:* Our translation prompts specifically instruct the LLM to leave code blocks, API keys, names, and technical terminology in their original language.

---

## 📓 8. Research Notebooks & Memory

**33. What is the "Research Notebook" feature?**
*Answer:* It's a personalized knowledge silo. When a user highlights text on any website and clicks "Bookmark", we don't just save the text—we embed it into a vector space (`halfvec(3072)`). When the user chats, we perform hybrid search across their bookmarks, allowing the LLM to synthesize isolated facts the user saved over weeks of research.

**34. How is chat memory handled?**
*Answer:* Conversations are not just stored sequentially; they are embedded. Every chat message in the `chat_sessions` table gets a vector embedding. This means the system can recall something you said 3 weeks ago without needing to pass the entire 3-week chat history into the LLM context window.

**35. How do you generate the Academic Reports?**
*Answer:* The `POST /browser/generate_report` endpoint pulls all documents and bookmarks associated with the session. We use Mistral Large to synthesize a structured 8-part academic paper (Abstract, Lit Review, Methodology, etc.). We then use the `python-docx` library to programmatically generate a fully formatted `.docx` file for download.

---

## 💻 9. Chrome Extension & Frontend

**36. How do you highlight text on the live webpage?**
*Answer:* Our Content Script uses the `window.find()` API or DOM TreeWalker to locate the exact text string returned by the LLM. We then wrap that text node in a `<mark>` tag with inline CSS to highlight it.

**37. How do citations work in the UI?**
*Answer:* The backend injects tags like `[db-block-1]` into the LLM output. The React frontend uses a custom Markdown renderer (via `react-markdown` plugins) to intercept those tags and render them as interactive, clickable Glassmorphism bubbles.

**38. What happens when a user clicks a citation?**
*Answer:* We use Chrome's Text Fragment API (`#:~:text=`). When a citation is clicked, we update the active tab's URL to include the text fragment, and Chrome natively scrolls the user to that exact sentence and highlights it in yellow.

**39. How are you doing real-time streaming in the sidepanel?**
*Answer:* We use NDJSON (Newline Delimited JSON) over standard HTTP chunked transfer encoding. The backend `yields` JSON strings, and the frontend uses the native `fetch` API with `response.body.getReader()` to decode the stream chunk-by-chunk, appending it to the React state.

**40. Why did you use React 19 and Vite?**
*Answer:* Vite provides instant HMR (Hot Module Replacement) which is crucial for Chrome Extension development. React 19 brings concurrent rendering improvements that keep the chat UI buttery smooth even while parsing thousands of incoming markdown tokens per second.

---

## 🚀 10. Scalability, Security & Deployment

**41. How would you scale this to 10,000 users?**
*Answer:* 
1. Move the Vector DB to a dedicated Milvus/Pinecone cluster or a scaled Supabase instance.
2. Put FastAPI behind a load balancer (NGINX/AWS ALB) running multiple Uvicorn worker processes.
3. Move background ingestion tasks (like GitHub cloning or Firecrawl scraping) to a dedicated Celery/Redis worker queue rather than FastAPI `BackgroundTasks`.

**42. How are API keys secured?**
*Answer:* We use a "Bring Your Own Key" (BYOK) model. The user enters their API keys in the extension settings. The extension stores them locally using `chrome.storage.local`. They are passed to the backend strictly via secure HTTP headers (e.g., `x-gemini-key`). The backend *never* saves the keys to the database.

**43. What optimizations did you make to the Vector DB to save costs?**
*Answer:* We use `halfvec` (16-bit floating point) instead of standard `vector` (32-bit). Since modern embeddings like Gemini 001 use 3072 dimensions, storing them as 16-bit literally halves our RAM and disk requirements with zero perceptible loss in semantic retrieval accuracy.

**44. How do you prevent prompt injection?**
*Answer:* We sanitize all user inputs and heavily template our system prompts. The context from web scraping is strictly isolated inside XML-style tags (`<context> ... </context>`) within the prompt, teaching the LLM to treat it as passive data rather than executable instructions.

**45. Why did you choose Mistral over OpenAI?**
*Answer:* We designed SnapMind to be capable of running fully locally (Airgapped). Mistral offers incredible open-weight models that can be run on Ollama. While we currently use APIs for speed, the architecture is entirely decoupled so swapping the API for a local `localhost:11434` Ollama endpoint takes one line of code.

---

## 🎯 11. Product & UX Challenges

**46. What was the hardest bug you had to fix?**
*Answer:* Exhaustion of the FastAPI thread pool! When GraphRAG entity extraction was running, the whole server would freeze and NGINX/Cloudflare would return a `524 Timeout`. We had to explicitly implement `concurrent.futures.ThreadPoolExecutor` and route synchronous LLM calls there so the main `asyncio` loop remained unblocked.

**47. How did you make the bot not sound like a generic AI?**
*Answer:* We implemented Persona Routing. The user can select "Scholar", "Coder", or "Analyst". We modify the system prompt dynamically. For "Scholar", we enforce a strict rule: *Refuse to answer if the answer is not explicitly in the context.* This severely curtails hallucinations.

**48. Why generate Mermaid diagrams?**
*Answer:* We noticed users asking "how does X work" based on codebases. Text answers are boring. By prompting the LLM to output valid Mermaid.js syntax, our React frontend intercepts the code block and renders a live flowchart. It creates a massive "Wow" factor for understanding complex architectures.

**49. How do you handle PDF parsing?**
*Answer:* Standard PDF parsers strip out page numbers, making citations useless. We customized our parser using `PyPDF2` to inject `[SNAPMIND_PAGE_X]` markers at the start of every page. When the LLM cites the chunk, we parse that marker and generate a citation link that appends `#page=X` to the URL, opening the PDF exactly where the fact lives.

**50. What is the next major feature on your roadmap?**
*Answer:* We want to move the heavy scraping/fetching logic directly into the Chrome Extension. By letting the client browser fetch YouTube transcripts or web HTML natively, we completely bypass server-side IP blocks, Cloudflare captchas, and rate-limiting, making the tool essentially unstoppable.
