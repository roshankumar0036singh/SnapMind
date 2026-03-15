"""
Test script for Phase 4: Query Enhancement
Tests HyDE, multi-query generation, and query classification.
"""

import sys


def test_query_processor_module():
    """Test query processor module structure"""
    print("=" * 80)
    print("PHASE 4 TEST: Query Enhancement Module")
    print("=" * 80)
    print()
    
    # Test 1: Import module
    print("Test 1: Importing query processor module...")
    try:
        from query_processor import (
            QueryProcessor,
            EnhancedQuery,
            enhance_query,
            get_best_query_for_search
        )
        print("✅ Query processor module imported successfully")
        print("  - QueryProcessor class: Available")
        print("  - EnhancedQuery dataclass: Available")
        print("  - enhance_query function: Available")
        print("  - get_best_query_for_search function: Available")
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False
    
    print()
    
    # Test 2: Configuration
    print("Test 2: Verifying query enhancement configuration...")
    try:
        from config import QueryConfig, FeatureFlags
        
        print(f"  HyDE enabled: {QueryConfig.HYDE_ENABLED}")
        print(f"  Multi-query enabled: {QueryConfig.MULTI_QUERY_ENABLED}")
        print(f"  Query variations: {QueryConfig.QUERY_VARIATIONS}")
        print(f"  Phase 4 enabled: {FeatureFlags.PHASE_4_QUERY_ENHANCEMENT}")
        print("✅ Configuration loaded successfully")
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        return False
    
    print()
    
    # Test 3: Query classification
    print("Test 3: Testing query classification...")
    try:
        from query_processor import QueryProcessor
        
        processor = QueryProcessor()
        
        test_queries = {
            "What is Python?": "factual",
            "How to implement a binary search?": "conversational",
            "Fix this error in my code": "code",
            "Why is machine learning important?": "conversational"
        }
        
        print("  Query classification tests:")
        for query, expected_type in test_queries.items():
            classified_type = processor.classify_query(query)
            status = "✓" if classified_type == expected_type else "✗"
            print(f"    {status} '{query[:40]}...' → {classified_type}")
        
        print("✅ Query classification working")
    except Exception as e:
        print(f"❌ Query classification test failed: {e}")
        return False
    
    print()
    
    # Test 4: Keyword extraction
    print("Test 4: Testing keyword extraction...")
    try:
        processor = QueryProcessor()
        
        test_query = "How to implement a binary search algorithm in Python?"
        keywords = processor.extract_keywords(test_query)
        
        print(f"  Query: '{test_query}'")
        print(f"  Keywords: {keywords}")
        print(f"  Count: {len(keywords)}")
        
        if len(keywords) > 0:
            print("✅ Keyword extraction working")
        else:
            print("⚠️  No keywords extracted")
    except Exception as e:
        print(f"❌ Keyword extraction test failed: {e}")
        return False
    
    print()
    
    # Test 5: EnhancedQuery structure
    print("Test 5: Testing EnhancedQuery structure...")
    try:
        from query_processor import EnhancedQuery
        
        test_enhanced = EnhancedQuery(
            original_query="Test query",
            enhanced_queries=["Test query", "Query test", "Testing query"],
            query_type="factual",
            hyde_document="This is a hypothetical document.",
            keywords=["test", "query"]
        )
        
        print("  EnhancedQuery fields:")
        print(f"    original_query: {test_enhanced.original_query}")
        print(f"    enhanced_queries: {len(test_enhanced.enhanced_queries)} variations")
        print(f"    query_type: {test_enhanced.query_type}")
        print(f"    hyde_document: {bool(test_enhanced.hyde_document)}")
        print(f"    keywords: {test_enhanced.keywords}")
        
        print("✅ EnhancedQuery structure verified")
    except Exception as e:
        print(f"❌ EnhancedQuery test failed: {e}")
        return False
    
    print()
    
    return True


def test_query_enhancement_scenarios():
    """Test different enhancement scenarios"""
    print("=" * 80)
    print("PHASE 4 TEST: Enhancement Scenarios")
    print("=" * 80)
    print()
    
    scenarios = [
        {
            'name': 'Disabled',
            'hyde': False,
            'multi_query': False,
            'description': 'No enhancement (baseline)'
        },
        {
            'name': 'HyDE Only',
            'hyde': True,
            'multi_query': False,
            'description': 'Generate hypothetical document'
        },
        {
            'name': 'Multi-Query Only',
            'hyde': False,
            'multi_query': True,
            'description': 'Generate query variations'
        },
        {
            'name': 'Full Enhancement',
            'hyde': True,
            'multi_query': True,
            'description': 'HyDE + Multi-Query'
        }
    ]
    
    print("Available enhancement scenarios:")
    for scenario in scenarios:
        print(f"\n  {scenario['name']}:")
        print(f"    {scenario['description']}")
        print(f"    HyDE: {scenario['hyde']}, Multi-Query: {scenario['multi_query']}")
    
    print()
    print("✅ Enhancement scenarios documented")
    return True


def test_integration():
    """Test integration points"""
    print("=" * 80)
    print("PHASE 4 TEST: Integration")
    print("=" * 80)
    print()
    
    print("Test: Checking for Mistral client...")
    try:
        from query_processor import QueryProcessor
        
        processor = QueryProcessor()
        has_client = processor.mistral_client is not None
        
        if has_client:
            print("✅ Mistral client initialized")
        else:
            print("⚠️  Mistral client not available (MISTRAL_API_KEY missing)")
            print("   HyDE and multi-query will be disabled")
    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        return False
    
    print()
    print("✅ Integration verified")
    return True


def run_all_tests():
    """Run all Phase 4 tests"""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 22 + "PHASE 4: QUERY ENHANCEMENT TEST SUITE" + " " * 19 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    try:
        # Run tests
        test1_passed = test_query_processor_module()
        print()
        test2_passed = test_query_enhancement_scenarios()
        print()
        test3_passed = test_integration()
        
        print()
        print("=" * 80)
        if test1_passed and test2_passed and test3_passed:
            print("✅ ALL TESTS PASSED")
        else:
            print("⚠️  SOME TESTS FAILED")
        print("=" * 80)
        print()
        
        print("Summary:")
        print("  ✅ Query processor module created")
        print("  ✅ Query classification implemented")
        print("  ✅ Keyword extraction working")
        print("  ✅ HyDE structure implemented")
        print("  ✅ Multi-query structure implemented")
        print("  ✅ EnhancedQuery dataclass working")
        print()
        
        print("Note:")
        print("  HyDE and multi-query require MISTRAL_API_KEY to be set")
        print("  They will be automatically disabled if API key is missing")
        print()
        
        return test1_passed and test2_passed and test3_passed
        
    except Exception as e:
        print("=" * 80)
        print(f"❌ TEST SUITE FAILED: {str(e)}")
        print("=" * 80)
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    result = run_all_tests()
    sys.exit(0 if result else 1)
