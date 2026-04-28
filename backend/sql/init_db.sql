-- ============================================================================
-- Initialization Script for standard PostgreSQL Database
-- ============================================================================

-- Step 1: Enable the pgvector extension (required for vector operations)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create the main documents table
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    source_url TEXT,
    embedding vector(3072) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Note: The rest of the indexes, BM25 scoring functions, and hybrid search 
-- functions are already handled in 'backend/database_migration_phase2.sql'.
-- Execute this script FIRST before running database_migration_phase2.sql.
