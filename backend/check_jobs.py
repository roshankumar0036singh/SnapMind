
import json
from database import get_db_pool
from psycopg.rows import dict_row

def check_jobs():
    pool = get_db_pool()
    if not pool:
        print("Error: Could not get DB pool.")
        return
        
    try:
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT * FROM ingestion_jobs ORDER BY job_id DESC LIMIT 10")
                rows = cur.fetchall()
                for r in rows:
                    print(json.dumps(r, default=str))
    except Exception as e:
        print(f"Error checking jobs: {e}")

if __name__ == "__main__":
    check_jobs()
