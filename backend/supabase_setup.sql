-- ============================================================================
-- Snapmind: Full Database Setup for Supabase (PostgreSQL + pgvector)
-- ============================================================================
-- This script performs a one-time initialization of all required tables, 
-- indexes, and functions for the Snapmind RAG system.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Core RAG: Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source_url TEXT,
    embedding vector(3072) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_content_fts ON documents USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_documents_source_url ON documents (source_url);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);

-- 3. Semantic Chat Memory: Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    embedding vector(3072),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_embedding ON chat_sessions USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- 4. Background Job Tracking
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'processing',
    message TEXT,
    files_processed INT DEFAULT 0,
    chunks_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_url ON ingestion_jobs(url);

-- 5. Research Notebook: Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding halfvec(3072), -- [MATCHED] Phase 20 (Semantic Search)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. GraphRAG: Knowledge Graph
CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    entity_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    source_url TEXT,
    session_id TEXT, -- [NEW] Conversation Scoping
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_edges_session_id ON edges(session_id);
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);

-- 7. Hybrid Search Functions
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_embedding vector(3072),
    query_text text,
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 10,
    filter_source_url text DEFAULT NULL,
    vector_weight float DEFAULT 0.7,
    keyword_weight float DEFAULT 0.3
)
RETURNS TABLE (
    id bigint,
    content text,
    source_url text,
    metadata jsonb,
    similarity float,
    bm25_score float,
    combined_score float
) AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT d.id, d.content, d.source_url, d.metadata,
               1 - (d.embedding <=> query_embedding) AS similarity
        FROM documents d
        WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
            AND (1 - (d.embedding <=> query_embedding)) > match_threshold
        ORDER BY d.embedding <=> query_embedding LIMIT match_count * 2
    ),
    keyword_results AS (
        SELECT d.id, d.content, d.source_url, d.metadata,
               ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', query_text))::float AS bm25
        FROM documents d
        WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
            AND to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
        ORDER BY bm25 DESC LIMIT match_count * 2
    )
    SELECT COALESCE(v.id, k.id), COALESCE(v.content, k.content), COALESCE(v.source_url, k.source_url),
           COALESCE(v.metadata, k.metadata), COALESCE(v.similarity, 0), COALESCE(k.bm25, 0),
           ((COALESCE(v.similarity, 0) * vector_weight) + (COALESCE(k.bm25, 0) * keyword_weight * 10)) AS score
    FROM vector_results v FULL OUTER JOIN keyword_results k ON v.id = k.id
    ORDER BY score DESC LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Final Verification
SELECT 'Database successfully initialized!' as status;
