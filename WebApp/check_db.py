import psycopg
from psycopg.rows import dict_row

DB_URL = "postgresql://postgres.hscptdibreqxgnlubopc:Roshan%407447464931@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"

def check_types():
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM workspaces LIMIT 1")
            row = cur.fetchone()
            if row:
                print("Row:", row)
                for k, v in row.items():
                    print(f"{k}: {type(v)}")

if __name__ == "__main__":
    check_types()
