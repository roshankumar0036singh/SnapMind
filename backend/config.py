from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List, Optional

class ModelSettings(BaseSettings):
    """Configuration for LLM models"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    
    # Mistral Models
    mistral_small: str = Field("mistral-small-latest", env="MISTRAL_SMALL_MODEL")
    mistral_large: str = Field("mistral-large-latest", env="MISTRAL_LARGE_MODEL")
    mistral_embed: str = Field("mistral-embed", env="MISTRAL_EMBED_MODEL")
    
    # Gemini Models
    gemini_flash: str = Field("gemini-2.0-flash", env="GEMINI_FLASH_MODEL")
    gemini_flash_lite: str = Field("gemini-2.0-flash-lite", env="GEMINI_FLASH_LITE_MODEL")
    gemini_pro: str = Field("gemini-1.5-pro", env="GEMINI_PRO_MODEL")

class DatabaseSettings(BaseSettings):
    """Database configuration"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    
    database_url: str = Field(..., env="DATABASE_URL")
    supabase_url: Optional[str] = Field(None, env="SUPABASE_URL")
    supabase_key: Optional[str] = Field(None, env="SUPABASE_KEY")

class ChunkingSettings(BaseSettings):
    """Configuration for semantic chunking"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    
    enabled: bool = Field(True, env="SEMANTIC_CHUNKING_ENABLED")
    min_size: int = Field(200, env="MIN_CHUNK_SIZE")
    target_size: int = Field(800, env="TARGET_CHUNK_SIZE")
    max_size: int = Field(1200, env="MAX_CHUNK_SIZE")
    overlap_percentage: float = Field(0.2, env="CHUNK_OVERLAP_PERCENTAGE")

class SearchSettings(BaseSettings):
    """Configuration for Retrieval results"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    mode: str = Field("hybrid", env="SEARCH_MODE")
    match_threshold: float = Field(0.2, env="MATCH_THRESHOLD")
    match_count: int = Field(10, env="MATCH_COUNT")
    vector_weight: float = Field(0.7, env="VECTOR_WEIGHT")
    keyword_weight: float = Field(0.3, env="KEYWORD_WEIGHT")

class RerankingSettings(BaseSettings):
    """Configuration for document reranking"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    enabled: bool = Field(True, env="RERANK_ENABLED")
    model: str = Field("mistral", env="RERANK_MODEL") # 'local' or 'mistral'
    candidates: int = Field(15, env="RERANK_CANDIDATES")
    top_k: int = Field(5, env="RERANK_TOP_K")

class QuerySettings(BaseSettings):
    """Configuration for query enhancement (HyDE/Multi-query)"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    hyde_enabled: bool = Field(True, env="HYDE_ENABLED")
    multi_query_enabled: bool = Field(True, env="MULTI_QUERY_ENABLED")
    query_variations: int = Field(3, env="QUERY_VARIATIONS")

class CacheSettings(BaseSettings):
    """Configuration for query caching"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    enabled: bool = Field(True, env="CACHE_ENABLED")
    backend: str = Field("memory", env="CACHE_BACKEND")
    ttl_general: int = Field(3600, env="CACHE_TTL_GENERAL")
    ttl_indexed: int = Field(86400, env="CACHE_TTL_INDEXED")
    similarity_threshold: float = Field(0.95, env="CACHE_SIMILARITY_THRESHOLD")

class ContextSettings(BaseSettings):
    """Configuration for context optimization"""
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    max_context_length: int = Field(10000, env="MAX_CONTEXT_LENGTH")
    enable_compression: bool = Field(True, env="ENABLE_COMPRESSION")
    enable_deduplication: bool = Field(True, env="ENABLE_DEDUPLICATION")
    min_relevance_score: float = Field(0.2, env="MIN_RELEVANCE_SCORE")

class SnapMindSettings(BaseSettings):
    """Global aggregation of all settings"""
    models: ModelSettings = ModelSettings()
    db: DatabaseSettings = DatabaseSettings()
    chunking: ChunkingSettings = ChunkingSettings()
    search: SearchSettings = SearchSettings()
    reranking: RerankingSettings = RerankingSettings()
    query: QuerySettings = QuerySettings()
    cache: CacheSettings = CacheSettings()
    context: ContextSettings = ContextSettings()
    
    # Provider: 'cloud', 'local', 'hybrid'
    llm_provider: str = Field("cloud", env="LLM_PROVIDER")
    
    # Feature Flags
    graphrag_enabled: bool = Field(True, env="GRAPHRAG_ENABLED")
    agentic_chunking_enabled: bool = Field(True, env="AGENTIC_CHUNKING_ENABLED")
    
    # Production Infrastructure
    allowed_origins: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3002"], 
        env="ALLOWED_ORIGINS",
        description="Comma-separated list of allowed origins for CORS"
    )
    rate_limit_per_minute: int = Field(5, env="RATE_LIMIT_PER_MINUTE")
    server_url: str = Field("http://localhost:8000", env="SERVER_URL") # Used for self-ping
    
    @property
    def context_limit(self) -> int:
        """Legacy alias for context.max_context_length used by some agents"""
        return self.context.max_context_length

    @property
    def is_configured(self) -> bool:
        """Returns True if essential AI keys are set."""
        return all([
            os.getenv("GEMINI_API_KEY"),
            os.getenv("GROQ_API_KEY"),
            os.getenv("MISTRAL_API_KEY") or os.getenv("MISTRAL_SMALL_MODEL") # Depending on which is used
        ])

    def get_missing_keys(self) -> List[str]:
        """Returns a list of missing essential keys."""
        missing = []
        if not os.getenv("GEMINI_API_KEY"): missing.append("GEMINI_API_KEY")
        if not os.getenv("GROQ_API_KEY"): missing.append("GROQ_API_KEY")
        if not os.getenv("MISTRAL_API_KEY"): missing.append("MISTRAL_API_KEY")
        if not os.getenv("DATABASE_URL"): missing.append("DATABASE_URL")
        return missing

# Global Settings Instance
settings = SnapMindSettings()

# Settings are fully unified in the SnapMindSettings object above.
# Legacy stubs have been removed.
