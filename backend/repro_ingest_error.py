from rag_pipeline import ingest_file_logic, ingest_multipage_logic
import unittest
from unittest.mock import MagicMock, patch

class TestIngestSignatures(unittest.TestCase):
    @patch('rag_pipeline.ingest_text_logic')
    def test_ingest_file_logic_signature(self, mock_ingest_text):
        # We don't need to actually run the logic, just check if it accepts the arguments
        mock_ingest_text.return_value = {"success": True}
        
        try:
            # Call with all expected arguments including session_id
            ingest_file_logic(
                source_url="http://test.com",
                file_bytes=b"test content",
                filename="test.txt",
                content_type="text/plain",
                target_lang="es",
                api_keys={},
                session_id="test-session-id"
            )
            print("ingest_file_logic accepts session_id: SUCCESS")
        except TypeError as e:
            self.fail(f"ingest_file_logic failed with TypeError: {e}")

    @patch('rag_pipeline.crawl_website_firecrawl')
    @patch('rag_pipeline.db_pool')
    def test_ingest_multipage_logic_signature(self, mock_db_pool, mock_crawl):
        mock_crawl.return_value = []
        
        try:
            # Call with session_id
            ingest_multipage_logic(
                url="http://test.com",
                max_pages=5,
                max_depth=2,
                api_keys={},
                session_id="test-session-id"
            )
            print("ingest_multipage_logic accepts session_id: SUCCESS")
        except TypeError as e:
            self.fail(f"ingest_multipage_logic failed with TypeError: {e}")

if __name__ == "__main__":
    unittest.main()
