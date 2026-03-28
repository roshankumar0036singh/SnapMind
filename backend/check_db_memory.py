
import os
from database import get_db_pool
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()

def check_memory():
    pool = get_db_pool()
    if not pool:
        print("Could not connect to database")
        return

    with pool.connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            # Check total count
            cur.execute("SELECT COUNT(*) FROM chat_messages")
            count = cur.fetchone()["count"]
            print(f"Total messages in chat_messages: {count}")

            # Check recent sessions
            cur.execute("SELECT session_id, COUNT(*) as msg_count FROM chat_messages GROUP BY session_id ORDER BY MAX(created_at) DESC LIMIT 5")
            sessions = cur.fetchall()
            print("\nRecent Sessions:")
            for s in sessions:
                print(f"Session: {s['session_id']} | Messages: {s['msg_count']}")

            # Check content of latest session
            if sessions:
                latest_sid = sessions[0]['session_id']
                print(f"\nLatest session ({latest_sid}) content:")
                cur.execute("SELECT role, content, created_at FROM chat_messages WHERE session_id = %s ORDER BY created_at ASC", (latest_sid,))
                msgs = cur.fetchall()
                for m in msgs:
                    print(f"[{m['created_at']}] {m['role']}: {m['content'][:50]}...")

if __name__ == "__main__":
    check_memory()
