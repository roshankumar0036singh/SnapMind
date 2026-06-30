import time
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class SearchRequestDTO(BaseModel):
    """Standardized search query request"""
    query: str
    session_id: Optional[str] = None
    tenant_id: Optional[str] = "default"
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    limit: int = 5
    filters: Dict[str, Any] = Field(default_factory=dict)

class IngestRequestDTO(BaseModel):
    """Standardized ingestion request for URLs or Text"""
    url: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None
    session_id: Optional[str] = None
    tenant_id: Optional[str] = "default"
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    stream: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

class JobStatusDTO(BaseModel):
    """Real-time job tracking status"""
    session_id: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    message: str
    progress: int = 0
    timestamp: float = Field(default_factory=time.time)

class SearchResultDTO(BaseModel):
    """Data Transfer Object for individual search search results"""
    id: str
    url: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    similarity: float = 0.0
    bm25_score: float = 0.0
    combined_score: float = 0.0
    credibility_score: int = 0
    credibility_tier: str = "community"
    highlight_snippet: str = ""
    is_reasoning_result: bool = False

class StepDTO(BaseModel):
    """Reasoning step metadata"""
    id: str
    thought: str
    action: str
    status: str = "completed"
    sources: List[str] = Field(default_factory=list)

class ChatResponseDTO(BaseModel):
    """Data Transfer Object for standardized chat responses"""
    answer: str
    sources: List[SearchResultDTO] = Field(default_factory=list)
    session_id: Optional[str] = None
    tenant_id: Optional[str] = "default"
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    model_used: Optional[str] = None
    reasoning_chain: List[StepDTO] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

class IngestResponseDTO(BaseModel):
    """Data Transfer Object for ingestion status"""
    success: bool
    url: str
    document_id: Optional[str] = None
    tenant_id: Optional[str] = "default"
    user_id: Optional[str] = None
    workspace_id: Optional[str] = None
    message: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AnalyticsDTO(BaseModel):
    """Data Transfer Object for library analytics"""
    doc_count: int
    bookmark_count: int
    session_count: int
    storage_size: str
    recent_activity: List[Dict[str, Any]] = Field(default_factory=list)
    status: str = "ok"

# [SCHEMAS] Enhanced Pydantic model descriptions
