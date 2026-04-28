import os
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client for auth verification
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
if not supabase_url or not supabase_key:
    print("[SECURITY] WARNING: Supabase credentials missing in env")

supabase: Client = create_client(supabase_url or "", supabase_key or "")

auth_scheme = HTTPBearer()

async def get_current_user(request: Request):
    """
    Validates the Supabase JWT and returns the user object.
    Supports both standard 'Authorization' header and 'x-supabase-auth' 
    to handle cases where the primary header is used by infrastructure proxies (like HF).
    """
    # 1. Try to get token from 'x-supabase-auth' first (Our custom header for proxy cases)
    token_str = request.headers.get("x-supabase-auth")
    
    # 2. Fallback to standard Authorization header
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]

    try:
        # [DEBUG] Log token presence
        if not token_str:
            print("[SECURITY] No authentication token found in x-supabase-auth or Authorization header")
            raise HTTPException(status_code=401, detail="No credentials provided")

        # Verify token with Supabase Auth
        res = supabase.auth.get_user(token_str)
        
        if not res or not res.user:
            print(f"[SECURITY] Invalid token or user not found.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return res.user
    except Exception as e:
        # Check for common Supabase auth errors
        err_msg = str(e)
        print(f"[SECURITY] Auth error: {err_msg}")
        
        if "invalid claim" in err_msg.lower() or "signature" in err_msg.lower():
            detail = "Token signature verification failed. Check SUPABASE_ANON_KEY consistency."
        elif "expired" in err_msg.lower():
            detail = "Authentication token has expired. Please log in again."
        else:
            detail = f"Authentication failed: {err_msg}"

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_user_id(user = Depends(get_current_user)) -> str:
    """Helper dependency to extract only the user_id (UUID) string."""
    return str(user.id)
