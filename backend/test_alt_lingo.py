import requests
import os
import json
from dotenv import load_dotenv

load_dotenv()

def test_alt_endpoint():
    api_key = os.getenv("LINGODEV_API_KEY")
    # Try api.lingo.dev instead of engine.lingo.dev
    url = "https://api.lingo.dev/v1/recognize"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {"text": "Hello world"}
    
    print(f"Testing {url}...")
    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Failed: {e}")

    # Also try the standard engine endpoint but with different headers
    url2 = "https://engine.lingo.dev/recognize"
    print(f"\nTesting {url2} with charset...")
    headers2 = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "application/json"
    }
    try:
        resp = requests.post(url2, headers=headers2, json=payload, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_alt_endpoint()
