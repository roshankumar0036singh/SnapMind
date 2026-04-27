import os
from database import get_db_pool

def run_migration():
    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            # 1. Create content_versions table for Knowledge Evolution
            print("Cleaning up existing table if any...")
            cur.execute("DROP TABLE IF EXISTS content_versions;")
            
            print("Creating content_versions table...")
            cur.execute("""
                CREATE TABLE content_versions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    source_url TEXT NOT NULL,
                    content TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    diff_summary TEXT,
                    user_id UUID,
                    workspace_id UUID,
                    version_number INTEGER DEFAULT 1,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_versions_url ON content_versions (source_url);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_versions_auth ON content_versions (workspace_id, user_id);")

            # 2. Add version columns to saved_pages if they don't exist
            print("Adding versioning columns to saved_pages...")
            cur.execute("""
                ALTER TABLE saved_pages 
                ADD COLUMN IF NOT EXISTS current_hash TEXT,
                ADD COLUMN IF NOT EXISTS version_count INTEGER DEFAULT 1;
            """)
            
            conn.commit()
            print("Migration successful!")

if __name__ == "__main__":
    run_migration()
