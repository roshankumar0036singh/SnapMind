import requests
import json

def debug_innertube():
    video_id = "a1MZNCAxbUQ"
    url = "https://www.youtube.com/youtubei/v1/player"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
    payload = {
        "videoId": video_id,
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240313.00.00",
                "hl": "en",
            }
        }
    }
    
    resp = requests.post(url, headers=headers, json=payload).json()
    print("Captions in response:")
    print(json.dumps(resp.get("captions"), indent=2))
    
    # Save full response for analysis if needed
    with open("player_debug.json", "w") as f:
        json.dump(resp, f, indent=2)

if __name__ == "__main__":
    debug_innertube()
