import os
import json
import psycopg
from datetime import datetime
from database import get_db_pool

def export_data(output_path: str) -> dict:
    """
    Exports the entire SnapMind knowledge base (documents, bookmarks, sessions) to a JSON file.
    """
    pool = get_db_pool()
    if not pool:
        return {"success": False, "error": "No database connection"}
    
    export_payload = {
        "metadata": {
            "version": "1.0",
            "exported_at": datetime.now().isoformat(),
            "app": "SnapMind Desktop"
        },
        "documents": [],
        "bookmarks": [],
        "chat_sessions": []
    }
    
    try:
        with pool.connection() as conn:
            # We want dictionaries back
            from psycopg.rows import dict_row
            with conn.cursor(row_factory=dict_row) as cur:
                print("[EXPORT] Fetching documents...")
                cur.execute("SELECT content, source_url, metadata, embedding FROM documents")
                export_payload["documents"] = cur.fetchall()
                # Convert pgvector (likely a list or array) to clean JSON list
                for doc in export_payload["documents"]:
                    if doc.get("embedding") is not None:
                        # Ensure it's a list for JSON serialization
                        try:
                            doc["embedding"] = list(doc["embedding"])
                        except:
                            pass
                
                print("[EXPORT] Fetching bookmarks...")
                cur.execute("SELECT content, source_url, metadata FROM bookmarks")
                export_payload["bookmarks"] = cur.fetchall()
                
                print("[EXPORT] Fetching chat sessions...")
                cur.execute("SELECT id, title, model, messages, created_at FROM chat_sessions")
                export_payload["chat_sessions"] = cur.fetchall()
                
        print(f"[EXPORT] Writing to {output_path}...")
        with open(output_path, 'w', encoding='utf-8') as f:
            # use default=str to handle datetime objects
            json.dump(export_payload, f, indent=2, default=str)
            
        return {
            "success": True, 
            "path": output_path, 
            "counts": {
                "documents": len(export_payload["documents"]),
                "bookmarks": len(export_payload["bookmarks"]),
                "sessions": len(export_payload["chat_sessions"])
            }
        }
    except Exception as e:
        print(f"[EXPORT] Error: {e}")
        return {"success": False, "error": str(e)}

def import_data(file_path: str) -> dict:
    """
    Imports knowledge base data from a SnapMind JSON export.
    """
    pool = get_db_pool()
    if not pool:
        return {"success": False, "error": "No database connection"}
    
    try:
        print(f"[IMPORT] Reading {file_path}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # 1. Documents
                docs = data.get("documents", [])
                print(f"[IMPORT] Syncing {len(docs)} documents...")
                for doc in docs:
                    cur.execute(
                        "INSERT INTO documents (content, source_url, metadata, embedding) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING",
                        (doc["content"], doc["source_url"], json.dumps(doc["metadata"]), doc["embedding"])
                    )
                
                # 2. Bookmarks
                bookmarks = data.get("bookmarks", [])
                print(f"[IMPORT] Syncing {len(bookmarks)} bookmarks...")
                for b in bookmarks:
                    cur.execute(
                        "INSERT INTO bookmarks (content, source_url, metadata) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                        (b["content"], b["source_url"], json.dumps(b["metadata"]))
                    )
                    
                # 3. Chat Sessions
                sessions = data.get("chat_sessions", [])
                print(f"[IMPORT] Syncing {len(sessions)} chat sessions...")
                for s in sessions:
                    # In some old exports messages might be strings, ensure they are JSONB compatible
                    msgs = s["messages"]
                    if isinstance(msgs, str):
                        msgs = json.loads(msgs)
                        
                    cur.execute(
                        "INSERT INTO chat_sessions (id, title, model, messages, created_at) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING",
                        (s["id"], s["title"], s["model"], json.dumps(msgs), s["created_at"])
                    )
                    
            conn.commit()
        return {"success": True, "message": "Import completed successfully."}
    except Exception as e:
        print(f"[IMPORT] Error: {e}")
        return {"success": False, "error": str(e)}
