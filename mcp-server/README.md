# SnapMind MCP Server

This server allows AI agents (like Antigravity, Cursor, or Claude Desktop) to interact with your SnapMind RAG knowledge base.

## Features

- **Semantic Search**: Search across your entire library of indexed documents and bookmarks.
- **RAG Chat**: Ask questions cited from your own knowledge base.
- **Auto-Ingestion**: Command an agent to index a new URL on the fly.
- **Library Analytics**: Monitor your knowledge base growth.

## Setup

### 1. Prerequisites
- Python 3.10 or higher
- `pip install mcp httpx python-dotenv`

### 2. Configuration
Copy `.env.example` to `.env` and fill in your API keys if you want to run it manually, or provide them via your MCP client's environment settings.

### 3. Agent Integration

#### Antigravity / Codex
Add this to your MCP settings:
```json
{
  "snapmind": {
    "command": "python",
    "args": ["d:\\Rag\\mcp-server\\server.py"],
    "env": {
      "SNAPMIND_BACKEND_URL": "https://roshan123478-snapmind-backend.hf.space",
      "HF_TOKEN": "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",
      "GEMINI_API_KEY": "YOUR_KEY",
      "MISTRAL_API_KEY": "YOUR_KEY"
    }
  }
}
```

#### Claude Desktop
Add to `%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "snapmind": {
      "command": "python",
      "args": ["d:\\Rag\\mcp-server\\server.py"],
      "env": {
        "SNAPMIND_BACKEND_URL": "https://roshan123478-snapmind-backend.hf.space",
        "HF_TOKEN": "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",
        "GEMINI_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

## Tools Provided

- `search(query, limit)`: Global semantic search.
- `chat(query, [site_id], [session_id])`: Contextual Q&A.
- `ingest_url(url, [crawl_mode])`: Index a new website.
- `get_analytics()`: Show library stats.
