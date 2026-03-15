from pytubefix import YouTube

def test_pytubefix():
    video_id = "_uQrJ0TkZlc"
    try:
        print(f"Testing pytubefix for: {video_id}")
        yt = YouTube(f"https://www.youtube.com/watch?v={video_id}")
        print(f"Title: {yt.title}")
        captions = list(yt.captions)
        print(f"Captions found: {[c.code for c in captions]}")
        if captions:
            print("Success!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_pytubefix()
