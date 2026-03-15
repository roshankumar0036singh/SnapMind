import sys
import os
# Add current directory to path so we can import youtube_parser
sys.path.append(os.getcwd())

from youtube_parser import get_youtube_transcript

def verify_robust_parser(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    print(f"--- Verifying parser for: {url} ---")
    
    success, text, error = get_youtube_transcript(url)
    
    if success:
        print(f"SUCCESS! Transcript fetched.")
        print(f"Transcript length: {len(text)} characters")
        print("\nSnippet:")
        print(text[:300] + "...")
    else:
        print(f"FAILED: {error}")

if __name__ == "__main__":
    vid = "UUhJhHbtuA0"
    if len(sys.argv) > 1:
        vid = sys.argv[1]
    verify_robust_parser(vid)
