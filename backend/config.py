"""
Configuration module for RAG pipeline.
Centralizes all configurable parameters for easy tuning and experimentation.
"""

import os
from dotenv import load_dotenv

load_dotenv()


# ============================================================================
# PHASE 1: CHUNKING CONFIGURATION
# ============================================================================

class ChunkingConfig:
    """Configuration for semantic chunking"""
    
    # Semantic Chunking Settings
    SEMANTIC_CHUNKING_ENABLED = os.getenv("SEMANTIC_CHUNKING_ENABLED", "true").lower() == "true"
    AGENTIC_CHUNKING_MODEL = "mistral-large-latest"
    AGENTIC_CHUNKING_TARGET_SIZE = 1000
    
    # Chunk size parameters (in characters)
    MIN_CHUNK_SIZE = int(os.getenv("MIN_CHUNK_SIZE", "200"))
    TARGET_CHUNK_SIZE = int(os.getenv("TARGET_CHUNK_SIZE", "800"))
    MAX_CHUNK_SIZE = int(os.getenv("MAX_CHUNK_SIZE", "1200"))
    
    # Overlap between chunks (0.0 to 1.0)
    CHUNK_OVERLAP_PERCENTAGE = float(os.getenv("CHUNK_OVERLAP_PERCENTAGE", "0.2"))
    
    # Preserve special content
    PRESERVE_CODE_BLOCKS = os.getenv("PRESERVE_CODE_BLOCKS", "true").lower() == "true"
    PRESERVE_TABLES = os.getenv("PRESERVE_TABLES", "true").lower() == "true"
    
    # Metadata extraction
    EXTRACT_METADATA = os.getenv("EXTRACT_METADATA", "true").lower() == "true"


# ============================================================================
# EMBEDDING CONFIGURATION
# ============================================================================

class EmbeddingConfig:
    """Configuration for embedding generation"""
    
    # Embedding model
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "mistral-embed")
    
    # Parallel processing
    MAX_EMBEDDING_WORKERS = int(os.getenv("MAX_EMBEDDING_WORKERS", "3"))
    
    # Batch size for bulk operations
    EMBEDDING_BATCH_SIZE = int(os.getenv("EMBEDDING_BATCH_SIZE", "10"))


# ============================================================================
# SEARCH CONFIGURATION
# ============================================================================

class SearchConfig:
    """Configuration for retrieval and search"""
    
    # Vector search parameters
    MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.2"))
    MATCH_COUNT = int(os.getenv("MATCH_COUNT", "10"))
    
    # Search mode: 'vector_only', 'hybrid', 'keyword_only'
    SEARCH_MODE = os.getenv("SEARCH_MODE", "hybrid")
    
    # Hybrid search weights (if enabled)
    VECTOR_WEIGHT = float(os.getenv("VECTOR_WEIGHT", "0.7"))
    KEYWORD_WEIGHT = float(os.getenv("KEYWORD_WEIGHT", "0.3"))


# ============================================================================
# RERANKING CONFIGURATION (Phase 3)
# ============================================================================

class RerankingConfig:
    """Configuration for reranking layer"""
    
    # Enable/disable reranking
    RERANK_ENABLED = os.getenv("RERANK_ENABLED", "true").lower() == "true"
    
    # Reranking model: 'cohere', 'local', 'none'
    RERANK_MODEL = os.getenv("RERANK_MODEL", "none")
    
    # Number of candidates to rerank
    RERANK_CANDIDATES = int(os.getenv("RERANK_CANDIDATES", "20"))
    
    # Number of results to return after reranking
    RERANK_TOP_K = int(os.getenv("RERANK_TOP_K", "5"))


# ============================================================================
# CACHING CONFIGURATION (Phase 6)
# ============================================================================

class CacheConfig:
    """Configuration for semantic caching"""
    
    # Enable/disable caching
    CACHE_ENABLED = os.getenv("CACHE_ENABLED", "true").lower() == "true"
    
    # Cache backend: 'redis', 'memory'
    CACHE_BACKEND = os.getenv("CACHE_BACKEND", "memory")
    
    # Redis URL (if using Redis)
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Cache TTL (in seconds)
    CACHE_TTL_GENERAL = int(os.getenv("CACHE_TTL_GENERAL", "3600"))  # 1 hour
    CACHE_TTL_INDEXED = int(os.getenv("CACHE_TTL_INDEXED", "86400"))  # 24 hours
    
    # Similarity threshold for cache hits
    CACHE_SIMILARITY_THRESHOLD = float(os.getenv("CACHE_SIMILARITY_THRESHOLD", "0.95"))


# ============================================================================
# GENERATION CONFIGURATION
# ============================================================================

class GenerationConfig:
    """Configuration for LLM generation"""
    
    # Generation model
    GENERATION_MODEL = os.getenv("GENERATION_MODEL", "mistral-small-latest")
    
    # Fallback models (in order of preference)
    FALLBACK_MODELS = os.getenv("FALLBACK_MODELS", "").split(",") if os.getenv("FALLBACK_MODELS") else []
    
    # Temperature
    TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
    
    # Max tokens
    MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2000"))
    
    # Streaming
    STREAMING_ENABLED = os.getenv("STREAMING_ENABLED", "true").lower() == "true"


