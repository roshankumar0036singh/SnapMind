# 🧠 SnapMind: Browser Intelligence System

SnapMind is a production-grade, autonomous RAG (Retrieval-Augmented Generation) ecosystem designed to turn your browser into a context-aware research powerhouse. It indexes, understands, and builds a semantic relationship map of your research.

---

## 🏗️ Project Architecture

The system consists of two main components:
1.  **Backend (FastAPI)**: Handles heavy lifting like Hybrid Search, Reranking, GraphRAG, and Vision processing.
2.  **Extension (React + Vite)**: Provides the sidepanel UI, citation rendering, and interaction with the browser.

---

## 🚀 Setup Instructions

Follow these steps in order to get the full SnapMind stack running locally.

### Phase 1: Backend Setup (Python)

The database (Supabase) is already pre-configured in the example environment file. You do not need to create a new database unless you want a private instance.

1.  **Navigate** to the `backend/` directory:
    ```bash
    cd backend
    ```
2.  **Create a virtual environment**:
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```
3.  **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
4.  **Configure Environment**: 
    -   Copy `backend/.env.example` to `backend/.env`.
    -   Open `backend/.env` and fill in your API keys in the **REQUIRED - Core Services** section. The Supabase URL and key are already provided.

5.  **Run the Server**:
    ```bash
    uvicorn main:app --reload
    ```
    The backend will be available at `http://localhost:8000`.

---
### Phase 2: Extension Setup (React/Vite)

1.  **Navigate** to the `extension/` directory:
    ```bash
    cd extension
    ```
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Build the extension**:
    ```bash
    npm run build
    ```
4.  **Load into Chrome**:
    - Open Chrome and navigate to `chrome://extensions/`.
    - Enable **Developer mode** (top right).
    - Click **Load unpacked** and select the `extension/dist` folder.
5.  **Connect to Backend**:
    - Open the SnapMind sidepanel.
    - Go to **Settings** and ensure the **Server URL** is set to `http://localhost:8000`.

---

### Image Analysis
SnapMind uses **Groq** for high-speed image analysis. To analyze images or screenshots, ensure your `GROQ_API_KEY` is configured in the backend `.env`.

---

## 🗺️ Key Features
- **Hybrid Search**: Combines BM25 keyword matching with Cosine Similarity vector search.
- **GraphRAG**: Automatically builds a conceptual map of your research sessions.
- **Citations**: Interactive bubbles with descriptive handles derived from page titles.
- **Sidepanel Stream**: Token-by-token response rendering for a seamless AI experience.
