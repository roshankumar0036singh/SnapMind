import os
import psycopg
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

def test_connection():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found in .env")
        return

    print(f"⏳ Connecting to Supabase...")
    try:
        # Try connecting and running a simple query
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                print(f"✅ Connection successful!")
                print(f"📊 PostgreSQL Version: {version}")

                # Check if tables exist
                cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
                tables = [row[0] for row in cur.fetchall()]
                print(f"📂 Tables found: {', '.join(tables) if tables else 'NONE'}")

                required_tables = ['documents', 'chat_sessions', 'ingestion_jobs', 'bookmarks', 'nodes', 'edges']
                missing_tables = [t for t in required_tables if t not in tables]

                if not missing_tables:
                    print("🚀 All required tables are present!")
                else:
                    print(f"⚠️ Missing tables: {', '.join(missing_tables)}")
                    print("💡 Please run the supabase_setup.sql in the Supabase SQL Editor.")

    except Exception as e:
        print(f"❌ Connection failed: {e}")

if __name__ == "__main__":
    test_connection()
