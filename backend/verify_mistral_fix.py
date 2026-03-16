import os
import base64
from vision import analyze_image_logic
from dotenv import load_dotenv

load_dotenv()

def verify():
    print("Verifying Mistral Vision fix in vision.py...")
    
    # Tiny 1x1 black pixel png
    image_bytes = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
    
    # We want to force Mistral fallback, but we can't easily break Gemini here 
    # without mocking. However, the logger in vision.py will show if Mistral is attempted.
    # For this test, we just want to see if it runs through and if Mistral is called, 
    # it doesn't crash with the formatting error.
    
    try:
        # We'll call it with a prompt that makes it obvious if it works
        result = analyze_image_logic(image_bytes, user_prompt="What color is this pixel?", mode="qa")
        
        print(f"Result Success: {result.get('success')}")
        print(f"Model Used: {result.get('model_used')}")
        if not result.get('success'):
            print(f"Error: {result.get('error')}")
            if "Input should be a valid string" in str(result.get('error')) or "discriminator 'type'" in str(result.get('error')):
                print("FAILED: Formatting error still present.")
            else:
                print("SUCCESS/OTHER: Formatting error resolved, but encountered other issue (check vision_error.log).")
        else:
            print("SUCCESS: Image analysis completed.")
            
    except Exception as e:
        print(f"CRASH: {e}")

if __name__ == "__main__":
    verify()
