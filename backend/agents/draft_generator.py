import json
from llm import LLMProvider

SYSTEM_PROMPT = """You are a professional business email writer. Convert informal text into a polished email. Include proper greeting, body with clear paragraphs, and appropriate closing.

Consider these guidelines:
- Recipient type affects the greeting and level of formality
- Length affects how much detail to include
- The context analysis tells you the intent, urgency, and key points
- Write the email in the SAME language as the original input text. If the input is in Malay, write in Malay. If Chinese, write in Chinese. Match the detected language exactly.

Return ONLY the email draft text. Do not include explanations, subject lines, or metadata — just the raw email body starting with the greeting."""

TONE_GUIDELINES = {
    "formal": "Use formal, respectful language. Avoid contractions. Maintain professional distance.",
    "friendly": "Use warm, approachable language while remaining professional. Light contractions are acceptable.",
    "persuasive": "Be compelling and convincing. Use confident language and clear value propositions.",
    "diplomatic": "Be tactful and balanced. Acknowledge multiple perspectives. Use softening language.",
    "apologetic": "Be sincerely apologetic. Take responsibility where appropriate. Offer to make amends.",
}

LENGTH_GUIDELINES = {
    "short": "Keep it to 2-3 concise sentences in a single paragraph.",
    "medium": "Write 2-3 short paragraphs covering the key points with moderate detail.",
    "long": "Write 3-4 detailed paragraphs thoroughly covering all points with context and nuance.",
}

RECIPIENT_GUIDELINES = {
    "boss": "Address with respect. Use 'Dear [Name]' or 'Hello [Name]'. Be direct and results-oriented. Close with 'Best regards'.",
    "client": "Address professionally. Use 'Dear [Name]'. Be service-oriented and courteous. Close with 'Kind regards' or 'Sincerely'.",
    "colleague": "Address collegially. Use 'Hi [Name]' or 'Hello [Name]'. Be collaborative. Close with 'Best' or 'Thanks'.",
    "professor": "Address with academic respect. Use 'Dear Professor [Name]'. Be deferential and precise. Close with 'Respectfully' or 'Best regards'.",
    "stranger": "Address formally. Use 'Dear [Name]' or 'To whom it may concern'. Introduce yourself briefly. Close with 'Sincerely' or 'Kind regards'.",
}


class DraftGenerator:
    def __init__(self, llm: LLMProvider):
        self.llm = llm

    async def generate(
        self,
        text: str,
        analysis: dict,
        tone: str = "formal",
        length: str = "medium",
        recipient: str = "colleague",
    ) -> str:
        tone_guide = TONE_GUIDELINES.get(tone, TONE_GUIDELINES["formal"])
        length_guide = LENGTH_GUIDELINES.get(length, LENGTH_GUIDELINES["medium"])
        recipient_guide = RECIPIENT_GUIDELINES.get(recipient, RECIPIENT_GUIDELINES["colleague"])

        user_prompt = f"""Original casual text:
{text}

Context Analysis:
{json.dumps(analysis, indent=2)}

Tone: {tone}
{tone_guide}

Length: {length}
{length_guide}

Recipient: {recipient}
{recipient_guide}

Write a professional email based on the above."""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
        return await self.llm.chat_completion(messages, temperature=0.7, max_tokens=1024)
