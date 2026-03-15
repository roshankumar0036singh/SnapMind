import base64
import os
from vision import analyze_image_logic
from dotenv import load_dotenv

load_dotenv()

# Create a dummy JPEG image (1x1 black pixel) - Fixed padding
dummy_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
image_bytes = base64.b64decode(dummy_image_b64)

def test_gemini_vision():
    print("Testing Gemini Vision through analyze_image_logic...")
    try:
        result = analyze_image_logic(image_bytes, user_prompt="What is this? Just say 'black pixel' if it is. Just test.", mode="qa")
        print(f"Result Success: {result.get('success')}")
        print(f"Model Used: {result.get('model_used')}")
        print(f"Answer: {result.get('answer')}")
        
        if result.get("success"):
            print("✅ Gemini Vision test PASSED")
        else:
            print(f"❌ Gemini Vision test FAILED: {result.get('answer')}")
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    test_gemini_vision()
