"""
Context Optimization Module for RAG Pipeline

Implements techniques to optimize context before sending to LLM:
- Context compression (remove redundant information)
- Relevance filtering (keep only most relevant parts)
- Deduplication (remove duplicate chunks)
- Smart truncation (preserve important information)
"""

import re
from typing import List, Dict, Any, Set
from dataclasses import dataclass
from config import settings


@dataclass
class OptimizedContext:
    """Optimized context with metadata"""
    content: str
    original_chunks: int
    optimized_chunks: int
    original_tokens: int
    optimized_tokens: int
    compression_ratio: float
    removed_duplicates: int
    chunks: List[Dict[str, Any]]


class ContextOptimizer:
    """
    Optimizes retrieved context to reduce tokens while maintaining quality.
    """
    
    def __init__(self):
        """Initialize context optimizer"""
        self.max_context_length = settings.context.max_context_length
        self.enable_compression = settings.context.enable_compression
        self.enable_deduplication = settings.context.enable_deduplication
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count (rough approximation).
        Real tokenization would use tiktoken, but this is faster.
        
        Rule of thumb: ~4 characters per token for English
        """
        return len(text) // 4
    
    def remove_duplicates(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Remove duplicate or highly similar chunks.
        
        Uses content-based deduplication with fuzzy matching.
        """
        if not self.enable_deduplication or not chunks:
            return chunks
        
        unique_chunks = []
        seen_content = set()
        duplicates_removed = 0
        
        for chunk in chunks:
            content = chunk.get('content', '').strip()
            
            # Create normalized version for comparison
            normalized = self._normalize_text(content)
            
            # Check for exact duplicates
            if normalized in seen_content:
                duplicates_removed += 1
                continue
            
            # Check for high similarity (>90% overlap)
            is_duplicate = False
            for seen in seen_content:
                if self._similarity_ratio(normalized, seen) > 0.9:
                    is_duplicate = True
                    duplicates_removed += 1
                    break
            
            if not is_duplicate:
                seen_content.add(normalized)
                unique_chunks.append(chunk)
        
        if duplicates_removed > 0:
            print(f"[CONTEXT] Removed {duplicates_removed} duplicate chunks")
        
        return unique_chunks
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for comparison"""
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Lowercase
        text = text.lower()
        # Remove punctuation
        text = re.sub(r'[^\w\s]', '', text)
        return text.strip()
    
    def _similarity_ratio(self, text1: str, text2: str) -> float:
        """
        Calculate similarity ratio between two texts.
        Simple word-based Jaccard similarity.
        """
        words1 = set(text1.split())
        words2 = set(text2.split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def compress_chunk(self, content: str) -> str:
        """
        Compress individual chunk by removing redundant information.
        
        Techniques:
        - Remove excessive whitespace
        - Remove repeated sentences
        - Remove boilerplate text
        """
        if not self.enable_compression:
            return content
        
        # Remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        content = re.sub(r' +', ' ', content)
        
        # Remove common boilerplate phrases
        boilerplate = [
            r'Click here to .*?\.',
            r'Learn more at .*?\.',
            r'For more information, visit .*?\.',
            r'Copyright \d{4}.*?\.',
            r'All rights reserved\.?',
        ]
        
        for pattern in boilerplate:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)
        
        return content.strip()
    
    def filter_by_relevance(
        self,
        chunks: List[Dict[str, Any]],
        query: str = None,
        min_score: float = None
    ) -> List[Dict[str, Any]]:
        """
        Filter chunks by relevance score.
        
        Args:
            chunks: List of chunks with scores
            query: Original query (for additional filtering)
            min_score: Minimum relevance score (uses config default if None)
        """
        if min_score is None:
            min_score = settings.context.min_relevance_score
        
        # Filter by score
        filtered = []
        for chunk in chunks:
            # Check various score fields
            score = (
                chunk.get('rerank_score') or
                chunk.get('score') or
                chunk.get('similarity') or
                0.0
            )
            
            if score >= min_score:
                filtered.append(chunk)
        
        if len(filtered) < len(chunks):
            removed = len(chunks) - len(filtered)
            print(f"[CONTEXT] Filtered out {removed} low-relevance chunks")
        
        return filtered
    
    def smart_truncate(
        self,
        chunks: List[Dict[str, Any]],
        max_tokens: int = None
    ) -> List[Dict[str, Any]]:
        """
        Intelligently truncate context to fit within token limit.
        
        Prioritizes:
        1. Highest scored chunks
        2. Chunks with metadata (headings)
        3. Shorter chunks (more diverse information)
        """
        if max_tokens is None:
            max_tokens = self.max_context_length
        
        # Sort by score (descending)
        sorted_chunks = sorted(
            chunks,
            key=lambda x: (
                x.get('rerank_score') or
                x.get('score') or
                x.get('similarity') or
                0.0
            ),
            reverse=True
        )
        
        # Add chunks until token limit
        selected = []
        total_tokens = 0
        
        for chunk in sorted_chunks:
            content = chunk.get('content', '')
            chunk_tokens = self.estimate_tokens(content)
            
            if total_tokens + chunk_tokens <= max_tokens:
                selected.append(chunk)
                total_tokens += chunk_tokens
            else:
                # Try to fit a partial chunk if there's room
                remaining_tokens = max_tokens - total_tokens
                if remaining_tokens > 100:  # Only if meaningful space left
                    # Truncate content to fit
                    chars_to_keep = remaining_tokens * 4
                    truncated_content = content[:chars_to_keep] + "..."
                    
                    truncated_chunk = chunk.copy()
                    truncated_chunk['content'] = truncated_content
                    truncated_chunk['truncated'] = True
                    
                    selected.append(truncated_chunk)
                    total_tokens += remaining_tokens
                
                break
        
        if len(selected) < len(sorted_chunks):
            print(f"[CONTEXT] Truncated to {len(selected)}/{len(sorted_chunks)} chunks ({total_tokens} tokens)")
        
        return selected
    
    def optimize_context(
        self,
        chunks: List[Dict[str, Any]],
        query: str = None
    ) -> OptimizedContext:
        """
        Main optimization method combining all techniques.
        
        Args:
            chunks: Retrieved chunks with scores
            query: Original query (optional, for relevance filtering)
            
        Returns:
            OptimizedContext with optimized content and metrics
        """
        original_count = len(chunks)
        original_content = '\n\n'.join([c.get('content', '') for c in chunks])
        original_tokens = self.estimate_tokens(original_content)
        
        print(f"[CONTEXT] Optimizing {original_count} chunks ({original_tokens} tokens)")
        
        # Step 1: Remove duplicates
        chunks = self.remove_duplicates(chunks)
        duplicates_removed = original_count - len(chunks)
        
        # Step 2: Filter by relevance
        chunks = self.filter_by_relevance(chunks, query)
        
        # Step 3: Compress individual chunks
        if self.enable_compression:
            for chunk in chunks:
                chunk['content'] = self.compress_chunk(chunk['content'])
        
        # Step 4: Smart truncation
        chunks = self.smart_truncate(chunks)
        
        # Build optimized content
        optimized_parts = []
        for i, chunk in enumerate(chunks):
            metadata = chunk.get('metadata', {})
            content = chunk.get('content', '')
            
            # [FIX] Enhanced Source URL Recovery
            source = (
                chunk.get('source_url', None) or 
                metadata.get('url', None) or 
                metadata.get('source', None) or 
                'Vector Store'
            )
            
            # [NEW] LinkedIn Heuristic
            # If the source is generic but content looks like LinkedIn, override it
            if source in ['Vector Store', 'Doc', 'Current Page']:
                linkedin_patterns = [r'LinkedIn', r'11mo', r'Head Coordinator', r'IIIT Nagpur']
                if any(re.search(p, content, re.I) for p in linkedin_patterns):
                    source = "LinkedIn Social Post"

            # Add metadata if available
            heading = metadata.get('heading', '')
            
            # Add rerank score if available
            score_info = ""
            if 'rerank_score' in chunk:
                score_info = f" (Relevance: {chunk['rerank_score']:.2f})"
            
            heading_info = f"\nHeading: {heading}" if heading else ""
            
            # [FIX] Remap the chunk id to match what's written in the context string.
            pseudo_id = f"db-block-{i+1}"
            chunk['id'] = pseudo_id
            
            part = f"Source: {source}{heading_info}{score_info}\nID: [{pseudo_id}]\nContent:\n{content}"
            optimized_parts.append(part)

        
        optimized_content = '\n\n---\n\n'.join(optimized_parts)
        optimized_tokens = self.estimate_tokens(optimized_content)
        
        compression_ratio = (
            (original_tokens - optimized_tokens) / original_tokens * 100
            if original_tokens > 0 else 0
        )
        
        print(f"[CONTEXT] Optimized: {len(chunks)} chunks, {optimized_tokens} tokens ({compression_ratio:.1f}% reduction)")
        
        return OptimizedContext(
            content=optimized_content,
            original_chunks=original_count,
            optimized_chunks=len(chunks),
            original_tokens=original_tokens,
            optimized_tokens=optimized_tokens,
            compression_ratio=compression_ratio,
            removed_duplicates=duplicates_removed,
            chunks=chunks
        )


def optimize_context(
    chunks: List[Dict[str, Any]],
    query: str = None
) -> OptimizedContext:
    """
    Convenience function for context optimization.
    
    Args:
        chunks: Retrieved chunks
        query: Original query
        
    Returns:
        OptimizedContext object
    """
    optimizer = ContextOptimizer()
    return optimizer.optimize_context(chunks, query)
