import os
from database import get_db_pool
from dotenv import load_dotenv

load_dotenv()

def check_session(session_id):
    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            # Check documents
            cur.execute(
                "SELECT count(*) FROM documents WHERE metadata->>'session_id' = %s",
                (session_id,)
            )
            doc_count = cur.fetchone()[0]
            
            # Check bookmarks
            cur.execute(
                "SELECT count(*) FROM bookmarks WHERE metadata->>'session_id' = %s",
                (session_id,)
            )
            bm_count = cur.fetchone()[0]
            
            # Check all sessions in documents for a sample
            cur.execute(
                "SELECT DISTINCT(metadata->>'session_id') FROM documents LIMIT 5"
            )
            sessions = [s[0] for s in cur.fetchall()]
            
            print(f"\nSession ID: {session_id}")
            print(f"Document count: {doc_count}")
            print(f"Bookmark count: {bm_count}")
            print(f"Available sessions (sample): {sessions}")

if __name__ == "__main__":
    check_session("session-1773673322817")
