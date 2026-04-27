import os
import json
import time
import asyncio
from typing import List, Dict, Any
from api_clients import get_mistral_client
from config import settings

async def run_agentic_chunking(text: str, api_keys: dict = None, target_chunk_size: int = 1000) -> List[Dict[str, Any]]:
    """
    Splits text into chunks using an LLM-steered 'Agentic' approach.
    Now supports parallel processing of segments for massive speedup.
    """
    total_len = len(text)
    print(f"[AGENTIC_CHUNKING] Processing {total_len} characters...")
    
    if total_len < target_chunk_size * 1.5:
        # Too small to bother with complex parallelization
        return await _process_segment(text, api_keys, target_chunk_size)

    # 1. Macro-chunking: Split into large segments (~10k chars) to process in parallel
    macro_size = 10000
    segments = []
    curr = 0
    while curr < total_len:
        end = min(curr + macro_size, total_len)
        if end < total_len:
            # Try to find a logical break near the end of macro-segment
            lookback = text[max(curr, end-500):end]
            last_period = lookback.rfind('.')
            last_newline = lookback.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point != -1:
                end = max(curr, end - 500) + break_point + 1
        
        segments.append(text[curr:end])
        curr = end

    print(f"[AGENTIC_CHUNKING] Split into {len(segments)} parallel segments.")
    
    import asyncio
    # Limit concurrency to avoid hitting API rate limits too hard
    semaphore = asyncio.Semaphore(10) 

    async def sem_process(seg):
        async with semaphore:
            return await _process_segment(seg, api_keys, target_chunk_size)

    tasks = [sem_process(seg) for seg in segments]
    results = await asyncio.gather(*tasks)
    
    # Flatten results
    final_chunks = [chunk for segment_chunks in results for chunk in segment_chunks]
    print(f"[AGENTIC_CHUNKING] Completed. Generated {len(final_chunks)} semantic chunks.")
    return final_chunks

async def _process_segment(text: str, api_keys: dict = None, target_chunk_size: int = 1000) -> List[Dict[str, Any]]:
    """Internal helper to process a single segment sequentially (agentic)."""
    from api_clients import get_mistral_async_client
    mistral_client = get_mistral_async_client(api_keys)
    
    if not mistral_client:
        return [{"content": text[i:i+target_chunk_size]} for i in range(0, len(text), target_chunk_size)]

    chunks = []
    remaining_text = text
    
    prompt_template = """
    You are an expert text architect. Your goal is to split the provided text into a semantically complete and coherent chunk.
    
    Rules:
    1. The chunk MUST be an EXACT SUBSTRING of the 'Text to process' provided below.
    2. The chunk should ideally be around {target_size} characters.
    3. Do NOT break in the middle of a sentence.
    4. Output strictly JSON: {{"chunk_content": "...", "reasoning": "..."}}.

    Text to process:
    {text_snippet}
    """

    while len(remaining_text) > 50:
        snippet_size = target_chunk_size + 1500
        text_snippet = remaining_text[:snippet_size]
        
        attempts = 0
        res_data = {}
        while attempts < 3:
            try:
                response = await mistral_client.chat.complete_async(
                    model=settings.models.mistral_large,
                    messages=[{"role": "user", "content": prompt_template.format(
                        target_size=target_chunk_size,
                        text_snippet=text_snippet
                    )}],
                    response_format={"type": "json_object"}
                )
                res_data = json.loads(response.choices[0].message.content)
                break
            except Exception:
                attempts += 1
                if attempts == 3: res_data = {"chunk_content": ""}
                await asyncio.sleep(0.5)

        chunk_content = res_data.get("chunk_content", "")
        reasoning = res_data.get("reasoning", "")
        
        # Mapping logic (simplified for reliability)
        actual_content = None
        if chunk_content and chunk_content in remaining_text:
            actual_content = chunk_content
        else:
            actual_content = remaining_text[:target_chunk_size]
            
        chunks.append({
            "content": actual_content,
            "metadata": {"agentic_reasoning": reasoning, "chunk_strategy": "agentic"}
        })
        
        remaining_text = remaining_text[len(actual_content):].lstrip()
        
    return chunks
