import json
import traceback
import time
import random
import threading
from typing import List, Dict, Any
import psycopg
from psycopg import errors
from api_clients import get_mistral_client
from database import get_db_pool, db_retry
from config import settings

# Global lock to serialize database writes for the graph (prevents deadlocks between threads)
GRAPH_LOCK = threading.Lock()

def extract_graph_data(text: str, api_keys: dict = None) -> Dict[str, Any]:
    """
    Uses Mistral to extract entities and their relationships from the given text.
    """
    client = get_mistral_client(api_keys)
    if not client:
        return {"nodes": [], "edges": []}

    system_prompt = """You are a knowledge graph extractor. 
Extract entities (nodes) and their relationships (edges) from the provided text.
Nodes should represent people, organizations, concepts, or important objects.
Edges should represent clear, factual relationships (e.g., 'works for', 'located in', 'part of').

Output strictly in JSON format:
{
  "nodes": [{"name": "Name", "type": "Type"}],
  "edges": [{"source": "Node A", "target": "Node B", "relation": "Relationship"}]
}"""

    # Limit text to avoid token limits during extraction
    sample_text = text[:8000]

    try:
        print(f"[GRAPH] Extracting entities from {len(sample_text)} characters...")
        response = client.chat.complete(
            model=settings.models.mistral_large,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Extract the knowledge graph from this text:\n\n{sample_text}"}
            ],
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        return json.loads(content)
        
    except Exception as e:
        print(f"[GRAPH] Extraction error: {e}")
        return {"nodes": [], "edges": []}

@db_retry(max_retries=15, initial_delay=3)
def insert_graph_data(graph_data: Dict[str, Any], source_url: str, session_id: str = None, user_id: str = None, workspace_id: str = None):
    """
    Inserts extracted nodes and edges into the database.
    """
    pool = get_db_pool()
    if not pool:
        return

    try:
        # SERIALIZE: Ensure only one thread is writing to the graph at a time
        with GRAPH_LOCK:
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    node_id_map = {}
                    nodes = graph_data.get("nodes", [])
                    
                    # Sort nodes by name to prevent lock-order deadlocks
                    nodes.sort(key=lambda x: x.get("name", ""))
                    
                    # 1. Insert Nodes
                    for node in nodes:
                        name = node.get("name")
                        etype = node.get("type", "concept")
                        if not name: continue
                        cur.execute(
                            "INSERT INTO nodes (name, entity_type, user_id, workspace_id) VALUES (%s, %s, %s, %s) "
                            "ON CONFLICT (name, user_id, workspace_id) DO UPDATE SET entity_type = EXCLUDED.entity_type RETURNING id",
                            (name, etype, user_id, workspace_id)
                        )
                        node_id = cur.fetchone()[0]
                        node_id_map[name] = node_id
                    
                    # 2. Insert Edges (MUST be inside cursor block)
                    edges = graph_data.get("edges", [])
                    for edge in edges:
                        src_name = edge.get("source")
                        tgt_name = edge.get("target")
                        relation = edge.get("relation") or "related_to"
                        if src_name in node_id_map and tgt_name in node_id_map:
                            cur.execute(
                                "INSERT INTO edges (source_node_id, target_node_id, relation, source_url, session_id, user_id, workspace_id) "
                                "VALUES (%s, %s, %s, %s, %s, %s, %s)",
                                (node_id_map[src_name], node_id_map[tgt_name], relation, source_url, session_id, user_id, workspace_id)
                            )
                    
                conn.commit()
                print(f"[GRAPH] Successfully inserted {len(nodes)} nodes and {len(edges)} edges.")
                print(f"[GRAPH] Finished processing graph data for user {user_id} in session {session_id}.")
    except (errors.DeadlockDetected, psycopg.OperationalError, psycopg.Error) as e:
        # Reraise to trigger @db_retry
        raise e
    except Exception as e:
        print(f"[GRAPH] DB Insert FATAL error: {e}")
        # traceback.print_exc()

def get_graph_context(query: str, api_keys: dict = None, user_id: str = None, workspace_id: str = None) -> str:
    """
    Given a query, finds relevant entities in the graph and returns 
    their relationships as a text block for the LLM.
    """
    client = get_mistral_client(api_keys)
    if not client:
        return ""

    # 1. Extract entities from query
    extract_prompt = f"Identify the primary entities (names, organizations, concepts) in this query: {query}. Return ONLY a comma-separated list."
    try:
        res = client.chat.complete(
            model=settings.models.mistral_large,
            messages=[{"role": "user", "content": extract_prompt}]
        )
        entities = [e.strip() for e in res.choices[0].message.content.split(",") if e.strip()]
        if not entities:
            return ""
        
        print(f"[GRAPH] Searching graph for entities: {entities} (User: {user_id})")
    except:
        return ""

    # 2. Query DB for related edges
    pool = get_db_pool()
    if not pool:
        return ""

    context_lines = []
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                for entity in entities:
                    # Find edges where this entity is source or target, filtered by user_id
                    sql = """
                        SELECT n1.name, e.relation, n2.name
                        FROM edges e
                        JOIN nodes n1 ON e.source_node_id = n1.id
                        JOIN nodes n2 ON e.target_node_id = n2.id
                        WHERE (n1.name ILIKE %s OR n2.name ILIKE %s)
                    """
                    params = [f"%{entity}%", f"%{entity}%"]
                    
                    if user_id:
                        sql += " AND e.user_id = %s"
                        params.append(user_id)
                    
                    if workspace_id:
                        sql += " AND e.workspace_id = %s"
                        params.append(workspace_id)
                    
                    sql += " LIMIT 15"
                    
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    for row in rows:
                        context_lines.append(f"- {row[0]} {row[1]} {row[2]}")
            
        if not context_lines:
            return ""
            
        return "\n### Knowledge Graph Relationships\n" + "\n".join(set(context_lines))
        
    except Exception as e:
        print(f"[GRAPH] Search error: {e}")
        return ""
