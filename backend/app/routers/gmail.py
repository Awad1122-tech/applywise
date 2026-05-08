from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from app.gmail_parser import fetch_job_emails
from app.gmail_auth import (
    get_gmail_credentials,
    get_gmail_credentials_from_token,
    generate_oauth_url,
    exchange_code_for_token,
    TOKEN_FILE,
)
from app.models import ApplicationStatus, Platform, User
from app.routers.auth import get_current_user
from app.database import get_db
from sqlalchemy.orm import Session
from rapidfuzz import fuzz
import os
import json
import traceback

router = APIRouter(prefix="/gmail", tags=["Gmail"])


@router.get("/auth-status")
def gmail_auth_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if current user has Gmail connected."""
    if current_user.gmail_token:
        return {"authenticated": True, "message": "Gmail connected successfully"}
    return {"authenticated": False, "message": "Gmail not connected. Please authenticate."}


@router.get("/oauth/url")
def get_oauth_url(
    current_user: User = Depends(get_current_user),
):
    """Get Google OAuth URL for current user to authenticate."""
    try:
        url = generate_oauth_url(user_id=str(current_user.id))
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating OAuth URL: {str(e)}")


@router.get("/oauth/callback")
def oauth_callback(
    code: str,
    state: str = None,
    db: Session = Depends(get_db),
):
    """
    Handle Google OAuth callback.
    Reads user_id from state parameter and saves token to that user.
    """
    try:
        print("=== OAUTH CALLBACK STARTED ===")
        print(f"=== STATE (user_id): {state} ===")

        token_json = exchange_code_for_token(code)
        print("=== TOKEN EXCHANGED SUCCESSFULLY ===")

        # Find user by ID from state parameter
        user = None
        if state:
            from uuid import UUID
            try:
                user = db.query(User).filter(User.id == UUID(state)).first()
            except Exception:
                pass

        if not user:
            print("=== USER NOT FOUND BY STATE, trying fallback ===")
            user = db.query(User).first()

        if user:
            user.gmail_token = token_json
            db.commit()
            print(f"=== TOKEN SAVED FOR USER: {user.email} ===")

        return RedirectResponse(url="http://localhost:5173?gmail=connected")

    except Exception as e:
        print("=== OAUTH CALLBACK ERROR ===")
        print(traceback.format_exc())
        return RedirectResponse(url=f"http://localhost:5173?gmail=error&message={str(e)}")


@router.post("/authenticate")
def gmail_authenticate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return OAuth URL for frontend to redirect user."""
    try:
        url = generate_oauth_url(user_id=str(current_user.id))
        return {"success": True, "oauth_url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")


def find_existing_application(job: dict, db: Session, user_id, ApplicationModel):
    """Find if a matching application already exists in database."""
    email_exists = db.query(ApplicationModel).filter(
        ApplicationModel.source_email_id == job["gmail_message_id"]
    ).first()
    if email_exists:
        return email_exists

    is_general = job["job_title"].lower() in ["general application", "unknown role"]

    existing_apps = db.query(ApplicationModel).filter(
        ApplicationModel.user_id == user_id
    ).all()

    for existing in existing_apps:
        company_score = fuzz.token_sort_ratio(
            job["company"].lower(),
            existing.company.lower()
        )

        if company_score >= 80:
            if is_general:
                return existing
            else:
                role_score = fuzz.token_sort_ratio(
                    job["job_title"].lower(),
                    existing.role.lower()
                )
                if role_score >= 70:
                    return existing

    return None


@router.get("/scan")
def scan_gmail(
    max_results: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan Gmail for job application emails — preview only."""
    try:
        if current_user.gmail_token:
            creds = get_gmail_credentials_from_token(current_user.gmail_token)
        else:
            creds = get_gmail_credentials()

        jobs = fetch_job_emails(max_results=max_results, credentials=creds)
        return {"success": True, "count": len(jobs), "jobs": jobs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail scan failed: {str(e)}")


@router.post("/import")
def import_gmail_jobs(
    max_results: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models import Application, EmailBlocklist
    from datetime import datetime

    try:
        if current_user.gmail_token:
            creds = get_gmail_credentials_from_token(current_user.gmail_token)
        else:
            creds = get_gmail_credentials()

        if not creds:
            raise HTTPException(
                status_code=401,
                detail="Gmail not connected. Please connect your Gmail account first."
            )

        blocklist = db.query(EmailBlocklist).filter(
            EmailBlocklist.user_id == current_user.id
        ).all()
        blocked_ids = {b.gmail_message_id for b in blocklist}

        jobs = fetch_job_emails(
            max_results=max_results,
            blocked_ids=blocked_ids,
            credentials=creds
        )
        imported = 0
        skipped = 0
        updated = 0

        status_map = {
            "Interview": ApplicationStatus.in_process,
            "Rejected": ApplicationStatus.rejected,
            "Offer": ApplicationStatus.selected,
            "Applied": ApplicationStatus.applied,
        }

        for job in jobs:
            email_type = job.get("email_type", "new")
            existing = find_existing_application(
                job, db, current_user.id, Application
            )

            if existing:
                new_status = status_map.get(job["status"])
                if new_status and new_status != ApplicationStatus.applied:
                    if existing.status == ApplicationStatus.applied:
                        existing.status = new_status
                        db.flush()
                        updated += 1
                skipped += 1
                continue

            if email_type == "reminder":
                skipped += 1
                continue

            status = status_map.get(job["status"], ApplicationStatus.applied)

            applied_at = None
            if job.get("applied_date"):
                try:
                    applied_at = datetime.strptime(job["applied_date"], "%Y-%m-%d")
                except ValueError:
                    applied_at = datetime.now()

            new_job = Application(
                user_id=current_user.id,
                company=job["company"],
                role=job["job_title"],
                platform=Platform[job.get("platform", "other")],
                status=status,
                applied_at=applied_at,
                source_email_id=job["gmail_message_id"],
                source_email_subject=job["notes"],
                auto_detected=True,
                notes=job["notes"],
            )
            db.add(new_job)
            db.flush()
            imported += 1

        db.commit()
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "updated": updated,
            "message": f"Imported {imported} new jobs, updated {updated} statuses, skipped {skipped}",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")