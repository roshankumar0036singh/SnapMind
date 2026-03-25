import os
import psycopg
from dotenv import load_dotenv
from database import get_db_pool

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def apply_migration():
    if not DATABASE_URL:
        print("❌ DATABASE_URL not found.")
        return

    print(f"🚀 Applying migration: database_migration_offline.sql")
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                with open("database_migration_offline.sql", "r") as f:
                    sql = f.read()
                    cur.execute(sql)
            conn.commit()
        print("✅ Migration applied successfully.")
    except Exception as e:
        print(f"❌ Failed to apply migration: {e}")

if __name__ == "__main__":
    apply_migration()
