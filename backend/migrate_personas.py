import os
import sys

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db_pool

def migrate():
    pool = get_db_pool()
    if not pool:
        print("Failed to get database pool")
        return
        
    print("Running migration for personas table...")
    with pool.connection() as conn:
        with conn.cursor() as cur:
            # Add user_id column
            cur.execute("ALTER TABLE personas ADD COLUMN IF NOT EXISTS user_id TEXT;")
            
            # Add workspace_id column
            cur.execute("ALTER TABLE personas ADD COLUMN IF NOT EXISTS workspace_id TEXT;")
            
            # Create index on user_id for faster queries
            cur.execute("CREATE INDEX IF NOT EXISTS idx_personas_user_id ON personas(user_id);")
            
            conn.commit()
            print("Migration successful! Added user_id and workspace_id columns.")

if __name__ == "__main__":
    migrate()
