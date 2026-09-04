"""
Multi-Hop Reasoning Chain Module for SnapMind.

Decomposes complex queries into sequential sub-questions, executes each step
with either local RAG or web search, and synthesizes a final answer with
full chain-of-thought visibility.
"""

import json
import time
from typing import Dict, Any, List
from config import settings


class ReasoningPlanner:
    """Decomposes a complex query into atomic sub-questions."""

    def __init__(self, api_keys: dict):
        self.api_keys = api_keys

    def plan(self, query: str, context_hint: str = "") -> List[Dict[str, Any]]:
        """
        Break a complex query into 2-5 sequential reasoning steps.

        Returns:
            [{"step": 1, "question": "...", "tool": "web_search"|"local_rag", "depends_on": []}]
        """
        from api_clients import get_mistral_client

        client = get_mistral_client(self.api_keys, task="research")
        if not client:
            return [{"step": 1, "question": query, "tool": "web_search", "depends_on": []}]

        context_section = ""
        if context_hint:
            context_section = f"\nAvailable local knowledge context: {context_hint[:500]}"

        prompt = f"""You are a reasoning planner. The user has asked a complex question that requires multi-step reasoning.

Break this query into 2-5 sequential steps. Each step should be a specific, atomic question.
For each step, decide if it needs:
- "web_search": needs fresh information from the internet
- "local_rag": can be answered from the user's existing indexed knowledge base

Later steps can reference results from earlier steps.
{context_section}

Output ONLY a valid JSON array of objects with these fields:
- "step": integer (1, 2, 3...)
- "question": string (the specific sub-question)
- "tool": "web_search" or "local_rag"
- "depends_on": array of step numbers this step needs results from

User Query: {query}"""

        try:
            response = client.chat.complete(
                model=settings.models.mistral_large,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"}
            )

            text = response.choices[0].message.content.strip()
            # Clean markdown wrappers
            from utils import strip_json_fences
            text = strip_json_fences(text)

            parsed = json.loads(text)

            # Handle both array and object-wrapped responses
            if isinstance(parsed, dict):
                for val in parsed.values():
                    if isinstance(val, list):
                        parsed = val
                        break

            if isinstance(parsed, list) and len(parsed) > 0:
                # Enforce max 5 steps
                return parsed[:5]

        except Exception as e:
            print(f"[REASONING] Planner error: {e}")

        # Fallback: single-step plan
        return [{"step": 1, "question": query, "tool": "web_search", "depends_on": []}]


