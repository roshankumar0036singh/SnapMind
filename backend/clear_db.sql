-- ============================================================================
-- Snapmind: Clear All Database Tables
-- ============================================================================
-- This script deletes all data from existing tables while keeping the schema.

-- Truncate RAG documents
TRUNCATE TABLE documents CASCADE;

-- Truncate chat sessions
TRUNCATE TABLE chat_sessions CASCADE;

-- Truncate ingestion jobs
TRUNCATE TABLE ingestion_jobs CASCADE;

-- Truncate bookmarks
TRUNCATE TABLE bookmarks CASCADE;

-- Truncate knowledge graph (edges first because of foreign keys)
TRUNCATE TABLE edges CASCADE;
TRUNCATE TABLE nodes CASCADE;

-- Final Verification
SELECT 'Database tables cleared successfully!' as status;
