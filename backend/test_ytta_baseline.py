from youtube_transcript_api import YouTubeTranscriptApi

def test_ytta():
    video_id = "_uQrJ0TkZlc"
    try:
        print(f"Testing youtube-transcript-api for: {video_id}")
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        print("Success!")
        print(f"Snippet: {transcript[0]}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_ytta()
