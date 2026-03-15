import requests
import json

BASE_URL = "http://127.0.0.1:8000"

def test_bookmarks():
    print("Testing Citation Bookmarking APIs...")
    
    # 1. Create a bookmark
    payload = {
        "content": "This is a test research snippet.",
        "source_url": "https://example.com/research",
        "metadata": {"tags": ["test", "verification"]}
    }
    resp = requests.post(f"{BASE_URL}/bookmarks", json=payload)
    print(f"POST /bookmarks: {resp.status_code}")
    print(resp.json())
    assert resp.status_code == 200
    bookmark_id = resp.json()["id"]
    
    # 2. Get all bookmarks
    resp = requests.get(f"{BASE_URL}/bookmarks")
    print(f"GET /bookmarks: {resp.status_code}")
    bookmarks = resp.json()["bookmarks"]
    print(f"Count: {len(bookmarks)}")
    assert any(b["id"] == bookmark_id for b in bookmarks)
    
    # 3. Delete the bookmark
    resp = requests.delete(f"{BASE_URL}/bookmarks/{bookmark_id}")
    print(f"DELETE /bookmarks/{bookmark_id}: {resp.status_code}")
    assert resp.status_code == 200
    
    # 4. Verify deletion
    resp = requests.get(f"{BASE_URL}/bookmarks")
    bookmarks = resp.json()["bookmarks"]
    assert not any(b["id"] == bookmark_id for b in bookmarks)
    
    print("✅ All bookmark API tests passed!")

if __name__ == "__main__":
    test_bookmarks()
