import os
import base64
from vision import analyze_image_logic
from dotenv import load_dotenv

load_dotenv()

def test_alternatives():
    print("=== Testing Vision Fallback Logic ===")
    
    # Tiny 1x1 black pixel png
    image_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
    
    # Mock keys to ensure the logic paths are reachable
    os.environ["GROQ_API_KEY"] = "gsk_mock_key"
    os.environ["HF_TOKEN"] = "hf_mock_token"
    
    # We'll use a unique prompt to identify the run
    prompt = "What is the primary color of this 1x1 image? (Verification Run)"
    
    print("\nRunning analyze_image_logic...")
    result = analyze_image_logic(image_bytes, user_prompt=prompt, mode="qa")
    
    print("\n--- Final Result ---")
    print(f"Success: {result.get('success')}")
    print(f"Model Used: {result.get('model_used')}")
    if result.get('success'):
        print(f"Answer: {result.get('answer')[:100]}...")
    else:
        print(f"Error: {result.get('error')}")
        print(f"Full Response: {result}")

if __name__ == "__main__":
    test_alternatives()
