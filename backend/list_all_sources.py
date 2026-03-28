
import os
from database import get_db_pool
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

def list_all_sources():
    pool = get_db_pool()
    if not pool:
        print("Could not connect to database")
        return

    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT source_url FROM documents")
            rows = cur.fetchall()
            print(f"Grand total unique source_urls: {len(rows)}")
            for r in rows:
                print(r[0])

if __name__ == "__main__":
    list_all_sources()
