from unittest.mock import MagicMock, patch
import sys

# Mock dependencies
sys.modules['youtube_transcript_api'] = MagicMock()
sys.modules['yt_dlp'] = MagicMock()
sys.modules['pytubefix'] = MagicMock()

import youtube_parser

@patch('youtube_parser.yt_dlp.YoutubeDL')
def test_youtube_returns_title(mock_ydl):
    # Setup mock yt-dlp
    instance = mock_ydl.return_value.__enter__.return_value
    instance.extract_info.return_value = {
        'title': 'Test Video Title',
        'requested_subtitles': {
            'en': {'data': 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTest content'}
        }
    }
    
    url = "https://www.youtube.com/watch?v=12345678901"
    success, text, err, title = youtube_parser.get_youtube_transcript(url)
    
    assert success is True
    assert title == 'Test Video Title'
    print(f"✅ Success: YouTube title '{title}' extracted")

if __name__ == "__main__":
    try:
        test_youtube_returns_title()
        print("Test passed!")
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
