import os
import base64
from mistralai import Mistral
from dotenv import load_dotenv

load_dotenv()

def check():
    print("Checking Mistral SDK version and models...")
    try:
        import mistralai
        print(f"SDK Version: {getattr(mistralai, '__version__', 'unknown')}")
        
        from mistralai.models import UserMessage, TextChunk, ImageURLChunk
        import pydantic
        
        print("\n--- Validating dicts against models ---")
        
        # Test TextChunk
        text_dict = {"type": "text", "text": "Hello"}
        try:
            tc = pydantic.TypeAdapter(TextChunk).validate_python(text_dict)
            print(f"TextChunk dict valid: {tc}")
        except Exception as e:
            print(f"TextChunk dict invalid: {e}")
            
        # Test ImageURLChunk with string
        img_dict_str = {"type": "image_url", "image_url": "data:image/jpeg;base64,aaaa"}
        try:
            ic = pydantic.TypeAdapter(ImageURLChunk).validate_python(img_dict_str)
            print(f"ImageURLChunk dict (string) valid: {ic}")
        except Exception as e:
            print(f"ImageURLChunk dict (string) invalid: {e}")
            
        # Test ImageURLChunk with nested dict
        img_dict_nested = {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,aaaa"}}
        try:
            ic = pydantic.TypeAdapter(ImageURLChunk).validate_python(img_dict_nested)
            print(f"ImageURLChunk dict (nested) valid: {ic}")
        except Exception as e:
            print(f"ImageURLChunk dict (nested) invalid: {e}")
            
        # Test list of chunks
        from typing import List, Union
        ChunkUnion = Union[TextChunk, ImageURLChunk]
        chunk_list = [text_dict, img_dict_str]
        try:
            lst = pydantic.TypeAdapter(List[ChunkUnion]).validate_python(chunk_list)
            print(f"Chunk list (string) valid: {lst}")
        except Exception as e:
            print(f"Chunk list (string) invalid: {e}")
            
        chunk_list_nested = [text_dict, img_dict_nested]
        try:
            lst = pydantic.TypeAdapter(List[ChunkUnion]).validate_python(chunk_list_nested)
            print(f"Chunk list (nested) valid: {lst}")
        except Exception as e:
            print(f"Chunk list (nested) invalid: {e}")

            
    except ImportError as e:
        print(f"Import error: {e}")
    except Exception as e:
        print(f"General error: {e}")

if __name__ == "__main__":
    check()
