-- Migration to support Offline Mode / Delayed Embeddings
CREATE TABLE IF NOT EXISTS pending_embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_pending_embeddings_created_at ON pending_embeddings(created_at);
