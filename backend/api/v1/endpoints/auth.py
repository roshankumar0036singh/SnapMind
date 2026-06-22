import os
import secrets
import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from security import get_current_user, get_user_id
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Use the service role key for API key validation (bypasses RLS)
_service_url = os.getenv("SUPABASE_URL")
_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
service_supabase: Client | None = None
if _service_url and _service_key:
    service_supabase = create_client(_service_url, _service_key)


class GenerateKeyRequest(BaseModel):
    name: str = "Default"


def hash_api_key(key: str) -> str:
    """SHA-256 hash of the API key for secure storage."""
    return hashlib.sha256(key.encode()).hexdigest()


@router.post("/generate-key")
async def generate_api_key(body: GenerateKeyRequest, user_id: str = Depends(get_user_id)):
    """
    Generate a new personal API key for MCP / CLI authentication.
    Returns the plaintext key ONCE — it cannot be retrieved again.
    """
    if not service_supabase:
        raise HTTPException(status_code=500, detail="Service role key not configured. Cannot create API keys.")
    
    # Generate a secure random key with a recognizable prefix
    raw_key = f"snp_{secrets.token_urlsafe(32)}"
    key_hash = hash_api_key(raw_key)
    key_prefix = raw_key[:12] + "..."
    
    try:
        result = service_supabase.table("user_api_keys").insert({
            "user_id": user_id,
            "key_hash": key_hash,
            "key_prefix": key_prefix,
            "name": body.name
        }).execute()
        
        return {
            "success": True,
            "key": raw_key,  # Only returned ONCE
            "key_id": result.data[0]["id"],
            "prefix": key_prefix,
            "name": body.name,
            "message": "Save this key now. You will not be able to see it again."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create API key: {str(e)}")


@router.get("/keys")
async def list_api_keys(user_id: str = Depends(get_user_id)):
    """
    List all API keys for the current user.
    Returns metadata only (prefix, name, dates) — never the full key.
    """
    if not service_supabase:
        raise HTTPException(status_code=500, detail="Service role key not configured.")
    
    try:
        result = service_supabase.table("user_api_keys") \
            .select("id, key_prefix, name, created_at, last_used_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()
        
        return {"success": True, "keys": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list API keys: {str(e)}")


@router.delete("/keys/{key_id}")
async def revoke_api_key(key_id: str, user_id: str = Depends(get_user_id)):
    """
    Revoke (permanently delete) an API key.
    """
    if not service_supabase:
        raise HTTPException(status_code=500, detail="Service role key not configured.")
    
    try:
        result = service_supabase.table("user_api_keys") \
            .delete() \
            .eq("id", key_id) \
            .eq("user_id", user_id) \
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="API key not found or already revoked.")
        
        return {"success": True, "message": "API key revoked successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to revoke API key: {str(e)}")


def validate_api_key(api_key: str) -> str | None:
    """
    Validate an incoming API key and return the user_id if valid.
    Uses the service role client to bypass RLS.
    Returns None if invalid.
    """
    if not service_supabase or not api_key:
        return None
    
    try:
        key_hash = hash_api_key(api_key)
        result = service_supabase.table("user_api_keys") \
            .select("user_id") \
            .eq("key_hash", key_hash) \
            .limit(1) \
            .execute()
        
        if result.data and len(result.data) > 0:
            user_id = result.data[0]["user_id"]
            
            # Update last_used_at in the background (fire and forget)
            try:
                service_supabase.table("user_api_keys") \
                    .update({"last_used_at": datetime.now(timezone.utc).isoformat()}) \
                    .eq("key_hash", key_hash) \
                    .execute()
            except Exception:
                pass  # Non-critical, don't fail the request
            
            return user_id
        
        return None
    except Exception as e:
        print(f"[AUTH] API key validation error: {e}")
        return None
