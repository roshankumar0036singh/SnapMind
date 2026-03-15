import os
from dotenv import load_dotenv
from database import get_db_pool

load_dotenv()

def check_graph():
    pool = get_db_pool()
    if not pool:
        print("Failed to connect to database")
        return

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM nodes")
                node_count = cur.fetchone()[0]
                
                cur.execute("SELECT COUNT(*) FROM edges")
                edge_count = cur.fetchone()[0]
                
                print(f"Nodes: {node_count}")
                print(f"Edges: {edge_count}")
                
                if node_count > 0:
                    cur.execute("SELECT * FROM nodes LIMIT 5")
                    print("\nSample Nodes:")
                    for row in cur.fetchall():
                        print(row)
                        
                if edge_count > 0:
                    cur.execute("SELECT * FROM edges LIMIT 5")
                    print("\nSample Edges:")
                    for row in cur.fetchall():
                        print(row)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_graph()
