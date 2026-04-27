import asyncio
from database import get_db_pool

async def update_db():
    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            sql = """
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_embedding vector(3072),
    query_text text,
    match_threshold float DEFAULT 0.3,
    match_count int DEFAULT 10,
    filter_source_urls text[] DEFAULT NULL,
    vector_weight float DEFAULT 0.7,
    keyword_weight float DEFAULT 0.3,
    target_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
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
            d.id::text::uuid as id,
            d.content,
            d.source_url,
            d.metadata,
            1 - (d.embedding <=> query_embedding) AS similarity,
            0::float AS bm25
        FROM documents d
        WHERE (filter_source_urls IS NULL OR d.source_url = ANY(filter_source_urls))
            AND (target_user_id IS NULL OR d.user_id = target_user_id)
            AND (1 - (d.embedding <=> query_embedding)) > match_threshold
        ORDER BY d.embedding <=> query_embedding
        LIMIT match_count * 2  -- Get more candidates for fusion
    ),
    keyword_results AS (
        -- Full-text search with BM25-like scoring
        SELECT 
            d.id::text::uuid as id,
            d.content,
            d.source_url,
            d.metadata,
            0::float AS similarity,
            ts_rank(
                to_tsvector('english', d.content),
                plainto_tsquery('english', query_text)
            )::float AS bm25
        FROM documents d
        WHERE (filter_source_urls IS NULL OR d.source_url = ANY(filter_source_urls))
            AND (target_user_id IS NULL OR d.user_id = target_user_id)
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
            """
            cur.execute(sql)
            conn.commit()
            print("Successfully updated hybrid_search_documents with user_id!")

if __name__ == "__main__":
    asyncio.run(update_db())
