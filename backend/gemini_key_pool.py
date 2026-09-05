import os
import threading
from typing import Optional, List, Dict

# The 5 core backend workloads that need isolated key distribution
# We use modulo math to perfectly distribute ANY number of keys (1 to 25+) across these
TASK_GROUPS = {
    "chat": 0,
    "ingest": 1,
    "graph": 2,
    "research": 3,
    "utility": 4
}

# Map specific components to their parent group
TASK_ALIASES = {
    # Chat & Stream components -> chat group
    "stream": "chat",
    
    # Ingestion & Chunking -> ingest group
    "chunking": "ingest",
    
    # Graph extraction -> graph group
    "extraction": "graph",
    
    # Web search/scraping -> research group
    "search": "research",
    "browser": "research",
    
    # Utilities (reports, widget formatting, small generation) -> utility group
    "report": "utility",
    "widget": "utility"
}

NUM_GROUPS = 5

_lock = threading.Lock()
_group_keys: Dict[int, List[str]] = {i: [] for i in range(NUM_GROUPS)}
_group_counters: Dict[int, int] = {i: 0 for i in range(NUM_GROUPS)}
_initialized = False

def _init_pool():
    global _initialized, _group_keys, _group_counters
    if _initialized:
        return

    with _lock:
        if _initialized:
            return
            
        raw_keys = os.getenv("GEMINI_API_KEYS", "")
        if not raw_keys:
            # Fallback to single key if pool is empty
            single_key = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
            all_keys = [single_key] if single_key else []
        else:
            all_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]

        if not all_keys:
            print("[KEY_POOL] Warning: No Gemini API keys found.")
            _initialized = True
            return

        total_keys = len(all_keys)
        
        # Determine how many keys to assign per group for an even distribution
        # e.g., if total_keys = 25, keys_per_group = 5. If total_keys = 7, keys_per_group = 5
        # Modulo math ensures we wrap around cleanly
        keys_per_group = max(1, total_keys // NUM_GROUPS)
        if total_keys < NUM_GROUPS:
            keys_per_group = 5 # arbitrary overlap depth to ensure multiple parallel requests

        for group_idx in range(NUM_GROUPS):
            start_idx = group_idx * keys_per_group
            _group_keys[group_idx] = []
            
            for i in range(keys_per_group):
                key = all_keys[(start_idx + i) % total_keys]
                _group_keys[group_idx].append(key)

        print(f"[KEY_POOL] Initialized Gemini pool with {total_keys} keys across {NUM_GROUPS} groups.")
        _initialized = True

def get_key(task: str = "chat") -> Optional[str]:
    """Returns the next available Gemini API key for the given task."""
    _init_pool()
    
    canonical = TASK_ALIASES.get(task, task)
    group_idx = TASK_GROUPS.get(canonical, 0)
    
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
