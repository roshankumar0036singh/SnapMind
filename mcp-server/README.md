# SnapMind MCP Server

Model Context Protocol server that exposes the SnapMind RAG backend as tools, resources, and prompt templates for any MCP-compatible AI agent.

## Architecture

```
stdio (JSON-RPC 2.0)                    HTTPS REST
Agent (Antigravity/Cursor/Claude) ←→ mcp-server/server.py ←→ HF Backend (hf.space)
```

**Transport:** stdio — agents launch the server as a subprocess. No ports needed.

## Tools (8)

| Tool | Endpoint | Description |
|---|---|---|
| `snapmind_search` | `POST /search/global` | Semantic search across the entire knowledge base |
| `snapmind_chat` | `POST /chat` | RAG-powered Q&A with persona and session support |
| `snapmind_ingest_url` | `POST /ingest` | Index a website URL |
| `snapmind_ingest_file` | `POST /ingest/file` | Index a local file (PDF, DOCX, CSV, TXT) |
| `snapmind_ingest_repo` | `POST /ingest/github` | Clone and index a GitHub repository |
| `snapmind_web_research` | `POST /browser/research` | Multi-agent web research with synthesis |
| `snapmind_list_personas` | `GET /personas` | List available AI personas |
| `snapmind_get_analytics` | `GET /admin/analytics` | Knowledge base statistics |

## Resources (2)

| URI | Description |
|---|---|
| `snapmind://kb/stats` | Live knowledge base statistics (JSON) |
| `snapmind://kb/tags` | All semantic tags in the knowledge base (JSON) |

## Prompt Templates (3)

| Prompt | Description |
|---|---|
| `research_topic` | Deep investigation combining web research + existing knowledge |
| `code_review` | Review code against indexed documentation and best practices |
| `summarize_notebook` | Summarize saved bookmarks and research notes on a topic |

## Setup

### Prerequisites
- Python 3.10+
- `pip install mcp httpx python-dotenv anyio`

### Install

```bash
cd d:\Rag\mcp-server
pip install -e .
```

### Environment

Copy `.env.example` to `.env` and fill in your keys, or provide them via the MCP client configuration:

```bash
cp .env.example .env
```

## Agent Configuration

### Antigravity / Gemini CLI

Add to your MCP settings:

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

### Claude Desktop

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

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "snapmind": {
      "command": "python",
      "args": ["d:\\Rag\\mcp-server\\server.py"],
      "env": {
        "SNAPMIND_BACKEND_URL": "https://roshan123478-snapmind-backend.hf.space",
        "HF_TOKEN": "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"
      }
    }
  }
}
```

### Continue.dev

Add to `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "python",
          "args": ["d:\\Rag\\mcp-server\\server.py"]
        }
      }
    ]
  }
}
```

## Project Structure

```
mcp-server/
├── server.py              # Entry point — registers all tools, resources, prompts
├── config.py              # Environment-based configuration and auth headers
├── pyproject.toml          # Package definition
├── .env.example            # Template for environment variables
├── test_integration.py     # Integration tests against live backend
├── tools/
│   ├── search.py           # snapmind_search handler
│   ├── chat.py             # snapmind_chat handler
│   ├── ingest.py           # snapmind_ingest_url, _file, _repo handlers
│   ├── research.py         # snapmind_web_research handler
│   └── personas.py         # snapmind_list_personas, _get_analytics handlers
└── resources/
    └── kb.py               # snapmind://kb/stats, snapmind://kb/tags handlers
```

## Testing

### Integration Test

```bash
cd d:\Rag\mcp-server
python test_integration.py
```

Tests connectivity to the backend and verifies search, analytics, and ingestion endpoints.

### Manual Verification

1. Start the backend: `uvicorn main:app --reload` in `d:\Rag\backend\`
2. Add the MCP config to your agent
3. Ask: "Search my SnapMind knowledge base for hybrid search"
4. Agent should call `snapmind_search` and return results
5. Ask: "Index https://docs.anthropic.com into my knowledge base"
6. Agent should call `snapmind_ingest_url` and report success

## License

ISC