class ReasoningExecutor:
    """Executes each step in a reasoning chain, accumulating a scratchpad."""

    def __init__(self, api_keys: dict, session_id: str = None, output_lang: str = "auto"):
        self.api_keys = api_keys
        self.session_id = session_id
        self.output_lang = output_lang

    async def execute_chain(self, plan: List[Dict], original_query: str):
        """
        Execute the reasoning chain step-by-step as an async generator.

        Yields:
            chunks of results or status updates.
        """
        scratchpad = []  # Accumulated findings
        chain_results = []
        all_citations = []
        all_blocks = []
        step_answers = {}  # step_number -> answer text

        print(f"[REASONING] Executing {len(plan)} step chain for: {original_query}")

        for step_info in plan:
            step_num = step_info.get("step", len(chain_results) + 1)
            question = step_info.get("question", "")
            tool = step_info.get("tool", "web_search")
            depends_on = step_info.get("depends_on", [])

            # Inject context from dependent steps
            context_from_deps = ""
            for dep in depends_on:
                if dep in step_answers:
                    context_from_deps += f"\n[From Step {dep}]: {step_answers[dep][:1000]}\n"

            enriched_question = question
            if context_from_deps:
                enriched_question = f"{question}\n\nContext from previous steps:{context_from_deps}"

            print(f"[REASONING] Step {step_num}: {question[:80]}... (tool={tool})")

            # Yield thought update
            yield {
                "type": "thought",
                "step": step_num,
                "thought": f"Executing research step: {question}",
                "action": f"Using {tool} to find answers",
                "status": "processing"
            }

            # Initialised before the try so a failing step degrades to an empty
            # result instead of raising NameError below: `step_sources` and
            # `step_citations` are both read unconditionally after this block, so
            # without this one bad step aborts the whole chain.
            step_answer = ""
            step_sources = []
            step_citations = []
            step_blocks = []

            try:
                if tool == "local_rag":
                    # Call async local rag
                    step_answer, step_sources, s_citations, s_blocks = await self._execute_local_rag(enriched_question)
                    step_citations = s_citations
                    step_blocks = s_blocks
                else:
                    # Web search via BrowserOrchestrator
                    result = await self._execute_web_search(enriched_question)
                    step_answer = result.get("answer", "No results found.")
                    step_citations = result.get("citations", [])
                    step_blocks = result.get("blocks", [])
                    step_sources = [c.get("url", "web") for c in step_citations[:3]]
            except Exception as e:
                print(f"[REASONING] Step {step_num} failed: {e}")
                step_answer = f"Step failed: {str(e)}"

            step_answers[step_num] = step_answer
            scratchpad.append(f"Step {step_num} ({question}): {step_answer[:500]}")

            chain_results.append({
                "id": str(step_num),
                "thought": f"Completed research for: {question}",
                "action": f"Synthesis of {tool} findings",
                "answer": step_answer,
                "sources": step_sources,
                "status": "completed"
            })

            # Yield progress
            yield {
                "type": "thought",
                "step": step_num,
                "thought": f"Finalized search for: {question}",
                "status": "completed"
            }

            # Namespace citations to avoid collisions
            for c in step_citations:
                c["blockId"] = f"hop{step_num}-{c.get('blockId', '')}"
            for b in step_blocks:
                b["id"] = f"hop{step_num}-{b.get('id', '')}"

            all_citations.extend(step_citations)
            all_blocks.extend(step_blocks)

        # Final synthesis
        yield {
                "type": "thought",
                "thought": "Synthesizing final answer from all research steps...",
                "status": "processing"
        }
        
        final_answer = await self._synthesize(original_query, chain_results)

        yield {
            "type": "final",
            "answer": final_answer,
            "chain": chain_results,
            "citations": all_citations,
            "blocks": all_blocks
        }

    async def _execute_local_rag(self, query: str) -> tuple:
        """Search the local knowledge base using SearchService."""
        try:
            from services.search_service import SearchService
            from models.dtos import SearchRequestDTO
            
            svc = SearchService(api_keys=self.api_keys)
            # Pass skip_reasoning=True to prevent recursion
            request = SearchRequestDTO(
                query=query,
                session_id=self.session_id,
                user_id=None # Add user_id if available in context
            )
            
            # Use chat instead of chat_stream for sub-steps to keep it simple
            response = await svc.chat(request, api_keys=self.api_keys, skip_reasoning=True)
            
            if response.answer:
                sources = [s.url for s in response.sources[:3]]
                return response.answer, sources, [], [] # TODO: map citations/blocks
                
            return "No relevant information found in local knowledge base.", [], [], []
        except Exception as e:
            print(f"[REASONING] Local RAG failed: {e}")
            return f"Local search error: {str(e)}", [], [], []

    async def _execute_web_search(self, query: str) -> Dict:
        """Execute a web search using the existing BrowserOrchestrator."""
        try:
            from browser_agents import BrowserOrchestrator
            orchestrator = BrowserOrchestrator(
                api_keys=self.api_keys,
                session_id=self.session_id,
                output_lang=self.output_lang
            )
            # BrowserOrchestrator.run is async, MUST be awaited
            return await orchestrator.run(query)
        except Exception as e:
            print(f"[REASONING] Web search failed: {e}")
            return {"answer": f"Web search error: {str(e)}", "citations": [], "blocks": []}

    async def _synthesize(self, original_query: str, chain: List[Dict]) -> str:
        """Generate final synthesized answer from all chain steps."""
        from api_clients import get_mistral_client

        client = get_mistral_client(self.api_keys, task="research")
        if not client:
            # Fallback: concatenate step answers
            return "\n\n".join([f"**Action:** {s.get('action')}\n**Answer:** {s['answer']}" for s in chain])

        chain_summary = ""
        for step in chain:
            chain_summary += f"\n**Question:** {step.get('thought')}\n**Finding:** {step['answer'][:800]}\n"

        lang_instruction = ""
        if self.output_lang and self.output_lang != "auto":
            from utils import LANG_MAP
            lang_name = LANG_MAP.get(self.output_lang, self.output_lang)
            lang_instruction = f"\n\nCRITICAL: Output your entire response in {lang_name}."

        prompt = f"""You are an advanced research assistant. A multi-step reasoning chain was executed to answer the user's complex question.

Synthesize ALL the findings below into a single, comprehensive, well-structured answer.
Include key facts from each step. Use citations from the steps where applicable.
Do NOT just repeat the steps — create a flowing, cohesive answer.{lang_instruction}

ORIGINAL QUESTION: {original_query}

REASONING CHAIN RESULTS:
{chain_summary}

Provide your final synthesized answer:"""

        try:
            response = await client.chat.stream_async(
                model=settings.models.mistral_large,
                messages=[{"role": "user", "content": prompt}]
            )
            # For simplicity in synthesis, we return the full text
            full_text = ""
            async for chunk in response:
                if chunk.choices[0].delta.content:
                    full_text += chunk.choices[0].delta.content
            return full_text.strip()
        except Exception as e:
            print(f"[REASONING] Synthesis failed: {e}")
            return "\n\n".join([f"**Step:** {s.get('thought')}\n**Answer:** {s['answer']}" for s in chain])


def is_multi_hop_query(query: str, api_keys: dict = None) -> bool:
    """
    Detect if a query requires multi-hop/chained reasoning.
    Uses fast heuristics first, falls back to LLM classification if ambiguous.
    """
    query_lower = query.lower().strip()

    # --- Heuristic checks (fast, no API call) ---

    # Pattern 1: Chained entity references
    chained_patterns = [
        r'who\s+.*?\s+that\s+',         # "Who is the person that..."
        r'what\s+company\s+.*?which\s+', # "What company...which..."
        r'how\s+did\s+.*?lead\s+to',     # "How did X lead to Y"
        r'why\s+did\s+.*?after\s+',      # "Why did X after Y"
        r'compare\s+.*?\s+and\s+.*?\s+in\s+terms\s+of',  # Multi-entity comparison
        r'trace\s+the\s+',              # "Trace the history/evolution"
        r'what\s+happened\s+.*?before\s+.*?and\s+after',  # Temporal chain
        r'explain\s+the\s+relationship\s+between\s+.*?\s+and\s+',
    ]

    import re
    for pattern in chained_patterns:
        if re.search(pattern, query_lower):
            return True

    # Pattern 2: Multiple explicit question marks (compound query)
    if query.count('?') >= 2:
        return True

    # Pattern 3: Step-indicator words
    step_words = ['first', 'then', 'finally', 'step by step', 'in order to']
    if sum(1 for w in step_words if w in query_lower) >= 2:
        return True

    # Pattern 5: Continuation Exclusions (Do NOT do multi-hop for follow-ups)
    continuation_keywords = ['finalize', 'successfully synced', 'synthesize all data', 'dossier based on']
    if any(kw in query_lower for kw in continuation_keywords):
        return False

    return False
