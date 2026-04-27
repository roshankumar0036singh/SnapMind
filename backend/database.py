import os
import threading
import time
import random
from pgvector.psycopg import register_vector
from psycopg_pool import ConnectionPool
import psycopg
from psycopg import errors
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

_db_pool = None
_pool_lock = threading.Lock()

def db_retry(max_retries=15, initial_delay=3): # Consistency across backend
    def decorator(func):
        def wrapper(*args, **kwargs):
            delay = initial_delay
            for i in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (errors.DeadlockDetected, psycopg.OperationalError, psycopg.Error) as e:
                    print(f"[DB_RETRY] Database error: {type(e).__name__} - {str(e)}")
                    if i == max_retries - 1:
                        raise e
                    sleep_time = (delay * (i + 1)) + random.uniform(0.5, 1.5)
                    print(f"[DB_RETRY] Recovering connection... Sleep {sleep_time:.2f}s (Attempt {i+1}/{max_retries})...")
                    time.sleep(sleep_time)
                except Exception as e:
                    raise e
        return wrapper
    return decorator

def get_db_pool():
    global _db_pool
    if _db_pool is not None:
        return _db_pool
        
    with _pool_lock:
        if _db_pool is None:
            try:
                if not DATABASE_URL:
                    print("[DB] Missing DATABASE_URL")
                    return None
                
                print("[DATABASE] Creating shared ConnectionPool...")
                def configure_connection(conn):
                    # Register the vector type on all new connections
                    register_vector(conn)
                    # [FIX] Increase statement timeout to 60s to prevent QueryCanceled during indexing
                    with conn.cursor() as cur:
                        cur.execute("SET statement_timeout = '60s'")
                    conn.commit() # [FIX] Prevent 'INTRANS' status error in pool
                
                # Check if we are running in local desktop mode
                is_local = "localhost" in DATABASE_URL or "127.0.0.1" in DATABASE_URL
                
                kwargs_dict = {
                    "prepare_threshold": None,
                    "keepalives": 1,
                    "keepalives_idle": 20,
                    "keepalives_interval": 5,
                    "keepalives_count": 3,
                    "tcp_user_timeout": 60000,
                    "connect_timeout": 20
                }
                
                if not is_local:
                    kwargs_dict["sslmode"] = "require"
                
                _db_pool = ConnectionPool(
                    DATABASE_URL, 
                    configure=configure_connection,
                    min_size=2 if is_local else 5,       
                    max_size=10 if is_local else 50,      
                    max_idle=5 if is_local else 10,
                    max_lifetime=300 if is_local else 60, 
                    check=ConnectionPool.check_connection, 
                    timeout=60.0,     
                    kwargs=kwargs_dict
                )
                logger_info = f"[DB] Pool Initialized: min={_db_pool.min_size}, max={_db_pool.max_size}, mode={'Local' if is_local else 'Cloud'}"
                print(logger_info)
            except Exception as e:
                print(f"[DB] Database Pool Failed to Initialize: {e}")
                import traceback
                traceback.print_exc()
    
    return _db_pool
