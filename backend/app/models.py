from sqlalchemy import (
    Column, String, DateTime, Enum, ForeignKey,
    Text, Boolean, Integer
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import uuid
import enum


class ApplicationStatus(str, enum.Enum):
    applied = "applied"
    in_process = "in_process"
    rejected = "rejected"
    selected = "selected"
    withdrawn = "withdrawn"


class Platform(str, enum.Enum):
    linkedin = "linkedin"
    indeed = "indeed"
    brightnetwork = "brightnetwork"
    gradcracker = "gradcracker"
    prospects = "prospects"
    milkround = "milkround"
    totaljobs = "totaljobs"
    reed = "reed"
    cv_library = "cv_library"
    nhs_jobs = "nhs_jobs"
    civil_service = "civil_service"
    workday = "workday"
    greenhouse = "greenhouse"
    taleo = "taleo"
    successfactors = "successfactors"
    direct = "direct"
    other = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    gmail_token = Column(Text, nullable=True)
    outlook_token = Column(Text, nullable=True)
    email_sync_enabled = Column(Boolean, default=False)
    last_email_sync = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    applications = relationship("Application", back_populates="user", cascade="all, delete-orphan")
    blocklist = relationship("EmailBlocklist", back_populates="user", cascade="all, delete-orphan")


class Application(Base):
    __tablename__ = "applications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    company = Column(String(255), nullable=False)
    role = Column(String(255), nullable=False)
    platform = Column(Enum(Platform), nullable=False, default=Platform.other)
    job_url = Column(Text, nullable=True)
    job_id_external = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    salary_range = Column(String(100), nullable=True)
    status = Column(Enum(ApplicationStatus), nullable=False, default=ApplicationStatus.applied)
    applied_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    status_updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    source_email_id = Column(String(255), nullable=True)
    source_email_subject = Column(Text, nullable=True)
    auto_detected = Column(Boolean, default=False)
    fingerprint = Column(String(64), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="applications")
    status_history = relationship("StatusHistory", back_populates="application", cascade="all, delete-orphan")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id = Column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False, index=True)
    old_status = Column(Enum(ApplicationStatus), nullable=True)
    new_status = Column(Enum(ApplicationStatus), nullable=False)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    changed_by = Column(String(20), default="user")
    note = Column(Text, nullable=True)

    application = relationship("Application", back_populates="status_history")


class EmailBlocklist(Base):
    __tablename__ = "email_blocklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    gmail_message_id = Column(String(255), nullable=False, index=True)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="blocklist")