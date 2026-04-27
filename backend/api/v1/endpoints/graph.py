from fastapi import APIRouter, HTTPException, Depends
from security import get_user_id

router = APIRouter()


@router.get("/sessions")
async def get_graph_sessions(user_id: str = Depends(get_user_id)):
    """Returns a list of chat sessions that have associated graph data."""
    try:
        from psycopg.rows import dict_row
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT e.session_id, 
                           (SELECT content FROM chat_messages WHERE session_id = e.session_id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as title,
                           COUNT(e.id) as edge_count,
                           (SELECT COUNT(DISTINCT nid) FROM (SELECT source_node_id as nid FROM edges WHERE session_id = e.session_id UNION SELECT target_node_id as nid FROM edges WHERE session_id = e.session_id) as n) as node_count
                    FROM edges e
                    WHERE e.session_id IS NOT NULL AND e.user_id = %s
                    GROUP BY e.session_id
                    ORDER BY e.session_id DESC
                """, (user_id,))
                return cur.fetchall()
    except Exception as e:
        print(f"[GRAPH API] Error fetching sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session_graph(session_id: str, user_id: str = Depends(get_user_id)):
    """Returns nodes and edges filtered by session_id and user_id."""
    try:
        from psycopg.rows import dict_row
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT e.source_node_id, e.target_node_id, e.relation, n1.name as source_name, n2.name as target_name, n1.entity_type as source_type, n2.entity_type as target_type
                    FROM edges e
                    JOIN nodes n1 ON e.source_node_id = n1.id
                    JOIN nodes n2 ON e.target_node_id = n2.id
                    WHERE e.session_id = %s AND e.user_id = %s
                """, (session_id, user_id))
                edges = cur.fetchall()
                
                cy_nodes = {}
                cy_edges = []
                
                for row in edges:
                    if row["source_node_id"] not in cy_nodes:
                        cy_nodes[row["source_node_id"]] = {
                            "data": {
                                "id": str(row["source_node_id"]),
                                "label": row["source_name"],
                                "type": row["source_type"]
                            }
                        }
                    if row["target_node_id"] not in cy_nodes:
                        cy_nodes[row["target_node_id"]] = {
                            "data": {
                                "id": str(row["target_node_id"]),
                                "label": row["target_name"],
                                "type": row["target_type"]
                            }
                        }
                    cy_edges.append({
                        "data": {
                            "source": str(row["source_node_id"]),
                            "target": str(row["target_node_id"]),
                            "label": row["relation"]
                        }
                    })
                
                return {
                    "success": True,
                    "nodes": list(cy_nodes.values()),
                    "edges": cy_edges
                }
    except Exception as e:
        print(f"[GRAPH API] Error fetching session graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data")
def get_graph_data(user_id: str = Depends(get_user_id)):
    """Returns the full knowledge graph (nodes and edges) for visualization."""
    try:
        from psycopg.rows import dict_row
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # [FIX] Filter by user_id to enforce data isolation
                cur.execute("SELECT id, name, entity_type, metadata FROM nodes WHERE user_id = %s", (user_id,))
                nodes = cur.fetchall()
                
                cur.execute("SELECT id, source_node_id, target_node_id, relation, source_url FROM edges WHERE user_id = %s", (user_id,))
                edges_db = cur.fetchall()
                
                # Filter nodes to only include nodes that have edges
                edge_node_ids = set([e["source_node_id"] for e in edges_db] + [e["target_node_id"] for e in edges_db])
                
                cy_nodes = [
                    {
                        "data": {
                            "id": str(n["id"]),
                            "label": n["name"],
                            "type": n["entity_type"]
                        }
                    }
                    for n in nodes if n["id"] in edge_node_ids
                ]
                
                cy_edges = [
                    {
                        "data": {
                            "source": str(e["source_node_id"]),
                            "target": str(e["target_node_id"]),
                            "label": e["relation"]
                        }
                    }
                    for e in edges_db
                ]

                return {
                    "success": True,
                    "nodes": cy_nodes,
                    "edges": cy_edges
                }
    except Exception as e:
        print(f"[GRAPH API] Error fetching global graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# [LOGGING] Standardized production logs for graph endpoint
