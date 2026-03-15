import requests
import time

def test_citations():
    url = "http://127.0.0.1:8000/chat"
    
    # Mock content blocks
    blocks = [
        {"id": "bi-block-0", "text": "Snapmind is a context-aware browser extension."},
        {"id": "bi-block-1", "text": "It uses Gemini Flash 2.5 for reasoning and logic."}
    ]
    
    payload = {
        "query": "What model does the extension use?",
        "content_blocks": blocks
    }
    
    print("Sending request...")
    try:
        res = requests.post(url, json=payload, timeout=20)
        
        if res.status_code == 200:
            answer = res.json()["answer"]
            print(f"Answer: {answer}")
            
            if "[bi-block-1]" in answer:
                print("✅ Success: Citation found!")
                return True
            else:
                print("⚠️ Warning: Answer valid but NO citation found.")
                return False
        else:
            print(f"❌ Error {res.status_code}: {res.text}")
            return False
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

if __name__ == "__main__":
    # Wait a sec for server to startup
    time.sleep(2)
    test_citations()
