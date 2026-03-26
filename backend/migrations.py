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
