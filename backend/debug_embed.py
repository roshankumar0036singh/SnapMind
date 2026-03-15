import requests
import re

def debug_embed():
    video_id = "a1MZNCAxbUQ"
    url = f"https://www.youtube.com/embed/{video_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
    resp = requests.get(url, headers=headers).text
    print(f"Source length: {len(resp)}")
    
    # Look for common markers
    markers = ["ytInitialPlayerResponse", "captions", "captionTracks", "playerCaptionsTracklistRenderer"]
    for marker in markers:
        print(f"Marker '{marker}': {'Found' if marker in resp else 'Not Found'}")
        
    with open("embed_debug.html", "w", encoding="utf-8") as f:
        f.write(resp)

if __name__ == "__main__":
    debug_embed()
