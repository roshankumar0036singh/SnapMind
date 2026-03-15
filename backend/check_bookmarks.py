from database import get_db_pool
import json

def check_bookmarks():
    pool = get_db_pool()
    if not pool:
        print("No pool")
        return
        
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM bookmarks")
            count = cur.fetchone()[0]
            print(f"Total bookmarks: {count}")
            
            if count > 0:
                cur.execute("SELECT id, content FROM bookmarks LIMIT 5")
                rows = cur.fetchall()
                for r in rows:
                    print(f"Bookmark {r[0]}: {r[1][:50]}...")

if __name__ == "__main__":
    check_bookmarks()
