"""
Pydantic models for auth and activity tracking.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ── Auth Models ────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Activity Models ────────────────────────────────────────────────────

class ActivityItem(BaseModel):
    id: str
    type: str  # "upload" | "chat"
    title: str
    description: str
    timestamp: str
    metadata: Optional[dict] = None


class HistoryResponse(BaseModel):
    activities: List[ActivityItem]
    total: int


# ── Chat Persistence ──────────────────────────────────────────────────

class ChatSessionCreate(BaseModel):
    title: str
    messages: list
    filter_tag: Optional[str] = "All"
    attached_file_name: Optional[str] = None


class ChatSessionResponse(BaseModel):
    id: str
    title: str
    messages: list
    filter_tag: Optional[str] = "All"
    attached_file_name: Optional[str] = None
    created_at: str
    updated_at: str
