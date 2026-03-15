import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_notebook_correlation():
    print("--- Testing Notebook Correlation & Semantic Search ---")
    
    # 1. Clear existing bookmarks (optional, but good for clean test)
    # req = requests.get(f"{BASE_URL}/bookmarks")
    # ...
    
    # 2. Add sample bookmarks
    bookmarks = [
        {
            "content": "The Mistral-7B model uses Grouped-query attention (GQA) for faster inference.",
            "source_url": "https://mistral.ai/news/announcing-mistral-7b/",
            "metadata": {"topic": "AI Architecture"}
        },
        {
            "content": "Sliding Window Attention (SWA) helps handle longer sequences with reduced cache size.",
            "source_url": "https://mistral.ai/news/announcing-mistral-7b/",
            "metadata": {"topic": "AI Architecture"}
        },
        {
            "content": "PostgreSQL pgvector supports halfvec for 2x memory reduction compared to vector.",
            "source_url": "https://github.com/pgvector/pgvector",
            "metadata": {"topic": "Database"}
        }
    ]
    
    print("\n[1] Creating bookmarks with embeddings...")
    for b in bookmarks:
        resp = requests.post(f"{BASE_URL}/bookmarks", json=b)
        print(f"  Created bookmark: {resp.status_code} - {resp.json().get('id')}")
        
    time.sleep(1) # Ensure embeddings are processed
    
    # 3. Query the notebook
    print("\n[2] Querying the notebook specifically (query_notebook=True)...")
    query_payload = {
        "query": "How does Mistral optimize attention and how does pgvector help store it?",
        "query_notebook": True
    }
    
    resp = requests.post(f"{BASE_URL}/chat", json=query_payload)
    if resp.status_code == 200:
        answer = resp.json().get("answer", "")
        print(f"\nAI Response:\n{answer}")
        
        # Check for correlation
        if "Grouped-query attention" in answer and "pgvector" in answer:
            print("\n✅ SUCCESS: AI correlated information from both AI and Database bookmarks!")
        else:
            print("\n❌ FAILED: AI did not correctly correlate the different topics from the notebook.")
    else:
        print(f"\n❌ FAILED: API error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    test_notebook_correlation()
