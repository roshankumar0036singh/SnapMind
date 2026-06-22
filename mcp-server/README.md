# SnapMind MCP Server

[![smithery badge](https://smithery.ai/badge/snapmind-mcp)](https://smithery.ai/server/snapmind-mcp)

The SnapMind Model Context Protocol (MCP) server exposes the powerful capabilities of the SnapMind RAG backend to any MCP-compatible client (like Cursor, Claude Desktop, or Antigravity).

Version 2.1 brings a massive expansion to **24 tools**, featuring deep reasoning agents, contextual desktop vision, adversarial RAG debates, and cross-lingual web intelligence.

## Installation

### Method 1: Using PyPI (Global Install - Recommended)

The easiest way to use SnapMind with Claude Desktop is via `uvx` or `npx`, which pulls directly from PyPI. Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "snapmind": {
      "command": "uvx",
      "args": [
        "snapmind-mcp"
      ],
      "env": {
        "SNAPMIND_BACKEND_URL": "https://snapmind-gateway.roshankumar30080.workers.dev",
        "SNAPMIND_API_KEY": "snp_your_generated_api_key",
        "GEMINI_API_KEY": "your-gemini-key",
        "FIRECRAWL_API_KEY": "your-firecrawl-key",
        "MISTRAL_API_KEY": "your-mistral-key",
        "LINGODEV_API_KEY": "your-lingodev-key"
      }
    }
  }
}
```

### Method 2: Using Smithery

To install SnapMind for Claude Desktop or other MCP clients via Smithery:

```bash
npx -y @smithery/cli install snapmind-mcp --client claude
```

### Method 3: Manual Local Installation

1. Clone the repository and navigate to the `mcp-server` directory:
```bash
git clone https://github.com/roshankumar0036singh/SnapMind.git
cd SnapMind/mcp-server
```

2. Install dependencies:
```bash
pip install -e .
```

3. Add to your MCP client configuration (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "snapmind": {
      "command": "snapmind-mcp",
      "env": {
        "SNAPMIND_BACKEND_URL": "https://snapmind-gateway.roshankumar30080.workers.dev",
        "SNAPMIND_API_KEY": "snp_your_generated_api_key",
        "GEMINI_API_KEY": "your-gemini-key",
        "FIRECRAWL_API_KEY": "your-firecrawl-key",
        "MISTRAL_API_KEY": "your-mistral-key",
        "LINGODEV_API_KEY": "your-lingodev-key"
      }
    }
  }
}
```

## Features

### 🛠️ 24 Available Tools
* **Agentic Intelligence (New in v2.1)**
  * `snapmind_see_screen` - Takes a secure, silent screenshot of your desktop so Claude can "see" what you are working on.
  * `snapmind_agent_debate` - Spins up two independent agents to debate a controversial topic in memory.
  * `snapmind_cross_lingual_research` - The Babel Fish: Autonomously researches foreign websites and translates findings.
  * `snapmind_person_intelligence` - Generates highly targeted OSINT dossiers for specific people.
  * `snapmind_live_scrape` - Instantly extracts clean markdown from any URL without indexing it.
  * `snapmind_export_session` - Exports full Chat History, Source Documents, and Graph Edges as Markdown or CSV.
* **Search & Chat**
  * `snapmind_search` - Semantic search across documents, bookmarks, and history.
  * `snapmind_chat` - Chat with your knowledge base using optional personas.
* **Knowledge Management**
  * `snapmind_create_bookmark` / `list_bookmarks` / `delete_bookmark` - Manage saved snippets.
  * `snapmind_knowledge_graph` - Extract relations and nodes from your data.
  * `snapmind_list_sites` / `delete_site` - Manage indexed source websites.
  * `snapmind_export_site` - Export all data for a specific site.
* **Deep Research**
  * `snapmind_web_research` - Multi-agent web research pipeline.
  * `snapmind_deep_research` - Multi-hop reasoning chain across web and local sources.
  * `snapmind_generate_report` - Synthesize sessions into a DOCX report.
* **Ingestion**
  * `snapmind_ingest_url` - Index a website.
  * `snapmind_ingest_file` - Index local documents (PDF, DOCX, CSV).
  * `snapmind_ingest_repo` - Clone and index a GitHub repository.
* **Utilities**
  * `snapmind_translate` - Translate text between languages.
  * `snapmind_analyze_image` - Vision AI (QA/OCR) on local images.
  * `snapmind_list_personas` / `get_analytics` / `health_check`

### 📚 7 Available Resources
* `snapmind://kb/stats` - Live knowledge base statistics
* `snapmind://kb/tags` - All semantic tags
* `snapmind://kb/sites` - List of all indexed source URLs
* `snapmind://graph/full` - The full knowledge graph data (JSON)
* `snapmind://graph/sessions` - List of sessions containing graph data
* `snapmind://sessions/{id}/history` - Chat history for a specific session

### 🗣️ 6 Prompt Templates
* `research_topic`, `code_review`, `summarize_notebook`, `deep_dive`, `compare_sources`, `export_knowledge`

## Development & Testing

```bash
# Run tests
pip install -e ".[dev]"
pytest tests/ -v
```
