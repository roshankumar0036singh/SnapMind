"""
Knowledge Evolution API Module for SnapMind.

Provides endpoints to query the temporal history of indexed content
and perform time-based searches across snapshots.
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from database import get_db_pool

router = APIRouter(prefix="/api/evolution", tags=["evolution"])

@router.get("/timeline/{source_url:path}")
def get_content_timeline(source_url: str) -> List[Dict[str, Any]]:
    """Get the version history (timeline) for a specific URL."""
    pool = get_db_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                # Get all versions, excluding the massive content_snapshot field
                cur.execute("""
                    SELECT id, content_hash, diff_summary, version_number, created_at 
                    FROM content_versions 
                    WHERE source_url = %s 
                    ORDER BY version_number ASC
                """, (source_url,))
                
                rows = cur.fetchall()
                timeline = []
                for row in rows:
                    timeline.append({
                        "id": row[0],
                        "hash": row[1],
                        "diff_summary": row[2],
                        "version": row[3],
                        "timestamp": row[4].isoformat() if row[4] else None
                    })
                return timeline
    except Exception as e:
        print(f"[EVOLUTION] Timeline fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/diff/{version_id}")
def get_diff_snapshot(version_id: int) -> Dict[str, Any]:
    """Get a specific version snapshot and its diff summary."""
    pool = get_db_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT source_url, diff_summary, content_snapshot, created_at 
                    FROM content_versions 
                    WHERE id = %s
                """, (version_id,))
                
                row = cur.fetchone()
                if not row:
                    raise HTTPException(status_code=404, detail="Version not found")
                    
                return {
                    "source_url": row[0],
                    "diff_summary": row[1],
                    "content": row[2],
                    "timestamp": row[3].isoformat() if row[3] else None
                }
    except Exception as e:
        if isinstance(e, HTTPException): raise
        print(f"[EVOLUTION] Diff fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from schemas import ResearchActionItem

@router.post("/research-actions")
def log_research_action(action: ResearchActionItem) -> Dict[str, Any]:
    """Logs a user research action (query, ingest, bookmark, read)."""
    pool = get_db_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        import json
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO research_actions (session_id, action_type, action_data, parent_action_id)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (action.session_id, action.action_type, json.dumps(action.action_data), action.parent_action_id))
                
                new_id = cur.fetchone()[0]
                conn.commit()
                return {"success": True, "action_id": new_id}
    except Exception as e:
        print(f"[EVOLUTION] Action log error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/research-path/{session_id}")
def get_research_path(session_id: str) -> List[Dict[str, Any]]:
    """Gets the hierarchical research path for a session."""
    pool = get_db_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not configured")
        
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, action_type, action_data, parent_action_id, created_at
                    FROM research_actions
                    WHERE session_id = %s
                    ORDER BY created_at ASC
                """, (session_id,))
                
                rows = cur.fetchall()
                path = []
                for row in rows:
                    path.append({
                        "id": row[0],
                        "type": row[1],
                        "data": row[2],
                        "parent_id": row[3],
                        "timestamp": row[4].isoformat() if row[4] else None
                    })
                return path
    except Exception as e:
        print(f"[EVOLUTION] Path fetch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

