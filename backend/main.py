from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from agents.pipeline import EmailPipeline

app = FastAPI(title="Informal-to-Professional Email Drafter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = EmailPipeline()


class TransformRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Casual/informal text to transform")
    tone: Literal["formal", "friendly", "persuasive", "diplomatic", "apologetic"] = "formal"
    length: Literal["short", "medium", "long"] = "medium"
    recipient: Literal["boss", "client", "colleague", "professor", "stranger"] = "colleague"


class IntermediateStep(BaseModel):
    stage: str
    output: object


class TransformResponse(BaseModel):
    original: str
    final_email: str
    score: int
    feedback: str
    language: str = "en"
    analysis: dict
    intermediate_steps: list[IntermediateStep]
    tokens_used: int
    error: str | None = None


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/transform", response_model=TransformResponse)
async def transform_email(req: TransformRequest):
    result = await pipeline.transform(
        text=req.text,
        tone=req.tone,
        length=req.length,
        recipient=req.recipient,
    )
    return TransformResponse(
        original=result.get("original", ""),
        final_email=result.get("final_email", ""),
        score=result.get("score", 0),
        feedback=result.get("feedback", ""),
        language=result.get("analysis", {}).get("language", "en"),
        analysis=result.get("analysis", {}),
        intermediate_steps=[
            IntermediateStep(stage=s["stage"], output=s["output"])
            for s in result.get("intermediate_steps", [])
        ],
        tokens_used=result.get("tokens_used", 0),
        error=result.get("error"),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
