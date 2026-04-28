from fastapi import APIRouter, Depends
from typing import List, Dict
from config import settings
from security import get_user_id

router = APIRouter()

@router.get("/keys")
async def check_api_keys(user_id: str = Depends(get_user_id)):
    """
    Checks if the backend has the necessary API keys configured.
    Returns a list of missing keys to help the frontend prompt the user.
    """
    missing = settings.get_missing_keys()
    is_fully_ready = len(missing) == 0
    
    return {
        "is_configured": is_fully_ready,
        "missing_keys": missing,
        "recommendation": "Please ensure all keys are set in the Extension ." if not is_fully_ready else "All systems go!"
    }

@router.get("/version")
async def get_version():
    return {"version": "2.0.0", "build": "production-hardened"}
