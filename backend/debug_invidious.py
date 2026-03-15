import requests
import json

def debug_invidious():
    video_id = "UUhJhHbtuA0"
    instance = "https://yewtu.be"
    try:
        api_url = f"{instance}/api/v1/captions/{video_id}"
        print(f"Checking {api_url}")
        resp = requests.get(api_url, timeout=10)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print("Captions data:")
            print(json.dumps(data, indent=2))
        else:
            print(f"Response: {resp.text[:500]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_invidious()
