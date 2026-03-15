"""
Root Cause Analysis: Lingo.dev Translation Failure
====================================================
Tests the EXACT header/body format differences between:
  1. Our REST implementation (Content-Type: application/json)
  2. The official SDK (Content-Type: application/json; charset=utf-8)
  3. Different body encoding strategies
"""
import requests
import json
import os
import time
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("LINGODEV_API_KEY")
BASE = "https://engine.lingo.dev"

def test(label, url, headers, data=None, json_data=None, timeout=10):
    print(f"\n--- [{label}] ---")
    print(f"  URL: {url}")
    print(f"  Headers: {headers}")
    try:
        start = time.time()
        if data:
            r = requests.post(url, headers=headers, data=data, timeout=timeout)
        else:
            r = requests.post(url, headers=headers, json=json_data, timeout=timeout)
        elapsed = time.time() - start
        print(f"  Status: {r.status_code} ({elapsed:.2f}s)")
        print(f"  Body: {r.text[:200]}")
        return True
    except requests.exceptions.ReadTimeout:
        print(f"  TIMED OUT after {timeout}s")
        return False
    except Exception as e:
        print(f"  ERROR: {e}")
        return False

# ===== HYPOTHESIS 1: Content-Type charset =====
# SDK uses "application/json; charset=utf-8", we use "application/json"
print("=" * 60)
print("HYPOTHESIS 1: Content-Type charset mismatch")
print("=" * 60)

# Test A: Our current header (no charset)
test("1A: No charset",
     f"{BASE}/recognize",
     {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
     json_data={"text": "Hello"})

# Test B: SDK-style header (with charset)
test("1B: With charset (SDK-style)",
     f"{BASE}/recognize",
     {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
     json_data={"text": "Hello"})

# ===== HYPOTHESIS 2: Body encoding (data vs json) =====
print("\n" + "=" * 60)
print("HYPOTHESIS 2: Raw bytes vs json= parameter")
print("=" * 60)

# Test C: Pre-encoded body with charset header
test("2A: Pre-encoded bytes + charset",
     f"{BASE}/recognize",
     {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
     data=json.dumps({"text": "Hello"}).encode("utf-8"))

# ===== HYPOTHESIS 3: Endpoint hit check =====
print("\n" + "=" * 60)
print("HYPOTHESIS 3: WhoAmI (no body) as control")
print("=" * 60)

test("3A: WhoAmI (control, no body)",
     f"{BASE}/whoami",
     {"Authorization": f"Bearer {api_key}"},
     json_data=None)

# ===== HYPOTHESIS 4: Translation endpoint =====
print("\n" + "=" * 60)
print("HYPOTHESIS 4: i18n endpoint (if recognize passes)")
print("=" * 60)

import uuid
test("4A: i18n with charset",
     f"{BASE}/i18n",
     {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json; charset=utf-8"},
     json_data={
         "params": {"workflowId": str(uuid.uuid4()), "fast": True},
         "locale": {"source": None, "target": "en"},
         "data": {"text": "Bonjour le monde"},
     })

print("\n\nDone. Check results above.")
