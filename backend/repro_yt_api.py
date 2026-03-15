from youtube_transcript_api import YouTubeTranscriptApi
import sys

print(f"Python version: {sys.version}")
print(f"YouTubeTranscriptApi: {YouTubeTranscriptApi}")
print(f"Attributes: {dir(YouTubeTranscriptApi)}")

try:
    video_id = "UUhJhHbtuA0"
    print(f"Attempting list_transcripts for {video_id}...")
    ts = YouTubeTranscriptApi.list_transcripts(video_id)
    print("Success: list_transcripts")
except Exception as e:
    print(f"Error: {e}")

try:
    print(f"Attempting get_transcript for {video_id}...")
    data = YouTubeTranscriptApi.get_transcript(video_id)
    print("Success: get_transcript")
except Exception as e:
    print(f"Error: {e}")
