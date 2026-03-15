import sys
import traceback

def test_pytubefix_diagnostics(video_id):
    try:
        from pytubefix import YouTube
        print(f"--- pytubefix Version: ---")
        import importlib.metadata
        try:
            print(importlib.metadata.version("pytubefix"))
        except:
            print("Unknown")

        url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"\nAttempting to initialize YouTube for: {url}")
        
        yt = YouTube(url, use_oauth=False, allow_oauth_cache=False)
        print("Initialization successful.")
        
        print("\nAttempting to access video title...")
        print(f"Title: {yt.title}")
        
        print("\nAttempting to access captions...")
        print(f"Captions available: {list(yt.captions.keys())}")
        
        for lang in ['en', 'a.en']:
            if lang in yt.captions:
                print(f"Found {lang} captions.")
                # We won't actually fetch the XML here to avoid too much network wait
                break
                
    except Exception as e:
        print("\n--- ERROR CAUGHT ---")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    vid = "UUhJhHbtuA0"
    if len(sys.argv) > 1:
        vid = sys.argv[1]
    test_pytubefix_diagnostics(vid)
