try:
    from pytubefix import YouTube
    print("SUCCESS: pytubefix imported successfully.")
    
    # Simple check to see if we can initialize the class
    # Using a common public video ID
    yt = YouTube("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
    print(f"SUCCESS: YouTube object initialized for video: {yt.title}")
    
except ImportError:
    print("ERROR: pytubefix module NOT found.")
except Exception as e:
    print(f"ERROR: An error occurred: {e}")
