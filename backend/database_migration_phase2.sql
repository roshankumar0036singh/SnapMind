-- ============================================================================
-- Phase 2: Hybrid Search Database Migration
-- ============================================================================
-- This migration adds full-text search capabilities to the documents table
-- and creates a hybrid search function combining vector + BM25 search.

-- Step 1: Add full-text search index
-- ============================================================================

-- Create GIN index for full-text search on content column
CREATE INDEX IF NOT EXISTS idx_documents_content_fts 
ON documents USING GIN (to_tsvector('english', content));

-- Add index on source_url for filtering
CREATE INDEX IF NOT EXISTS idx_documents_source_url 
ON documents (source_url);

-- Add index on metadata for future filtering
CREATE INDEX IF NOT EXISTS idx_documents_metadata 
ON documents USING GIN (metadata);

-- Step 2: Create BM25 scoring function
-- ============================================================================

CREATE OR REPLACE FUNCTION bm25_score(
    query_text text,
    document_content text,
    k1 float DEFAULT 1.5,
    b float DEFAULT 0.75
) RETURNS float AS $$
DECLARE
    doc_length int;
    avg_doc_length float;
    tf float;
    idf float;
    score float;
BEGIN
    -- Simple BM25 approximation using PostgreSQL's ts_rank
    -- For production, consider using a dedicated BM25 extension
    score := ts_rank(
        to_tsvector('english', document_content),
        plainto_tsquery('english', query_text)
    );
    
    RETURN score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Create hybrid search function
-- ============================================================================

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
        -- Vector similarity search
        SELECT 
            d.id,
            d.content,
            d.source_url,
            d.metadata,
            1 - (d.embedding <=> query_embedding) AS similarity,
            0::float AS bm25
        FROM documents d
        WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
            AND (1 - (d.embedding <=> query_embedding)) > match_threshold
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count * 2  -- Get more candidates for fusion
    ),
    keyword_results AS (
        -- Full-text search with BM25-like scoring
        SELECT 
            d.id,
            d.content,
            d.source_url,
            d.metadata,
            0::float AS similarity,
            ts_rank(
                to_tsvector('english', d.content),
                plainto_tsquery('english', query_text)
            )::float AS bm25
        FROM documents d
        WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
            AND to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
        ORDER BY bm25 DESC
        LIMIT match_count * 2  -- Get more candidates for fusion
    ),
    combined AS (
        -- Combine results using Reciprocal Rank Fusion approach
        SELECT 
            COALESCE(v.id, k.id) AS id,
            COALESCE(v.content, k.content) AS content,
            COALESCE(v.source_url, k.source_url) AS source_url,
            COALESCE(v.metadata, k.metadata) AS metadata,
            COALESCE(v.similarity, 0) AS similarity,
            COALESCE(k.bm25, 0) AS bm25_score,
            -- Normalize and combine scores
            (
                (COALESCE(v.similarity, 0) * vector_weight) + 
                (COALESCE(k.bm25, 0) * keyword_weight * 10)  -- Scale BM25 to similar range
            ) AS combined_score
        FROM vector_results v
        FULL OUTER JOIN keyword_results k ON v.id = k.id
    )
    SELECT 
        c.id,
        c.content,
        c.source_url,
        c.metadata,
        c.similarity,
        c.bm25_score,
        c.combined_score
    FROM combined c
    ORDER BY c.combined_score DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create helper function for keyword-only search
-- ============================================================================

CREATE OR REPLACE FUNCTION keyword_search_documents(
    query_text text,
    match_count int DEFAULT 10,
    filter_source_url text DEFAULT NULL
)
RETURNS TABLE (
    id bigint,
    content text,
    source_url text,
    metadata jsonb,
    rank float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.content,
        d.source_url,
        d.metadata,
        ts_rank(
            to_tsvector('english', d.content),
            plainto_tsquery('english', query_text)
        )::float AS rank
    FROM documents d
    WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url || '%')
        AND to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
    ORDER BY rank DESC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Add comments for documentation
-- ============================================================================

COMMENT ON FUNCTION hybrid_search_documents IS 
'Hybrid search combining vector similarity and BM25 keyword matching with configurable weights';

COMMENT ON FUNCTION keyword_search_documents IS 
'Full-text search using PostgreSQL tsvector and BM25-like ranking';

COMMENT ON INDEX idx_documents_content_fts IS 
'Full-text search index for hybrid search (Phase 2)';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'documents'
ORDER BY indexname;

-- Test hybrid search function
-- SELECT * FROM hybrid_search_documents(
--     query_embedding := (SELECT embedding FROM documents LIMIT 1),
--     query_text := 'test query',
--     match_count := 5
-- );
