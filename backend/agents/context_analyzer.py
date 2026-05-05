import json
import re
from llm import LLMProvider

SYSTEM_PROMPT = """You are an expert email analyst. Given casual text, analyze the intent, urgency, and tone requirements for a professional email.

Return ONLY a valid JSON object with these keys:
- "intent": one of [request, apology, follow-up, complaint, gratitude, inquiry, update, other]
- "urgency": one of [low, medium, high]
- "target_tone": a brief string describing the recommended tone (e.g. "polite and professional")
- "key_points": an array of strings capturing the main points to include in the email

Do not include any text outside the JSON object."""


class ContextAnalyzer:
    def __init__(self, llm: LLMProvider):
        self.llm = llm

    async def analyze(self, text: str) -> dict:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Analyze this casual text for email drafting:\n\n{text}"},
        ]
        raw = await self.llm.chat_completion(messages, temperature=0.3, max_tokens=512)
        return self._parse_json(raw)

    @staticmethod
    def _parse_json(raw: str) -> dict:
        raw = raw.strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {
                "intent": "other",
                "urgency": "medium",
                "target_tone": "professional",
                "key_points": [raw],
            }
