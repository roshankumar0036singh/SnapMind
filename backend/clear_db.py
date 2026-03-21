import os
import psycopg
from dotenv import load_dotenv

# load the database url from the environment variables
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

sql_file_path = "clear_db.sql"

def clear_database():
    if not DATABASE_URL:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return

    try:
        # connect to the database and execute the sql script
        with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
            print(f"Opening {sql_file_path}...")
            with open(sql_file_path, 'r') as f:
                sql = f.read()
                print("Executing truncate commands...")
                conn.execute(sql)
            print("✅ Successfully cleared all Snapmind data from Supabase.")
    except Exception as e:
        print(f"❌ Error clearing database: {e}")

if __name__ == "__main__":
    confirm = input("Are you sure you want to clear all data from the database? (y/N): ")
    if confirm.lower() == 'y':
        clear_database()
    else:
        print("Operation cancelled.")
