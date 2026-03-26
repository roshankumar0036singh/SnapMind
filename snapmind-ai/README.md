#  SnapMind AI CLI

> The ultimate local-first AI companion for researchers, developers, and analysts.

SnapMind AI is a production-grade Command Line Interface (CLI) that brings specialized **Intelligence Architectures** directly to your terminal. Whether you're deep in academic research, refactoring complex codebases, or analyzing large data sets, SnapMind provides a tailored persona for every workflow.

---

##  Key Features

- **Local-First (Ollama)**: 100% offline potential. Prioritizes local LLMs via Ollama with cloud fallbacks (OpenAI, Mistral, Anthropic, Gemini).
- **Secure Persistence**: API keys are securely stored in your OS-native keychain.
- **Smart Vector Storage**: Persistent `.snapmind_cache/` ensures instant restarts across sessions.
- **Multi-Persona System**: Specialized prompts and tools for different professional roles.

---

##  Installation

Install globally via NPM:

```bash
npm install -g snapmind-ai
```

---

##  Personas (Intelligence Architectures)

###  **Scholar**
*Deep research and semantic PDF indexing.*
- **Features**: Mount entire folders of PDFs, filter by page ranges, and generate BibTeX citations.
- **Command**: `/cite` for automated bibliography.

###  **Coder**
*The elite software architect companion.*
- **Features**: Clone and index GitHub repos, mount local projects, and visualize system architecture.
- **Command**: `/diagram` to generate Mermaid.js architecture maps.

###  **Analyst**
*High-fidelity data relationship mapping.*
- **Features**: Query CSV/Data files, identify trends, and format extracts into clean Markdown tables.
- **Command**: `/table` for automated data summaries.

###  **Writer**
*Web-to-Draft synthesis with tone control.*
- **Features**: Live scraping of multiple URLs, professional tone selection (Professional, Creative, etc.), and outline generation.
- **Command**: `/export` to save your synthesized research logs.

---

##  Configuration

Configure your default provider and API keys through the built-in wizard:

```bash
snapmind-ai config
```

### Supported Providers:
- **Ollama** (Default)
- **OpenAI** (GPT-4o)
- **Mistral** (Mistral Large)
- **Anthropic** (Claude 3.5 Sonnet)
- **Gemini** (1.5 Pro)

---

##  CLI Flags

### 🌐 Global Flags
- `--airgap`: Force the CLI to use local Ollama models only (no cloud fallbacks).

### 🎓 Scholar
- `--mount <dir>`: Mount a local directory containing PDFs recursively.
- `--pages <range>`: (Optional) Index specific page ranges (e.g., `1-10`).

### 💻 Coder
- `--repo <url>`: Clone and index a public GitHub repository.
- `--mount <dir>`: Mount a local project directory for indexing.
- `--watch <dir>`: Automatically sync index when files are added, changed, or removed.

### 📊 Analyst
- `--mount <dir>`: Mount a folder containing CSV data files.

---

##  License
ISC © 2026. Take care of your mind! 🧠✨
