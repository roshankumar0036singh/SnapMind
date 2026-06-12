# SnapMind AI 🧠

**SnapMind AI** is the ultimate local AI companion for students, developers, and analysts. It brings intelligent, persona-based AI workflows and RAG (Retrieval-Augmented Generation) capabilities directly to your terminal. 

Whether you need to chat with your codebase, ingest research PDFs, run scheduled background analytics, or just work offline securely, SnapMind AI has you covered.

---

## 🌟 Key Features

- **🧠 specialized Intelligence Architectures (Personas)**: Auto-routing or manual selection of specialized AI bots:
  - **§ Scholar**: Index PDFs, cite pages, and conduct deep research.
  - **» Coder**: Scan GitHub repos, refactor logic, fix bugs, and generate architecture diagrams.
  - **∑ Analyst**: Query data, find trends, and export CSVs.
  - **¶ Writer**: Scrape the web and synthesize drafts.
- **🔒 100% Airgap Mode**: Run entirely offline (`--airgap`) using local models via [Ollama](https://ollama.com).
- **☁️ Multi-Provider Support**: Easily swap between Ollama, OpenAI, Mistral, Anthropic, or Google Gemini.
- **🔐 Secure Keychain Integration**: Safely store your API keys in your OS's native keychain using `snapmind vault`.
- **📂 Advanced File Ingestion**: Index remote GitHub repos (`--repo`), mount local directories (`--mount`), or automatically watch folders for file changes (`--watch`).
- **⏰ Scheduled RAG Reports**: Use `snapmind schedule` to run periodic AI analyses in the background and output markdown reports.
- **⚡ Pipe Integration**: Send stdin directly to the AI (e.g., `cat log.txt | snapmind-ai --pipe --persona coder`).

---

## 🚀 Installation

Ensure you have Node.js installed, then clone the repository and install dependencies:

```bash
git clone https://github.com/your-username/snapmind-ai.git
cd snapmind-ai
npm install
```

Link the package globally to use the `snapmind-ai` command anywhere:
```bash
npm link
```

*(Optional)* For the full local-first experience, install [Ollama](https://ollama.com) and ensure it's running.

---

## 🛠️ Getting Started

To get started, simply run the interactive CLI wizard:

```bash
snapmind-ai config
```
This will allow you to select your preferred default AI provider (e.g., OpenAI, Mistral, Anthropic) and securely configure your API keys.

Launch the interactive RAG interface in your current directory:
```bash
snapmind-ai
```

### Common Commands

- **Start with a specific persona:**
  ```bash
  snapmind-ai --persona coder
  ```
- **Index and chat with a local folder and watch for changes:**
  ```bash
  snapmind-ai --mount ./my-project --watch ./my-project
  ```
- **Clone and chat with a GitHub repository:**
  ```bash
  snapmind-ai --repo https://github.com/user/project.git
  ```
- **Run in completely offline/Airgap mode:**
  ```bash
  snapmind-ai --airgap --mount ./confidential-docs
  ```

---

## 🧩 Advanced Usage

SnapMind AI comes bundled with powerful utility subcommands.

### Scheduled Intelligence Reports
Schedule a background job that automatically queries an indexed namespace and generates a markdown report.
```bash
# Add a report to run every Monday at 9AM
snapmind-ai schedule add -q "Summarize latest trends in the project" -c "0 9 * * 1" -p coder

# Start the background daemon
snapmind-ai schedule run
```

### Global Neural Search
Query across all indexed namespaces and datasets globally.
```bash
snapmind-ai search "authentication logic"
```

### Secure Vault
Manage your API keys securely inside your OS's encrypted keychain.
```bash
snapmind-ai vault set openai
snapmind-ai vault delete openai
```

### Custom Personas
Create and manage your own custom AI personas with tailored system prompts.
```bash
snapmind-ai persona create
snapmind-ai persona list
```

### Pipeline Integration
Easily chain Unix commands into SnapMind AI.
```bash
tail -n 100 error.log | snapmind-ai --pipe --persona coder
```

---

## ⚙️ Configuration & Maintenance

The system stores vector embeddings, cached repos, and settings globally in `~/.snapmind/`. 

To clean up orphan namespaces and caches, periodically run:
```bash
snapmind-ai maintenance
```

To view or manage your current configuration programmatically:
```bash
snapmind-ai config get provider
snapmind-ai config set temperature 0.7
```

## 📜 License
ISC
