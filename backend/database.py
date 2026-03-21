import os
import threading
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

_db_pool = None
_pool_lock = threading.Lock()

def get_db_pool():
    global _db_pool
    if _db_pool is not None:
        return _db_pool
        
    with _pool_lock:
        if _db_pool is None:
            try:
                if not DATABASE_URL:
                    print("❌ Missing DATABASE_URL")
                    return None
                
                print("[DATABASE] Creating shared ConnectionPool...")
                def configure_connection(conn):
                    # Register the vector type on all new connections
                    register_vector(conn)
                
                _db_pool = ConnectionPool(
                    DATABASE_URL, 
                    configure=configure_connection,
                    min_size=5,       
                    max_size=50,      
                    max_idle=30,      
                    max_lifetime=1200, # 20 mins
                    check=ConnectionPool.check_connection, 
                    timeout=60.0,     # Extremely patient for parallel bursts
                    kwargs={
                        "prepare_threshold": None,
                        "keepalives": 1,
                        "keepalives_idle": 30,
                        "keepalives_interval": 10,
                        "keepalives_count": 5,
                        "sslmode": "require",
                        "tcp_user_timeout": 60000 
                    }
                )
                print("✅ Database Pool Initialized Successfully")
            except Exception as e:
                print(f"❌ Database Pool Failed to Initialize: {e}")
                import traceback
                traceback.print_exc()
    
    return _db_pool
