import psycopg
from database import get_db_pool
import os

def apply_migration():
    pool = get_db_pool()
    if not pool:
        print("❌ Could not get database pool.")
        return

    migration_file = "d:/Rag/backend/database_migration_phase19.sql"
    if not os.path.exists(migration_file):
        print(f"❌ Migration file not found: {migration_file}")
        return

    with open(migration_file, "r") as f:
        sql = f.read()

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                print("⏳ Applying Research Bookmarking migration...")
                cur.execute(sql)
                conn.commit()
                print("✅ Migration applied successfully.")
    except Exception as e:
        print(f"❌ Error applying migration: {e}")

if __name__ == "__main__":
    apply_migration()
