from youtube_parser import get_youtube_transcript
import sys

url = "https://www.youtube.com/watch?v=UUhJhHbtuA0"
if len(sys.argv) > 1:
    url = sys.argv[1]

print(f"Testing URL: {url}")
success, content, error = get_youtube_transcript(url)

if success:
    print("SUCCESS!")
    print(f"Content length: {len(content)}")
    print("First 200 chars:")
    print(content[:200])
else:
    print("FAILED!")
    print(f"Error: {error}")
