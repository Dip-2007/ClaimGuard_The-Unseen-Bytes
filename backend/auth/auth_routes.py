"""
Auth routes — Register, Login, Get Profile.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from db.database import get_db
from db.models import UserCreate, UserLogin, TokenResponse, UserResponse
from auth.auth_utils import hash_password, verify_password, create_token, require_auth

router = APIRouter(tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
async def register(body: UserCreate):
    """Register a new user account."""
    db = get_db()

    # Check if email already exists
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "An account with this email already exists")

    # Create user document
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "created_at": now,
        "updated_at": now,
    }

    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Create JWT token
    token = create_token(user_id, body.email.lower(), body.name)

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            name=body.name,
            email=body.email.lower(),
            created_at=now,
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin):
    """Login with email and password."""
    db = get_db()

    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        raise HTTPException(401, "Invalid email or password")

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")

    user_id = str(user["_id"])
    token = create_token(user_id, user["email"], user["name"])

    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            name=user["name"],
            email=user["email"],
            created_at=user.get("created_at", ""),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: dict = Depends(require_auth)):
    """Get the currently authenticated user's profile."""
    db = get_db()
    from bson import ObjectId

    user = await db.users.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(404, "User not found")

    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        created_at=user.get("created_at", ""),
    )
