import asyncio
from openai import AsyncOpenAI
from config import (
    OPENROUTER_API_KEY,
    OPENROUTER_MODEL,
    OPENROUTER_BASE_URL,
    OPENROUTER_SITE_URL,
    OPENROUTER_SITE_NAME,
)


class LLMProvider:
    def __init__(self):
        default_headers = {}
        if OPENROUTER_SITE_URL:
            default_headers["HTTP-Referer"] = OPENROUTER_SITE_URL
        if OPENROUTER_SITE_NAME:
            default_headers["X-OpenRouter-Title"] = OPENROUTER_SITE_NAME

        self.client = AsyncOpenAI(
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            default_headers=default_headers if default_headers else None,
        )
        self.model = OPENROUTER_MODEL
        self.total_tokens_used = 0

    async def chat_completion(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        max_tokens: int = 2048,
        max_retries: int = 3,
    ) -> str:
        last_error = None
        for attempt in range(max_retries):
            try:
                response = await self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    extra_body={},
                )
                usage = response.usage
                if usage and usage.total_tokens:
                    self.total_tokens_used += usage.total_tokens
                content = response.choices[0].message.content
                return content.strip() if content else ""
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    await asyncio.sleep(1 * (attempt + 1))
        raise RuntimeError(
            f"LLM call failed after {max_retries} attempts: {last_error}"
        )
