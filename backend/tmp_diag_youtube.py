import sys
import traceback
import socket

def check_dns(hostname):
    try:
        ip = socket.gethostbyname(hostname)
        print(f"DNS Resolution: {hostname} -> {ip}")
        return True
    except Exception as e:
        print(f"DNS Resolution FAILED for {hostname}: {e}")
        return False

def diagnostic():
    video_id = "UUhJhHbtuA0" # Test video ID
    
    print("--- Environment Info ---")
    print(f"Python version: {sys.version}")
    
    print("\n--- youtube-transcript-api check ---")
    try:
        import youtube_transcript_api
        from youtube_transcript_api import YouTubeTranscriptApi
        print(f"youtube_transcript_api version: {importlib_metadata_version('youtube-transcript-api')}")
        print(f"YouTubeTranscriptApi attributes: {dir(YouTubeTranscriptApi)}")
        
        if hasattr(YouTubeTranscriptApi, 'list_transcripts'):
            print("YouTubeTranscriptApi.list_transcripts found.")
        else:
            print("YouTubeTranscriptApi.list_transcripts NOT found!")
            
    except Exception as e:
        print(f"youtube-transcript-api error: {e}")

    print("\n--- pytubefix check ---")
    try:
        import pytubefix
        from pytubefix import YouTube
        print(f"pytubefix version: {importlib_metadata_version('pytubefix')}")
        
        check_dns("www.youtube.com")
        check_dns("googlevideo.com")
        
    except Exception as e:
        print(f"pytubefix error: {e}")

def importlib_metadata_version(pkg):
    try:
        import importlib.metadata
        return importlib.metadata.version(pkg)
    except:
        return "Unknown"

if __name__ == "__main__":
    diagnostic()
