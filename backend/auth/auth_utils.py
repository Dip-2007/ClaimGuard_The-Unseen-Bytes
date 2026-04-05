"""
Authentication utilities — password hashing, JWT creation/verification, dependency injection.
"""

import os
import jwt
from datetime import datetime, timedelta, timezone
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

# ── Config ─────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "claimguard-default-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 72  # 3 days

security = HTTPBearer(auto_error=False)


# ── Password ───────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    # Truncate to 72 bytes to avoid bcrypt error
    pw_bytes = password.encode('utf-8')[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        pw_bytes = plain.encode('utf-8')[:72]
        # Some generated hashes from passlib might have a slightly different prefix,
        # but checkpw handles standard bcrypt hashes fine.
        return bcrypt.checkpw(pw_bytes, hashed.encode('utf-8'))
    except Exception:
        return False


# ── JWT ────────────────────────────────────────────────────────────────
def create_token(user_id: str, email: str, name: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "name": name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")


# ── Dependencies ───────────────────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    Returns the decoded JWT payload if a valid token is provided.
    Returns None for guest users (no token).
    """
    if credentials is None:
        return None  # Guest user
    return decode_token(credentials.credentials)


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Strict auth dependency — raises 401 if no token.
    """
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    return decode_token(credentials.credentials)
