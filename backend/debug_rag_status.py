
import json
from database import get_db_pool
from psycopg.rows import dict_row

def check_documents():
    pool = get_db_pool()
    if not pool:
        print("Error: Could not get DB pool.")
        return
        
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Total count
                cur.execute("SELECT count(*) FROM documents")
                total = cur.fetchone()['count']
                print(f"Total documents: {total}")
                
                # Count by source_url pattern (Github)
                cur.execute("SELECT count(*) FROM documents WHERE source_url LIKE '%%github.com%%'")
                github_count = cur.fetchone()['count']
                print(f"Github documents: {github_count}")
                
                # Last 5 github documents
                cur.execute("SELECT id, source_url, content FROM documents WHERE source_url LIKE '%%github.com%%' ORDER BY id DESC LIMIT 5")
                rows = cur.fetchall()
                print("\nLast 5 Github documents:")
                for r in rows:
                    print(f"ID: {r['id']}, URL: {r['source_url']}")
                    print(f"Content: {r['content'][:100]}...\n")
                    
                # Recent jobs
                cur.execute("SELECT * FROM ingestion_jobs ORDER BY job_id DESC LIMIT 5")
                jobs = cur.fetchall()
                print("\nRecent ingestion jobs:")
                for j in jobs:
                    print(json.dumps(j, default=str))
                    
    except Exception as e:
        print(f"Error checking documents: {e}")

if __name__ == "__main__":
    check_documents()
