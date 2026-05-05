from datetime import datetime, timezone, timedelta
from fastapi import Header, HTTPException
from config import get_firebase_credentials, FIREBASE_PROJECT_ID

_firebase_app = None
_firestore_client = None

# ============================================
# Subscription Tiers
# ============================================
# Pricing rationale (Gemini 2.5 Flash Lite: $0.10/M input, $0.40/M output):
#   Per email: ~2,700 input + ~1,030 output tokens = ~$0.00068 cost
#   Pro:    RM 9.90/month, API budget $1.00 → 1,470 emails/month → 50/day (with margin)
#   Premium: RM 29.90/month, API budget $3.00 → 4,410 emails/month → 150/day (with margin)

SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Percuma",
        "price_rm": 0,
        "daily_limit": 5,
        "features": ["Tones asas (Formal, Friendly)", "5 emel / hari", "Kualiti asas"],
    },
    "pro": {
        "name": "Pro",
        "price_rm": 9.90,
        "daily_limit": 50,
        "features": ["Semua 5 ton", "50 emel / hari", "Analisis lanjutan", "Tanpa iklan"],
    },
    "premium": {
        "name": "Premium",
        "price_rm": 29.90,
        "daily_limit": 150,
        "features": ["Semua ton + tersuai", "150 emel / hari", "Sokongan keutamaan", "Eksport PDF", "Analitik terperinci", "Akses API"],
    },
}

def _init_firebase():
    global _firebase_app, _firestore_client
    if _firebase_app is not None:
        return
    creds = get_firebase_credentials()
    if creds is None:
        return
    import firebase_admin
    from firebase_admin import credentials, firestore
    _firebase_app = firebase_admin.initialize_app(
        credentials.Certificate(creds),
        {"projectId": FIREBASE_PROJECT_ID},
    )
    _firestore_client = firestore.client()

def _get_firestore():
    _init_firebase()
    return _firestore_client

async def get_current_user(authorization: str = Header(None)):
    if not authorization:
        return {"uid": "anonymous", "email": "anonymous@local"}
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[len("Bearer "):]
    _init_firebase()
    if _firebase_app is None:
        return {"uid": "anonymous", "email": "anonymous@local"}
    try:
        from firebase_admin import auth
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_user_tier(uid: str) -> str:
    db = _get_firestore()
    if db is None:
        return "free"
    doc = db.collection("users").document(uid).get()
    if doc.exists:
        data = doc.to_dict()
        return data.get("tier", "free")
    return "free"

def get_daily_usage(uid: str) -> int:
    db = _get_firestore()
    if db is None:
        return 0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc = db.collection("usage").document(f"{uid}_{today}").get()
    if doc.exists:
        return doc.to_dict().get("count", 0)
    return 0

def increment_usage(uid: str) -> int:
    db = _get_firestore()
    if db is None:
        return 0
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    ref = db.collection("usage").document(f"{uid}_{today}")
    doc = ref.get()
    if doc.exists:
        new_count = doc.to_dict().get("count", 0) + 1
        ref.update({"count": new_count, "updated_at": datetime.now(timezone.utc)})
        return new_count
    else:
        ref.set({"count": 1, "uid": uid, "date": today, "created_at": datetime.now(timezone.utc)})
        return 1

def check_subscription(uid: str) -> dict:
    tier = get_user_tier(uid)
    usage = get_daily_usage(uid)
    limit = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])["daily_limit"]
    return {
        "tier": tier,
        "tier_name": SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])["name"],
        "daily_usage": usage,
        "daily_limit": limit,
        "allowed": usage < limit,
    }

def set_user_tier(uid: str, tier: str):
    db = _get_firestore()
    if db is None:
        return
    db.collection("users").document(uid).set({
        "tier": tier,
        "email": "",
        "updated_at": datetime.now(timezone.utc),
    }, merge=True)

SUBSCRIPTION_TIERS_LIST = [
    {
        "id": "free",
        "name": "Percuma",
        "price_rm": 0,
        "daily_limit": 5,
        "features": ["5 emel / hari", "Tones Formal & Friendly", "Kualiti asas", "Disokong iklan"],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_rm": 9.90,
        "daily_limit": 50,
        "features": ["50 emel / hari", "Semua 5 ton", "Analisis lanjutan", "Tanpa iklan", "E-mel berkualiti tinggi"],
    },
    {
        "id": "premium",
        "name": "Premium",
        "price_rm": 29.90,
        "daily_limit": 150,
        "features": ["150 emel / hari", "Semua ton + tersuai", "Sokongan keutamaan", "Eksport PDF", "Analitik terperinci", "Akses API"],
    },
]
