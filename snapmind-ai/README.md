<p align="center">
  <img src="https://img.shields.io/npm/v/snapmind-ai?style=flat-square&color=00bcd4" alt="npm version" />
  <img src="https://img.shields.io/npm/l/snapmind-ai?style=flat-square" alt="license" />
  <img src="https://img.shields.io/node/v/snapmind-ai?style=flat-square&color=43853d" alt="node" />
  <img src="https://img.shields.io/badge/LLM-Local%20%7C%20Cloud-blueviolet?style=flat-square" alt="llm" />
</p>

# SnapMind AI CLI

> **Production-grade, persona-based AI workflows — directly in your terminal.**

SnapMind AI is a local-first Command Line Interface that provides specialized **Intelligence Architectures** (personas) for researchers, developers, data analysts, and writers. It combines persistent vector storage (LanceDB), streaming AI responses, session memory, and a complexity-based model router into a single `npm` package.

---

## Highlights

| Feature | Description |
|---|---|
| **4 Personas** | Scholar, Coder, Analyst, Writer — each with tailored tools and system prompts |
| **Hybrid RAG** | Vector similarity + Full-Text Search (FTS) via LanceDB for precision retrieval |
| **Local-First** | 100% offline with Ollama; seamless cloud fallback to OpenAI, Mistral, Anthropic, Gemini |
| **Secure Vault** | API keys stored in your OS-native keychain (via `keytar`) |
| **Session Memory** | Persistent sessions with named snapshots for branching research paths |
| **Multi-Agent Handoff** | Switch between personas mid-session while preserving full conversation context |
| **Auto-Routing** | Semantic intent detection to automatically select the best persona for your query |
| **Re-ranking** | 2-stage retrieval with LLM-based relevance scoring for high-precision context |
| **Global Search** | Query across all indexed datasets from any persona |
| **Theme Engine** | Cyberpunk, Matrix, and Default terminal color schemes |

---

## Installation

```bash
npm install -g snapmind-ai
```

