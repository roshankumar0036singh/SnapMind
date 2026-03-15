import os
import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

def dump_chat_history():
    if not DATABASE_URL:
        print("❌ Missing DATABASE_URL")
        return

    try:
        with psycopg.connect(DATABASE_URL) as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT session_id, role, content, created_at FROM chat_sessions ORDER BY created_at DESC LIMIT 20")
                rows = cur.fetchall()
                print("Recent Chat History:")
                for row in rows:
                    print(f"[{row['created_at']}] {row['session_id']} - {row['role']}: {row['content'][:100]}...")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    dump_chat_history()
