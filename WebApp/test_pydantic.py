from pydantic import BaseModel
import uuid
from typing import Any, Dict

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: Any
    metadata: Dict[str, Any]

WorkspaceResponse(
    id=uuid.uuid4(),
    name="test",
    owner_id=uuid.uuid4(),
    created_at="2024",
    metadata={}
)
