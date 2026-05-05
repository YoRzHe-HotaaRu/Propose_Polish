from datetime import datetime, timezone
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
    "guest": {
        "name": "Guest",
        "price_rm": 0,
        "daily_limit": 1,
        "features": ["1 free trial email", "Basic quality"],
    },
    "free": {
        "name": "Free",
        "price_rm": 0,
        "daily_limit": 5,
        "features": ["5 emails / day", "Formal & Friendly tones", "Basic quality"],
    },
    "pro": {
        "name": "Pro",
        "price_rm": 9.90,
        "daily_limit": 50,
        "features": ["50 emails / day", "All 5 tones", "Advanced analysis", "Ad-free"],
    },
    "premium": {
        "name": "Premium",
        "price_rm": 29.90,
        "daily_limit": 150,
        "features": ["150 emails / day", "All tones + custom", "Priority support", "PDF Export", "Detailed analytics", "API access"],
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

async def get_current_user(
    authorization: str = Header(None),
    x_anonymous_uid: str = Header(None, alias="X-Anonymous-UID"),
) -> dict:
    # Firebase-authenticated user
    if authorization:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid Authorization header")
        token = authorization[len("Bearer "):]
        _init_firebase()
        if _firebase_app is None:
            return {"uid": "firebase_unknown", "email": "unknown@local", "is_guest": False}
        try:
            from firebase_admin import auth
            decoded = auth.verify_id_token(token)
            decoded["is_guest"] = False
            return decoded
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Guest with anonymous device UID (per-device, stored in localStorage)
    if x_anonymous_uid:
        safe_uid = "guest_" + x_anonymous_uid[:64].replace("/", "_").replace("\\", "_")
        return {"uid": safe_uid, "email": "guest@local", "is_guest": True}

    # Fallback — no auth at all
    return {"uid": "guest_legacy", "email": "guest@local", "is_guest": True}

def _ensure_user_doc(uid: str, email: str = ""):
    """Create Firestore user doc on first login/registration so tier persists."""
    if uid.startswith("guest_"):
        return
    db = _get_firestore()
    if db is None:
        return
    ref = db.collection("users").document(uid)
    if not ref.get().exists:
        ref.set({
            "tier": "free",
            "email": email,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

def get_user_tier(uid: str) -> str:
    if uid.startswith("guest_"):
        return "guest"
    db = _get_firestore()
    if db is None:
        return "free"
    doc = db.collection("users").document(uid).get()
    if doc.exists:
        return doc.to_dict().get("tier", "free")
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

def check_subscription(uid: str, is_guest: bool = False) -> dict:
    # Auto-create user doc on first access (post-registration)
    if not uid.startswith("guest_"):
        _ensure_user_doc(uid)

    tier = get_user_tier(uid)
    tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
    usage = get_daily_usage(uid)
    limit = tier_info["daily_limit"]

    return {
        "tier": tier,
        "tier_name": tier_info["name"],
        "daily_usage": usage,
        "daily_limit": limit,
        "allowed": usage < limit,
        "is_guest": is_guest,
    }

def set_user_tier(uid: str, tier: str):
    if uid.startswith("guest_"):
        return
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
        "name": "Free",
        "price_rm": 0,
        "daily_limit": 5,
        "features": ["5 emails / day", "Formal & Friendly tones", "Basic quality", "Free forever"],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price_rm": 9.90,
        "daily_limit": 50,
        "features": ["50 emails / day", "All 5 tones", "Advanced analysis", "Ad-free", "High-quality emails"],
    },
    {
        "id": "premium",
        "name": "Premium",
        "price_rm": 29.90,
        "daily_limit": 150,
        "features": ["150 emails / day", "All tones + custom", "Priority support", "PDF Export", "Detailed analytics", "API access"],
    },
]
