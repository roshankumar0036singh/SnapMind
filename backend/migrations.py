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
    },
    {
        "version": 4,
        "name": "schema_repair_and_consistency",
        "sql": """
            -- 1. Standardize documents table (rename url to source_url if needed)
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='url') THEN
                    ALTER TABLE documents RENAME COLUMN url TO source_url;
                END IF;
            END $$;

            -- 2. Fix bookmarks table (add missing metadata column)
            ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS embedding vector(768);

            -- 3. Ensure indexing is consistent
            CREATE INDEX IF NOT EXISTS documents_source_url_idx ON documents (source_url);
        """
    },
    {
        "version": 5,
        "name": "file_sync_infrastructure",
        "sql": """
            -- 1. Create table to track local files indexed by the desktop app
            CREATE TABLE IF NOT EXISTS indexed_files (
                path TEXT PRIMARY KEY,
                last_hash TEXT,
                last_indexed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'indexed',
                metadata JSONB DEFAULT '{}'::jsonb
            );

            -- 2. Create table to track watched directories
            CREATE TABLE IF NOT EXISTS watched_dirs (
                path TEXT PRIMARY KEY,
                recursive BOOLEAN DEFAULT true,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS indexed_files_hash_idx ON indexed_files (last_hash);
        """
    },
    {
        "version": 6,
        "name": "chat_memory_and_hybrid_fix",
        "sql": """
            -- 1. Create table for individual chat messages (semantic memory)
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding vector(768),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id);

            -- 2. Advanced Hybrid Search Function (Vector + Keyword) Fix
            -- Update to use source_url instead of url
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
                    WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url)
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM documents d
                    WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url)
                      AND to_tsvector('english', d.content) @@ websearch_to_tsquery('english', query_text)
                    ORDER BY rank DESC
                    LIMIT match_count * 2
                )
                SELECT 
                    d.id,
                    d.source_url AS url,
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
        "version": 7,
        "name": "upgrade_dimensions_to_3072",
        "sql": """
            -- Upgrade documents table
            UPDATE documents 
            SET embedding = (
                substring(embedding::text from 1 for length(embedding::text)-1) || 
                ',' || 
                array_to_string(array_fill(0, ARRAY[3072 - vector_dims(embedding)]), ',') || 
                ']'
            )::vector 
            WHERE embedding IS NOT NULL AND vector_dims(embedding) < 3072;
            ALTER TABLE documents ALTER COLUMN embedding TYPE vector(3072);

            -- Upgrade chat_messages table
            UPDATE chat_messages 
            SET embedding = (
                substring(embedding::text from 1 for length(embedding::text)-1) || 
                ',' || 
                array_to_string(array_fill(0, ARRAY[3072 - vector_dims(embedding)]), ',') || 
                ']'
            )::vector 
            WHERE embedding IS NOT NULL AND vector_dims(embedding) < 3072;
            ALTER TABLE chat_messages ALTER COLUMN embedding TYPE vector(3072);

            -- Upgrade bookmarks table
            UPDATE bookmarks 
            SET embedding = (
                substring(embedding::text from 1 for length(embedding::text)-1) || 
                ',' || 
                array_to_string(array_fill(0, ARRAY[3072 - vector_dims(embedding)]), ',') || 
                ']'
            )::vector 
            WHERE embedding IS NOT NULL AND vector_dims(embedding) < 3072;
            ALTER TABLE bookmarks ALTER COLUMN embedding TYPE vector(3072);

            -- Drop and recreate hybrid_search_documents to use 3072 dimensions
            DROP FUNCTION IF EXISTS hybrid_search_documents(vector, text, float, integer, text, float, float);
            
            CREATE OR REPLACE FUNCTION hybrid_search_documents(
                query_embedding vector(3072),
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
                    WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url)
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM documents d
                    WHERE (filter_source_url IS NULL OR d.source_url LIKE filter_source_url)
                      AND to_tsvector('english', d.content) @@ websearch_to_tsquery('english', query_text)
                    ORDER BY rank DESC
                    LIMIT match_count * 2
                )
                SELECT 
                    d.id,
                    d.source_url AS url,
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
        "version": 8,
        "name": "personas_table",
        "sql": """
            CREATE TABLE IF NOT EXISTS personas (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                system_prompt_addon TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """
    },
    {
        "version": 9,
        "name": "background_sync_watchlist",
        "sql": """
            CREATE TABLE IF NOT EXISTS watched_urls (
                id SERIAL PRIMARY KEY,
                url TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """
    },
    {
        "version": 10,
        "name": "chatbot_widget_table",
        "sql": """
            CREATE TABLE IF NOT EXISTS widget_documents (
                id BIGSERIAL PRIMARY KEY,
                widget_id TEXT NOT NULL,
                url TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding vector(3072),
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS widget_documents_widget_id_idx ON widget_documents (widget_id);
            CREATE INDEX IF NOT EXISTS widget_documents_url_idx ON widget_documents (url);
            CREATE INDEX IF NOT EXISTS widget_documents_content_fts_idx ON widget_documents USING GIN (to_tsvector('english', content));

            DROP FUNCTION IF EXISTS hybrid_search_widget(vector, text, float, integer, text, float, float);
            
            CREATE OR REPLACE FUNCTION hybrid_search_widget(
                query_embedding vector(3072),
                query_text TEXT,
                match_threshold FLOAT,
                match_count INTEGER,
                filter_widget_id TEXT,
                vector_weight FLOAT DEFAULT 0.5,
                keyword_weight FLOAT DEFAULT 0.5
            ) RETURNS TABLE (
                id BIGINT,
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
                    FROM widget_documents d
                    WHERE d.widget_id = filter_widget_id
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM widget_documents d
                    WHERE d.widget_id = filter_widget_id
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
                FROM widget_documents d
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
        "version": 11,
        "name": "knowledge_evolution_tracking",
        "sql": """
            -- Content snapshots for temporal knowledge tracking
            CREATE TABLE IF NOT EXISTS content_versions (
                id BIGSERIAL PRIMARY KEY,
                source_url TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                content_snapshot TEXT,
                diff_summary TEXT,
                version_number INTEGER DEFAULT 1,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_content_versions_url ON content_versions (source_url);
            CREATE INDEX IF NOT EXISTS idx_content_versions_url_created ON content_versions (source_url, created_at DESC);
        """
    },
    {
        "version": 12,
        "name": "research_path_tracking",
        "sql": """
            -- Research action log for path visualization
            CREATE TABLE IF NOT EXISTS research_actions (
                id BIGSERIAL PRIMARY KEY,
                session_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
                parent_action_id BIGINT REFERENCES research_actions(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_research_actions_session ON research_actions (session_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_research_actions_parent ON research_actions (parent_action_id);
        """
    },
    {
        "version": 13,
        "name": "batch_site_search_support",
        "sql": """
            -- Support batch site search with array of prefixes
            -- [FIX] Drop first to avoid signature mismatch errors
            DROP FUNCTION IF EXISTS hybrid_search_documents(vector, text, float, integer, text, float, float);

            CREATE OR REPLACE FUNCTION hybrid_search_documents(
                query_embedding vector(3072),
                query_text TEXT,
                match_threshold FLOAT,
                match_count INTEGER,
                filter_source_urls TEXT[], -- Array of prefixes
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
                    WHERE (filter_source_urls IS NULL OR d.source_url LIKE ANY(filter_source_urls))
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM documents d
                    WHERE (filter_source_urls IS NULL OR d.source_url LIKE ANY(filter_source_urls))
                      AND to_tsvector('english', d.content) @@ websearch_to_tsquery('english', query_text)
                    ORDER BY rank DESC
                    LIMIT match_count * 2
                )
                SELECT 
                    d.id,
                    d.source_url AS url,
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
        "version": 14,
        "name": "multi_user_isolation",
        "sql": """
            -- 1. Add user_id column to core tables
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE ingestion_jobs ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE nodes ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE edges ADD COLUMN IF NOT EXISTS user_id UUID;

            -- 2. Create indexes for user_id to optimize filtering
            CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
            CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_user_id ON ingestion_jobs(user_id);
            CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);

            -- 3. Update Hybrid Search Function to support user_id filtering
            DROP FUNCTION IF EXISTS hybrid_search_documents(vector, text, float, integer, text[], float, float);
            
            CREATE OR REPLACE FUNCTION hybrid_search_documents(
                query_embedding vector(3072),
                query_text TEXT,
                match_threshold FLOAT,
                match_count INTEGER,
                filter_source_urls TEXT[], 
                target_user_id UUID,        -- [NEW] Enforce data isolation
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
                    WHERE (d.user_id = target_user_id) -- [REQUIRED] Strict isolation
                      AND (filter_source_urls IS NULL OR d.source_url LIKE ANY(filter_source_urls))
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM documents d
                    WHERE (d.user_id = target_user_id) -- [REQUIRED] Strict isolation
                      AND (filter_source_urls IS NULL OR d.source_url LIKE ANY(filter_source_urls))
                      AND to_tsvector('english', d.content) @@ websearch_to_tsquery('english', query_text)
                    ORDER BY rank DESC
                    LIMIT match_count * 2
                )
                SELECT 
                    d.id,
                    d.source_url AS url,
                    d.content,
                    d.metadata,
                    COALESCE(v.sim, 0)::FLOAT AS similarity,
                    COALESCE(k.rank, 0)::FLOAT AS bm25_score,
                    (COALESCE(v.sim, 0) * vector_weight + COALESCE(k.rank, 0) * keyword_weight)::FLOAT AS combined_score
                FROM documents d
                LEFT JOIN vector_matches v ON d.id = v.id
                LEFT JOIN keyword_matches k ON d.id = k.id
                WHERE (v.id IS NOT NULL OR k.id IS NOT NULL)
                  AND d.user_id = target_user_id
                ORDER BY combined_score DESC
                LIMIT match_count;
            END;
            $$;
        """
    },
    {
        "version": 15,
        "name": "workspaces_and_tenant_isolation",
        "sql": """
            -- 1. Create a separate table for Workspaces
            CREATE TABLE IF NOT EXISTS workspaces (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                owner_id UUID NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB DEFAULT '{}'::jsonb
            );

            CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);

            -- 2. Add workspace_id to core entities for strict logical isolation
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
            ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
            ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
            ALTER TABLE nodes ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
            ALTER TABLE edges ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

            CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace_id ON chat_sessions(workspace_id);

            -- 3. Hardening Node Isolation: Unique Nodes per Workspace/User
            -- Add a composite constraint to prevent entity collisions across tenants
            ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_name_key;
            ALTER TABLE nodes ADD CONSTRAINT nodes_name_workspace_user_unique UNIQUE (name, workspace_id, user_id);

            -- 4. Update Hybrid Search for Workspace Support
            DROP FUNCTION IF EXISTS hybrid_search_documents(vector, text, float, integer, text[], uuid, float, float);
            
            CREATE OR REPLACE FUNCTION hybrid_search_documents(
                query_embedding vector(3072),
                query_text TEXT,
                match_threshold FLOAT,
                match_count INTEGER,
                filter_source_urls TEXT[], 
                target_user_id UUID,
                target_workspace_id UUID,   -- [NEW] Strict Workspace Isolation
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
                    WHERE (d.user_id = target_user_id)
                      AND (target_workspace_id IS NULL OR d.workspace_id = target_workspace_id) -- [REQUIRED]
                      AND (filter_source_urls IS NULL OR d.source_url LIKE ANY(filter_source_urls))
                      AND 1 - (d.embedding <=> query_embedding) > match_threshold
                    ORDER BY d.embedding <=> query_embedding
                    LIMIT match_count * 2
                ),
                keyword_matches AS (
                    SELECT 
                        d.id,
                        ts_rank(to_tsvector('english', d.content), websearch_to_tsquery('english', query_text)) AS rank
                    FROM documents d
                    WHERE (d.user_id = target_user_id)
                      AND (target_workspace_id IS NULL OR d.workspace_id = target_workspace_id) -- [REQUIRED]
                      AND (filter_source_urls IS NULL OR d.source_url LIKE ANY(filter_source_urls))
                      AND to_tsvector('english', d.content) @@ websearch_to_tsquery('english', query_text)
                    ORDER BY rank DESC
                    LIMIT match_count * 2
                )
                SELECT 
                    d.id,
                    d.source_url AS url,
                    d.content,
                    d.metadata,
                    COALESCE(v.sim, 0)::FLOAT AS similarity,
                    COALESCE(k.rank, 0)::FLOAT AS bm25_score,
                    (COALESCE(v.sim, 0) * vector_weight + COALESCE(k.rank, 0) * keyword_weight)::FLOAT AS combined_score
                FROM documents d
                LEFT JOIN vector_matches v ON d.id = v.id
                LEFT JOIN keyword_matches k ON d.id = k.id
                WHERE (v.id IS NOT NULL OR k.id IS NOT NULL)
                  AND d.user_id = target_user_id
                  AND (target_workspace_id IS NULL OR d.workspace_id = target_workspace_id)
                ORDER BY combined_score DESC
                LIMIT match_count;
            END;
            $$;
        """
    },
    {
        "version": 16,
        "name": "user_api_keys",
        "sql": """
            -- Personal API Keys for MCP / CLI authentication
            CREATE TABLE IF NOT EXISTS user_api_keys (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                key_hash TEXT NOT NULL UNIQUE,
                key_prefix TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT 'Default',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP WITH TIME ZONE
            );

            CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_api_keys_key_hash ON user_api_keys(key_hash);

            -- Enable Row Level Security
            ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

            -- RLS Policy: Users can only see their own keys
            DROP POLICY IF EXISTS user_api_keys_select_policy ON user_api_keys;
            CREATE POLICY user_api_keys_select_policy ON user_api_keys
                FOR SELECT USING (auth.uid() = user_id);

            -- RLS Policy: Users can only insert keys for themselves
            DROP POLICY IF EXISTS user_api_keys_insert_policy ON user_api_keys;
            CREATE POLICY user_api_keys_insert_policy ON user_api_keys
                FOR INSERT WITH CHECK (auth.uid() = user_id);

            -- RLS Policy: Users can only delete their own keys
            DROP POLICY IF EXISTS user_api_keys_delete_policy ON user_api_keys;
            CREATE POLICY user_api_keys_delete_policy ON user_api_keys
                FOR DELETE USING (auth.uid() = user_id);

            -- RLS Policy: Service role can read all keys (for API key validation)
            DROP POLICY IF EXISTS user_api_keys_service_select ON user_api_keys;
            CREATE POLICY user_api_keys_service_select ON user_api_keys
                FOR SELECT TO service_role USING (true);

            -- RLS Policy: Service role can update last_used_at
            DROP POLICY IF EXISTS user_api_keys_service_update ON user_api_keys;
            CREATE POLICY user_api_keys_service_update ON user_api_keys
                FOR UPDATE TO service_role USING (true);
        """
    },
    {
        "version": 17,
        "name": "personas_ownership",
        "sql": """
            -- Personas were created before multi-user isolation (v14) and so had
            -- no owner: every account saw and could delete every persona, and a
            -- persona id from one account could be applied by another.
            ALTER TABLE personas ADD COLUMN IF NOT EXISTS user_id UUID;
            ALTER TABLE personas ADD COLUMN IF NOT EXISTS workspace_id UUID;

            CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);
            CREATE INDEX IF NOT EXISTS idx_personas_workspace_id ON personas(workspace_id);

            -- Rows that predate this migration keep user_id NULL. There is no way
            -- to recover who authored them, so the API treats NULL as "shared with
            -- everyone" rather than deleting them. Assign them an owner by hand if
            -- that matters for your deployment:
            --   UPDATE personas SET user_id = '<uuid>' WHERE user_id IS NULL;
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
                            print(f"[MIGRATIONS] Failed to apply migration v{migration['version']}: {e}")
                            raise e
                            
        print("[MIGRATIONS] Schema is up to date.")
        return True
    except Exception as e:
        print(f"[MIGRATIONS] Critical failure during migration check: {e}")
        return False

# Standalone execution support
if __name__ == "__main__":
    run_migrations()
