-- ============================================================================
-- Phase 3: Chat Memory Database Migration
-- ============================================================================

-- Step 1: Create the chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    embedding vector(3072), -- Requires pgvector extension 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Add indexes for performance optimization
-- 1. Index on session_id for fast retrieval of specific chat history
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id 
ON chat_sessions (session_id);

-- 2. Index on created_at to easily pull the "last N messages"
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at 
ON chat_sessions (created_at DESC);

-- 3. HNSW Index for fast semantic memory search 
-- Note: pgvector has a limit of 2000 dimensions for standard float vectors. To index 3072 dimensions, we cast to halfvec.
CREATE INDEX IF NOT EXISTS idx_chat_sessions_embedding 
ON chat_sessions USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

-- Step 3: Add comments for documentation
COMMENT ON TABLE chat_sessions IS 'Stores persistent chat history with vector embeddings for semantic memory recall';
COMMENT ON COLUMN chat_sessions.session_id IS 'UUID from the frontend grouping the chat rounds together';
COMMENT ON COLUMN chat_sessions.role IS 'Either user or assistant';
COMMENT ON COLUMN chat_sessions.content IS 'The raw text message';
COMMENT ON COLUMN chat_sessions.embedding IS 'Gemini vector embedding of the chat message for semantic contextualization';

-- ============================================================================
-- Migration Complete
-- ============================================================================
