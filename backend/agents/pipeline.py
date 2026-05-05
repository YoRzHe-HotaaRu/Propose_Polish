import traceback
from llm import LLMProvider
from agents.context_analyzer import ContextAnalyzer
from agents.draft_generator import DraftGenerator
from agents.polisher import Polisher
from agents.qc_checker import QCChecker


class EmailPipeline:
    def __init__(self, llm: LLMProvider | None = None):
        self.llm = llm or LLMProvider()
        self.analyzer = ContextAnalyzer(self.llm)
        self.generator = DraftGenerator(self.llm)
        self.polisher = Polisher(self.llm)
        self.qc = QCChecker(self.llm)

    async def transform(
        self,
        text: str,
        tone: str = "formal",
        length: str = "medium",
        recipient: str = "colleague",
    ) -> dict:
        intermediate_steps = []
        total_tokens_start = self.llm.total_tokens_used

        try:
            print(f"\n[Pipeline] Stage 1/4: Context Analysis...")
            analysis = await self.analyzer.analyze(text)
            print(f"[Pipeline] Analysis: {analysis}")
            intermediate_steps.append({"stage": "context_analysis", "output": analysis})
        except Exception as e:
            traceback.print_exc()
            return self._error_result(f"Context analysis failed: {str(e)}", intermediate_steps)

        try:
            print(f"\n[Pipeline] Stage 2/4: Generating Draft...")
            draft = await self.generator.generate(text, analysis, tone, length, recipient)
            print(f"[Pipeline] Draft: {draft[:200]}...")
            intermediate_steps.append({"stage": "draft", "output": draft})
        except Exception as e:
            traceback.print_exc()
            return self._error_result(f"Draft generation failed: {str(e)}", intermediate_steps)

        try:
            print(f"\n[Pipeline] Stage 3/4: Polishing...")
            polished = await self.polisher.polish(draft, tone)
            print(f"[Pipeline] Polished: {polished[:200]}...")
            intermediate_steps.append({"stage": "polished", "output": polished})
        except Exception as e:
            traceback.print_exc()
            return self._error_result(f"Polishing failed: {str(e)}", intermediate_steps)

        try:
            print(f"\n[Pipeline] Stage 4/4: QC Review...")
            qc_result = await self.qc.review(polished, tone, length)
            print(f"[Pipeline] QC Score: {qc_result.get('score')}, Feedback: {qc_result.get('feedback')}")
            intermediate_steps.append({"stage": "qc_review", "output": qc_result})
        except Exception as e:
            traceback.print_exc()
            return self._error_result(f"QC review failed: {str(e)}", intermediate_steps)

        tokens_used = self.llm.total_tokens_used - total_tokens_start

        return {
            "original": text,
            "analysis": analysis,
            "draft": draft,
            "polished": polished,
            "final_email": qc_result.get("final_email", polished),
            "score": qc_result.get("score", 0),
            "feedback": qc_result.get("feedback", ""),
            "intermediate_steps": intermediate_steps,
            "tokens_used": tokens_used,
        }

    @staticmethod
    def _error_result(message: str, steps: list) -> dict:
        return {
            "error": message,
            "original": "",
            "analysis": {},
            "draft": "",
            "polished": "",
            "final_email": "",
            "score": 0,
            "feedback": message,
            "intermediate_steps": steps,
            "tokens_used": 0,
        }
