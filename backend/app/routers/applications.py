from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from uuid import UUID

from app.database import get_db
from app.models import Application, StatusHistory, ApplicationStatus, Platform, User, EmailBlocklist
from app.schemas import ApplicationCreate, ApplicationUpdate, ApplicationOut, AnalyticsSummary
from app.routers.auth import get_current_user
from app.utils.fingerprint import make_fingerprint

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("/", response_model=List[ApplicationOut])
def list_applications(
    status: Optional[ApplicationStatus] = None,
    platform: Optional[Platform] = None,
    search: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Application).filter(Application.user_id == current_user.id)

    if status:
        q = q.filter(Application.status == status)
    if platform:
        q = q.filter(Application.platform == platform)
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            (func.lower(Application.company).like(term)) |
            (func.lower(Application.role).like(term))
        )

    return q.order_by(Application.applied_at.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fingerprint = make_fingerprint(payload.company, payload.role)

    app = Application(
        user_id=current_user.id,
        fingerprint=fingerprint,
        applied_at=payload.applied_at or datetime.now(timezone.utc),
        **payload.model_dump(exclude={"applied_at"}),
    )
    db.add(app)
    db.flush()

    db.add(StatusHistory(
        application_id=app.id,
        old_status=None,
        new_status=app.status,
        changed_by="user",
    ))

    db.commit()
    db.refresh(app)
    return app


@router.get("/analytics", response_model=AnalyticsSummary)
def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    apps = db.query(Application).filter(Application.user_id == current_user.id).all()
    total = len(apps)

    by_status = {}
    by_platform = {}
    responded = 0
    now = datetime.now(timezone.utc)
    this_week = 0
    this_month = 0

    for a in apps:
        by_status[a.status.value] = by_status.get(a.status.value, 0) + 1
        by_platform[a.platform.value] = by_platform.get(a.platform.value, 0) + 1

        if a.status in (ApplicationStatus.in_process, ApplicationStatus.selected):
            responded += 1

        applied = a.applied_at
        if applied.tzinfo is None:
            applied = applied.replace(tzinfo=timezone.utc)

        if applied >= now - timedelta(days=7):
            this_week += 1
        if applied >= now - timedelta(days=30):
            this_month += 1

    return AnalyticsSummary(
        total_applications=total,
        by_status=by_status,
        by_platform=by_platform,
        response_rate=round(responded / total, 3) if total else 0.0,
        this_week=this_week,
        this_month=this_month,
    )


@router.get("/{app_id}", response_model=ApplicationOut)
def get_application(
    app_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = _get_or_404(db, app_id, current_user.id)
    return app


@router.patch("/{app_id}", response_model=ApplicationOut)
def update_application(
    app_id: UUID,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = _get_or_404(db, app_id, current_user.id)
    old_status = app.status

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(app, field, value)

    if payload.status and payload.status != old_status:
        db.add(StatusHistory(
            application_id=app.id,
            old_status=old_status,
            new_status=payload.status,
            changed_by="user",
        ))

    if payload.company or payload.role:
        app.fingerprint = make_fingerprint(app.company, app.role)

    db.commit()
    db.refresh(app)
    return app


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    app_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    app = _get_or_404(db, app_id, current_user.id)

    # If this was auto-imported from Gmail, add to blocklist so it never comes back
    if app.auto_detected and app.source_email_id:
        already_blocked = db.query(EmailBlocklist).filter(
            EmailBlocklist.user_id == current_user.id,
            EmailBlocklist.gmail_message_id == app.source_email_id,
        ).first()

        if not already_blocked:
            db.add(EmailBlocklist(
                user_id=current_user.id,
                gmail_message_id=app.source_email_id,
                reason="deleted by user",
            ))

    db.delete(app)
    db.commit()


def _get_or_404(db: Session, app_id: UUID, user_id: UUID) -> Application:
    app = db.query(Application).filter(
        Application.id == app_id,
        Application.user_id == user_id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app