import asyncio
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

# We'll test the tool logic directly (since stdio is hard to test without a full client)
# But we'll use the same calls the server would make.

BACKEND_URL = os.environ.get("SNAPMIND_BACKEND_URL", "https://roshan123478-snapmind-backend.hf.space").rstrip("/")
HF_TOKEN = os.environ.get("HF_TOKEN", "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")

async def test_backend_connectivity():
    print(f"🔍 Testing connectivity to {BACKEND_URL}...")
    headers = {"Authorization": f"Bearer {HF_TOKEN}" if HF_TOKEN else ""}
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # 1. Test Root/Manifest
            resp = await client.get(f"{BACKEND_URL}/mcp/manifest", headers=headers)
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                print("✅ Backend Manifest reached!")
                print(resp.json())
            else:
                print(f"❌ Failed to reach manifest: {resp.text[:200]}")
            
            # 2. Test Analytics
            resp = await client.get(f"{BACKEND_URL}/admin/analytics", headers=headers)
            if resp.status_code == 200:
                print("✅ Analytics Tool reached!")
                print(f"Docs: {resp.json().get('docs')}")
            else:
                print(f"❌ Analytics failed: {resp.text[:200]}")
                
            # 3. Test Search (Global)
            resp = await client.post(f"{BACKEND_URL}/search/global", json={"query": "test", "limit": 1}, headers=headers)
            if resp.status_code == 200:
                print("✅ Search Tool reached!")
            else:
                print(f"❌ Search failed: {resp.text[:200]}")

        except Exception as e:
            print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(test_backend_connectivity())
