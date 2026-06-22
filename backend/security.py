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
    source = "x-supabase-auth"
    
    # 2. Fallback to standard Authorization header
    if not token_str:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            potential_token = auth_header.split(" ")[1]
            # [CRITICAL] If this is a Hugging Face token (starts with hf_), SKIP IT.
            # It's an infrastructure token and NOT a user token.
            if potential_token.startswith("hf_"):
                print("[SECURITY] Found hf_ token in Authorization header, skipping to avoid malformed JWT error.")
            else:
                token_str = potential_token
                source = "Authorization"

    try:
        # [DEBUG] Log token presence
        if not token_str:
            # --- MCP SERVER BYPASS ---
            # The MCP Server doesn't have a JWT, but it sends LLM API keys.
            if request.headers.get("x-gemini-key") or request.headers.get("x-mistral-key") or request.headers.get("x-firecrawl-key"):
                print("[SECURITY] MCP Server detected via API Keys. Resolving default user_id...")
                try:
                    mcp_user_id = os.getenv("DEFAULT_USER_ID")
                    
                    if not mcp_user_id:
                        mcp_user_id = "00000000-0000-0000-0000-000000000000" # Fallback Nil UUID
                        # Try to dynamically grab the real user_id from various tables
                        for table in ["documents", "saved_pages", "bookmarks", "chat_sessions"]:
                            try:
                                res = supabase.table(table).select("user_id").not_is("user_id", "null").limit(1).execute()
                                if res.data and len(res.data) > 0:
                                    mcp_user_id = res.data[0]["user_id"]
                                    break
                            except Exception:
                                pass
                                
                    print(f"[SECURITY] Bypassing auth. Assigned MCP to user_id: {mcp_user_id}")
                    class MockUser:
                        id = mcp_user_id
                    return MockUser()
                except Exception as e:
                    print(f"[SECURITY] Critical failure in MCP bypass: {e}")

            print(f"[SECURITY] No valid authentication token found. Headers present: {list(request.headers.keys())}")
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
