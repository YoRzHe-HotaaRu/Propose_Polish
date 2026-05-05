import json
import re
from llm import LLMProvider

SYSTEM_PROMPT = """You are a quality assurance specialist for business correspondence. Review this email and return a score from 1-10 plus any final improvements needed.

Check for:
1. No informal/casual language remains
2. Tone matches the target requirement
3. Clear call to action or purpose
4. No grammatical errors
5. Appropriate length for the specified format

Return ONLY a valid JSON object with these keys:
- "score": integer from 1 to 10
- "feedback": string with brief assessment and reasoning
- "final_email": string — if score < 7, return an improved version of the email; if score >= 7, return the original email unchanged

Do not include any text outside the JSON object."""


class QCChecker:
    def __init__(self, llm: LLMProvider):
        self.llm = llm

    async def review(
        self,
        email: str,
        tone: str = "formal",
        length: str = "medium",
    ) -> dict:
        user_prompt = f"""Target tone: {tone}
Target length: {length}

Email to review:
{email}"""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        raw = await self.llm.chat_completion(messages, temperature=0.2, max_tokens=1024)
        return self._parse_json(raw, email)

    @staticmethod
    def _parse_json(raw: str, fallback_email: str) -> dict:
        raw = raw.strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            raw = match.group(0)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {
                "score": 5,
                "feedback": "QC check failed to parse — manual review recommended.",
                "final_email": fallback_email,
            }
