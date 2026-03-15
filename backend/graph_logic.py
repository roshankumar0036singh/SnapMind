import json
import traceback
from typing import List, Dict, Any
from api_clients import get_mistral_client
from database import get_db_pool

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
            model="mistral-large-latest",
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

def insert_graph_data(graph_data: Dict[str, Any], source_url: str, session_id: str = None):
    """
    Inserts extracted nodes and edges into the database.
    """
    pool = get_db_pool()
    if not pool:
        return

    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Insert Nodes and get their IDs
                node_id_map = {}
                for node in graph_data.get("nodes", []):
                    name = node.get("name")
                    etype = node.get("type", "concept")
                    if not name: continue
                    
                    # upsert node
                    cur.execute(
                        """
                        INSERT INTO nodes (name, entity_type) 
                        VALUES (%s, %s) 
                        ON CONFLICT (name) DO UPDATE SET entity_type = EXCLUDED.entity_type
                        RETURNING id
                        """,
                        (name, etype)
                    )
                    node_id = cur.fetchone()[0]
                    node_id_map[name] = node_id
                
                # 2. Insert Edges
                for edge in graph_data.get("edges", []):
                    src_name = edge.get("source")
                    tgt_name = edge.get("target")
                    relation = edge.get("relation") or "related_to"
                    
                    if src_name in node_id_map and tgt_name in node_id_map:
                        src_id = node_id_map[src_name]
                        tgt_id = node_id_map[tgt_name]
                        
                        cur.execute(
                            """
                            INSERT INTO edges (source_node_id, target_node_id, relation, source_url, session_id)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (src_id, tgt_id, relation, source_url, session_id)
                        )
            conn.commit()
            print(f"[GRAPH] Successfully inserted {len(graph_data.get('nodes', []))} nodes and {len(graph_data.get('edges', []))} edges (Session: {session_id}).")
            
    except Exception as e:
        print(f"[GRAPH] DB Insert error: {e}")
        traceback.print_exc()

def get_graph_context(query: str, api_keys: dict = None) -> str:
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
            model="mistral-large-latest",
            messages=[{"role": "user", "content": extract_prompt}]
        )
        entities = [e.strip() for e in res.choices[0].message.content.split(",") if e.strip()]
        if not entities:
            return ""
        
        print(f"[GRAPH] Searching graph for entities: {entities}")
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
                    # Find edges where this entity is source or target
                    cur.execute(
                        """
                        SELECT n1.name, e.relation, n2.name
                        FROM edges e
                        JOIN nodes n1 ON e.source_node_id = n1.id
                        JOIN nodes n2 ON e.target_node_id = n2.id
                        WHERE n1.name ILIKE %s OR n2.name ILIKE %s
                        LIMIT 10
                        """,
                        (f"%{entity}%", f"%{entity}%")
                    )
                    rows = cur.fetchall()
                    for row in rows:
                        context_lines.append(f"- {row[0]} {row[1]} {row[2]}")
            
        if not context_lines:
            return ""
            
        return "\n### Knowledge Graph Relationships\n" + "\n".join(set(context_lines))
        
    except Exception as e:
        print(f"[GRAPH] Search error: {e}")
        return ""
