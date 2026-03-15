import os
import psycopg
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

files = ["database_migration_phase2.sql", "database_migration_phase3.sql"]

try:
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        for f in files:
            print(f"Applying {f}...")
            with open(f, 'r') as sql_file:
                sql = sql_file.read()
                conn.execute(sql)
            print(f"Successfully applied {f}")
except Exception as e:
    print(f"Error applying SQL: {e}")
