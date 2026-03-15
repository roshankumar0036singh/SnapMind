import json
from youtube_parser import get_innertube_transcript, get_embedded_transcript

def test_new_methods():
    video_id = "_uQrJ0TkZlc"
    print(f"Testing new methods for: {video_id}\n")
    
    print("--- Testing Raw InnerTube ---")
    success, text, err = get_innertube_transcript(video_id)
    print(f"Success: {success}")
    if success:
        print(f"Transcript Snippet (Innertube): {text[:200]}...")
    else:
        print(f"Error (Innertube): {err}")
        
    print("\n--- Testing Embedded Player Scraping ---")
    success, text, err = get_embedded_transcript(video_id)
    print(f"Success: {success}")
    if success:
        print(f"Transcript Snippet (Embed): {text[:200]}...")
    else:
        print(f"Error (Embed): {err}")

if __name__ == "__main__":
    test_new_methods()
