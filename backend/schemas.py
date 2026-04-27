from pydantic import BaseModel, Field
from typing import List, Dict, Any, Union, Optional

class BrowserRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    workspace_id: Optional[str] = None # [NEW]
    output_lang: str = "auto"
    query_notebook: bool = False
    image_data: Optional[str] = None
    visible: bool = False  # [NEW] For Desktop Browser Agent

class IngestRequest(BaseModel):
    url: str
    text_content: Optional[str] = None # [NEW] For Visual/Manual Ingest
    crawl_mode: str = "single"  # "single" or "multi"
    max_pages: int = 50  # For multi-page crawling
    max_depth: int = 3   # For multi-page crawling
    target_lang: str = "auto"  # [NEW] Language for Lingo.dev translation
    session_id: Optional[str] = None # [NEW] Phase 25: Conversation-Scoped Graph
    workspace_id: Optional[str] = None # [NEW]
    stream: bool = False # [NEW] Stream progress via NDJSON

class RepoIngestRequest(BaseModel):
    repo_url: str
    target_lang: str = "auto"
    session_id: Optional[str] = None # [NEW] Phase 25: Conversation-Scoped Graph
    workspace_id: Optional[str] = None # [NEW]

class ChatRequest(BaseModel):
    query: str
    search_query: Optional[str] = None # [NEW] Pre-translated query for searching
    query_lang: Optional[str] = None   # [NEW] Original language of the query
    output_lang: str = "auto"       # [NEW] Forced Output Language (Feature 5)
    context_url: Optional[str] = None
    session_id: Optional[str] = None   # [NEW] Phase 5: Semantic Chat Memory
    workspace_id: Optional[str] = None # [NEW]
    site_id: Optional[str] = None      # [NEW] Phase 3: Context Switching (UUID)
    history: Optional[List[Dict[str, Any]]] = None # [NEW] Conversational History
    page_content: Optional[str] = None  # [NEW] Allow direct text context
    content_blocks: Optional[List[Dict[str, Any]]] = None # [NEW] Structured blocks for citation

class WidgetIngestRequest(BaseModel):
    url: str
    widget_id: str
    workspace_id: Optional[str] = None # [NEW]
    max_pages: int = 50
    max_depth: int = 3
    api_key: Optional[str] = None

class WidgetChatRequest(BaseModel):
    query: str
    widget_id: str
    workspace_id: Optional[str] = None # [NEW]
    session_id: Optional[str] = None # [NEW] Phase 5: Semantic Chat Memory
    page_content: Optional[str] = None  # [NEW] Allow direct text context
    content_blocks: Optional[List[Dict[str, Any]]] = None # [NEW] Structured blocks for citation
    site_id: Optional[str] = None # [NEW] Phase 3: Context Switching (UUID)
    history: Optional[List[Dict[str, Any]]] = None # [NEW] Conversational History
    query_notebook: bool = False # [NEW] Phase 20: Research Notebook Correlation
    persona_id: Optional[str] = None # [NEW] Feature 21: Custom Agent Personas
    api_key: Optional[str] = None

class SuggestRequest(BaseModel):
    page_content: Optional[str] = None
    url: Optional[str] = None
    workspace_id: Optional[str] = None # [NEW]
    site_id: Optional[str] = None

class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "auto"

class BookmarkRequest(BaseModel):
    content: str
    source_url: Optional[str] = None
    workspace_id: Optional[str] = None # [NEW]
    metadata: Optional[Dict[str, Any]] = None

class SavePageRequest(BaseModel):
    url: str
    text: str
    workspace_id: Optional[str] = None # [NEW]
    folder_name: str = "General"

class WatchlistRequest(BaseModel):
    url: str
    workspace_id: Optional[str] = None # [NEW]

class ReverseEngineerRequest(BaseModel):
    html: str
    styles: Dict[str, Any]
    prompt: Optional[str] = "Reverse-engineer this UI element into a clean, modern, and responsive React component using Tailwind CSS."

class ResearchRequest(BaseModel):
    session_id: Optional[str] = None
    workspace_id: Optional[str] = None # [NEW]
    query: str
    output_lang: str = "auto"
    query_notebook: bool = False
    image_data: Optional[str] = None
    visible: bool = False # [NEW] For Desktop Browser Agent
    research_mode: str = "general" # [NEW] Phase 18/19: "general", "scholar", or "legal"

class ReportRequest(BaseModel):
    session_ids: List[str]  # [MOD] Support multiple sessions
    query: str
    workspace_id: Optional[str] = None # [NEW]
    output_lang: str = "auto" # [NEW]
    source_urls: Optional[List[str]] = None # Support selective synthesis

class PersonaRequest(BaseModel):
    name: str
    workspace_id: Optional[str] = None # [NEW]
    system_prompt_addon: str

class GlobalSearchRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None # [NEW]
    limit: int = 20

class AnalyzeImageRequest(BaseModel):
    image_data: str # Base64 string
    prompt: Optional[str] = None
    mode: str = "qa" # [NEW] "qa" or "extraction"
    target_lang: str = "auto" # [NEW] Support for translation
    active_context: Optional[Dict[str, Any]] = None # [NEW] { type: 'url'|'file', id: string, name: string }

class ResearchActionItem(BaseModel):
    action_type: str
    description: str
    status: str = "pending"
    reason: Optional[str] = None

# [SCHEMAS] Enhanced Pydantic model descriptions
