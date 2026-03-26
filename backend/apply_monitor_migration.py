import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def apply_migration(file_name):
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found.")
        return

    print(f"🚀 Applying migration: {file_name}")
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                with open(file_name, "r") as f:
                    sql = f.read()
                    cur.execute(sql)
            conn.commit()
        print(f"✅ Migration {file_name} applied successfully.")
    except Exception as e:
        print(f"❌ Failed to apply migration {file_name}: {e}")

if __name__ == "__main__":
    import sys
    file = sys.argv[1] if len(sys.argv) > 1 else "database_migration_monitor.sql"
    apply_migration(file)
