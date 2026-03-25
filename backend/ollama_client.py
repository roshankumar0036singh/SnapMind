import requests
import json
import httpx
from typing import Dict, Any, Generator, Optional
import os

class OllamaClient:
    """
    Client for interacting with local Ollama instance.
    Mirrors the interface of the existing Mistral/Gemini clients.
    """
    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.default_model = model or os.getenv("OLLAMA_GENERATION_MODEL", "llama3")

    def _get_headers(self) -> Dict[str, str]:
        return {"Content-Type": "application/json"}

    def is_available(self) -> bool:
        """Check if Ollama service is running."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False

    def get_models(self) -> list[str]:
        """List available models."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=2)
            if response.status_code == 200:
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
            return []
        except requests.exceptions.RequestException:
            return []

    def generate(self, prompt: str, system_prompt: Optional[str] = None, model: Optional[str] = None, json_mode: bool = False, temperature: float = 0.7) -> str:
        """Generate a complete response (non-streaming)."""
        target_model = model or self.default_model
        
        payload = {
            "model": target_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature
            }
        }
        
        if system_prompt:
            payload["system"] = system_prompt
            
        if json_mode:
            payload["format"] = "json"

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                headers=self._get_headers(),
                json=payload,
                timeout=120  # Local generation can take time
            )
            response.raise_for_status()
            return response.json().get("response", "")
        except requests.exceptions.RequestException as e:
            print(f"[OllamaClient] Generation error: {e}")
            return f"Error connecting to local LLM: {str(e)}"

    def chat_stream(self, messages: list[dict], model: Optional[str] = None, temperature: float = 0.7) -> Generator[str, None, None]:
        """Generate a streaming response using chat format."""
        target_model = model or self.default_model
        
        # Convert messages from standard format to Ollama format
        ollama_messages = []
        for msg in messages:
            # Handle list-based content (e.g. from vision wrappers)
            content = msg.get("content", "")
            if isinstance(content, list):
                # Extract text blocks, ignore image blocks for local generation (unless vision model is explicitly used)
                text_content = ""
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_content += block.get("text", "") + "\n"
                content = text_content.strip()

            ollama_messages.append({
                "role": msg.get("role", "user"),
                "content": str(content)
            })

        payload = {
            "model": target_model,
            "messages": ollama_messages,
            "stream": True,
            "options": {
                "temperature": temperature
            }
        }

        try:
            with httpx.stream(
                "POST", 
                f"{self.base_url}/api/chat", 
                headers=self._get_headers(), 
                json=payload,
                timeout=120.0
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if line:
                        try:
                            chunk = json.loads(line)
                            if "message" in chunk and "content" in chunk["message"]:
                                yield chunk["message"]["content"]
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            print(f"[OllamaClient] Streaming error: {e}")
            yield f"\n\n[Error strictly connecting to local LLM: {str(e)}]"

# Singleton instance
ollama_client = OllamaClient()
