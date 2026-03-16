import os
import base64
from vision import analyze_image_logic
from dotenv import load_dotenv

load_dotenv()

def test_final_vision():
    print("=== Testing Refactored Vision Logic (Groq/HF) ===")
    
    # Use the provided screenshot file
    image_path = os.path.join(os.path.dirname(__file__), "Screenshot 2026-03-15 191412.png")
    if not os.path.exists(image_path):
        print(f"Error: Screenshot not found at {image_path}")
        return

    with open(image_path, "rb") as f:
        image_bytes = f.read()
    
    prompt = "What is shown in this screenshot? Describe the main elements."
    
    print("\nRunning analyze_image_logic...")
    # This should now attempt Groq first, using the keys from .env
    result = analyze_image_logic(image_bytes, user_prompt=prompt, mode="qa")
    
    print("\n--- Final Result ---")
    print(f"Success: {result.get('success')}")
    print(f"Model Used: {result.get('model_used')}")
    if result.get('success'):
        print(f"Answer: {result.get('answer')[:200]}...")
    else:
        print(f"Error: {result.get('error')}")
        print(f"Full Response: {result}")

if __name__ == "__main__":
    test_final_vision()
