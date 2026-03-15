
import os
from database import get_db_pool

def check_session_ids():
    pool = get_db_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            # Check edges
            cur.execute("SELECT COUNT(*), COUNT(session_id) FROM edges")
            total_edges, edges_with_session = cur.fetchone()
            print(f"Edges: Total={total_edges}, With Session={edges_with_session}")
            
            if edges_with_session > 0:
                cur.execute("SELECT DISTINCT session_id FROM edges WHERE session_id IS NOT NULL")
                sessions = [r[0] for r in cur.fetchall()]
                print(f"Distinct Sessions in Edges: {sessions}")

            # Check nodes (though schema shows session_id is on edges mostly)
            cur.execute("SELECT COUNT(*) FROM nodes")
            total_nodes = cur.fetchone()[0]
            print(f"Nodes: Total={total_nodes}")
            
            # Check recent edges
            cur.execute("SELECT id, source_node_id, target_node_id, session_id FROM edges ORDER BY id DESC LIMIT 5")
            recent_edges = cur.fetchall()
            print("\nRecent Edges:")
            for e in recent_edges:
                print(f"ID: {e[0]}, Source: {e[1]}, Target: {e[2]}, Session: {e[3]}")

if __name__ == "__main__":
    check_session_ids()
