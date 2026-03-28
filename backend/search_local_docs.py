
import os
from database import get_db_pool
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

def check_local():
    pool = get_db_pool()
    if not pool:
        print("Could not connect to database")
        return

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT DISTINCT source_url FROM documents WHERE source_url ILIKE '%localhost%' OR source_url ILIKE '%npm.html%'")
            urls = cur.fetchall()
            if not urls:
                print("No documents found matching localhost or npm.html")
            else:
                print("Found matching documents:")
                for u in urls:
                    print(u['source_url'])

if __name__ == "__main__":
    check_local()
