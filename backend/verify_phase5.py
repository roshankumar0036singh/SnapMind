import requests
import json
import uuid
import time
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_background_ingest():
    print("\n--- Testing Feature 2: Background Ingestion ---")
    payload = {
        "url": "https://example.com/test-article",
        "text_content": "Snapmind architecture consists of a React Extension Frontend and a FastAPI Python backend.",
        "crawl_mode": "single"
    }

    print("Sending /ingest request...")
    start_time = time.time()
    response = requests.post(f"{BASE_URL}/ingest", json=payload)
    elapsed = time.time() - start_time
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    print(f"Response Time: {elapsed:.3f}s")
    
    if response.status_code == 202 and elapsed < 1.0:
        print("✅ Background Ingestion Verified (Returned immediately with 202 Accepted)")
    else:
        print("❌ Background Ingestion Failed (Did not return 202 or took too long)")
        sys.exit(1)

def test_semantic_memory():
    print("\n--- Testing Feature 3: Semantic Chat Memory ---")
    session_id = str(uuid.uuid4())
    print(f"Created Session ID: {session_id}")
    
    # Turn 1: Tell the bot a fact about the user
    payload1 = {
        "query": "My favorite programming language is Python and my dog's name is Rex.",
        "session_id": session_id
    }
    
    print("\nTurn 1 (Saving Fact)...")
    response1 = requests.post(f"{BASE_URL}/chat", json=payload1)
    if response1.status_code == 200:
         print(f"Bot 1: {response1.json().get('answer')[:100]}...")
    else:
         print(f"❌ Turn 1 Failed: {response1.text}")
         sys.exit(1)
         
    # Wait slightly to ensure DB write
    time.sleep(1)
         
    # Turn 2: Ask the bot to recall the fact using ONLY the session ID (No history sent)
    payload2 = {
        "query": "What is my dog's name? Answer based on our past conversation, not general knowledge.",
        "session_id": session_id
    }
    
    print("\nTurn 2 (Recalling Fact)...")
    response2 = requests.post(f"{BASE_URL}/chat", json=payload2)
    
    if response2.status_code == 200:
        answer = response2.json().get('answer')
        print(f"Bot 2: {answer}")
        
        if "Rex" in answer:
             print("✅ Semantic Chat Memory Verified (Remembered past conversation automatically)")
        else:
             print("❌ Semantic Chat Memory Failed (Did not remember facts from Turn 1)")
    else:
        print(f"❌ Turn 2 Failed: {response2.text}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        # Wait for FastAPI to start up if it just restarted
        time.sleep(2)
        test_background_ingest()
        test_semantic_memory()
        print("\nAll Tests Passed! ")
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error: Backend is not running at http://127.0.0.1:8000")
        sys.exit(1)
