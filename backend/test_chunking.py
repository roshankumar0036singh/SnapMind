"""
Test script for semantic chunking module.
Verifies chunking quality, overlap, and metadata extraction.
"""

from chunking import chunk_text, SemanticChunker, ChunkConfig


def test_basic_chunking():
    """Test basic text chunking"""
    print("=" * 80)
    print("TEST 1: Basic Text Chunking")
    print("=" * 80)
    
    text = """
    This is a simple paragraph. It contains multiple sentences. Each sentence should be preserved.
    
    This is another paragraph. It should be in a separate chunk if the text is long enough.
    The chunker should respect paragraph boundaries and maintain context.
    """
    
    chunks = chunk_text(text, max_chars=100, use_semantic=True)
    
    print(f"Input length: {len(text)} chars")
    print(f"Number of chunks: {len(chunks)}")
    print()
    
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i+1}:")
        print(f"  Content: {chunk['content'][:100]}...")
        print(f"  Length: {len(chunk['content'])} chars")
        print(f"  Metadata: {chunk['metadata']}")
        print()


def test_markdown_chunking():
    """Test markdown-aware chunking"""
    print("=" * 80)
    print("TEST 2: Markdown Chunking")
    print("=" * 80)
    
    markdown_text = """
# Main Heading

This is an introduction paragraph under the main heading.

## Section 1

This section contains important information. It has multiple sentences that provide context.

### Subsection 1.1

Here's some detailed content in a subsection.

```python
def example_function():
    return "This code block should be preserved intact"
```

## Section 2

Another section with different content. This should be chunked separately.

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
| Data 3   | Data 4   |

Final paragraph after the table.
"""
    
    chunks = chunk_text(markdown_text, max_chars=300, use_semantic=True)
    
    print(f"Input length: {len(markdown_text)} chars")
    print(f"Number of chunks: {len(chunks)}")
    print()
    
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i+1}:")
        print(f"  Heading: {chunk['metadata'].get('heading', 'None')}")
        print(f"  Level: {chunk['metadata'].get('heading_level', 0)}")
        print(f"  Has Code: {chunk['metadata'].get('has_code', False)}")
        print(f"  Has Table: {chunk['metadata'].get('has_table', False)}")
        print(f"  Length: {len(chunk['content'])} chars")
        print(f"  Preview: {chunk['content'][:150].replace(chr(10), ' ')}...")
        print()


def test_overlap():
    """Test chunk overlap"""
    print("=" * 80)
    print("TEST 3: Chunk Overlap")
    print("=" * 80)
    
    text = """
    Sentence one provides context. Sentence two builds on it. Sentence three continues the thought.
    Sentence four adds more information. Sentence five concludes the first part.
    Sentence six starts a new idea. Sentence seven expands on it. Sentence eight provides details.
    Sentence nine adds context. Sentence ten wraps up the section.
    """
    
    config = ChunkConfig(
        target_chunk_size=150,
        overlap_percentage=0.3  # 30% overlap
    )
    
    chunker = SemanticChunker(config)
    chunks = chunker.chunk_text(text)
    
    print(f"Number of chunks: {len(chunks)}")
    print(f"Overlap percentage: {config.overlap_percentage * 100}%")
    print()
    
    for i in range(len(chunks) - 1):
        current = chunks[i].content
        next_chunk = chunks[i + 1].content
        
        # Find overlapping text
        overlap = ""
        for j in range(len(current)):
            if next_chunk.startswith(current[j:]):
                overlap = current[j:]
                break
        
        overlap_ratio = len(overlap) / len(current) if current else 0
        
        print(f"Chunk {i+1} → Chunk {i+2}:")
        print(f"  Overlap length: {len(overlap)} chars")
        print(f"  Overlap ratio: {overlap_ratio:.1%}")
        if overlap:
            print(f"  Overlapping text: '{overlap[:80]}...'")
        print()


def test_metadata_extraction():
    """Test metadata extraction"""
    print("=" * 80)
    print("TEST 4: Metadata Extraction")
    print("=" * 80)
    
    markdown = """
# Documentation

## Installation

To install the package, run the following command:

```bash
pip install example-package
```

## Usage

Here's a simple example:

```python
import example
result = example.process()
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| debug  | false   | Enable debug mode |
| port   | 8000    | Server port |
"""
    
    chunks = chunk_text(markdown, max_chars=200, source_url="https://example.com/docs", use_semantic=True)
    
    print(f"Number of chunks: {len(chunks)}")
    print()
    
    for i, chunk in enumerate(chunks):
        meta = chunk['metadata']
        print(f"Chunk {i+1}:")
        print(f"  Heading: {meta.get('heading', 'N/A')}")
        print(f"  Level: {meta.get('heading_level', 0)}")
        print(f"  Type: {meta.get('chunk_type', 'unknown')}")
        print(f"  Has Code: {meta.get('has_code', False)}")
        print(f"  Has Table: {meta.get('has_table', False)}")
        print(f"  Source URL: {meta.get('source_url', 'N/A')}")
        print(f"  Chunk ID: {meta.get('chunk_id', 'N/A')}")
        print()


def test_legacy_compatibility():
    """Test backward compatibility with legacy chunking"""
    print("=" * 80)
    print("TEST 5: Legacy Compatibility")
    print("=" * 80)
    
    text = "This is a test paragraph. " * 50
    
    # New semantic chunking
    semantic_chunks = chunk_text(text, max_chars=200, use_semantic=True)
    
    # Legacy chunking
    legacy_chunks = chunk_text(text, max_chars=200, use_semantic=False)
    
    print(f"Semantic chunks: {len(semantic_chunks)}")
    print(f"Legacy chunks: {len(legacy_chunks)}")
    print()
    
    print("Semantic chunk format:")
    if semantic_chunks:
        print(f"  Keys: {list(semantic_chunks[0].keys())}")
        print(f"  Has metadata: {'metadata' in semantic_chunks[0]}")
    
    print()
    print("Legacy chunk format:")
    if legacy_chunks:
        print(f"  Keys: {list(legacy_chunks[0].keys())}")
        print(f"  Metadata type: {legacy_chunks[0]['metadata'].get('chunk_type', 'N/A')}")


def run_all_tests():
    """Run all chunking tests"""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "SEMANTIC CHUNKING TEST SUITE" + " " * 30 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    try:
        test_basic_chunking()
        test_markdown_chunking()
        test_overlap()
        test_metadata_extraction()
        test_legacy_compatibility()
        
        print("=" * 80)
        print("✅ ALL TESTS COMPLETED SUCCESSFULLY")
        print("=" * 80)
        
    except Exception as e:
        print("=" * 80)
        print(f"❌ TEST FAILED: {str(e)}")
        print("=" * 80)
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_all_tests()