**Prerequisites:**
- **Node.js** >= 18.x
- **(Optional)** [Ollama](https://ollama.com) installed and running for local-first mode
- **(Optional)** API keys for cloud providers (OpenAI, Mistral, Anthropic, Gemini)

---

## Quick Start

```bash
# Launch interactive mode
snapmind-ai

# Direct persona launch
snapmind-ai --persona scholar --mount ./research-papers

# Clone and analyze a GitHub repo
snapmind-ai --persona coder --repo https://github.com/user/repo.git

# Auto-route: let the AI pick the best persona
snapmind-ai "Summarize the key findings from my PDFs"
```

---

## Personas

### Scholar
*Deep research, semantic PDF indexing, and academic citation.*

| Command | Description |
|---|---|
| `/cite` | Generate inline citations from indexed documents |
| `/bibtex` | Export a full BibTeX bibliography from your session |
| `/global <query>` | Search across ALL indexed datasets (Relational RAG) |
| `/snapshot <name>` | Save a named checkpoint of your session state |
| `/handoff` | Transfer context to another persona |
| `/export` | Save session history to a Markdown file |
| `/stats` | View token usage and system health |
| `exit` | Return to main menu |

```bash
snapmind-ai --persona scholar --mount <dir>     # Mount a folder of PDFs
snapmind-ai --persona scholar --pages <range>   # Index specific pages (e.g., 1-10)
```

---

### Coder
*Elite software architecture companion with AST-aware indexing.*

| Command | Description |
|---|---|
| `/diagram` | Generate a Mermaid.js architecture diagram of the codebase |
| `/skill <script>` | Execute an npm script (e.g., `/skill test`, `/skill lint`) |
| `/global <query>` | Cross-repo Relational RAG search |
| `/snapshot <name>` | Save named session checkpoint |
| `/handoff` | Transfer context to another persona |
| `/export` | Save session to Markdown |
| `/stats` | View token usage |
| `exit` | Return to main menu |

```bash
snapmind-ai --persona coder --repo <url>        # Clone and index a GitHub repo
snapmind-ai --persona coder --mount <dir>       # Mount a local project
snapmind-ai --persona coder --watch             # Live-sync index on file changes
```

**Tech-Stack Intelligence:** Automatically detects `package.json`, `requirements.txt`, `go.mod`, and `Cargo.toml` to inject framework-specific system prompts.

---

### Analyst
*High-fidelity data querying, trend analysis, and visualization.*

| Command | Description |
|---|---|
| `/chart` | Render an ASCII line chart from numerical trends |
| `/table` | Format data snippets into a clean Markdown table |
| `/global <query>` | Cross-dataset Relational RAG search |
| `/snapshot <name>` | Save named session checkpoint |
| `/handoff` | Transfer context to another persona |
| `/stats` | View token usage |
| `exit` | Return to main menu |

```bash
snapmind-ai --persona analyst --mount <dir>     # Mount a folder of CSV files
```

---

### Writer
*Web-to-draft synthesis with tone control and collaborative memory.*

| Command | Description |
|---|---|
| `/import` | Import context from another persona's indexed data |
| `/global <query>` | Cross-dataset Relational RAG search |
| `/snapshot <name>` | Save named session checkpoint |
| `/handoff` | Transfer context to another persona |
| `/export` | Save synthesized drafts to Markdown |
| `/stats` | View token usage |
| `exit` | Return to main menu |

**Tone Options:** `Professional` · `Creative` · `Technical` · `Academic` · `Concise`

---

## CLI Reference

### Commands

| Command | Description |
|---|---|
| `snapmind-ai` | Launch interactive persona selector |
| `snapmind-ai config` | Open the configuration wizard |
| `snapmind-ai config set <key> <value>` | Set a config value directly |
| `snapmind-ai search <query>` | Global search across all indexed datasets |
| `snapmind-ai maintenance` | Clean up orphan sessions and stale caches |
| `snapmind-ai vault set <provider>` | Securely store an API key in the OS Keychain |
| `snapmind-ai vault delete <provider>` | Remove an API key from the Keychain |

### Flags

| Flag | Description |
|---|---|
| `--airgap` | Force 100% offline mode (requires Ollama) |
| `--persona <name>` | Launch directly into a persona (`scholar`, `coder`, `analyst`, `writer`) |
| `--mount <path>` | Mount a local directory for indexing |
| `--repo <url>` | Clone and index a GitHub repository |
| `--watch` | Auto-sync the vector index on file changes |
| `--pages <range>` | Index specific PDF page ranges (Scholar only) |

---

## Configuration

```bash
snapmind-ai config
```

Interactive wizard to configure:
- **Default AI Provider** — `ollama`, `openai`, `mistral`, `anthropic`, `gemini`
- **API Keys** — Stored securely in your OS Keychain
- **Temperature** — Control response creativity (0.0 – 1.0)

### Supported Providers

| Provider | Models | Local |
|---|---|---|
| Ollama | Llama 3, Mistral, etc. | Yes |
| OpenAI | GPT-4o, GPT-4o-mini (auto-routed) | No |
| Mistral | Mistral Large | No |
| Anthropic | Claude 3.5 Sonnet | No |
| Gemini | Gemini 1.5 Pro | No |

---

## Project Structure

```
snapmind-ai/
├── src/
│   ├── index.js              # CLI entry point (Commander.js)
│   ├── cli/
│   │   └── menu.js           # Interactive persona selector & handoff loop
│   ├── personas/
│   │   ├── scholar.js        # PDF indexing, /cite, /bibtex
│   │   ├── coder.js          # AST parsing, /diagram, /skill
│   │   ├── analyst.js        # CSV querying, /chart, /table
│   │   └── writer.js         # Web scraping, tone control, /import
│   └── utils/
│       ├── llm.js            # Unified LLM + Embeddings factory
│       ├── lance_store.js    # LanceDB wrapper (Hybrid Search, Re-ranking)
│       ├── vector_storage.js # Namespace manager, Global Search
│       ├── credentials.js    # OS Keychain integration (keytar)
│       ├── session.js        # Persistent session & snapshot manager
│       ├── streamer.js       # Real-time token streaming to terminal
│       ├── router.js         # Complexity-based model routing
│       ├── monitor.js        # Token usage tracking & health dashboard
│       ├── ast_parser.js     # JS/TS AST code block extractor
│       ├── charts.js         # ASCII chart rendering (asciichart)
│       ├── themes.js         # CLI theme engine
│       ├── watcher.js        # File system change watcher (chokidar)
│       ├── exporter.js       # Session-to-Markdown export
│       ├── errors.js         # Centralized error handling
│       ├── config.js         # Persistent config store (conf)
│       └── constants.js      # NLP tuning parameters per persona
├── package.json
└── README.md
```

### Data Storage

All persistent data is stored locally in `.snapmind_cache/`:

```
.snapmind_cache/
├── lancedb/           # Vector tables (one per namespace)
└── sessions/          # Conversation history & snapshots
```

---

## Development

```bash
# Clone the repository
git clone https://github.com/roshankumar0036singh/SnapMind.git
cd snapmind-ai

# Install dependencies
npm install

# Link for local development
npm link

# Run locally
snapmind-ai
```

### NLP Tuning

Each persona has configurable retrieval parameters in `src/utils/constants.js`:

| Persona | Chunk Size | Chunk Overlap | Similarity K |
|---|---|---|---|
| Scholar | 1000 | 200 | 5 |
| Coder | 2000 | 200 | 4 |
| Analyst | 1000 | 100 | 5 |
| Writer | 1500 | 200 | 6 |

---

## Security

- **API Keys** are never stored in plaintext. All credentials use the OS-native keychain via `keytar`.
- **Airgap Mode** (`--airgap`) ensures zero network traffic — all processing stays on your machine.
- **No telemetry.** SnapMind does not phone home or collect usage data.

---

## License

ISC © 2026
