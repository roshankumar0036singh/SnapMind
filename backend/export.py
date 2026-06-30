"""
Export utilities for downloading indexed content.
"""
from typing import Dict, Any, List
from database import get_db_pool


def export_site_json(source_url: str, user_id: str = None) -> Dict[str, Any]:
    """
    Export all documents for a given source URL as JSON, filtered by user.
    
    Args:
        source_url: The source URL to export
        user_id: string UUID of the user
        
    Returns:
        Dictionary with success status and data
    """
    try:
        # Query all documents for this URL
        db_pool = get_db_pool()
        from psycopg.rows import dict_row
        
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                if user_id:
                    cur.execute("SELECT id, content, source_url, embedding::text, metadata, created_at::text FROM documents WHERE source_url = %s AND user_id = %s ORDER BY created_at", (source_url, user_id))
                else:
                    cur.execute("SELECT id, content, source_url, embedding::text, metadata, created_at::text FROM documents WHERE source_url = %s ORDER BY created_at", (source_url,))
                documents = cur.fetchall()
        
        return {
            "success": True,
            "source_url": source_url,
            "total_documents": len(documents),
            "documents": documents,
            "export_format": "json"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def export_site_text(source_url: str, user_id: str = None) -> str:
    """
    Export all documents for a given source URL as plain text, filtered by user.
    
    Args:
        source_url: The source URL to export
        user_id: string UUID of the user
        
    Returns:
        Formatted text string
    """
    try:
        # Query all documents for this URL
        db_pool = get_db_pool()
        from psycopg.rows import dict_row
        
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                if user_id:
                    cur.execute("SELECT content, created_at::text FROM documents WHERE source_url = %s AND user_id = %s ORDER BY created_at", (source_url, user_id))
                else:
                    cur.execute("SELECT content, created_at::text FROM documents WHERE source_url = %s ORDER BY created_at", (source_url,))
                documents = cur.fetchall()
        
        # Format as text
        lines = [
            f"Export from: {source_url}",
            f"Total chunks: {len(documents)}",
            f"Generated: {documents[0]['created_at'] if documents else 'N/A'}",
            "=" * 80,
            ""
        ]
        
        for idx, doc in enumerate(documents, 1):
            lines.append(f"--- Chunk {idx} ---")
            lines.append(doc.get('content', ''))
            lines.append("")
        
        return "\n".join(lines)
    except Exception as e:
        return f"Export failed: {str(e)}"

import re
import json

def export_session_data(session_id: str, format_type: str = "json", user_id: str = None) -> Any:
    """
    Export all data (chat history, graph edges, and cited source documents) for a given session.
    Supports formats: 'json', 'markdown', 'csv'
    """
    try:
        db_pool = get_db_pool()
        from psycopg.rows import dict_row
        
        # 1. Fetch Chat History
        with db_pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT id, title, created_at::text, messages FROM chat_sessions WHERE id = %s",
                    (session_id,)
                )
                session_row = cur.fetchone()
                
        chat_history = []
        if session_row and session_row.get('messages'):
            messages = session_row['messages']
            if isinstance(messages, str):
                messages = json.loads(messages)
            
            # Format messages as chat_history to match the downstream expected structure
            for idx, msg in enumerate(messages):
                chat_history.append({
                    "id": f"{session_id}-{idx}",
                    "role": msg.get("role", "unknown"),
                    "content": msg.get("text", msg.get("content", "")),
                    "created_at": session_row["created_at"] # We only have session-level timestamp
                })
                
        # 2 & 3. Extract Citations directly from the messages array
        source_documents = []
        seen_cit_ids = set()
        
        if session_row and session_row.get('messages'):
            messages_list = session_row['messages']
            if isinstance(messages_list, str):
                messages_list = json.loads(messages_list)
                
            for msg in messages_list:
                if msg.get('role') == 'assistant' and 'citations' in msg:
                    for cit in msg['citations']:
                        # Avoid duplicates
                        cit_id = cit.get('blockId', str(len(seen_cit_ids)))
                        if cit_id not in seen_cit_ids:
                            seen_cit_ids.add(cit_id)
                            source_documents.append({
                                "id": cit_id,
                                "source_url": cit.get('url', ''),
                                "content": cit.get('snippet', 'No snippet available'),
                                "metadata": {"label": cit.get('label', 'Source')}
                            })
                    
        # 4. Fetch Graph Data
        graph_edges = []
        try:
            with db_pool.connection() as conn:
                with conn.cursor(row_factory=dict_row) as cur:
                    cur.execute(
                        "SELECT source_node_id as source, relation, target_node_id as target, source_url, created_at::text FROM edges WHERE session_id = %s ORDER BY created_at",
                        (session_id,)
                    )
                    graph_edges = cur.fetchall()
        except Exception as e:
            print(f"[EXPORT] Failed to fetch graph edges: {str(e)}")
            # Graph might not be set up or no session_id in edges
            pass
            
        # Format Output
        if format_type == "markdown":
            lines = [
                f"# Session Export: {session_id}",
                f"Generated from SnapMind\n",
                "## Chat History\n"
            ]
            for msg in chat_history:
                role = "User" if msg['role'] == 'user' else "SnapMind"
                lines.append(f"**{role}** ({msg['created_at']}):\n{msg['content']}\n")
                
            lines.append("## Graph Relations Discovered\n")
            if graph_edges:
                lines.append("| Source | Relation | Target |")
                lines.append("|---|---|---|")
                for edge in graph_edges:
                    lines.append(f"| {edge['source']} | {edge['relation']} | {edge['target']} |")
                lines.append("\n")
            else:
                lines.append("*No graph edges found for this session.*\n")
                
            lines.append("## Cited Source Documents\n")
            if source_documents:
                for doc in source_documents:
                    lines.append(f"### Document ID: {doc['id']}")
                    lines.append(f"**Source URL:** {doc['source_url']}")
                    lines.append(f"**Extracted Text:**\n```\n{doc['content']}\n```\n")
            else:
                lines.append("*No documents cited in this session.*\n")
                
            return {
                "success": True,
                "content": "\n".join(lines),
                "export_format": "markdown",
                "filename": f"session_{session_id}.md"
            }
            
        elif format_type == "csv":
            import io
            import csv
            import zipfile
            
            # Create a zip file containing 3 CSVs
            memory_file = io.BytesIO()
            with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
                # Chat History CSV
                chat_io = io.StringIO()
                if chat_history:
                    writer = csv.DictWriter(chat_io, fieldnames=["id", "role", "content", "created_at"])
                    writer.writeheader()
                    writer.writerows(chat_history)
                zf.writestr("chat_history.csv", chat_io.getvalue())
                
                # Documents CSV
                docs_io = io.StringIO()
                if source_documents:
                    # Clean metadata for CSV
                    for d in source_documents:
                        if isinstance(d.get('metadata'), dict):
                            d['metadata'] = json.dumps(d['metadata'])
                    writer = csv.DictWriter(docs_io, fieldnames=["id", "content", "source_url", "metadata", "created_at"])
                    writer.writeheader()
                    writer.writerows(source_documents)
                zf.writestr("source_documents.csv", docs_io.getvalue())
                
                # Edges CSV
                edges_io = io.StringIO()
                if graph_edges:
                    writer = csv.DictWriter(edges_io, fieldnames=["source", "relation", "target", "source_url", "created_at"])
                    writer.writeheader()
                    writer.writerows(graph_edges)
                zf.writestr("graph_edges.csv", edges_io.getvalue())
                
            memory_file.seek(0)
            return {
                "success": True,
                "content": memory_file.read(),
                "export_format": "csv",
                "filename": f"session_{session_id}.zip"
            }
            
        else: # Default to JSON
            return {
                "success": True,
                "session_id": session_id,
                "export_format": "json",
                "chat_history": chat_history,
                "source_documents": source_documents,
                "graph_edges": graph_edges,
                "filename": f"session_{session_id}.json"
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

