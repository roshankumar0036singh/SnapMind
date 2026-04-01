# SnapMind AI — Comprehensive Slide Outline

*A highly detailed, expanded bullet-point script for the 18-slide presentation. Use this to dive deep into technical specifics during your pitch while keeping slides structured.*

---

## Slide 1: Title Slide
* **Project Title:** SnapMind AI
* **Mission Tagline:** "One RAG Engine. Every Surface. Every Researcher."
* **Competition Track:** Human–AI Collaboration & Open Innovation
* **Event:** AXIS'26 AI Hackathon — VNIT Nagpur
* **Team Name:** [Your Team Name]
* **Team Members:** [Leader Name], [Member 2], [Member 3]

---

## Slide 2: The Problem (Knowledge is Fractured, AI is Forgetful)
### Current AI paradigms fail at persistent, verifiable intelligence.

![Knowledge Fragmentation Infographic](file:///d:/Rag/ppt_assets/Slide2_Problem_Light.png)

* **LLMs are Inherently Stateless:** Standard chatbots (ChatGPT, Perplexity, Gemini) forget all context the moment a session ends, preventing true, long-term research.
* **Knowledge is Deeply Fragmented:** Modern research spans dozens of browser tabs, downloaded PDFs, local code repositories, YouTube videos, and Tweets, with zero unified searchability.
  * *Example Scenario:* A designer references a PDF on Monday, a YouTube video on Tuesday, and scattered browser tabs on Wednesday. When they try to synthesize this research on Thursday, a standard AI has completely forgotten everything they looked at.
* **Lack of Verifiable Provenance:** AI heavily hallucinates; answers generated without explicit, block-level source citations cannot be trusted in academic or enterprise settings.
* **The Multilingual Barrier:** Over 60% of the world's web content is non-English, completely isolating researchers who rely on single-language semantic models.
* **Dev Workflow Redundancy:** Engineers constantly rebuild custom RAG pipelines from scratch for every new project (CLI, Web, App), creating massive technical debt.

---

## Slide 3: Our Solution: The RAG Ecosystem
### The First Operating System for Web Scale Research

*[Image Note: Place the Light-Themed Ecosystem Hub Infographic here]*

* **The Master Thesis:** We stopped building isolated AI tools and built a *knowledge infrastructure layer* for the next generation of human and agent collaboration.
* **Unified Central Intelligence:** A single, persistent vector database acting as your "second brain," providing one single source of truth.
* **Six Interconnected Surfaces:** Complete feature parity across Browser, Desktop App, Terminal, npm Package, MCP Server, and Mobile App.
* **"Index Once, Query Anywhere" Architecture:** Ingest a 500-page PDF via the desktop client on Sunday, and immediately query its contents natively from your shell terminal on Monday.
* **True Format Agnosticism:** The ecosystem doesn't care if the data is a massive dense textbook, a complex GitHub repository, a Twitter thread, or a YouTube transcript—it digests everything identically.
* **BYOK (Bring Your Own Key) Privacy:** Complete ownership of data; users supply their own provider API keys (Gemini, Mistral, Groq) to prevent vendor lock-in and eliminate SaaS subscription traps.
* **Evergreen Memory & Real-time Sync:** The knowledge base expands perpetually. Update a node on your mobile app, and the MCP server reads the new data milliseconds later.
* **Open Architecture Philosophy:** By building native MCP (Model Context Protocol) support from Day 1, we guarantee this ecosystem isn't a walled garden—future AI models will natively integrate with the brain you've spent years building.

---

## Slide 4: System Architecture (End-to-End)
### A Production-Grade API Hub-and-Spoke Model
* **The 6-Spoke Surface Layer:** React 19 UIs, Node CLI (commander.js), and Python MCP Clients communicating via REST and stdio.
* **Central API Hub:** Built on FastAPI, supporting over 20 concurrent endpoints with NDJSON (Newline Delimited JSON) for token-by-token streaming.
* **Micro-Engines:** Specialized daemon threads for GraphRAG (Neo4j/Supabase logic), Browser Agent orchestration, and VLM (Vision-Language Model) processing.
* **Cloud & Local Database:** Supabase PostgreSQL augmented with the `pgvector` extension for 3072-dimensional embedding storage.
* **The LLM Ensemble Network:** Primary generation via Gemini 2.0 / Mistral Large, visual scraping via Groq Llama 4 Scout, and fully native offline fallback to local Ollama endpoints.

---

## Slide 5: Core RAG Pipeline Deep Dive
### Multi-Stage Processing to Eliminate Hallucinations
* **Omnivore Ingestion:** Parsers built for raw URLs, PDFs, DOCX, CSV tables, YouTube transcripts (via `pytubefix`), Twitter threads, and massive GitHub repos.
* **Adaptive Semantic Chunking:** Splits documents by exact structural intent—preserving entire markdown tables and code blocks without mid-sentence severing (20% overlap ratio).
* **Agentic Chunk boundaries:** Optional mode where Mistral Large determines the exact thematic crossover point between text chunks.
* **Hybrid Search Formulation (RRF):** PostgreSQL PL/pgSQL function blending dense vectors (Cosine Similarity, 70% weight) and sparse keywords (BM25, 30% weight) for absolute recall.
* **High-Latency Reranking:** Initial retrieval fetches 20 candidates, pushes them through Cohere's Cross-Encoder (`rerank-english-v3.0`), returning the mathematically exact top 5 matches.
* **Context Optimization Protocol:** Compresses context by executing Jaccard deduplication (>90% overlap) and stripping navigational boilerplate before feeding the LLM.

---

## Slide 6: Surface 1 — Browser Extension
### Augmenting the Open Web in Real-Time
* **One-Click Web Indexing:** A background Service Worker silently parses the active DOM and pipes it to the FastAPI vector store instantly.
* **Persistent Sidepanel Architecture:** Powered by Chrome Manifest V3, allowing chat instances to persist without reloading as you switch between arbitrary tabs.
* **Text-Fragment Citations (`#:~:text=`):** Citations are hyperlinked directly to semantic anchor tags—clicking a database citation jumps your screen to the exact highlighted source sentence.
* **Live GraphRAG Visualizer:** Cytoscape.js canvas rendering a live, force-directed map of entities mentioned on the current page.
* **Multimodal Web Vision:** Take partial screenshots from the sidepanel; Groq Vision extracts embedded text and charts directly into your vector index.

---

## Slide 7: Surface 2 — Desktop Application
### A Native, Offline-Capable Research Workstation
* **Standalone Electron Framework:** A heavy-duty, isolated React 19 / Vite workspace packaged via `electron-builder` directly for local machines.
* **Session-State Knowledge Bases:** Groups ingested vectors natively by project folders (e.g., "Thesis", "Client Audit"), preventing cross-contamination of unrelated semantic domains.
* **Drag-and-Drop Batch Ingestion:** Bypasses web limits allowing you to drag 100+ PDFs directly from your desktop into the embedding engine with live queue processing.
* **3D Knowledge Topography:** A dedicated, resizable sidepanel utilizing `react-force-graph-3d` and Three.js to render a manipulatable, cosmic-scale web of how your documents interlink via GraphRAG.
* **Local Vision/OCR Pipeline:** Fully native image querying; Tesseract.js runs entirely locally to read graphics, charts, and scanned PDFs without ever bouncing visual data to the cloud.
* **Split-Pane Source Viewer:** Click any inline citation `[doc-node/uuid]` and the right panel instantly loads the original PDF or scraped website exactly on the highlighted paragraph.
* **Academic Report Generator:** Bypasses the typical "chat" UI paradigm to synthesize entire complex dossiers into beautifully formatted, localized DOCX files.
* **Zero-Trust Offline Mode ("Airgap Mode"):** Explicitly cuts web access—running LangChain orchestration entirely against a local Ollama instance (llama3/mistral) targeting local LanceDB vector stores to guarantee absolute corporate data privacy.
* **Deep System Integration:** Registers custom URL handlers (`snapmind://ingest`) and system tray APIs for rapid, ubiquitous access across your operating system.

---

## Slide 8: Surface 3 — CLI Tool & npm Package 
### Headless Terminal Intelligence (`snapmind-ai`)
* **Instant Deployment:** `npm install -g snapmind-ai` gives any machine a localized RAG agent in seconds.
* **4 Pre-Prompted Workflow Personas:**
  * `Scholar`: Tailored instructions for deep PDF citation and academia.
  * `Coder`: Scans entire local github repos (`--repo`) to architect solutions.
  * `Analyst`: Interprets and visualizes CSV/Tabular structures.
  * `Writer`: Web-sweeper utilizing Firecrawl for aggressive content aggregation.
* **Advanced Pipeline Commands:** `snapmind-ai --pipe` allows developers to pipe raw `cat` or `grep` output straight into the LLM context flow.
* **Scheduled Cron Intelligence:** `snapmind-ai schedule add -c "0 9 * * 1" -q "Scan latest AI papers"` executes headless scheduled ingestion.
* **OS Vault Security Setup:** Uses `keytar` to securely store API keys in the native Windows/macOS credential keychain rather than plaintext config files.

---

## Slide 9: Surface 4 — The MCP Protocol Server
### Engineering RAG for Third-Party AI Agents
* **What is MCP (Model Context Protocol)?** The bleeding-edge standard defining how autonomous AI agents interface with external file systems and localized databases.
* **Exposing the Engine:** We've packaged the entire SnapMind FastAPI backend into a single MCP `stdio` server script.
* **9 Atomic Tools for Agents:** Directly exposes methods like `snapmind_search`, `snapmind_web_research`, and `snapmind_ingest_url` to Claude Desktop and Cursor IDE.
* **3 Standardized Prompt Templates:** Ships with deep workflow queries (`code_review`, `research_topic`) pre-optimized for third-party LLM context windows.
* **Real-world Impact:** You can now open Claude Desktop, ask it a question, and it will autonomously decide to fire a `snapmind_search` tool call into your private RAG database to find the answer.

---

## Slide 10: Surface 5 & 6 — Mobile App & Consumer Web
### Scalable Access and Cross-Platform UX
* **Native Mobile App:** A React Native-based mobile interface allowing researchers to access and query their persistent RAG database on the go.
* **Web Dashboard:** A Vercel/Next-style static frontend allowing pure consumer access to the RAG database anywhere in the world.
* **Context-Aware UI:** Both platforms dynamically read the context of user input/images to offer "Instant Summaries" out of the box.
* **Streaming NDJSON Architecture:** The clients utilize fetch streaming to render text character-by-character, drastically cutting perceived Time-To-First-Token (TTFT) latency.

---

## Slide 11: Ecosystem Cohesion & Synchronization
### Unifying Data Across Divergent Endpoints
* **Single Source of Truth:** Whether scraping a tweet, uploading a Word doc, or piping bash logs, 100% of data pools into standard 3072-dimension Postgres vectors.
* **Shared Authentication Tokens:** Key validation occurs at the hub API layer; you authenticate the extension, and the CLI tool instantly inherits the security permissions.
* **Session Interoperability:** Start a complex conversation session (`UUID-A`) via the extension on Friday, and pull that exact chat history via `snapmind-ai` terminal on Monday.
* **Universal Citation Protocol:** `[db-block-X]` tags are injected uniformly—the Desktop app renders it as a clickable modal, the CLI renders it as an ANSI-colored footnote.
* **Zero Duplication:** By exposing a structured REST API, building the 6th surface (the Mobile App) took 90% less code than building the 1st surface.
* **Real-Time Data Propagation:** Inserting a vector via the CLI tool reflects in the Desktop App's 3D Knowledge Graph natively within ~150 milliseconds.
* **Centralized Telemetry:** A single `monitor.js` background process tracks LLM latency, token usage, and retrieval success rates across all 6 surfaces concurrently.

---

## Slide 12: Precision Technical Innovations
### Graduate-Level Engineering Applied to RAG
* **Multi-Agent Orchestrator:** Instead of one naive search prompt, SnapMind uses 5 sub-agents: *QueryAnalyzer (Expands query) -> SearchAgent (Fetches 5 links) -> RankerAgent (Trims to 3) -> Scraper (Pulls MD) -> Synthesizer (Merges answer).*
* **Mistral GraphRAG:** The ingestion pipeline automatically prompts Mistral Large to extract Node/Edge pairs (e.g. `[OpenAI] -> [Competes With] -> [Anthropic]`) and logs them for Cytoscape map rendering.
* **Pre-Embedding Polyglot Protocol:** An English-Optimized LLM cannot properly embed Hindi text. SnapMind uses Lingo.dev to auto-detect and translate non-English source text *prior* to vectorization, yielding 100% semantic matching across languages.
* **Timeout Resilience:** If Lingo.dev fails, the pipeline automatically pivots to Mistral-JSON mode for translation without breaking the ingestion thread.
* **Intelligent Content Scraping:** Utilizes Firecrawl APIs on dynamic JavaScript-heavy websites to scrape pure Markdown, rather than raw HTML DOM, drastically reducing token bloat.
* **Multi-Level Reranking:** Cohere Cross-Encoder acts as the primary reranker, but the system auto-falls back to a local `ms-marco-MiniLM` model if API connectivity drops.

---

## Slide 13: Live Ecosystem Walkthrough
### A 2-Minute Proof of Concept
* **Step 1: The Browser Injection (30s)** 
  * Open an dense Wikipedia article on quantum mechanics.
  * Click the extension sidepanel and hit "Ingest". See the Live GraphRAG map populate in under 5 seconds.
* **Step 2: The Terminal Validation (30s)**
  * Switch to VSCode/Terminal.
  * Execute `snapmind-ai search "quantum decoherence"`.
  * Show the exact passage retrieved from the CLI with accurate block-level citation arrays highlighting the cross-surface synchronization.
* **Step 3: The Autonomous MCP Agent (60s)**
  * Open Claude Desktop (with SnapMind MCP configured).
  * Prompt: *"Summarize my recent research."*
  * Watch Claude autonomously trigger the local `snapmind_search` tool, pull the Wikipedia embeddings from Supabase, and write out a fully synthesized summary natively inside the Claude UI.

---

## Slide 14: SnapMind vs. Commercial Alternatives (ChatGPT/Perplexity)
### Why Own The Infrastructure?
* **Permanent vs. Ephemeral:** ChatGPT threads die entirely when closed; SnapMind indexes scale infinitely.
* **Universal File Compatibility:** NotebookLM is locked to Docs/PDFs; SnapMind parses live URLs, GitHub repos, and YouTube subtitles natively.
* **Verifiable Evidence:** Commercial tools provide opaque internet links; SnapMind maps citations back to the exact chunk ID and database index, completely solving the hallucination transparency issue.
* **Six Surface Areas:** Perplexity locks you into their browser UI; SnapMind moves with developers into terminals and native desktop workflows.
* **The MCP Advantage:** Commercial tools are walled gardens; SnapMind explicitly allows third-party AI agents total, programmatic access to the user's brain.
* **Cost Predictability:** Commercial Enterprise RAG costs thousands a month; SnapMind operates purely on variable API usage (fractions of a cent per ingestion) or entirely free via offline Ollama mode.

---

## Slide 15: Real-World Use Cases & Impact
### Human-AI Collaboration at Scale
* **Global Academia:** Graduate students can cross-reference 5 different textbooks instantaneously. Non-native speakers can input a query in Hindi and retrieve answers embedded from purely English scientific journals.
* **Software Tooling:** OSS developers can configure the `snapmind-ai` CLI in GitHub Actions to automatically run semantic analysis on giant inherited legacy codebases.
* **Investigative Journalism:** Reporters can aggregate hundreds of disparate news links, interviews, and CSV financial data into a single queryable GraphRAG web.
* **Enterprise Infrastructure:** Fortune 500 companies can hook the SnapMind MCP server directly into their private engineering wikis, giving all internal AI tooling deep semantic context instantly.
* **Legal & Medical Analysis:** Firms handle highly sensitive case documents via the Airgap offline mode, extracting legal precedent without leaking confidential client data to the public cloud.

---

## Slide 16: The Future Roadmap
### The Next Decade of Knowledge Architecture
* **Autonomous Web Crawlers:** Upgrading the browser agent to roam the web 24/7, proactively seeking new information on pinned topics without human prompting.
* **Collaborative GraphRAG:** Multiplayer knowledge bases featuring Team RBAC (Role-Based Access Control) to build shared semantic wikis across organizations.
* **Custom Embedding Finetuning:** Deploying domain-specific vector models (e.g. heavily specialized medical or open-source legal embedding spaces).
* **On-Device Mobile Deployments:** Rebuilding the core API in React Native, targeting Apple CoreML and Android TFLite to process the entire pipeline on a smartphone without API costs.
* **Conversational Voice UI:** Integrating Whisper endpoints for hands-free "Voice-to-Research," creating an ambient intelligence module for the Desktop App.

---

## Slide 17: Team & Architecture Responsibilities
### The Builders
* **[Leader Name]:** RAG Pipeline Architecture, Hybrid Search Algorithms (RRF), FastAPI Backend structure, and Multi-Agent processing models.
* **[Member 2]:** Chrome Extension UI logic, Desktop Electron packaging, 3D Graph Visualization libraries (Cytoscape/ForceGraph), and Tailwind design.
* **[Member 3]:** MCP Protocol integration, Node.js CLI tool development, deployment infrastructure (Docker/HF Spaces), and Database administration.

---

## Slide 18: Closing Statement
### Amplifying Human Capability
* **"SnapMind isn't an AI attempting to replace the researcher."**
* **"It is an open infrastructure layer built to amplify human cognition."**
* **"One Engine. Every Surface. Every Language."**
* **Project Links:** [Demo Video URI] | [GitHub Repository] | [Hosted API Specs]
