# 🧠 SnapMind: The Autonomous Browser Research Agent

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Gemini_2.0-8E75B2?style=for-the-badge&logo=google-cloud&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![Vector DB](https://img.shields.io/badge/pgvector-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)

**SnapMind** is a production-grade, autonomous RAG (Retrieval-Augmented Generation) ecosystem designed to turn your browser into a context-aware research powerhouse. It doesn't just "chat" with pages—it understands, indexes, and builds a semantic relationship map of your entire knowledge base.

---

## 🏗️ System Architecture

SnapMind is composed of three primary layers, optimized for low-latency retrieval and high-precision generation.

### 1. The Frontier (Chrome Extension)
- **Sidepanel UI**: Built with React and Vite, featuring a glassmorphism design and real-time LLM streaming.
- **Background Service**: Manages the API orchestrator and handles complex multi-step ingestion flows.
- **Content Script**: Performs on-the-fly DOM analysis and content extraction for "Live Chat" features.

### 2. The Intelligence Hub (FastAPI Backend)
- **Streaming RAG**: Uses NDJSON communication for token-by-token response rendering.
- **Semantic Dispatcher**: Routes queries through Hybrid Search, Reranking, and Context Optimization pipelines.
- **Vision Engine**: Specialized multimodal processing for diagrams and data-heavy screenshots.

### 3. The Infrastructure (Supabase & External APIs)
- **Supabase (PostgreSQL + pgvector)**: Handles persistent storage for vector embeddings, relational metadata, and knowledge graph nodes.
- **LLM Ensemble**: Orchestrates **Gemini 2.0 Flash** for high-speed embeddings/vision and **Mistral** for nuanced agentic reasoning.
- **Scraper Service**: Utilizes **Firecrawl** and custom parsers for clean markdown conversion.

---

## 🛠️ Data Model & Infrastructure (Supabase)

SnapMind relies on a complex, highly-indexed database schema within Supabase to ensure millisecond retrieval.

### Core Schema
- **`documents`**: Stores text chunks with `vector(3072)` embeddings and GIN-indexed full-text search.
- **`chat_sessions`**: Persistent storage for conversation history with HNSW indexing for semantic memory retrieval.
- **`ingestion_jobs`**: Background tracking for multi-page crawls and long-running file processing.
- **`bookmarks`**: The "Research Notebook" storage, featuring semantic search over saved highlights.
- **`nodes` / `edges`**: Powering the **GraphRAG** visualization, these tables track relationships discovered across different research sessions.

### 🔍 Hybrid Search Algorithm (The "Secret Sauce")
We use a custom PostgreSQL function `hybrid_search_documents` that implements a weighted fusion of semantic and keyword scores:

```sql
-- Weighted Reciprocal Rank Fusion Logic
((COALESCE(similarity, 0) * 0.7) + (COALESCE(bm25_score, 0) * 0.3 * 10)) AS combined_score
```
*   **Vector (70%)**: Captures intent and conceptual meaning via Cosine Similarity.
*   **Keyword (30%)**: Ensures names, specific IDs, and rare terms are never missed using BM25-like ranking.

---

## 🏎️ Parser Ecosystem

SnapMind supports a wide array of sources through its specialized parsing layer (`backend/*_parser.py`):

| Source Type | Technology | Logic |
| :--- | :--- | :--- |
| **YouTube** | `pytubefix` + `Invidious` | Extracts high-res transcripts, timestamps, and AI-generated video summaries. |
| **PDF/DOCX/CSV** | `python-docx` / `PyPDF2` | Ingests complex local documentation into the cloud vector store. |
| **GitHub** | `git` / `scrapers` | Clones and semantically indexes entire repositories for "Chat with Code" mode. |
| **Notion** | `Notion API` | Experimental support for syncing and searching private workspaces. |
| **Twitter (X)** | `scrapers` | Indexes tweet threads and keeps track of viral conversations. |

---

## 🎨 Advanced UI/UX Features

- **Pin Tab (Multi-Source Comparison)**: Pin two or more tabs (e.g., "API Docs A" vs "API Docs B") and ask "Compare the error handling between these two."
- **Clean Response Rendering**: Our custom markdown engine identifies and strips internal `[bi-block-X]` tags, replacing them with interactive, hoverable citation bubbles.
- **Descriptive Bubbles**: Citations aren't just numbers—they are handles like `[SSOC 1]` or `[HW 3]`, derived from the source page titles.
- **Graph Map**: A real-time Cytoscape.js visualization of how your research is connected conceptually.

---

## 🚀 Deployment Guide

### 1. Database Setup (Supabase)
Run the initialization script in the Supabase SQL Editor:
```bash
# Found in: backend/supabase_setup.sql
# 1. Enable pgvector extension
# 2. Create tables, indexes, and hybrid search functions
```

### 2. Backend Config
Rename `.env.example` to `.env` and provide your keys:
- `DATABASE_URL`: Your Supabase connection string.
- `GOOGLE_API_KEY`: For Gemini embeddings.
- `MISTRAL_API_KEY`: For the reasoning agent.
- `FIRECRAWL_API_KEY`: For advanced web scraping.

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Extension Setup
```bash
cd extension
npm install
npm run build
```
Load the `dist/` folder via Chrome's `Developer mode` in `chrome://extensions`.

---

## 🗺️ Roadmap
- [x] **Relational GraphRAG**: Linking entities across sources. (Completed)
- [x] **Multi-Site Comparison**: Descriptive pin-tab citations. (Completed)
- [ ] **Autonomous Web Agents**: Letting the AI browse the web to find answers for you.
- [ ] **Collaborative Research**: Real-time shared notebooks for teams.

---

## 📄 License & Contributing
Built for research efficiency. Contributions are welcome—please see the `CONTRIBUTING.md` for our coding standards.
