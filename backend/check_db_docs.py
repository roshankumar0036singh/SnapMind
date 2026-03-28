
import os
from database import get_db_pool
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

def check_docs():
    pool = get_db_pool()
    if not pool:
        print("Could not connect to database")
        return

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT COUNT(*) FROM documents")
            count = cur.fetchone()["count"]
            print(f"Total documents: {count}")

            cur.execute("SELECT source_url, COUNT(*) as chunk_count FROM documents GROUP BY source_url LIMIT 20")
            urls = cur.fetchall()
            print("\nURLs in documents table:")
            for u in urls:
                print(f"URL: {u['source_url']} | Chunks: {u['chunk_count']}")

if __name__ == "__main__":
    check_docs()
