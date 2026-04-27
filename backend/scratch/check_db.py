import psycopg
from database import DATABASE_URL

with psycopg.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'hybrid_search_documents'")
        result = cur.fetchone()
        if result:
            print(result[0])
        else:
            print("Function not found")
