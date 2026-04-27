import asyncio
import uuid
import json
from repositories.document_repository import DocumentRepository
from services.search_service import SearchService
from models.dtos import SearchRequestDTO, IngestRequestDTO
from database import get_db_pool

async def verify_isolation():
    repo = DocumentRepository()
    svc = SearchService()
    
    user_id = str(uuid.uuid4())
    ws_a = str(uuid.uuid4())
    ws_b = str(uuid.uuid4())
    
    print(f"--- VERIFYING ISOLATION (User: {user_id}) ---", flush=True)
    
    # 1. Setup Workspaces
    from repositories.workspace_repository import WorkspaceRepository
    ws_repo = WorkspaceRepository()
    ws_repo.create("Alpha", user_id, metadata={"id": ws_a}) # Using ID directly might need repo update or just using returned ID
    # Actually, ws_repo.create generates its own ID. I'll use that.
    ws_a = ws_repo.create("Alpha", user_id)
    ws_b = ws_repo.create("Beta", user_id)
    
    print(f"[TEST] Created Workspace A ({ws_a}) and Workspace B ({ws_b})", flush=True)

    # 2. Insert into Workspace A
    doc_a = {
        "id": str(uuid.uuid4()),
        "content": "SECRET KEY FOR WORKSPACE ALPHA",
        "source_url": "https://alpha.com",
        "embedding": [0.1] * 3072,
        "metadata": {"session_id": "sess_a"},
        "user_id": user_id,
        "workspace_id": ws_a
    }
    repo.bulk_insert([doc_a])
    print("[TEST] Inserted secret into Workspace A", flush=True)
    
    # 2. Search from Workspace B
    print("[TEST] Searching from Workspace B (Should find nothing)...", flush=True)
    req_b = SearchRequestDTO(
        query="SECRET KEY",
        user_id=user_id,
        workspace_id=ws_b
    )
    res_b = await svc.chat(req_b, api_keys={})
    
    if any("ALPHA" in s.content for s in res_b.sources):
        print("!!! FAILURE: Data leaked into Workspace B !!!")
    else:
        print("[OK] SUCCESS: Isolation maintained for Workspace B")
        
    # 3. Search from Workspace A
    print("[TEST] Searching from Workspace A (Should find secret)...")
    req_a = SearchRequestDTO(
        query="SECRET KEY",
        user_id=user_id,
        workspace_id=ws_a
    )
    res_a = await svc.chat(req_a, api_keys={})
    if any("ALPHA" in s.content for s in res_a.sources):
        print("✅ SUCCESS: Data found in its own workspace")
    else:
        print("!!! FAILURE: Data missing in Workspace A !!!")

if __name__ == "__main__":
    asyncio.run(verify_isolation())
