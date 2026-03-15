import requests
import httpx
import os
import json
import time
from dotenv import load_dotenv

load_dotenv()

def test_lingo_variants():
    api_key = os.getenv("LINGODEV_API_KEY")
    url = "https://engine.lingo.dev/recognize"
    payload = {"text": "Guten Morgen"}
    
    # Variant 1: requests (standard)
    print("\n--- [1] Testing with requests (JSON) ---")
    try:
        start = time.time()
        r = requests.post(url, 
                         headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                         json=payload, 
                         timeout=10)
        print(f"Status: {r.status_code}, Time: {time.time()-start:.2f}s")
        print(f"Body: {r.text}")
    except Exception as e:
        print(f"Failed: {e}")

    # Variant 2: httpx (HTTP/1.1)
    print("\n--- [2] Testing with httpx (HTTP/1.1) ---")
    try:
        with httpx.Client(http2=False) as client:
            start = time.time()
            r = client.post(url, 
                           headers={"Authorization": f"Bearer {api_key}"},
                           json=payload,
                           timeout=10)
            print(f"Status: {r.status_code}, Time: {time.time()-start:.2f}s")
            print(f"Body: {r.text}")
    except Exception as e:
        print(f"Failed: {e}")

    # Variant 3: httpx (HTTP2)
    print("\n--- [3] Testing with httpx (HTTP2) ---")
    try:
        with httpx.Client(http2=True) as client:
            start = time.time()
            r = client.post(url, 
                           headers={"Authorization": f"Bearer {api_key}"},
                           json=payload,
                           timeout=10)
            print(f"Status: {r.status_code}, Time: {time.time()-start:.2f}s")
            print(f"Body: {r.text}")
    except Exception as e:
        print(f"Failed: {e}")

    # Variant 4: WhoAmI comparison
    print("\n--- [4] Testing WhoAmI (Should work) ---")
    try:
        r = requests.post("https://engine.lingo.dev/whoami", 
                         headers={"Authorization": f"Bearer {api_key}"},
                         timeout=10)
        print(f"Status: {r.status_code}")
        print(f"Body: {r.text}")
    except Exception as e:
        print(f"Failed: {e}")

if __name__ == "__main__":
    test_lingo_variants()
