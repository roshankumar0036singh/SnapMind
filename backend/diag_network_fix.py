"""
Step 1: Network Diagnostic — Find a working path to engine.lingo.dev
Tests HTTP/2, HTTP/1.1, async httpx, and the official SDK's quick_translate.
"""
import asyncio
import os
import time
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("LINGODEV_API_KEY")
BASE = "https://engine.lingo.dev"
TIMEOUT = 8  # seconds — aggressive but fair

async def test_httpx_h2():
    """Test with httpx HTTP/2 (what the official SDK uses internally)"""
    import httpx
    print("\n[TEST 1] httpx HTTP/2 (SDK transport)")
    try:
        async with httpx.AsyncClient(
            http2=True,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {api_key}",
            },
            timeout=TIMEOUT
        ) as client:
            start = time.time()
            r = await client.post(f"{BASE}/recognize", json={"text": "Bonjour"})
            elapsed = time.time() - start
            print(f"  ✅ Status: {r.status_code} ({elapsed:.2f}s)")
            print(f"  Response: {r.text[:200]}")
            print(f"  HTTP Version: {r.http_version}")
            return True
    except Exception as e:
        print(f"  ❌ Failed: {type(e).__name__}: {e}")
        return False

async def test_httpx_h1():
    """Test with httpx HTTP/1.1"""
    import httpx
    print("\n[TEST 2] httpx HTTP/1.1")
    try:
        async with httpx.AsyncClient(
            http2=False,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {api_key}",
            },
            timeout=TIMEOUT
        ) as client:
            start = time.time()
            r = await client.post(f"{BASE}/recognize", json={"text": "Bonjour"})
            elapsed = time.time() - start
            print(f"  ✅ Status: {r.status_code} ({elapsed:.2f}s)")
            print(f"  Response: {r.text[:200]}")
            return True
    except Exception as e:
        print(f"  ❌ Failed: {type(e).__name__}: {e}")
        return False

async def test_sdk_quick_translate():
    """Test with the official SDK's quick_translate class method"""
    from lingodotdev import LingoDotDevEngine
    print("\n[TEST 3] Official SDK quick_translate()")
    try:
        start = time.time()
        result = await asyncio.wait_for(
            LingoDotDevEngine.quick_translate("Bonjour le monde", api_key, "en"),
            timeout=TIMEOUT
        )
        elapsed = time.time() - start
        print(f"  ✅ Result: {result} ({elapsed:.2f}s)")
        return True
    except asyncio.TimeoutError:
        print(f"  ❌ Timed out after {TIMEOUT}s")
        return False
    except Exception as e:
        print(f"  ❌ Failed: {type(e).__name__}: {e}")
        return False

async def test_sdk_recognize():
    """Test with the official SDK's recognize_locale"""
    from lingodotdev import LingoDotDevEngine
    print("\n[TEST 4] Official SDK recognize_locale()")
    try:
        async with LingoDotDevEngine({"api_key": api_key}) as engine:
            start = time.time()
            locale = await asyncio.wait_for(
                engine.recognize_locale("Guten Morgen"),
                timeout=TIMEOUT
            )
            elapsed = time.time() - start
            print(f"  ✅ Locale: {locale} ({elapsed:.2f}s)")
            return True
    except asyncio.TimeoutError:
        print(f"  ❌ Timed out after {TIMEOUT}s")
        return False
    except Exception as e:
        print(f"  ❌ Failed: {type(e).__name__}: {e}")
        return False

async def test_requests_h1():
    """Test with plain requests (HTTP/1.1 only) as baseline"""
    import requests
    print("\n[TEST 5] Python requests (HTTP/1.1, baseline)")
    try:
        start = time.time()
        r = requests.post(
            f"{BASE}/recognize",
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": f"Bearer {api_key}",
            },
            json={"text": "Bonjour"},
            timeout=TIMEOUT
        )
        elapsed = time.time() - start
        print(f"  ✅ Status: {r.status_code} ({elapsed:.2f}s)")
        print(f"  Response: {r.text[:200]}")
        return True
    except Exception as e:
        print(f"  ❌ Failed: {type(e).__name__}: {e}")
        return False

async def main():
    print(f"API Key: {api_key[:8]}...{api_key[-4:]}")
    print(f"Timeout: {TIMEOUT}s per test")
    print("=" * 60)
    
    results = {}
    results["httpx_h2"] = await test_httpx_h2()
    results["httpx_h1"] = await test_httpx_h1()
    results["sdk_quick"] = await test_sdk_quick_translate()
    results["sdk_recognize"] = await test_sdk_recognize()
    results["requests_h1"] = await test_requests_h1()
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {name}: {status}")
    
    if any(results.values()):
        winners = [k for k, v in results.items() if v]
        print(f"\n Working transport(s): {', '.join(winners)}")
    else:
        print(f"\n⚠️  All transports failed. Issue is ISP/regional. Need proxy or VPN.")

if __name__ == "__main__":
    asyncio.run(main())
