from database import get_db_pool
pool = get_db_pool()
with pool.connection() as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chat_sessions'")
        for row in cur.fetchall():
            print(row)
