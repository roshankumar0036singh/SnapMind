"""
Test script to verify URL filtering is working correctly.
Run this after indexing a page to check if filtering works.
"""
import asyncio
from search import get_relevant_context

async def test_url_filtering():
    print("=" * 80)
    print("URL FILTERING VERIFICATION TEST")
    print("=" * 80)
    
    # Test 1: Query with specific URL filter
    test_url = "https://example.com"  # Replace with your indexed URL
    test_query = "test query"
    
    print(f"\n📝 Test Query: '{test_query}'")
    print(f"🔍 Filtering by URL: {test_url}")
    print("\n" + "-" * 80)
    
    context = get_relevant_context(test_query, match_threshold=0.3, site_id=test_url)
    
    print("\n" + "-" * 80)
    if context:
        print(f"✅ Got context ({len(context)} chars)")
        print("\nFirst 200 chars of context:")
        print(context[:200] + "...")
    else:
        print("❌ No context retrieved")
        print("\nPossible reasons:")
        print("1. Page not indexed yet")
        print("2. URL mismatch (check normalization)")
        print("3. Query doesn't match indexed content")
    
    print("\n" + "=" * 80)
    print("Check the logs above for [DEBUG] messages showing:")
    print("  - Normalized URL")
    print("  - Number of matches found")
    print("  - Source URL of each match")
    print("  - Any URL mismatch warnings")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(test_url_filtering())
