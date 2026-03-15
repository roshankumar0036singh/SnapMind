import os
import requests
import base64
import json

# Backend URL
BACKEND_URL = "http://localhost:8000"

def test_image_ingestion():
    """
    Test uploading an image and verifying its metadata in the DB.
    Note: Requires backend to be running.
    """
    print("--- Testing Image Ingestion ---")
    
    # Create a dummy image or use a real one if available
    # For testing the pipeline without needing a real image content,
    # we just need valid bytes that are recognized as an image.
    # However, for Pixtral to work, it really needs an image.
    
    # Let's try to find an existing image in the project or workspace
    # Since I don't have a guaranteed path, I'll use a small base64 pixel as a fallback
    # but a real image is better.
    
    # 1x1 Transparent PNG
    pixel_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
    image_bytes = base64.b64decode(pixel_b64)
    
    # Use a dummy image from the current directory if it exists, or create one
    img_path = os.path.join(os.path.dirname(__file__), "test_pixel.png")
    if not os.path.exists(img_path):
        from PIL import Image
        img = Image.new('RGB', (100, 100), color=(73, 109, 137))
        img.save(img_path)
    
    try:
        with open(img_path, "rb") as f:
            files = {"file": (os.path.basename(img_path), f, "image/png")}
            data = {"url": "https://test-vision-rag.com/image.png"}
            headers = {} # Backend reads .env for keys
            
            print(f"Uploading {os.path.basename(img_path)}...")
            response = requests.post(f"{BACKEND_URL}/ingest/file", files=files, data=data, headers=headers)
            
            if response.status_code == 200:
                print("✅ Ingestion successful!")
                print(json.dumps(response.json(), indent=2))
            else:
                print(f"❌ Ingestion failed with status {response.status_code}:")
                print(response.text)
                
    except Exception as e:
        print(f"❌ Connection error: {e}")

if __name__ == "__main__":
    test_image_ingestion()
