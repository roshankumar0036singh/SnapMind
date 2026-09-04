import json
from typing import List, Dict, Generator

from api_clients import get_mistral_client, get_openai_client, get_gemini_client
# from config import ModelRegistry, LLMProviderConfig
from ollama_client import ollama_client


class BaseLLMProvider:
    def __init__(self, api_keys: dict, model_target: str, model_used_name: str):
        self.api_keys = api_keys
        self.model_target = model_target
        self.model_used = model_used_name

    def generate(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        raise NotImplementedError

    def stream(self, system_content: str, messages: List[Dict[str, str]], **kwargs) -> Generator[str, None, None]:
        raise NotImplementedError

    async def generate_async(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        raise NotImplementedError


class MistralProvider(BaseLLMProvider):
    def generate(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        client = get_mistral_client(self.api_keys, task="chat")
        response = client.chat.complete(
            model=self.model_target,
            messages=messages,
            **kwargs
        )
        return response.choices[0].message.content

    async def generate_async(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        from api_clients import get_mistral_async_client
        client = get_mistral_async_client(self.api_keys)
        response = await client.chat.complete_async(
            model=self.model_target,
            messages=messages,
            **kwargs
        )
        return response.choices[0].message.content

    def stream(self, system_content: str, messages: List[Dict[str, str]], **kwargs) -> Generator[str, None, None]:
        client = get_mistral_client(self.api_keys, task="chat")
        if not client:
            raise ValueError("Mistral API key is missing. Please configure it in Settings -> Models.")
        try:
            stream_response = client.chat.stream(
                model=self.model_target,
                messages=messages,
            )
            for chunk in stream_response:
                if chunk.data.choices[0].delta.content:
                    text_chunk = chunk.data.choices[0].delta.content
                    yield text_chunk
        except Exception as mistral_stream_err:
            print(f"[LLM] Mistral streaming failed ({mistral_stream_err}). Falling back to non-streaming...")
            fallback_response = client.chat.complete(
                model=self.model_target,
                messages=messages,
            )
            full_response = fallback_response.choices[0].message.content or ""
            if full_response:
                yield full_response
            else:
                raise ValueError("Mistral non-streaming fallback returned empty response.")


class OpenAIProvider(BaseLLMProvider):
    def generate(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        client = get_openai_client(self.api_keys)
        response = client.chat.completions.create(
            model=self.model_target,
            messages=messages,
            **kwargs
        )
        return response.choices[0].message.content

    async def generate_async(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        from api_clients import get_openai_async_client
        client = get_openai_async_client(self.api_keys)
        response = await client.chat.completions.create(
            model=self.model_target,
            messages=messages,
            **kwargs
        )
        return response.choices[0].message.content

    def stream(self, system_content: str, messages: List[Dict[str, str]], **kwargs) -> Generator[str, None, None]:
        client = get_openai_client(self.api_keys)
        stream_response = client.chat.completions.create(
            model=self.model_target,
            messages=messages,
            stream=True
        )
        for chunk in stream_response:
            if getattr(getattr(chunk.choices[0], 'delta', None), 'content', None) is not None:
                text_chunk = chunk.choices[0].delta.content
                yield text_chunk


class GeminiProvider(BaseLLMProvider):
    def _format_gemini_messages(self, messages: List[Dict[str, str]]):
        gemini_system_instruction = ""
        if messages and messages[0]["role"] == "system":
            gemini_system_instruction = messages[0]["content"]

        gemini_contents = []
        for m in messages:
            if m["role"] != "system":
                parts = [{"text": m["content"]}]
                r = "user" if m["role"] == "user" else "model"
                gemini_contents.append({"role": r, "parts": parts})
        return gemini_system_instruction, gemini_contents

    def generate(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        client = get_gemini_client(self.api_keys)
        sys_inst, gemini_contents = self._format_gemini_messages(messages)

        from google.genai import types
        response = client.models.generate_content(
            model=self.model_target,
            contents=gemini_contents,
            config=types.GenerateContentConfig(system_instruction=sys_inst)
        )
        return response.text

    async def generate_async(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        client = get_gemini_client(self.api_keys)
        sys_inst, gemini_contents = self._format_gemini_messages(messages)

        from google.genai import types
        # Modern GenAI SDK uses standard async via client.aio
        response = await client.aio.models.generate_content(
            model=self.model_target,
            contents=gemini_contents,
            config=types.GenerateContentConfig(system_instruction=sys_inst)
        )
        return response.text

    def stream(self, system_content: str, messages: List[Dict[str, str]], **kwargs) -> Generator[str, None, None]:
        client = get_gemini_client(self.api_keys)
        sys_inst, gemini_contents = self._format_gemini_messages(messages)

        from google.genai import types
        stream_response = client.models.generate_content_stream(
            model=self.model_target,
            contents=gemini_contents,
            config=types.GenerateContentConfig(system_instruction=sys_inst)
        )
        for chunk in stream_response:
            text_chunk = chunk.text
            yield text_chunk


class OllamaProvider(BaseLLMProvider):
    def generate(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        return ollama_client.generate(
            prompt=query,
            system_prompt=system_content,
            model=self.model_target
        )

    async def generate_async(self, system_content: str, messages: List[Dict[str, str]], query: str, **kwargs) -> str:
        import asyncio
        # Ollama client is currently sync, so we run in thread executor
        return await asyncio.to_thread(
            ollama_client.generate,
            prompt=query,
            system_prompt=system_content,
            model=self.model_target
        )

    def stream(self, system_content: str, messages: List[Dict[str, str]], **kwargs) -> Generator[str, None, None]:
        stream_response = ollama_client.chat_stream(
            messages=messages,
            model=self.model_target
        )
        for text_chunk in stream_response:
            yield text_chunk


from config import settings

class LLMRouter:
    _providers = {
        "mistral": MistralProvider,
        "openai": OpenAIProvider,
        "gemini": GeminiProvider,
        "local": OllamaProvider,
        "hybrid": OllamaProvider,
        "ollama": OllamaProvider,
    }

    @classmethod
    def get_provider(cls, api_keys: dict = None) -> BaseLLMProvider:
        api_keys = api_keys or {}
        # [NEW] Default to settings values via Pydantic
        active_provider = api_keys.get("llm_provider", settings.llm_provider).lower()
        active_model = api_keys.get("llm_model", "")

        if active_provider in ["local", "hybrid", "ollama"]:
            model_target = active_model or "llama3.2" # Fallback if OLLAMA_GENERATION_MODEL missing
            model_used_name = f"Ollama ({model_target})"
            provider_class = cls._providers["ollama"]
        elif active_provider == "openai":
            model_target = active_model or "gpt-4o-mini"
            model_used_name = f"OpenAI ({model_target})"
            provider_class = cls._providers["openai"]
        elif active_provider == "gemini":
            model_target = active_model or settings.models.gemini_flash
            model_used_name = f"Gemini ({model_target})"
            provider_class = cls._providers["gemini"]
        else:
            # Default to Mistral Small for background/standard tasks
            model_target = active_model or settings.models.mistral_small
            model_used_name = f"Mistral ({model_target})"
            provider_class = cls._providers.get(active_provider, MistralProvider)

        return provider_class(api_keys, model_target, model_used_name)

    def __init__(self, api_keys: dict = None):
        self.api_keys = api_keys or {}

    def chat(self, prompt: str, system_instruction: str = "You are a helpful assistant.", model_id: str = None, history: list = None, **kwargs) -> str:
        """Unified chat call."""
        # Update api_keys with model_id if provided
        keys = self.api_keys.copy()
        if model_id:
            keys["llm_model"] = model_id
        
        provider = self.get_provider(keys)
        messages = [{"role": "system", "content": system_instruction}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})
        
        return provider.generate(system_instruction, messages, prompt, **kwargs)

    async def chat_async(self, prompt: str, system_instruction: str = "You are a helpful assistant.", model_id: str = None, history: list = None, **kwargs) -> str:
        """Unified async chat call."""
        keys = self.api_keys.copy()
        if model_id:
            keys["llm_model"] = model_id
        
        provider = self.get_provider(keys)
        messages = [{"role": "system", "content": system_instruction}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})
        
        return await provider.generate_async(system_instruction, messages, prompt, **kwargs)

    async def stream(self, prompt: str, system_instruction: str = "You are a helpful assistant.", model_id: str = None, history: list = None, **kwargs):
        """Unified streaming call."""
        keys = self.api_keys.copy()
        if model_id:
            keys["llm_model"] = model_id
            
        provider = self.get_provider(keys)
        messages = [{"role": "system", "content": system_instruction}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": prompt})
        
        # Generator is usually synchronous in these providers, but we yield as async
        for chunk in provider.stream(system_instruction, messages, **kwargs):
            # For providers that may return None deltas
            if chunk:
                yield chunk

# [STRICT_TYPES] Enforcing neural consistency for LLMRouter
