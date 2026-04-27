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
