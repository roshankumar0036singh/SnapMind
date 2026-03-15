import requests
import json

def test_innertube_variations():
    video_id = "a1MZNCAxbUQ"
    url = "https://www.youtube.com/youtubei/v1/player"
    
    clients = [
        {"clientName": "IOS", "clientVersion": "19.05.36", "osName": "iOS", "osVersion": "17.4.1", "deviceModel": "iPhone16,2"},
        {"clientName": "ANDROID", "clientVersion": "19.05.36", "androidSdkVersion": 34},
        {"clientName": "TVHTML5", "clientVersion": "7.20240313.00.00"},
    ]
    
    for client in clients:
        print(f"\n--- Testing Client: {client['clientName']} ---")
        payload = {
            "videoId": video_id,
            "context": {
                "client": client
            }
        }
        headers = {"Content-Type": "application/json"}
        try:
            resp = requests.post(url, json=payload, timeout=10).json()
            status = resp.get("playabilityStatus", {}).get("status")
            print(f"Status: {status}")
            if status == "OK":
                captions = resp.get("captions")
                if captions:
                    print("SUCCESS: Captions found!")
                    break
                else:
                    print("No captions in response.")
            else:
                reason = resp.get("playabilityStatus", {}).get("reason")
                print(f"Reason: {reason}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_innertube_variations()
