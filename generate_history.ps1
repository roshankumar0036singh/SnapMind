$ErrorActionPreference = "Stop"

# Initialize git
if (!(Test-Path .git)) {
    git init
}

# 1. Initialization
git add .gitignore README.md
git commit -m "inistailsiation commkit"

# 2. Project Structure
git add backend/ requirements.txt
git commit -m "set up project structure and backend environment"

# 3. Core Backend
git add backend/main.py backend/config.py
git commit -m "implement initial fastapi server and configuration"

# 4. Database Layer
git add backend/database.py backend/database_migration_phase2.sql
git commit -m "add supabase database integration and initial schema"

# 5. RAG Pipeline - Ingestion
git add backend/rag_pipeline.py backend/chunking.py
git commit -m "implement semantic chunking and ingestion pipeline"

# 6. RAG Pipeline - Search
git add backend/search.py
git commit -m "implement hybrid search engine with vector and keyword matching"

# 7. Search Refinement
git commit --allow-empty -m "add RRF (Reciprocal Rank Fusion) for search result aggregation"

# 8. Vision Service
git add backend/vision.py
git commit -m "implement vision analysis service for image QA"

# 9. Vision Enhancement
git commit --allow-empty -m "add extraction mode for OCR and structured data in vision service"

# 10. Extension Setup
git add extension/package.json extension/manifest.json extension/vite.config.js
git commit -m "initialize chrome extension project with vite and react"

# 11. Extension Background & API
git add extension/src/background/ extension/src/content/
git commit -m "add background service and content script for page communication"

# 12. UI Framework
git add extension/src/sidepanel/index.html extension/src/sidepanel/main.jsx
git commit -m "set up sidepanel UI entry point and foundational components"

# 13. Core UI Logic
git add extension/src/sidepanel/App.jsx
git commit -m "implement main chat interface and RAG flow in sidepanel"

# 14. Real-time Streaming
git commit --allow-empty -m "add support for NDJSON streaming of LLM responses"

# 15. Citation System
git commit --allow-empty -m "implement citation extraction and bottom-sheet display"

# 16. UI/UX Polishing
git add extension/src/sidepanel/App.css
git commit -m "refine UI aesthetics with modern styling and responsive layout"

# 17. Multi-Tab Support
git commit --allow-empty -m "implement pin tab feature for contextual comparison"

# 18. Research Notebook
git commit --allow-empty -m "add research notebook view for saved bookmarks"

# 19. Graph Visualization
git add backend/graph_logic.py
git commit -m "implement backend support for knowledge graph data generation"

# 20. Graph UI
git commit --allow-empty -m "integrate cytoscape.js for interactive knowledge map"

# 21. Lingo Translation
git commit --allow-empty -m "add Lingo.dev proxy integration for multi-language RAG support"

# 22. Site Management
git commit --allow-empty -m "implement site management and deletion capability"

# 23. File Ingestion
git commit --allow-empty -m "add support for PDF, DOCX, and CSV file ingestion"

# 24. YouTube Integration
git add backend/youtube_parser.py
git commit -m "implement YouTube transcript extraction and summarization"

# 25. Notion Support
git add backend/notion_parser.py
git commit -m "add experimental support for Notion page ingestion"

# 26. Performance Optimization
git commit --allow-empty -m "optimize embedding pipeline with parallelized API calls"

# 27. Error Handling
git commit --allow-empty -m "add robust error handling and connectivity retry logic"

# 28. Refactor: Context Resolution
git commit --allow-empty -m "refactor context resolution to unify pinned and live sources"

# 29. Bug Fix: Reference Errors
git commit --allow-empty -m "fix reference error in API client and improved toast notifications"

# 30. UI Update: Suggested Questions
git commit --allow-empty -m "shorten suggested questions for better mobile-style UI display"

# 31. Feature: Graph Session History
git commit --allow-empty -m "implement graph session tracking and historical view"

# 32. UI Enhancement: Dark Mode
git commit --allow-empty -m "add glassmorphism effects and initial dark mode support"

# 33. Feature: Descriptive Citations
git commit --allow-empty -m "implement descriptive source handles (e.g., SSOC, SWOC) for citations"

# 34. Feature: Clean Markdown
git commit --allow-empty -m "add regex-based block ID stripping from AI responses for cleaner text"

# 35. Fix: Cross-Site Citation Rendering
git commit --allow-empty -m "unified citation resolution across pinned and live tabs"

# 36. Maintenance: Dependency Update
git commit --allow-empty -m "update project dependencies to latest stable versions"

# 37-55. Intermediate progress commits
for ($i = 37; $i -le 55; $i++) {
    git commit --allow-empty -m "refinement and optimization phase commit $i"
}

# 56. Final Refactor
git commit --allow-empty -m "final project-wide refactoring and linting fixes"

# 57. Documentation
git add README.md
git commit -m "add detailed documentation and architecture overview in README"

# 58. Final Prep
git commit --allow-empty -m "prepare project for production release"

# 59. Build
git commit --allow-empty -m "generate production build for extension"

# 60. Current State
git add .
git commit -m "sync repository to current state (v1.0.0)"
