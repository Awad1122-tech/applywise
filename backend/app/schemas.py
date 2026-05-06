from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from app.models import ApplicationStatus, Platform


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    email_sync_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Applications ──────────────────────────────────────────────────────────────

class ApplicationCreate(BaseModel):
    company: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    platform: Platform = Platform.other
    job_url: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    status: ApplicationStatus = ApplicationStatus.applied
    applied_at: Optional[datetime] = None
    notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    company: Optional[str] = None
    role: Optional[str] = None
    platform: Optional[Platform] = None
    job_url: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None


class StatusHistoryOut(BaseModel):
    old_status: Optional[ApplicationStatus]
    new_status: ApplicationStatus
    changed_at: datetime
    changed_by: str
    note: Optional[str]

    class Config:
        from_attributes = True


class ApplicationOut(BaseModel):
    id: UUID
    company: str
    role: str
    platform: Platform
    job_url: Optional[str]
    location: Optional[str]
    salary_range: Optional[str]
    status: ApplicationStatus
    applied_at: datetime
    auto_detected: bool
    notes: Optional[str]
    created_at: datetime
    status_history: List[StatusHistoryOut] = []

    class Config:
        from_attributes = True


# ── Duplicate check ───────────────────────────────────────────────────────────

class DuplicateCheckRequest(BaseModel):
    company: str
    role: str
    job_url: Optional[str] = None


class DuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    confidence: float
    matched_application: Optional[ApplicationOut] = None
    message: str


# ── Analytics ─────────────────────────────────────────────────────────────────

class AnalyticsSummary(BaseModel):
    total_applications: int
    by_status: dict
    by_platform: dict
    response_rate: float
    this_week: int
    this_month: int