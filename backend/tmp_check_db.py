from database import get_db_pool
import json

def check_db():
    try:
        pool = get_db_pool()
        if not pool:
            print("Pool not initialized")
            return
        conn = pool.getconn()
        cur = conn.cursor()

        tables = ['edges', 'nodes', 'chat_sessions']
        for table in tables:
            cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}')")
            exists = cur.fetchone()[0]
            print(f"Table {table} exists: {exists}")
            if exists:
                cur.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
                cols = cur.fetchall()
                print(f"Columns in {table}: {cols}")
        
        pool.putconn(conn)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    check_db()
