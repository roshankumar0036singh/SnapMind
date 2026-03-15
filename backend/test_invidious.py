from youtube_parser import get_invidious_transcript

def test_invidious():
    video_id = "UUhJhHbtuA0"
    print(f"Testing Invidious fallback for: {video_id}")
    success, text, err = get_invidious_transcript(video_id)
    print(f"Success: {success}")
    if success:
        print("Transcript snippet:")
        print(text[:500])
    else:
        print(f"Error: {err}")

if __name__ == "__main__":
    test_invidious()
