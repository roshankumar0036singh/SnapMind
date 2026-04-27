from fastapi import APIRouter
from fastapi import APIRouter, HTTPException, Depends
from repositories.document_repository import DocumentRepository
from security import get_user_id

router = APIRouter()
repo = DocumentRepository()

@router.get("")
def get_all_tags_endpoint(user_id: str = Depends(get_user_id)):
    """
    Retrieve unique semantic tags across all user workspaces (Global View).
    """
    try:
        tags = repo.get_all_tags(user_id=user_id, limit=100)
        return {"success": True, "tags": tags}
    except Exception as e:
        print(f"Error fetching global tags: {e}")
        return {"success": False, "tags": [], "error": str(e)}


@router.get("/{workspace_id}")
def get_tags_endpoint(workspace_id: str, user_id: str = Depends(get_user_id)):
    """
    Retrieve all unique semantic tags currently stored in the database for a specific workspace.
    """
    try:
        tags = repo.get_all_tags(workspace_id=workspace_id, user_id=user_id, limit=100)
        return {"success": True, "tags": tags}
    except Exception as e:
        print(f"Error fetching tags: {e}")
        return {"success": False, "tags": [], "error": str(e)}
