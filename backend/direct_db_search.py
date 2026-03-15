
import psycopg
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def search_content():
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # 0. Search for the specific User ID from the screenshot
                print("--- Searching for User ID: 4298556 ---")
                cur.execute("SELECT id, source_url, content FROM documents WHERE content LIKE '%4298556%'")
                found = cur.fetchall()
                for r in found:
                    print(f"ID: {r[0]}, URL: {r[1]}")
                    print(f"Content: {r[2][:300]}...\n")

                # 1. Search for "Roshan Ranjit Singh" to see where it comes from
                print("--- Searching for 'Roshan Ranjit Singh' ---")
                cur.execute("SELECT id, source_url, content FROM documents WHERE content ILIKE '%Roshan Ranjit Singh%'")
                found = cur.fetchall()
                print(f"Found {len(found)} matches for 'Roshan Ranjit Singh'")
                for r in found:
                    print(f"ID: {r[0]}, URL: {r[1]}")
                    print(f"Content Sample: {r[2][:500]}...\n")
                
                # 2. Check total document count and source diversity
                print("--- Source URL Summary ---")
                cur.execute("SELECT source_url, count(*) as cnt FROM documents GROUP BY source_url ORDER BY cnt DESC LIMIT 20")
                sources = cur.fetchall()
                for s in sources:
                    print(f"{s[1]} docs: {s[0]}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    search_content()
