import os
import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def search_github_tos():
    if not DATABASE_URL:
        print("❌ Missing DATABASE_URL")
        return

    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Search for GitHub Terms of Service
                cur.execute("""
                    SELECT content, source_url, metadata 
                    FROM documents 
                    WHERE content ILIKE %s 
                    LIMIT 20
                """, ('%GitHub Terms of Service%',))
                rows = cur.fetchall()
                print(f"Found {len(rows)} matching chunks:")
                for i, row in enumerate(rows):
                    print(f"\n[{i+1}] Source: {row['source_url']}")
                    print(f"Content: {row['content']}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_github_tos()
