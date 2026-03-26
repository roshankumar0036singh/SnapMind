import urllib.parse
from database import get_db_pool

# Centralized source of truth for all database tables in SnapMind
MIGRATIONS = [
    {
        "version": 1,
        "name": "initial_schema",
        "sql": """
            CREATE EXTENSION IF NOT EXISTS vector;
            
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding vector(768),
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS documents_url_idx ON documents (url);
            
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                messages JSONB DEFAULT '[]'::jsonb
            );
            
            CREATE TABLE IF NOT EXISTS refresh_suggestions (
                url TEXT PRIMARY KEY,
                title TEXT,
                last_visited TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                visit_count INTEGER DEFAULT 1,
                last_ingested TIMESTAMP WITH TIME ZONE,
                status TEXT DEFAULT 'pending'
            );
            
            CREATE TABLE IF NOT EXISTS ingest_status (
                url TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                progress INTEGER DEFAULT 0,
                message TEXT,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS bookmarks (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                source_url TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS analytics (
                id SERIAL PRIMARY KEY,
                event_type TEXT NOT NULL,
                event_data JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Insert default settings
            INSERT INTO settings (key, value) 
            VALUES ('web_monitor_enabled', 'true'::jsonb) 
            ON CONFLICT (key) DO NOTHING;
        """
    },
    {
        "version": 2,
        "name": "hybrid_search_and_jobs",
        "sql": """
            -- 1. Create Ingestion Jobs tracking table
            CREATE TABLE IF NOT EXISTS ingestion_jobs (
                job_id SERIAL PRIMARY KEY,
                url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'processing',
                message TEXT,
                chunks_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            -- 2. Add GIN index for full-text search
            CREATE INDEX IF NOT EXISTS documents_content_fts_idx ON documents USING GIN (to_tsvector('english', content));

            -- 3. Advanced Hybrid Search Function (Vector + Keyword)
            -- [FIX] Drop first to avoid signature mismatch errors
            DROP FUNCTION IF EXISTS hybrid_search_documents(vector, text, float, integer, text, float, float);
            
            CREATE OR REPLACE FUNCTION hybrid_search_documents(
                query_embedding vector(768),
                query_text TEXT,
                match_threshold FLOAT,
                match_count INTEGER,
                filter_source_url TEXT,
                vector_weight FLOAT DEFAULT 0.5,
                keyword_weight FLOAT DEFAULT 0.5
            ) RETURNS TABLE (
                id TEXT,
                url TEXT,
                content TEXT,
                metadata JSONB,
                similarity FLOAT,
                bm25_score FLOAT,
                combined_score FLOAT
            ) LANGUAGE plpgsql AS $$
            BEGIN
                RETURN QUERY
                WITH vector_matches AS (
                    SELECT 
                        d.id,
                        1 - (d.embedding <=> query_embedding) AS sim
                    FROM documents d
                    WHERE (filter_source_url IS NULL OR d.url LIKE filter_source_url)
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM documents d
                    WHERE (filter_source_url IS NULL OR d.url LIKE filter_source_url)
                      AND to_tsvector('english', d.content) @@ websearch_to_tsquery('english', query_text)
                    ORDER BY rank DESC
                    LIMIT match_count * 2
                )
                SELECT 
                    d.id,
                    d.url,
                    d.content,
                    d.metadata,
                    COALESCE(v.sim, 0)::FLOAT AS similarity,
                    COALESCE(k.rank, 0)::FLOAT AS bm25_score,
                    (COALESCE(v.sim, 0) * vector_weight + COALESCE(k.rank, 0) * keyword_weight)::FLOAT AS combined_score
                FROM documents d
                LEFT JOIN vector_matches v ON d.id = v.id
                LEFT JOIN keyword_matches k ON d.id = k.id
                WHERE v.id IS NOT NULL OR k.id IS NOT NULL
                ORDER BY combined_score DESC
                LIMIT match_count;
            END;
            $$;
        """
    },
    {
        "version": 3,
        "name": "web_monitor_fingerprints",
        "sql": """
            -- 1. Table to track unique content fingerprints for change detection
            CREATE TABLE IF NOT EXISTS web_monitor_state (
                url TEXT PRIMARY KEY,
                content_hash TEXT NOT NULL,
                last_checked TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                change_detected_at TIMESTAMP WITH TIME ZONE
            );

            -- 2. Enhance refresh_suggestions with fingerprint info
            ALTER TABLE refresh_suggestions ADD COLUMN IF NOT EXISTS last_fingerprint TEXT;
            ALTER TABLE refresh_suggestions ADD COLUMN IF NOT EXISTS reason TEXT;
        """
    }
]

def run_migrations():
    """
    Run safe, sequential database migrations on startup.
    This guarantees that the schema is always correctly initialized without side effects.
    """
    pool = get_db_pool()
    if not pool:
        print("[MIGRATIONS] Cannot run migrations. Database pool is not initialized.")
        return False
        
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Create the migrations tracking table
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        version INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                """)
                conn.commit()
                
                # Check current version
                cur.execute("SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;")
                result = cur.fetchone()
                current_version = result[0] if result else 0
                
                # Apply pending migrations
                for migration in MIGRATIONS:
                    if migration["version"] > current_version:
                        print(f"[MIGRATIONS] Applying migration v{migration['version']} ({migration['name']})...")
                        try:
                            # Apply the SQL
                            cur.execute(migration["sql"])
                            
                            # Record the execution
                            cur.execute(
                                "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
                                (migration["version"], migration["name"])
                            )
                            conn.commit()
                            print(f"[MIGRATIONS] Migration v{migration['version']} applied successfully.")
                        except Exception as e:
                            conn.rollback()
                            print(f"[MIGRATIONS] ❌ Failed to apply migration v{migration['version']}: {e}")
                            raise e
                            
        print("[MIGRATIONS] Schema is up to date.")
        return True
    except Exception as e:
        print(f"[MIGRATIONS] ❌ Critical failure during migration check: {e}")
        return False

# Standalone execution support
if __name__ == "__main__":
    run_migrations()
