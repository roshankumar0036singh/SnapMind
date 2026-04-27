from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from repositories.workspace_repository import WorkspaceRepository
from security import get_user_id
from pydantic import BaseModel

router = APIRouter()
repo = WorkspaceRepository()

class WorkspaceCreate(BaseModel):
    name: str
    metadata: Dict[str, Any] = {}

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: Any
    metadata: Dict[str, Any]

@router.post("/", response_model=WorkspaceResponse)
async def create_workspace(data: WorkspaceCreate, user_id: str = Depends(get_user_id)):
    """Create a new workspace for the current user."""
    try:
        ws_id = repo.create(data.name, user_id, data.metadata)
        ws = repo.get_by_id(ws_id)
        if not ws:
            raise HTTPException(status_code=500, detail="Failed to retrieve created workspace")
        return ws
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[WorkspaceResponse])
async def list_workspaces(user_id: str = Depends(get_user_id)):
    """List all workspaces owned by the current user."""
    return repo.get_by_owner(user_id)

@router.get("/{workspace_id}", response_model=WorkspaceResponse)
async def get_workspace(workspace_id: str, user_id: str = Depends(get_user_id)):
    """Get details of a specific workspace."""
    ws = repo.get_by_id(workspace_id)
    if not ws or str(ws['owner_id']) != user_id:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws

@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, user_id: str = Depends(get_user_id)):
    """Delete a workspace (only if owned by the user)."""
    success = repo.delete(workspace_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workspace not found or not owned by you")
    return {"message": "Workspace deleted successfully"}
