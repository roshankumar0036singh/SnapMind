<p align="center">
  <h1 align="center">SnapMind AI</h1>
  <p align="center">
    <strong>Persona-based RAG CLI for local AI, semantic search, and terminal-native knowledge workflows</strong>
  </p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/snapmind-ai"><img src="https://img.shields.io/npm/v/snapmind-ai?style=flat-square&logo=npm&logoColor=white" alt="npm version"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 18+"></a>
  <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/license-ISC-blue?style=flat-square" alt="License ISC"></a>
  <img src="https://img.shields.io/badge/tests-19%20passing-success?style=flat-square" alt="Tests passing">
  <img src="https://img.shields.io/badge/RAG-LanceDB-6366F1?style=flat-square" alt="LanceDB RAG">
  <img src="https://img.shields.io/badge/LLM-Ollama%20%7C%20OpenAI%20%7C%20Claude%20%7C%20Gemini-111?style=flat-square" alt="Multi-provider LLM">
</p>

<p align="center">
  Chat with PDFs, codebases, spreadsheets, and web research — entirely from your terminal.<br>
  Built-in vector search, hybrid retrieval, offline airgap mode, and a programmable Node.js API.
</p>

---

## Table of Contents

- [Overview](#overview)
- [Why SnapMind AI](#why-snapmind-ai)
- [Key Features](#key-features)
- [Intelligence Personas](#intelligence-personas)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI Command Reference](#cli-command-reference)
- [Persona Workflows](#persona-workflows)
- [Programmatic API](#programmatic-api)
- [Configuration](#configuration)
- [Data Storage & Index Management](#data-storage--index-management)
- [Security](#security)
- [Development](#development)
- [FAQ](#faq)
- [License](#license)

---

## Overview

**SnapMind AI** is an open-source **Retrieval-Augmented Generation (RAG) CLI** that brings **local AI**, **semantic vector search**, and **specialized AI personas** to the command line.

Use it to:

- Index and query **PDF research papers**, **GitHub repositories**, **CSV/Excel/Parquet datasets**, and **local codebases**
- Run **100% offline** with [Ollama](https://ollama.com) in airgap mode
- Switch between **OpenAI**, **Anthropic Claude**, **Google Gemini**, **Mistral**, and local models
- Search indexed knowledge globally with **LanceDB**-powered hybrid retrieval
- Automate recurring intelligence reports with **cron scheduling**
- Embed RAG workflows in your own apps via **`snapmind-ai/api`**

> **Keywords:** `rag cli`, `local ai`, `vector search`, `semantic search`, `lancedb`, `ollama`, `langchain`, `terminal ai`, `pdf chat`, `codebase ai`, `retrieval augmented generation`

---

## Why SnapMind AI

| Capability | SnapMind AI |
|---|---|
| **Local-first RAG** | Vector indexes stored in `~/.snapmind/` — no cloud required |
| **Hybrid search** | Vector similarity + full-text search for sharper retrieval |
| **Persona routing** | Scholar, Coder, Analyst, Writer — or custom personas |
| **Citation grounding** | Scholar refuses answers when sources are insufficient |
| **Headless ingest** | Index files without launching an interactive session |
| **Production-ready CLI** | Vault, scheduling, plugins, maintenance, and TypeScript types |

---

## Key Features

### RAG & Vector Search
- **LanceDB** vector store with incremental indexing and deduplication
- **Global semantic search** across all indexed namespaces
- **Hybrid retrieval** (embeddings + keyword FTS) enabled by default
- **Headless ingest** via `snapmind-ai ingest` for PDF, code, and tabular data

### AI Providers
- **Ollama** — fully offline local inference and embeddings
- **OpenAI**, **Mistral**, **Anthropic**, **Google Gemini** — cloud LLM support
- **Remote backend mode** — connect to a SnapMind FastAPI server
- **Smart model routing** — complexity-based OpenAI model selection

### Terminal-Native Workflows
- **File watchers** — live re-index for code (Coder) and PDFs (Scholar)
- **Git incremental sync** — `/sync` re-indexes only changed repo files
- **Unix pipe support** — `cat logs.txt | snapmind-ai --pipe --persona coder`
- **Session memory** — configurable conversation window for multi-turn chat
- **Scheduled reports** — cron-driven markdown intelligence reports

### Extensibility
- **Custom personas** — author system prompts, file types, and slash commands
- **Plugin catalog** — install bundled or remote plugins (`snapmind-ai plugin`)
- **Programmatic API** — import RAG utilities in Node.js 18+ applications
- **TypeScript definitions** — typed exports via `snapmind-ai/api`

---

## Intelligence Personas

SnapMind AI routes your task to a specialized **Intelligence Architecture** — each persona has tailored ingestion, retrieval, and slash commands.

| Persona | Best For | Supported Sources |
|---|---|---|
| **Scholar** | Academic research, citations, deep synthesis | PDF folders & files |
| **Coder** | Code review, architecture, bug analysis | JS/TS/Python repos, GitHub clones |
| **Analyst** | Trends, charts, structured data Q&A | CSV, Excel (`.xlsx`), Parquet |
| **Writer** | Drafts, outlines, web synthesis | URLs, local `.txt` / `.md` |
| **Custom** | Domain-specific experts you define | Configurable file types |

### Persona Slash Commands (selection)

| Command | Persona | Description |
|---|---|---|
| `/export` | All | Export session to Markdown |
| `/global <query>` | All | Cross-namespace semantic search |
| `/grounding on\|off` | Scholar | Toggle citation grounding |
| `/sync` | Coder | Incremental git re-index |
| `/chart` | Analyst | ASCII trend chart from data |
| `/diagram` | Coder | Generate Mermaid architecture diagram |
| `/collaborate <task>` | All | Multi-agent orchestration pipeline |

Run `/help` inside any session for the full command list.

---

## Installation

### npm (recommended)

```bash
npm install -g snapmind-ai
```

### From source

```bash
git clone https://github.com/your-org/snapmind.git
cd snapmind/snapmind-ai
npm install
npm link
```

### Prerequisites

| Requirement | Notes |
|---|---|
| **Node.js 18+** | Required |
| **Ollama** | Optional — recommended for offline/airgap mode |
| **API keys** | Optional — for OpenAI, Anthropic, Gemini, or Mistral |

```bash
# Verify installation
snapmind-ai --version
snapmind-ai --help
```

---

## Quick Start

### 1. Configure your AI provider

```bash
snapmind-ai config
```

Interactive wizard for provider, API keys (OS keychain), temperature, hybrid search, memory window, and remote backend URL.

### 2. Launch the interactive CLI

```bash
snapmind-ai
```

### 3. Common one-liners

```bash
# Chat with a local codebase
snapmind-ai --persona coder --mount ./my-project --watch ./my-project

# Research PDFs offline
snapmind-ai --airgap --persona scholar --mount ./papers --watch ./papers

# Analyze a spreadsheet
snapmind-ai --persona analyst --mount ./data

# Index without opening a session
snapmind-ai ingest ./my-project --type code

# Search everything you've indexed
snapmind-ai search "authentication middleware"
```

---

## CLI Command Reference

| Command | Description |
|---|---|
| `snapmind-ai` | Interactive persona menu |
| `snapmind-ai config` | Settings wizard & key management |
| `snapmind-ai ingest <path>` | Headless indexing (pdf / code / data) |
| `snapmind-ai search <query>` | Global semantic search |
| `snapmind-ai index list` | List vector namespaces & chunk counts |
| `snapmind-ai index clear <ns>` | Remove a namespace |
| `snapmind-ai schedule add` | Create a cron intelligence report |
| `snapmind-ai schedule run` | Start the report scheduler |
| `snapmind-ai vault set <provider>` | Store API key in OS keychain |
| `snapmind-ai persona create` | Build a custom persona |
| `snapmind-ai plugin list` | Browse plugin catalog |
| `snapmind-ai plugin install <id>` | Install a plugin |
| `snapmind-ai maintenance` | Clean orphan sessions & caches |
| `snapmind-ai help` | Command overview |

### Global flags

| Flag | Description |
|---|---|
| `--persona <name>` | scholar, coder, analyst, writer |
| `--mount <path>` | Index a local directory |
| `--watch <path>` | Live re-index on file changes |
| `--repo <url>` | Clone & index a GitHub repository |
| `--airgap` | Offline-only mode (Ollama required) |
| `--multilingual` | Multilingual embedding models |
| `--pipe` | Read stdin as indexed input |
| `--pages <range>` | PDF page range (e.g. `1-20`) |

---

## Persona Workflows

### Scholar — PDF research with citations

```bash
snapmind-ai --persona scholar --mount ./research --watch ./research
```

- Hybrid vector search over chunked PDF pages
- **Citation grounding** — answers only when retrieval is confident
- `/cite [n]` for full source excerpts
- `/bibtex` to export a bibliography file

### Coder — codebase intelligence

```bash
snapmind-ai --persona coder --repo https://github.com/user/project.git
```

- AST-aware indexing for JavaScript and TypeScript
- `/sync` for incremental git re-index after pulls
- `/diagram` for Mermaid architecture diagrams
- `/skill <npm-script>` to run project scripts in context

### Analyst — tabular data analysis

```bash
snapmind-ai --persona analyst --mount ./datasets
```

Supports **CSV**, **Excel** (`.xlsx`, `.xls`), and **Parquet**.

- `/chart` — ASCII trend visualization
- `/table` — Markdown table extraction
- Live watch mode for updating spreadsheets

### Writer — web & document synthesis

```bash
snapmind-ai --persona writer
```

- Scrape URLs or load local Markdown/text
- Tone selection (Professional, Academic, Technical, …)
- `/import` to merge context from other indexed namespaces

### Scheduled intelligence reports

```bash
snapmind-ai schedule add \
  -q "Summarize project architecture changes" \
  -c "0 9 * * 1" \
  -m ./my-project \
  -p coder

snapmind-ai schedule run
```

Reports are saved to `~/snapmind_reports/` as Markdown.

---

## Programmatic API

Embed SnapMind AI in Node.js applications:

```javascript
import {
  ingestSource,
  retrieveContext,
  getLLM,
  getEmbeddings,
  resolveNamespace,
} from 'snapmind-ai/api';

// Index a directory headlessly
const { namespace, chunks } = await ingestSource('./my-app', { type: 'code' });
console.log(`Indexed ${chunks} chunks → ${namespace}`);

// Retrieve RAG context programmatically
const embeddings = await getEmbeddings();
const results = await retrieveContext('auth middleware', namespace, embeddings, 5);
const llm = await getLLM();
```

TypeScript types are included:

```typescript
import type { IngestResult, ChatMessage } from 'snapmind-ai/api';
```

---

## Configuration

All settings persist in your OS user config store. View them anytime:

```bash
snapmind-ai config list
```

| Key | Default | Description |
|---|---|---|
| `provider` | `ollama` | Default LLM provider |
| `model` | `llama3` | Default model name |
| `temperature` | `0.3` | LLM sampling temperature |
| `mode` | `local` | `local` (LanceDB) or `remote` (FastAPI backend) |
| `backendUrl` | `http://localhost:8000` | Remote backend URL |
| `hybridSearch` | `true` | Vector + keyword hybrid retrieval |
| `memoryWindow` | `20` | Max messages in LLM context |
| `citationGrounding` | `true` | Scholar strict source validation |
| `multilingual` | `false` | Multilingual embedding models |
| `pluginRegistryUrl` | `""` | Optional remote plugin catalog URL |

```bash
snapmind-ai config set hybridSearch false
snapmind-ai config set memoryWindow 30
snapmind-ai config get provider
```

---

## Data Storage & Index Management

All local data is stored under **`~/.snapmind/`**:

| Path | Contents |
|---|---|
| `~/.snapmind/lancedb/` | Vector indexes (LanceDB tables) |
| `~/.snapmind/sessions/` | Conversation history snapshots |
| `~/.snapmind/exports/` | Session Markdown exports |
| `~/.snapmind/personas/` | Custom persona definitions |
| `~/.snapmind/plugins/` | Installed plugins |

```bash
# Inspect indexes
snapmind-ai index list

# Clear a stale namespace
snapmind-ai index clear <namespace>

# System hygiene
snapmind-ai maintenance
```

Legacy `./.snapmind_cache` directories are migrated automatically on first run.

---

## Security

- **API keys** are stored in your **OS native keychain** via `snapmind-ai vault` — never written to plain-text config
- **Airgap mode** (`--airgap`) enforces local-only inference with Ollama
- **Citation grounding** prevents Scholar from hallucinating when sources are missing
- **Non-interactive safety** — background jobs fail fast instead of prompting for keys in CI/headless environments

```bash
snapmind-ai vault set openai
snapmind-ai vault delete openai
snapmind-ai config reset openai
```

---

## Development

```bash
cd snapmind-ai
npm install
npm test          # 19 unit & integration tests
npm link          # symlink CLI globally
```

### Environment variables

| Variable | Purpose |
|---|---|
| `SNAPMIND_CACHE_DIR` | Override `~/.snapmind` (useful for tests) |

### Tech stack

LangChain · LanceDB · Apache Arrow · Ollama · Commander · Chokidar · node-cron · SheetJS · Hyparquet

---

## FAQ

<details>
<summary><strong>Does SnapMind AI work fully offline?</strong></summary>

Yes. Run with <code>--airgap</code> and ensure <a href="https://ollama.com">Ollama</a> is running. Embeddings and chat use local models only.
</details>

<details>
<summary><strong>What vector database does SnapMind AI use?</strong></summary>

<a href="https://lancedb.com">LanceDB</a> — an embedded, local-first vector database. No separate server required.
</details>

<details>
<summary><strong>Can I use SnapMind AI without the interactive CLI?</strong></summary>

Yes. Use <code>snapmind-ai ingest</code> for headless indexing and import from <code>snapmind-ai/api</code> in your Node.js scripts.
</details>

<details>
<summary><strong>Which file formats are supported?</strong></summary>

<ul>
  <li><strong>Scholar:</strong> PDF</li>
  <li><strong>Coder:</strong> .js, .ts, .py, .md, .json</li>
  <li><strong>Analyst:</strong> .csv, .xlsx, .xls, .parquet</li>
  <li><strong>Writer:</strong> URLs, .txt, .md</li>
</ul>
</details>

<details>
<summary><strong>How is this different from ChatGPT or Claude?</strong></summary>

SnapMind AI is a <strong>local RAG terminal tool</strong> — it indexes <em>your</em> documents and codebases, runs semantic search over them, and grounds answers in retrieved sources. It is not a general chatbot replacement; it is a knowledge workflow engine for developers and researchers.
</details>

<details>
<summary><strong>Is there a remote / team mode?</strong></summary>

Set <code>mode</code> to <code>remote</code> and configure <code>backendUrl</code> to connect to a SnapMind FastAPI backend for shared ingestion and search.
</details>

---

## License

Released under the **ISC License**.

---

<p align="center">
  <sub>Built for developers, researchers, and analysts who think in the terminal.</sub>
</p>
