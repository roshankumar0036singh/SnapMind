import sys
from youtube_transcript_api import YouTubeTranscriptApi
from pytubefix import YouTube
import traceback

def reproduce():
    video_id = "aqz-KE-bpKQ" # Known video ID
    
    print("--- Testing youtube-transcript-api ---")
    try:
        print(f"Type of YouTubeTranscriptApi: {type(YouTubeTranscriptApi)}")
        print(f"Has list_transcripts: {hasattr(YouTubeTranscriptApi, 'list_transcripts')}")
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        print("Successfully called list_transcripts")
    except Exception as e:
        print(f"youtube-transcript-api failed: {e}")
        traceback.print_exc()

    print("\n--- Testing pytubefix ---")
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        print(f"Attempting to initialize YouTube for: {url}")
        yt = YouTube(
            url,
            use_oauth=False,
            allow_oauth_cache=False
        )
        print(f"Initialized YouTube. Title: {yt.title}")
        print("Attempting to access captions...")
        captions = list(yt.captions)
        print(f"Found {len(captions)} captions.")
    except Exception as e:
        print(f"pytubefix failed: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    reproduce()
