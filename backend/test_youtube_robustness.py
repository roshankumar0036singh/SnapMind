import sys
import unittest
from unittest.mock import MagicMock, patch
import os

# Add current directory to path
sys.path.append(os.getcwd())

class TestYouTubeRobustness(unittest.TestCase):
    
    @patch('youtube_transcript_api.YouTubeTranscriptApi.list_transcripts')
    @patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript')
    def test_attr_error_fallback(self, mock_get_transcript, mock_list_transcripts):
        """Test that it falls back to get_transcript if list_transcripts fails"""
        from youtube_parser import get_youtube_transcript
        
        mock_list_transcripts.side_effect = Exception("AttributeError: type object 'YouTubeTranscriptApi' has no attribute 'list_transcripts'")
        mock_get_transcript.return_value = [{'text': 'Hello world', 'start': 0.0}]
        
        success, text, error = get_youtube_transcript("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
        
        self.assertTrue(success)
        self.assertIn("Hello world", text)
        mock_list_transcripts.assert_called_once()
        mock_get_transcript.assert_called_once()
        print("SUCCESS: Attribute error fallback verified.")

    @patch('youtube_transcript_api.YouTubeTranscriptApi.list_transcripts')
    @patch('youtube_transcript_api.YouTubeTranscriptApi.get_transcript')
    @patch('pytubefix.YouTube')
    def test_dns_error_retry(self, mock_pytube, mock_get_transcript, mock_list_transcripts):
        """Test that DNS errors trigger retries with backoff"""
        from youtube_parser import get_youtube_transcript
        
        # Mock DNS error for both first and second method of the first library
        mock_list_transcripts.side_effect = Exception("[Errno -5] No address associated with hostname")
        mock_get_transcript.side_effect = Exception("[Errno -5] No address associated with hostname")
        
        mock_caption = MagicMock()
        mock_caption.code = 'en'
        mock_caption.xml_captions = '<transcript><text start="0">Pytube success</text></transcript>'
        
        mock_yt_instance = MagicMock()
        mock_yt_instance.captions = [mock_caption]
        mock_pytube.return_value = mock_yt_instance
        
        # To avoid actual sleeping in tests
        with patch('time.sleep', return_value=None) as mock_sleep:
            success, text, error = get_youtube_transcript("https://www.youtube.com/watch?v=aqz-KE-bpKQ")
            
            self.assertTrue(success)
            self.assertIn("Pytube success", text)
            # 3 attempts for YT API (1 original + 2 retries)
            self.assertEqual(mock_list_transcripts.call_count, 3)
            self.assertEqual(mock_get_transcript.call_count, 3)
            print("SUCCESS: DNS error retry logic verified.")

if __name__ == "__main__":
    unittest.main()