# ============================================================================
# QUERY ENHANCEMENT CONFIGURATION (Phase 4)
# ============================================================================

class QueryConfig:
    """Configuration for query enhancement"""
    
    # Enable HyDE (Hypothetical Document Embeddings)
    HYDE_ENABLED = os.getenv("HYDE_ENABLED", "false").lower() == "true"
    
    # Enable multi-query generation
    MULTI_QUERY_ENABLED = os.getenv("MULTI_QUERY_ENABLED", "false").lower() == "true"
    
    # Number of query variations to generate
    QUERY_VARIATIONS = int(os.getenv("QUERY_VARIATIONS", "3"))


# ============================================================================
# CONTEXT OPTIMIZATION CONFIGURATION (Phase 5)
# ============================================================================

class ContextConfig:
    """Configuration for context optimization"""
    
    # Maximum context length (in tokens)
    MAX_CONTEXT_LENGTH = int(os.getenv("MAX_CONTEXT_LENGTH", "4000"))
    
    # Enable compression
    ENABLE_COMPRESSION = os.getenv("ENABLE_COMPRESSION", "true").lower() == "true"
    
    # Enable deduplication
    ENABLE_DEDUPLICATION = os.getenv("ENABLE_DEDUPLICATION", "true").lower() == "true"
    
    # Minimum relevance score for filtering
    MIN_RELEVANCE_SCORE = float(os.getenv("MIN_RELEVANCE_SCORE", "0.000001"))


# ============================================================================
# MONITORING CONFIGURATION (Phase 9)
# ============================================================================

class MonitoringConfig:
    """Configuration for monitoring and evaluation"""
    
    # Enable metrics collection
    METRICS_ENABLED = os.getenv("METRICS_ENABLED", "false").lower() == "true"
    
    # Log retrieval quality
    LOG_RETRIEVAL_QUALITY = os.getenv("LOG_RETRIEVAL_QUALITY", "false").lower() == "true"
    
    # Track latency
    TRACK_LATENCY = os.getenv("TRACK_LATENCY", "false").lower() == "true"


# ============================================================================
# FEATURE FLAGS
# ============================================================================

class FeatureFlags:
    """Feature flags for gradual rollout and A/B testing"""
    
    # Phase rollout flags
    PHASE_1_SEMANTIC_CHUNKING = os.getenv("PHASE_1_ENABLED", "true").lower() == "true"
    PHASE_2_HYBRID_SEARCH = os.getenv("PHASE_2_ENABLED", "false").lower() == "true"
    PHASE_3_RERANKING = os.getenv("PHASE_3_ENABLED", "true").lower() == "true"
    PHASE_4_QUERY_ENHANCEMENT = os.getenv("PHASE_4_ENABLED", "false").lower() == "true"
    PHASE_5_CONTEXT_OPTIMIZATION = os.getenv("PHASE_5_ENABLED", "true").lower() == "true"
    PHASE_6_CACHING = os.getenv("PHASE_6_ENABLED", "true").lower() == "true"
    GRAPHRAG_ENABLED = os.getenv("GRAPHRAG_ENABLED", "true").lower() == "true" # [NEW] Phase 13
    PHASE_15_AGENTIC_CHUNKING = os.getenv("AGENTIC_CHUNKING_ENABLED", "false").lower() == "true" # [NEW] Phase 15
    
    # A/B testing variant
    AB_TEST_VARIANT = os.getenv("AB_TEST_VARIANT", "control")  # 'control' or 'treatment'


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_config_summary() -> dict:
    """Get a summary of all active configurations"""
    return {
        "chunking": {
            "semantic_enabled": ChunkingConfig.SEMANTIC_CHUNKING_ENABLED,
            "target_size": ChunkingConfig.TARGET_CHUNK_SIZE,
            "overlap": ChunkingConfig.CHUNK_OVERLAP_PERCENTAGE,
        },
        "search": {
            "mode": SearchConfig.SEARCH_MODE,
            "match_count": SearchConfig.MATCH_COUNT,
        },
        "reranking": {
            "enabled": RerankingConfig.RERANK_ENABLED,
            "model": RerankingConfig.RERANK_MODEL,
        },
        "caching": {
            "enabled": CacheConfig.CACHE_ENABLED,
            "backend": CacheConfig.CACHE_BACKEND,
        },
        "generation": {
            "model": GenerationConfig.GENERATION_MODEL,
            "streaming": GenerationConfig.STREAMING_ENABLED,
        },
        "features": {
            "phase_1": FeatureFlags.PHASE_1_SEMANTIC_CHUNKING,
            "phase_2": FeatureFlags.PHASE_2_HYBRID_SEARCH,
            "phase_3": FeatureFlags.PHASE_3_RERANKING,
            "phase_4": FeatureFlags.PHASE_4_QUERY_ENHANCEMENT,
            "phase_5": FeatureFlags.PHASE_5_CONTEXT_OPTIMIZATION,
            "phase_6": FeatureFlags.PHASE_6_CACHING,
        }
    }


def print_config():
    """Print current configuration (for debugging)"""
    import json
    config = get_config_summary()
    print("=" * 80)
    print("CURRENT RAG CONFIGURATION")
    print("=" * 80)
    print(json.dumps(config, indent=2))
    print("=" * 80)


if __name__ == "__main__":
    print_config()
