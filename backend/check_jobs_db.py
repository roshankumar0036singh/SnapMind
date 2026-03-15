import os
from dotenv import load_dotenv
load_dotenv()
from database import get_db_pool

def check_table():
    pool = get_db_pool()
    if not pool:
        print("Could not connect to database pool")
        return
        
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ingestion_jobs');")
                exists = cur.fetchone()[0]
                print(f"Table 'ingestion_jobs' exists: {exists}")
                
                if exists:
                    cur.execute("SELECT COUNT(*) FROM ingestion_jobs")
                    count = cur.fetchone()[0]
                    print(f"Number of rows in 'ingestion_jobs': {count}")
                    
                    if count > 0:
                        cur.execute("SELECT job_id, status, url FROM ingestion_jobs ORDER BY job_id DESC LIMIT 5")
                        print("Latest jobs:")
                        for row in cur.fetchall():
                            print(row)
    except Exception as e:
        print(f"Error checking table: {e}")

if __name__ == "__main__":
    check_table()
