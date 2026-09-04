"""
Mistral Key Pool — Round-robin key distribution across task categories.

Distributes 25 API keys into 5 groups of 5, each dedicated to a task category:
  - chat:     Keys 1–5   (LLM streaming, search, hybrid search)
  - ingest:   Keys 6–10  (agentic chunking, ingest service)
  - graph:    Keys 11–15 (graph extraction, graph context)
  - research: Keys 16–20 (reasoning chain, browser agents, reports)
  - utility:  Keys 21–25 (saved_pages, widget_logic, query_processor)

Each group round-robins within its own keys so heavy usage in one
category never starves another.
"""

import os
import threading
from typing import Optional

# ── Pool Configuration ──────────────────────────────────────────────────────────

TASK_GROUPS = {
    "chat":     0,
    "ingest":   1,
    "graph":    2,
    "research": 3,
    "utility":  4,
}

# Aliases — maps convenience names to the canonical group
TASK_ALIASES = {
    "report":  "research",
    "search":  "chat",
    "embed":   "ingest",
}

KEYS_PER_GROUP = 5
NUM_GROUPS = 5

# ── Internal State ──────────────────────────────────────────────────────────────

_lock = threading.Lock()
_group_keys: list[list[str]] = [[] for _ in range(NUM_GROUPS)]
_group_counters: list[int] = [0 for _ in range(NUM_GROUPS)]
_initialized = False


def _init_pool():
    """Parse MISTRAL_API_KEYS env var and distribute into groups."""
    global _initialized, _group_keys, _group_counters

    if _initialized:
        return

    with _lock:
        if _initialized:
            return

        raw = os.getenv("MISTRAL_API_KEYS", "")
        all_keys = [k.strip() for k in raw.split(",") if k.strip()]

        if len(all_keys) == 0:
            # Fallback: use the single MISTRAL_API_KEY for all groups
            single = os.getenv("MISTRAL_API_KEY", "")
            if single.strip():
                all_keys = [single.strip()]
                _group_keys = [[single.strip()] for _ in range(NUM_GROUPS)]
            _initialized = True
            return

        # Distribute keys across groups, wrapping around if fewer than expected keys are provided
        for group_idx in range(NUM_GROUPS):
            for i in range(KEYS_PER_GROUP):
                key_index = (group_idx * KEYS_PER_GROUP + i) % len(all_keys)
                _group_keys[group_idx].append(all_keys[key_index])

        _group_counters = [0 for _ in range(NUM_GROUPS)]
        _initialized = True

        total = sum(len(g) for g in _group_keys)
        print(f"[KEY_POOL] Initialized with {total} keys across {NUM_GROUPS} groups: "
              f"chat={len(_group_keys[0])}, ingest={len(_group_keys[1])}, "
              f"graph={len(_group_keys[2])}, research={len(_group_keys[3])}, utility={len(_group_keys[4])}")


def get_key(task: str = "chat") -> Optional[str]:
    """
    Get the next API key for the given task category via round-robin.

    Args:
        task: One of 'chat', 'ingest', 'graph', 'research', 'utility',
              'report', 'search', 'embed'.

    Returns:
        An API key string, or None if no keys are configured.
    """
    _init_pool()

    # Resolve aliases
    canonical = TASK_ALIASES.get(task, task)
    group_idx = TASK_GROUPS.get(canonical, 0)  # default to chat group

    keys = _group_keys[group_idx]
    if not keys:
        return None

    with _lock:
        idx = _group_counters[group_idx] % len(keys)
        _group_counters[group_idx] += 1

    return keys[idx]


def get_key_count(task: str = "chat") -> int:
    """Returns the number of keys allocated to this task group."""
    _init_pool()
    canonical = TASK_ALIASES.get(task, task)
    group_idx = TASK_GROUPS.get(canonical, 0)
    return len(_group_keys[group_idx])
