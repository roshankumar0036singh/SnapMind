import os
import json
import time
from typing import List, Dict, Any
from api_clients import get_mistral_client

def run_agentic_chunking(text: str, api_keys: dict = None, target_chunk_size: int = 1000) -> List[Dict[str, Any]]:
    """
    Splits text into chunks using an LLM-steered 'Agentic' approach.
    Unlike fixed-size splitting, this asks the LLM to identify logical 
    breakpoints that preserve semantic context.
    """
    print(f"[AGENTIC_CHUNKING] Processing {len(text)} characters...")
    
    mistral_client = get_mistral_client(api_keys)
    if not mistral_client:
        # Fallback to simple splitting if no client
        print("[AGENTIC_CHUNKING] No LLM client found. Falling back to simple split.")
        return [{"content": text[i:i+target_chunk_size]} for i in range(0, len(text), target_chunk_size)]

    # We use a sliding window approach with LLM evaluation at candidate points
    chunks = []
    remaining_text = text
    
    prompt_template = """
    You are an expert text architect. Your goal is to split the provided text into a semantically complete and coherent chunk.
    
    Rules:
    1. The chunk MUST be an EXACT SUBSTRING of the 'Text to process' provided below. Do not change any characters, punctuation, or whitespace.
    2. The chunk should ideally be around {target_size} characters, but priority is given to SEMANTIC COMPLETENESS.
    3. Do NOT break in the middle of a sentence or a logical thought.
    4. If a section header or a new topic starts, that is a perfect place to start a new chunk.
    5. Output strictly a JSON object with:
       - 'chunk_content': The exact text of the identified chunk.
       - 'reasoning': A brief 1-sentence explanation of why you chose this boundary.

    Text to process:
    {text_snippet}
    """

    while len(remaining_text) > 50:
        # Take a larger snippet to give context to the LLM
        snippet_size = target_chunk_size + 1000 # Give enough overhead to find a boundary
        text_snippet = remaining_text[:snippet_size]
        
        # Retry logic for LLM call
        attempts = 0
        res_data = {}
        while attempts < 3:
            try:
                response = mistral_client.chat.complete(
                    model="mistral-large-latest",
                    messages=[{"role": "user", "content": prompt_template.format(
                        target_size=target_chunk_size,
                        text_snippet=text_snippet
                    )}],
                    response_format={"type": "json_object"}
                )
                res_data = json.loads(response.choices[0].message.content)
                break
            except Exception as e:
                attempts += 1
                print(f"[AGENTIC_CHUNKING] Attempt {attempts} failed: {e}")
                if attempts == 3:
                    res_data = {"chunk_content": "", "reasoning": f"Error: {e}"}
                time.sleep(1)

        chunk_content = res_data.get("chunk_content", "")
        reasoning = res_data.get("reasoning", "")
            
        # --- Robust Mapping Strategy ---
        import re
        
        def get_mapping(s):
            """Returns (normalized_string, [(original_index)]) mapping."""
            normalized = []
            mapping = []
            for i, char in enumerate(s):
                if not char.isspace():
                    normalized.append(char)
                    mapping.append(i)
            return "".join(normalized), mapping

        actual_content = None
        if chunk_content:
            # 1. Exact match
            if chunk_content in remaining_text:
                actual_content = chunk_content
            else:
                # 2. Normalized match (ignores all whitespace/newlines)
                norm_remaining, map_remaining = get_mapping(remaining_text)
                norm_chunk, _ = get_mapping(chunk_content)
                
                idx_in_norm = norm_remaining.find(norm_chunk)
                if idx_in_norm != -1:
                    # Map back to original indices
                    start_orig = map_remaining[idx_in_norm]
                    end_orig = map_remaining[idx_in_norm + len(norm_chunk) - 1] + 1
                    actual_content = remaining_text[start_orig:end_orig]
                else:
                    # 3. Anchored Match (first 4 words and last 4 words)
                    words = chunk_content.split()
                    if len(words) >= 4:
                        start_anc = " ".join(words[:2])
                        end_anc = " ".join(words[-2:])
                        s_idx = remaining_text.find(start_anc)
                        e_idx = remaining_text.find(end_anc, s_idx)
                        if s_idx != -1 and e_idx != -1:
                            actual_content = remaining_text[s_idx : e_idx + len(end_anc)]

        if not actual_content:
            # Fallback to fixed size
            print(f"[AGENTIC_CHUNKING] Match failed. LLM sent approx {len(chunk_content or '')} chars.")
            actual_content = remaining_text[:target_chunk_size]
            reasoning = f"(Fallback) LLM reasoning: {reasoning}" if reasoning else "Fallback: matching failed."
        else:
            print(f"[AGENTIC_CHUNKING] Successfully matched chunk ({len(actual_content)} chars).")

        chunks.append({
            "content": actual_content,
            "metadata": {
                "agentic_reasoning": reasoning,
                "chunk_strategy": "agentic"
            }
        })
        
        # Move the pointer
        remaining_text = remaining_text[len(actual_content):].lstrip()
        print(f"[AGENTIC_CHUNKING] Created chunk ({len(actual_content)} chars).")

    return chunks
