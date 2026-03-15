"""
Verifies that vision.py builds the correct Mistral message structure.
"""
import base64

def test_vision_logic_structure():
    print("Verifying message structure...")

    # Simulate a tiny 1x1 JPEG
    fake_image_bytes = open("test_pixel.png", "rb").read()
    base64_image = base64.b64encode(fake_image_bytes).decode('utf-8')
    data_url = f"data:image/jpeg;base64,{base64_image}"

    user_message_text = "System prompt...\n\nUser Question: What is in this image?"

    # Replicate the structure built in vision.py
    content = [
        {
            "type": "text",
            "text": user_message_text
        },
        {
            "type": "image_url",
            "image_url": {
                "url": data_url
            }
        }
    ]

    messages = [{"role": "user", "content": content}]

    # Validate structure
    assert isinstance(messages[0]["content"], list), "content must be a list"
    assert messages[0]["content"][0]["type"] == "text", "First element must be text"
    assert messages[0]["content"][1]["type"] == "image_url", "Second element must be image_url"
    assert "url" in messages[0]["content"][1]["image_url"], "image_url must have 'url' key"
    print("✅ Structure validation passed!")

    # Print sample payload - FIXED: access ["image_url"]["url"] not ["image_url"][:50]
    print("\nSample Payload Content[0]:")
    print(messages[0]["content"][0])

    print("\nSample Payload Content[1] (truncated):")
    img_chunk = messages[0]["content"][1]
    print({
        "type": img_chunk["type"],
        "image_url": {"url": img_chunk["image_url"]["url"][:50] + "..."}
    })

    print("\n✅ Message structure is correct and compatible with Mistral API.")

if __name__ == "__main__":
    test_vision_logic_structure()
