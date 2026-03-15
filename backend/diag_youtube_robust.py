import sys
import traceback

def test_youtube_transcript_api(video_id):
    print(f"\n--- Testing youtube-transcript-api for: {video_id} ---")
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        print(f"SUCCESS: Fetched {len(transcript)} transcript entries.")
        # Print first entry
        if transcript:
            print(f"Sample: {transcript[0]}")
        return True
    except Exception as e:
        print(f"ERROR: youtube-transcript-api failed: {e}")
        return False

def test_pytubefix(video_id):
    print(f"\n--- Testing pytubefix for: {video_id} ---")
    try:
        from pytubefix import YouTube
        url = f"https://www.youtube.com/watch?v={video_id}"
        yt = YouTube(url, use_oauth=False, allow_oauth_cache=False)
        print(f"SUCCESS: Initialized YouTube object for: {yt.title}")
        print(f"Captions: {list(yt.captions.keys())}")
        return True
    except Exception as e:
        print(f"ERROR: pytubefix failed: {e}")
        return False

if __name__ == "__main__":
    vid = "UUhJhHbtuA0"
    if len(sys.argv) > 1:
        vid = sys.argv[1]
    
    yt_api_res = test_youtube_transcript_api(vid)
    pytube_res = test_pytubefix(vid)
    
    print("\n--- Summary ---")
    print(f"youtube-transcript-api: {'OK' if yt_api_res else 'FAILED'}")
    print(f"pytubefix:              {'OK' if pytube_res else 'FAILED'}")
