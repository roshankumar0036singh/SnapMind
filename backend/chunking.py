"""
Advanced Chunking Module for RAG Pipeline

Implements semantic chunking strategies that:
- Respect document structure (markdown, code blocks)
- Maintain context with overlapping chunks
- Extract metadata for better retrieval
- Support configurable chunk sizes
"""

import re
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass


@dataclass
class ChunkConfig:
    """Configuration for chunking behavior"""
    min_chunk_size: int = 200
    target_chunk_size: int = 800
    max_chunk_size: int = 1200
    overlap_percentage: float = 0.2  # 20% overlap
    preserve_code_blocks: bool = True
    preserve_tables: bool = True
    extract_metadata: bool = True


@dataclass
class Chunk:
    """Represents a text chunk with metadata"""
    content: str
    metadata: Dict[str, Any]
    start_char: int
    end_char: int
    chunk_index: int


class SemanticChunker:
    """
    Advanced chunker that respects semantic boundaries and document structure.
    """
    
    def __init__(self, config: ChunkConfig = None):
        self.config = config or ChunkConfig()
        
    def chunk_text(self, text: str, source_url: str = "") -> List[Chunk]:
        """
        Main chunking method that orchestrates the chunking process.
        
        Args:
            text: Input text to chunk
            source_url: Source URL for metadata
            
        Returns:
            List of Chunk objects with content and metadata
        """
        # Detect content type
        is_markdown = self._is_markdown(text)
        
        if is_markdown:
            return self._chunk_markdown(text, source_url)
        else:
            return self._chunk_plain_text(text, source_url)
    
    def _is_markdown(self, text: str) -> bool:
        """Detect if text is markdown formatted"""
        markdown_indicators = [
            r'^#{1,6}\s',  # Headers
            r'```',  # Code blocks
            r'\[.*\]\(.*\)',  # Links
            r'^\*\s',  # Bullet lists
            r'^\d+\.\s',  # Numbered lists
            r'\|.*\|',  # Tables
        ]
        
        for pattern in markdown_indicators:
            if re.search(pattern, text, re.MULTILINE):
                return True
        return False
    
    def _chunk_markdown(self, text: str, source_url: str) -> List[Chunk]:
        """
        Chunk markdown text while preserving structure.
        
        Strategy:
        1. Extract code blocks and tables (preserve intact)
        2. Split by headers to get sections
        3. Chunk each section with overlap
        4. Reassemble with metadata
        """
        chunks = []
        
        # Extract and protect code blocks and tables
        protected_blocks = []
        protected_text = text
        
        if self.config.preserve_code_blocks:
            protected_text, code_blocks = self._extract_code_blocks(protected_text)
            protected_blocks.extend(code_blocks)
        
        if self.config.preserve_tables:
            protected_text, tables = self._extract_tables(protected_text)
            protected_blocks.extend(tables)
        
        # Split by headers to get sections
        sections = self._split_by_headers(protected_text)
        
        chunk_index = 0
        current_position = 0
        
        for section in sections:
            heading = section.get('heading', '')
            heading_level = section.get('level', 0)
            content = section.get('content', '')
            
            # If section is small enough, keep as single chunk
            if len(content) <= self.config.max_chunk_size:
                chunk = Chunk(
                    content=content.strip(),
                    metadata={
                        'source_url': source_url,
                        'heading': heading,
                        'heading_level': heading_level,
                        'chunk_type': 'section',
                        'has_code': '```' in content,
                        'chunk_id': f"chunk-{chunk_index}"
                    },
                    start_char=current_position,
                    end_char=current_position + len(content),
                    chunk_index=chunk_index
                )
                chunks.append(chunk)
                chunk_index += 1
                current_position += len(content)
            else:
                # Split large section with overlap
                section_chunks = self._chunk_with_overlap(
                    content, 
                    heading=heading,
                    heading_level=heading_level,
                    source_url=source_url,
                    start_index=chunk_index,
                    start_position=current_position
                )
                chunks.extend(section_chunks)
                chunk_index += len(section_chunks)
                current_position += len(content)
        
        # Restore protected blocks
        chunks = self._restore_protected_blocks(chunks, protected_blocks)
        
        # Filter out chunks that are too small
        chunks = [c for c in chunks if len(c.content.strip()) >= self.config.min_chunk_size]
        
        return chunks
    
    def _chunk_plain_text(self, text: str, source_url: str) -> List[Chunk]:
        """
        Chunk plain text using sentence boundaries and overlap.
        """
        return self._chunk_with_overlap(
            text,
            heading="",
            heading_level=0,
            source_url=source_url,
            start_index=0,
            start_position=0
        )
    
    def _chunk_with_overlap(
        self, 
        text: str, 
        heading: str,
        heading_level: int,
        source_url: str,
        start_index: int,
        start_position: int
    ) -> List[Chunk]:
        """
        Split text into overlapping chunks respecting sentence boundaries.
        """
        chunks = []
        
        # Split into sentences
        sentences = self._split_sentences(text)
        
        if not sentences:
            return chunks
        
        current_chunk = []
        current_length = 0
        chunk_index = start_index
        chunk_start_pos = start_position
        
        overlap_size = int(self.config.target_chunk_size * self.config.overlap_percentage)
        
        for i, sentence in enumerate(sentences):
            sentence_length = len(sentence)
            
            # Add sentence to current chunk
            current_chunk.append(sentence)
            current_length += sentence_length
            
            # Check if we should finalize this chunk
            should_finalize = (
                current_length >= self.config.target_chunk_size or
                (current_length >= self.config.min_chunk_size and i == len(sentences) - 1)
            )
            
            if should_finalize:
                chunk_content = ' '.join(current_chunk).strip()
                
                chunk = Chunk(
                    content=chunk_content,
                    metadata={
                        'source_url': source_url,
                        'heading': heading,
                        'heading_level': heading_level,
                        'chunk_type': 'text',
                        'sentence_count': len(current_chunk),
                        'chunk_id': f"chunk-{chunk_index}"
                    },
                    start_char=chunk_start_pos,
                    end_char=chunk_start_pos + len(chunk_content),
                    chunk_index=chunk_index
                )
                chunks.append(chunk)
                
                # Prepare next chunk with overlap
                if i < len(sentences) - 1:
                    # Calculate how many sentences to keep for overlap
                    overlap_sentences = []
                    overlap_length = 0
                    
                    for sent in reversed(current_chunk):
                        if overlap_length + len(sent) <= overlap_size:
                            overlap_sentences.insert(0, sent)
                            overlap_length += len(sent)
                        else:
                            break
                    
                    current_chunk = overlap_sentences
                    current_length = overlap_length
                    chunk_start_pos += len(chunk_content) - overlap_length
                else:
                    current_chunk = []
                    current_length = 0
                
                chunk_index += 1
        
        # Handle remaining content
        if current_chunk and current_length >= self.config.min_chunk_size:
            chunk_content = ' '.join(current_chunk).strip()
            chunk = Chunk(
                content=chunk_content,
                metadata={
                    'source_url': source_url,
                    'heading': heading,
                    'heading_level': heading_level,
                    'chunk_type': 'text',
                    'sentence_count': len(current_chunk),
                    'chunk_id': f"chunk-{chunk_index}"
                },
                start_char=chunk_start_pos,
                end_char=chunk_start_pos + len(chunk_content),
                chunk_index=chunk_index
            )
            chunks.append(chunk)
        
        return chunks
    
    def _split_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using regex.
        Handles common abbreviations and edge cases.
        """
        # Simple sentence splitter (can be enhanced with spaCy/NLTK)
        # Handles: . ! ? followed by space and capital letter
        sentence_pattern = r'(?<=[.!?])\s+(?=[A-Z])'
        sentences = re.split(sentence_pattern, text)
        
        # Clean up
        sentences = [s.strip() for s in sentences if s.strip()]
        
        return sentences
    
    def _split_by_headers(self, text: str) -> List[Dict[str, Any]]:
        """
        Split markdown text by headers.
        
        Returns:
            List of sections with heading and content
        """
        sections = []
        
        # Pattern to match markdown headers
        header_pattern = r'^(#{1,6})\s+(.+)$'
        
        lines = text.split('\n')
        current_section = {'heading': '', 'level': 0, 'content': []}
        
        for line in lines:
            header_match = re.match(header_pattern, line)
            
            if header_match:
                # Save previous section if it has content
                if current_section['content']:
                    current_section['content'] = '\n'.join(current_section['content'])
                    sections.append(current_section)
                
                # Start new section
                level = len(header_match.group(1))
                heading = header_match.group(2).strip()
                current_section = {
                    'heading': heading,
                    'level': level,
                    'content': []
                }
            else:
                current_section['content'].append(line)
        
        # Add final section
        if current_section['content']:
            current_section['content'] = '\n'.join(current_section['content'])
            sections.append(current_section)
        
        # If no headers found, treat entire text as one section
        if not sections:
            sections.append({
                'heading': '',
                'level': 0,
                'content': text
            })
        
        return sections
    
    def _extract_code_blocks(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extract code blocks and replace with placeholders.
        
        Returns:
            (text_with_placeholders, list_of_code_blocks)
        """
        code_blocks = []
        pattern = r'```[\s\S]*?```'
        
        def replace_code(match):
            code = match.group(0)
            placeholder = f"__CODE_BLOCK_{len(code_blocks)}__"
            code_blocks.append({
                'type': 'code',
                'content': code,
                'placeholder': placeholder
            })
            return placeholder
        
        protected_text = re.sub(pattern, replace_code, text)
        return protected_text, code_blocks
    
    def _extract_tables(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Extract markdown tables and replace with placeholders.
        
        Returns:
            (text_with_placeholders, list_of_tables)
        """
        tables = []
        # Pattern for markdown tables (simplified)
        pattern = r'(?:^\|.+\|$\n)+(?:^\|[-:\s|]+\|$\n)+(?:^\|.+\|$\n)+'
        
        def replace_table(match):
            table = match.group(0)
            placeholder = f"__TABLE_{len(tables)}__"
            tables.append({
                'type': 'table',
                'content': table,
                'placeholder': placeholder
            })
            return placeholder
        
        protected_text = re.sub(pattern, replace_table, text, flags=re.MULTILINE)
        return protected_text, tables
    
    def _restore_protected_blocks(
        self, 
        chunks: List[Chunk], 
        protected_blocks: List[Dict[str, Any]]
    ) -> List[Chunk]:
        """
        Restore code blocks and tables in chunks.
        """
        for chunk in chunks:
            for block in protected_blocks:
                placeholder = block['placeholder']
                if placeholder in chunk.content:
                    chunk.content = chunk.content.replace(placeholder, block['content'])
                    
                    # Update metadata
                    if block['type'] == 'code':
                        chunk.metadata['has_code'] = True
                    elif block['type'] == 'table':
                        chunk.metadata['has_table'] = True
        
        return chunks


def chunk_text(
    text: str, 
    max_chars: int = 800,
    source_url: str = "",
    use_semantic: bool = True
) -> List[Dict[str, Any]]:
    """
    Main chunking function compatible with existing pipeline.
    
    Args:
        text: Text to chunk
        max_chars: Target chunk size (used for config)
        source_url: Source URL for metadata
        use_semantic: Use semantic chunking (True) or legacy chunking (False)
        
    Returns:
        List of chunk dictionaries with 'content' and 'metadata' keys
    """
    if use_semantic:
        config = ChunkConfig(
            target_chunk_size=max_chars,
            max_chunk_size=int(max_chars * 1.5),
            min_chunk_size=int(max_chars * 0.25)
        )
        chunker = SemanticChunker(config)
        chunks = chunker.chunk_text(text, source_url)
        
        # Convert to dict format for compatibility
        return [
            {
                'content': chunk.content,
                'metadata': chunk.metadata
            }
            for chunk in chunks
        ]
    else:
        # Legacy chunking (fallback)
        return _legacy_chunk_text(text, max_chars)


def _legacy_chunk_text(text: str, max_chars: int = 1000) -> List[Dict[str, Any]]:
    """
    Original chunking logic (preserved for backward compatibility).
    """
    chunks = [c.strip() for c in text.split('\n\n') if c.strip()]
    final_chunks = []
    
    for chunk in chunks:
        if len(chunk) > max_chars:
            sentences = chunk.split('. ')
            current_chunk = ""
            for sentence in sentences:
                if len(current_chunk + sentence) < max_chars:
                    current_chunk += sentence + ". "
                else:
                    if current_chunk:
                        final_chunks.append(current_chunk.strip())
                    current_chunk = sentence + ". "
            if current_chunk:
                final_chunks.append(current_chunk.strip())
        else:
            final_chunks.append(chunk)
    
    # Filter and convert to dict format
    return [
        {
            'content': c,
            'metadata': {'chunk_type': 'legacy'}
        }
        for c in final_chunks if len(c) > 50
    ]
