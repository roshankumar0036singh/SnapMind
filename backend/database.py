import os
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Global variables for the pool
_db_pool = None

def get_db_pool():
    global _db_pool
    if _db_pool is None:
        try:
            if not DATABASE_URL:
                print("❌ Missing DATABASE_URL")
                return None
            
            def configure_connection(conn):
                # Register the vector type on all new connections
                register_vector(conn)
            
            _db_pool = ConnectionPool(
                DATABASE_URL, 
                configure=configure_connection,
                min_size=10,
                max_size=30,
                timeout=15.0,
                kwargs={"prepare_threshold": None}
            )
            print("✅ Database Pool Initialized Successfully")
        except Exception as e:
            print(f"❌ Database Pool Failed to Initialize: {e}")
            import traceback
            traceback.print_exc()
    
    return _db_pool
