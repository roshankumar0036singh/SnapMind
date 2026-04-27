from fastapi import APIRouter, HTTPException
from schemas import PersonaRequest

router = APIRouter()


@router.get("")
def get_personas_endpoint():
    try:
        from database import get_db_pool
        from psycopg.rows import dict_row
        pool = get_db_pool()
        if not pool: return {"success": False, "personas": []}
        with pool.connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, name, system_prompt_addon FROM personas ORDER BY created_at ASC")
                rows = cur.fetchall()
                for r in rows: r['id'] = str(r['id'])
        return {"success": True, "personas": rows}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("")
def create_persona_endpoint(request: PersonaRequest):
    try:
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO personas (name, system_prompt_addon) VALUES (%s, %s) RETURNING id",
                    (request.name, request.system_prompt_addon)
                )
                pid = cur.fetchone()[0]
                conn.commit()
        return {"success": True, "id": str(pid)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.delete("/{persona_id}")
def delete_persona_endpoint(persona_id: str):
    try:
        from database import get_db_pool
        pool = get_db_pool()
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM personas WHERE id = %s", (persona_id,))
                conn.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

# [LOGGING] Standardized production logs for personas endpoint
