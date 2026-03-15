import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

f = "graph_migration.sql"

try:
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        print(f"Applying {f}...")
        with open(f, 'r') as sql_file:
            sql = sql_file.read()
            conn.execute(sql)
        print(f"Successfully applied {f}")
except Exception as e:
    print(f"Error applying SQL: {e}")
