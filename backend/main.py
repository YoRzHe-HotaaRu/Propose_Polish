from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from agents.pipeline import EmailPipeline
from auth import (
    get_current_user, check_subscription, increment_usage,
    SUBSCRIPTION_TIERS_LIST, set_user_tier
)

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


class SubscriptionStatus(BaseModel):
    tier: str
    tier_name: str
    daily_usage: int
    daily_limit: int
    allowed: bool


class SubscriptionInfo(BaseModel):
    tiers: list[dict]
    current_tier: str
    current_usage: int


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/subscription", response_model=SubscriptionInfo)
async def get_subscription(user: dict = Depends(get_current_user)):
    uid = user.get("uid", "anonymous")
    status = check_subscription(uid)
    return SubscriptionInfo(
        tiers=SUBSCRIPTION_TIERS_LIST,
        current_tier=status["tier"],
        current_usage=status["daily_usage"],
    )


@app.post("/api/subscription/upgrade")
async def upgrade_subscription(tier: str, user: dict = Depends(get_current_user)):
    uid = user.get("uid", "anonymous")
    valid_tiers = [t["id"] for t in SUBSCRIPTION_TIERS_LIST]
    if tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Choose: {', '.join(valid_tiers)}")
    set_user_tier(uid, tier)
    return {"status": "ok", "tier": tier}


@app.post("/api/transform", response_model=TransformResponse)
async def transform_email(req: TransformRequest, user: dict = Depends(get_current_user)):
    uid = user.get("uid", "anonymous")
    sub = check_subscription(uid)
    if not sub["allowed"]:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit reached ({sub['daily_usage']}/{sub['daily_limit']}). Upgrade to continue."
        )

    result = await pipeline.transform(
        text=req.text,
        tone=req.tone,
        length=req.length,
        recipient=req.recipient,
    )
    increment_usage(uid)

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
