from llm import LLMProvider

SYSTEM_PROMPT = """You are a meticulous email editor. Polish the following email draft to ensure it is professionally worded, grammatically perfect, and flows naturally.

Your tasks:
1. Fix any grammar or spelling errors
2. Replace casual or informal words with professional alternatives (e.g. "hey" → "Hello", "gonna" → "going to", "wanna" → "would like to", "btw" → "by the way" only if context-appropriate)
3. Improve sentence flow and readability — vary sentence structure, eliminate redundancy
4. Ensure proper email etiquette for the given tone
5. Keep placeholders like [Name] if present — do not fabricate names

Return ONLY the polished email text. No explanations, no commentary."""


class Polisher:
    def __init__(self, llm: LLMProvider):
        self.llm = llm

    async def polish(self, draft: str, tone: str = "formal") -> str:
        user_prompt = f"""Target tone: {tone}

Email draft to polish:
{draft}"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        return await self.llm.chat_completion(messages, temperature=0.4, max_tokens=1024)
