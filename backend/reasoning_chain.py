"""
Multi-Hop Reasoning Chain Module for SnapMind.

Decomposes complex queries into sequential sub-questions, executes each step
with either local RAG or web search, and synthesizes a final answer with
full chain-of-thought visibility.
"""

import json
import time
from typing import Dict, Any, List
from config import ModelRegistry, ContextConfig


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

        client = get_mistral_client(self.api_keys)
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
                model=ModelRegistry.MISTRAL_LARGE,
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

    def execute_chain(self, plan: List[Dict], original_query: str) -> Dict[str, Any]:
        """
        Execute the reasoning chain step-by-step.

        Returns:
            {
                "final_answer": str,
                "chain": [{"step": 1, "question": ..., "answer": ..., "sources": [...], "tool_used": ...}],
                "citations": [...],
                "blocks": [...]
            }
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

            step_answer = ""
            step_sources = []
            step_citations = []
            step_blocks = []

            try:
                if tool == "local_rag":
                    step_answer, step_sources = self._execute_local_rag(enriched_question)
                else:
                    result = self._execute_web_search(enriched_question)
                    step_answer = result.get("answer", "No results found.")
                    step_citations = result.get("citations", [])
                    step_blocks = result.get("blocks", [])
                    step_sources = [c.get("snippet", "") for c in step_citations[:3]]
            except Exception as e:
                print(f"[REASONING] Step {step_num} failed: {e}")
                step_answer = f"Step failed: {str(e)}"

            step_answers[step_num] = step_answer
            scratchpad.append(f"Step {step_num} ({question}): {step_answer[:500]}")

            chain_results.append({
                "step": step_num,
                "question": question,
                "answer": step_answer,
                "sources": step_sources,
                "tool_used": tool
            })

            # Namespace citations to avoid collisions
            for c in step_citations:
                c["blockId"] = f"hop{step_num}-{c.get('blockId', '')}"
            for b in step_blocks:
                b["id"] = f"hop{step_num}-{b.get('id', '')}"

            all_citations.extend(step_citations)
            all_blocks.extend(step_blocks)

        # Final synthesis
        final_answer = self._synthesize(original_query, chain_results)

        return {
            "answer": final_answer,
            "chain": chain_results,
            "citations": all_citations,
            "blocks": all_blocks,
            "reasoning_type": "multi_hop"
        }

    def _execute_local_rag(self, query: str) -> tuple:
        """Search the local knowledge base."""
        try:
            from search import get_relevant_context
            context, blocks = get_relevant_context(query, api_keys=self.api_keys)
            if context:
                # Summarize with Mistral
                from api_clients import get_mistral_client
                client = get_mistral_client(self.api_keys)
                if client:
                    resp = client.chat.complete(
                        model=ModelRegistry.MISTRAL_SMALL,
                        messages=[
                            {"role": "system", "content": "Answer the question concisely using ONLY the provided context."},
                            {"role": "user", "content": f"Context:\n{context[:4000]}\n\nQuestion: {query}"}
                        ]
                    )
                    answer = resp.choices[0].message.content.strip()
                    sources = [b.get("url", "local") for b in blocks[:3]] if blocks else ["local"]
                    return answer, sources
            return "No relevant information found in local knowledge base.", []
        except Exception as e:
            print(f"[REASONING] Local RAG failed: {e}")
            return f"Local search error: {str(e)}", []

    def _execute_web_search(self, query: str) -> Dict:
        """Execute a web search using the existing BrowserOrchestrator."""
        try:
            from browser_agents import BrowserOrchestrator
            orchestrator = BrowserOrchestrator(
                api_keys=self.api_keys,
                session_id=self.session_id,
                output_lang=self.output_lang
            )
            return orchestrator.run(query)
        except Exception as e:
            print(f"[REASONING] Web search failed: {e}")
            return {"answer": f"Web search error: {str(e)}", "citations": [], "blocks": []}

    def _synthesize(self, original_query: str, chain: List[Dict]) -> str:
        """Generate final synthesized answer from all chain steps."""
        from api_clients import get_mistral_client

        client = get_mistral_client(self.api_keys)
        if not client:
            # Fallback: concatenate step answers
            return "\n\n".join([f"**Step {s['step']}:** {s['answer']}" for s in chain])

        chain_summary = ""
        for step in chain:
            chain_summary += f"\n**Step {step['step']} — {step['question']}:**\n{step['answer'][:800]}\n"

        lang_instruction = ""
        if self.output_lang and self.output_lang != "auto":
            from search import LANG_MAP
            lang_name = LANG_MAP.get(self.output_lang, self.output_lang)
            lang_instruction = f"\n\nCRITICAL: Output your entire response in {lang_name}."

        prompt = f"""You are an advanced research assistant. A multi-step reasoning chain was executed to answer the user's complex question.

Synthesize ALL the step results below into a single, comprehensive, well-structured answer.
Include key facts from each step. Use citations from the steps where applicable.
Do NOT just repeat the steps — create a flowing, cohesive answer.{lang_instruction}

ORIGINAL QUESTION: {original_query}

REASONING CHAIN RESULTS:
{chain_summary}

Provide your final synthesized answer:"""

        try:
            response = client.chat.complete(
                model=ModelRegistry.MISTRAL_LARGE,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"[REASONING] Synthesis failed: {e}")
            return "\n\n".join([f"**Step {s['step']}:** {s['answer']}" for s in chain])


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

    # Pattern 4: Length-based heuristic (very long queries often need decomposition)
    if len(query.split()) > 30:
        return True

    return False
