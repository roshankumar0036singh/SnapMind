import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def check_db():
    if not DATABASE_URL:
        print("❌ Missing DATABASE_URL")
        return

    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                # 1. Count total docs
                cur.execute("SELECT count(*) FROM documents")
                count = cur.fetchone()[0]
                print(f"Total documents: {count}")

                # 2. List unique source URLs
                cur.execute("SELECT source_url, count(*) FROM documents GROUP BY source_url ORDER BY count(*) DESC LIMIT 20")
                urls = cur.fetchall()
                print("\nTop 20 Source URLs:")
                for url, cnt in urls:
                    print(f" - {url}: {cnt} chunks")
                
                # 3. Check for specific site
                target = "https://huggingface.co/spaces/roshan123478/SnapMind-Backend/tree/main"
                cur.execute("SELECT count(*) FROM documents WHERE source_url = %s", (target,))
                site_count = cur.fetchone()[0]
                print(f"\nChunks for {target}: {site_count}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_db()
