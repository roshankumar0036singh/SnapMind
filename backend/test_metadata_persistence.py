import json
from unittest.mock import MagicMock, patch
import sys
import os

# Mock the database and other dependencies before importing rag_pipeline
sys.modules['database'] = MagicMock()
sys.modules['api_clients'] = MagicMock()
sys.modules['config'] = MagicMock()
sys.modules['chunking'] = MagicMock()
sys.modules['custom_crawler'] = MagicMock()
sys.modules['agentic_chunking'] = MagicMock()

# Import the logic to test
import rag_pipeline

@patch('rag_pipeline.requests.post')
@patch('rag_pipeline.parallel_embed_chunks')
@patch('rag_pipeline.db_pool')
def test_ingestion_stores_title(mock_db_pool, mock_embed, mock_post):
    # 1. Mock Firecrawl response with a title
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        'data': {
            'markdown': 'This is a long test content. ' * 20,
            'metadata': {'title': 'Social Summer Of Code'}
        }
    }
    mock_post.return_value = mock_response
    
    # 2. Mock embedding result
    mock_embed.return_value = [
        {"content": "chunk 1", "source_url": "http://test.com", "embedding": [0.1], "metadata": {"title": "Social Summer Of Code"}}
    ]
    
    # 3. Call ingestion
    url = "http://test.com"
    result = rag_pipeline.ingest_website_logic(url)
    
    # 4. Verify parallel_embed_chunks was called with the title
    args, kwargs = mock_embed.call_args
    assert kwargs['page_title'] == 'Social Summer Of Code', f"Expected title 'Social Summer Of Code', got {kwargs.get('page_title')}"
    print("✅ Success: page_title correctly passed to parallel_embed_chunks")

if __name__ == "__main__":
    try:
        test_ingestion_stores_title()
        print("Test passed!")
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
