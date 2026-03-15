import requests
import base64
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    print(f"Testing Health ({BASE_URL}/)...", end=" ")
    try:
        r = requests.get(f"{BASE_URL}/")
        if r.status_code == 200:
            print("✅ OK")
            return True
        else:
            print(f"❌ Failed: {r.status_code}")
            return False
    except Exception as e:
        print(f"❌ Connection Error: {e}")
        return False

def test_chat():
    print("Testing Chat RAG (/chat)...", end=" ")
    try:
        payload = {"query": "Hello, are you online?", "page_content": "This is a test page."}
        r = requests.post(f"{BASE_URL}/chat", json=payload)
        if r.status_code == 200:
            print("✅ OK")
            print(f"   Response: {r.json()['answer'][:50]}...")
            return True
        else:
            print(f"❌ Failed: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_vision():
    print("Testing Vision (/analyze-image)...", end=" ")
    # 1x1 white pixel base64
    dummy_image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
    try:
        payload = {"image_data": dummy_image, "prompt": "What color is this?"}
        r = requests.post(f"{BASE_URL}/analyze-image", json=payload)
        if r.status_code == 200:
            print("✅ OK")
            print(f"   Response: {r.json()['answer']}")
            return True
        else:
            print(f"❌ Failed: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    if not test_health():
        print("\n⚠️ Backend is NOT running. Please run 'uvicorn main:app --reload'")
        sys.exit(1)
        
    print("-" * 20)
    test_chat()
    test_vision()
    print("-" * 20)
    print("Verification Complete.")
