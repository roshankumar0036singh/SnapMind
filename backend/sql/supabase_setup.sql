-- ============================================================================
-- Snapmind: Full Database Setup for Supabase (PostgreSQL + pgvector)
-- ============================================================================
-- This script performs a one-time initialization of all required tables, 
-- indexes, and functions for the Snapmind RAG system.

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Multi-Tenancy: Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces (owner_id);

-- 3. Core RAG: Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    source_url TEXT,
    embedding vector(3072) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    user_id UUID,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_content_fts ON documents USING GIN (to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_documents_source_url ON documents (source_url);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents (user_id);

-- 3. Semantic Chat Memory: Chat Sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    embedding vector(3072),
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_embedding ON chat_sessions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_auth ON chat_sessions (workspace_id, user_id);

-- 4. Background Job Tracking
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    status TEXT DEFAULT 'processing',
    message TEXT,
    files_processed INT DEFAULT 0,
    chunks_count INT DEFAULT 0,
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Offline Queue: Pending Embeddings
CREATE TABLE IF NOT EXISTS pending_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    source_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Research Notebook: Bookmarks
CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    source_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding halfvec(3072),
    user_id UUID,
    workspace_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_workspace ON bookmarks (workspace_id);

-- 6. GraphRAG: Knowledge Graph
CREATE TABLE IF NOT EXISTS nodes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    workspace_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, workspace_id)
);

CREATE TABLE IF NOT EXISTS edges (
    id SERIAL PRIMARY KEY,
    source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    source_url TEXT,
    session_id TEXT,
    workspace_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edges_workspace ON edges(workspace_id);

-- 7. Personal Data: Saved Pages
CREATE TABLE IF NOT EXISTS saved_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    original_url TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    folder_name TEXT DEFAULT 'General',
    keywords TEXT[],
    emotions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_pages_auth ON saved_pages (workspace_id, user_id);

-- 8. Hybrid Search Functions (Production Hardened)
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_embedding vector(3072),
    query_text text,
    workspace_val UUID,
    user_val UUID DEFAULT NULL,
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 10,
    filter_source_url text DEFAULT NULL,
    vector_weight float DEFAULT 0.7,
    keyword_weight float DEFAULT 0.3
)
RETURNS TABLE (
    id UUID,
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
        WHERE (workspace_val IS NULL AND d.workspace_id IS NULL OR d.workspace_id = workspace_val)
            AND (user_val IS NULL OR d.user_id = user_val)
            AND (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
            AND (1 - (d.embedding <=> query_embedding)) > match_threshold
        ORDER BY d.embedding <=> query_embedding LIMIT match_count * 2
    ),
    keyword_results AS (
        SELECT d.id, d.content, d.source_url, d.metadata,
               ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', query_text))::float AS bm25
        FROM documents d
        WHERE (workspace_val IS NULL AND d.workspace_id IS NULL OR d.workspace_id = workspace_val)
            AND (user_val IS NULL OR d.user_id = user_val)
            AND (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
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
