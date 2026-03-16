import httpx
import time
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

def benchmark_lingo():
    api_key = os.getenv("LINGODEV_API_KEY")
    if not api_key:
        print("Error: LINGODEV_API_KEY not found.")
        return

    text = "これはテストです。" # "This is a test."
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json; charset=utf-8"
    }

    print(f"Testing with text: '{text}'")
    
    with httpx.Client(http2=True, timeout=120.0) as client:
        # Step 1: Benchmark Detection
        print("\n[Step 1] Timing /recognize...")
        start_det = time.time()
        try:
            r_det = client.post("https://engine.lingo.dev/recognize", headers=headers, json={"text": text})
            end_det = time.time()
            print(f"  Status: {r_det.status_code}")
            print(f"  Time: {end_det - start_det:.2f}s")
        except Exception as e:
            print(f"  Failed: {e}")

        # Step 2: Benchmark Translation (with source provided)
        print("\n[Step 2] Timing /i18n (with source='ja')...")
        payload = {
            "params": {"workflowId": str(uuid.uuid4()), "fast": True},
            "locale": {"source": "ja", "target": "en"},
            "data": {"text": text},
        }
        start_trans = time.time()
        try:
            r_trans = client.post("https://engine.lingo.dev/i18n", headers=headers, json=payload)
            end_trans = time.time()
            print(f"  Status: {r_trans.status_code}")
            print(f"  Time: {end_trans - start_trans:.2f}s")
        except Exception as e:
            print(f"  Failed: {e}")

        # Step 3: Benchmark "One-Shot" (i18n without source)
        print("\n[Step 3] Timing /i18n (WITHOUT source, auto-detection)...")
        payload_auto = {
            "params": {"workflowId": str(uuid.uuid4()), "fast": True},
            "locale": {"target": "en"},
            "data": {"text": text},
        }
        start_auto = time.time()
        try:
            r_auto = client.post("https://engine.lingo.dev/i18n", headers=headers, json=payload_auto)
            end_auto = time.time()
            print(f"  Status: {r_auto.status_code}")
            print(f"  Time: {end_auto - start_auto:.2f}s")
        except Exception as e:
            print(f"  Failed: {e}")

if __name__ == "__main__":
    benchmark_lingo()
