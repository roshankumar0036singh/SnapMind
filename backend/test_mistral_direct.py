import os
from dotenv import load_dotenv
from mistralai import Mistral
import time

def test_mistral_limits():
    # Load .env explicitly to ensure we get the latest key
    load_dotenv(override=True)
    api_key = os.getenv("MISTRAL_API_KEY")
    
    print(f"Testing Mistral API Key: {api_key[:10]}...{api_key[-4:] if api_key else 'None'}")
    
    if not api_key:
        print("❌ No MISTRAL_API_KEY found in environment.")
        return

    client = Mistral(api_key=api_key)
    
    print("Sending test query to mistral-small-latest...")
    try:
        start = time.time()
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": "Hello, this is a quick test."}]
        )
        end = time.time()
        print(f"✅ Success! Response: '{response.choices[0].message.content}'")
        print(f"Latency: {end - start:.2f}s")
        
        # Test rate limit quickly by sending 3 rapid requests
        print("\nTesting rapid requests (simulating chunking)...")
        for i in range(3):
            print(f"Request {i+1}...")
            client.chat.complete(
                model="mistral-small-latest",
                messages=[{"role": "user", "content": f"Quick test {i}"}]
            )
        print("✅ Rapid requests succeeded!")
        
    except Exception as e:
        error_str = str(e)
        print(f"❌ API Error: {error_str}")
        if "Status 429" in error_str or "Rate limit" in error_str:
            print("\n⚠️ CONCLUSION: The new organization key is STILL rate-limited. Free tier limits apply instantly to new keys.")

if __name__ == "__main__":
    test_mistral_limits()
