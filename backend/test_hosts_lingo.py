import requests
import os
from dotenv import load_dotenv

load_dotenv()

def test_api_lingo_host():
    api_key = os.getenv("LINGODEV_API_KEY")
    hosts = ["api.lingo.dev", "engine.lingo.dev"]
    endpoints = ["/recognize", "/i18n", "/whoami"]
    
    for host in hosts:
        for end in endpoints:
            url = f"https://{host}{end}"
            print(f"Testing {url}...")
            try:
                # Use a body for recognize/i18n
                if end == "/whoami":
                    resp = requests.post(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=5)
                else:
                    payload = {"text": "test"} if end == "/recognize" else {"data": {"t": "t"}, "locale": {"target": "es"}, "params": {"fast": True}}
                    resp = requests.post(url, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=5)
                
                print(f"  Result: {resp.status_code}")
                if resp.status_code == 200:
                    print(f"  Success! Response: {resp.text[:100]}")
            except Exception as e:
                print(f"  Failed: {e}")

if __name__ == "__main__":
    test_api_lingo_host()
