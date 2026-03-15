import requests
import base64

def test_ocr():
    url = "http://127.0.0.1:8000/analyze-image"
    
    # Tiny Red Dot JPEG Base64
    jpeg_b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    
    payload = {
        "image_data": jpeg_b64,
        "mode": "extraction"
    }
    
    print("Sending Extraction Request with JPEG...")
    try:
        res = requests.post(url, json=payload, timeout=40)
        
        if res.status_code == 200:
            print("✅ Success! Response:")
            print(res.json())
        else:
            print(f"❌ Error {res.status_code}: {res.text}")
            
    except Exception as e:
        print(f"❌ Connection Error: {e}")

if __name__ == "__main__":
    test_ocr()
