from fastapi import APIRouter, HTTPException, Depends
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
from app.config import settings
from sqlalchemy.orm import Session
from rapidfuzz import fuzz
import re
import traceback

router = APIRouter(prefix="/gmail", tags=["Gmail"])


def safe_platform(value: str) -> Platform:
    val = (value or "other").lower().strip()
    return Platform[val] if val in Platform.__members__ else Platform.other


def is_generic_role(role: str) -> bool:
    return role.lower().strip() in ["general application", "unknown role", "unknown", "n/a", ""]


def is_generic_company(company: str) -> bool:
    return company.lower().strip() in [
        "unknown company", "unknown", "n/a", "",
        "placements/internships", "graduate jobs",
    ]


def normalise_company(name: str) -> str:
    """Strip legal suffixes so M&G plc and M&G match."""
    name = name.lower().strip()
    name = re.sub(r'\b(plc|ltd|limited|inc|llp|llc|group|uk|co)\b', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def find_existing(company: str, role: str, db: Session, user_id, ApplicationModel):
    existing_apps = db.query(ApplicationModel).filter(
        ApplicationModel.user_id == user_id
    ).all()

    best_match = None
    best_score = 0

    for existing in existing_apps:
        company_score = fuzz.token_sort_ratio(
            normalise_company(company),
            normalise_company(existing.company)
        )
        if company_score < 85:
            continue

        if is_generic_role(existing.role) or is_generic_role(role):
            score = company_score
        else:
            role_score = fuzz.token_sort_ratio(role.lower(), existing.role.lower())
            score = (company_score * 0.6) + (role_score * 0.4)

        if score > best_score:
            best_score = score
            best_match = existing

    return best_match if best_score >= 82 else None


def add_to_blocklist(db: Session, user_id, gmail_message_id: str, reason: str, EmailBlocklist):
    already = db.query(EmailBlocklist).filter(
        EmailBlocklist.user_id == user_id,
        EmailBlocklist.gmail_message_id == gmail_message_id,
    ).first()
    if not already:
        db.add(EmailBlocklist(
            user_id=user_id,
            gmail_message_id=gmail_message_id,
            reason=reason,
        ))


@router.get("/auth-status")
def gmail_auth_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.gmail_token:
        return {"authenticated": True, "message": "Gmail connected successfully"}
    return {"authenticated": False, "message": "Gmail not connected. Please authenticate."}


@router.get("/oauth/url")
def get_oauth_url(current_user: User = Depends(get_current_user)):
    try:
        url = generate_oauth_url(user_id=str(current_user.id))
        return {"url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating OAuth URL: {str(e)}")


@router.get("/oauth/callback")
def oauth_callback(code: str, state: str = None, db: Session = Depends(get_db)):
    try:
        token_json = exchange_code_for_token(code)
        user = None
        if state:
            from uuid import UUID
            try:
                user = db.query(User).filter(User.id == UUID(state)).first()
            except Exception:
                pass
        if not user:
            user = db.query(User).first()
        if user:
            user.gmail_token = token_json
            db.commit()
            print(f"Token saved for: {user.email}")
        return RedirectResponse(url=f"{settings.frontend_url}?gmail=connected")
    except Exception as e:
        print(traceback.format_exc())
        return RedirectResponse(url=f"{settings.frontend_url}?gmail=error&message={str(e)}")


@router.post("/authenticate")
def gmail_authenticate(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        url = generate_oauth_url(user_id=str(current_user.id))
        return {"success": True, "oauth_url": url}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")


@router.get("/scan")
def scan_gmail(
    max_results: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        creds = get_gmail_credentials_from_token(current_user.gmail_token) if current_user.gmail_token else get_gmail_credentials()
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
        creds = get_gmail_credentials_from_token(current_user.gmail_token) if current_user.gmail_token else get_gmail_credentials()
        if not creds:
            raise HTTPException(status_code=401, detail="Gmail not connected.")

        blocked_ids = {
            b.gmail_message_id
            for b in db.query(EmailBlocklist).filter(
                EmailBlocklist.user_id == current_user.id
            ).all()
        }

        already_imported_ids = {
            a.source_email_id
            for a in db.query(Application).filter(
                Application.user_id == current_user.id,
                Application.source_email_id.isnot(None)
            ).all()
        }
        blocked_ids = blocked_ids | already_imported_ids

        jobs = fetch_job_emails(
            max_results=max_results,
            blocked_ids=blocked_ids,
            credentials=creds,
        )

        status_map = {
            "Interview": ApplicationStatus.in_process,
            "Rejected":  ApplicationStatus.rejected,
            "Offer":     ApplicationStatus.selected,
            "Applied":   ApplicationStatus.applied,
        }

        imported = 0
        skipped  = 0
        updated  = 0

        for job in jobs:
            email_type = job.get("email_type", "new")
            new_status  = status_map.get(job["status"], ApplicationStatus.applied)

            # ── UPDATE emails ─────────────────────────────────────────────────
            if email_type == "update":
                add_to_blocklist(
                    db, current_user.id,
                    job["gmail_message_id"],
                    "update email - auto-blocklisted",
                    EmailBlocklist,
                )

                existing = find_existing(
                    job["company"], job["job_title"], db, current_user.id, Application
                )

                if existing:
                    changed = False
                    if new_status != ApplicationStatus.applied and existing.status == ApplicationStatus.applied:
                        print(f"Status: {existing.company} → {new_status.value}")
                        existing.status = new_status
                        changed = True
                    if is_generic_role(existing.role) and not is_generic_role(job["job_title"]):
                        print(f"Role: {existing.company} '{existing.role}' → '{job['job_title']}'")
                        existing.role = job["job_title"]
                        changed = True
                    if is_generic_company(existing.company) and not is_generic_company(job["company"]):
                        print(f"Company: '{existing.company}' → '{job['company']}'")
                        existing.company = job["company"]
                        changed = True
                    if changed:
                        db.flush()
                        updated += 1
                    skipped += 1
                    continue

                # No existing record — create new with correct status
                applied_at = None
                if job.get("applied_date"):
                    try:
                        applied_at = datetime.strptime(job["applied_date"], "%Y-%m-%d")
                    except ValueError:
                        applied_at = datetime.now()

                new_app = Application(
                    user_id=current_user.id,
                    company=job["company"],
                    role=job["job_title"],
                    platform=safe_platform(job.get("platform")),
                    status=new_status,
                    applied_at=applied_at,
                    source_email_id=job["gmail_message_id"],
                    source_email_subject=job["notes"],
                    auto_detected=True,
                    notes=job["notes"],
                )
                db.add(new_app)
                db.flush()
                imported += 1
                continue

            # ── REMINDER emails ───────────────────────────────────────────────
            if email_type == "reminder":
                add_to_blocklist(
                    db, current_user.id,
                    job["gmail_message_id"],
                    "reminder email - auto-blocklisted",
                    EmailBlocklist,
                )
                skipped += 1
                continue

            # ── NEW emails: check for duplicate by company+role ───────────────
            existing = find_existing(
                job["company"], job["job_title"], db, current_user.id, Application
            )
            if existing:
                changed = False
                if is_generic_role(existing.role) and not is_generic_role(job["job_title"]):
                    existing.role = job["job_title"]
                    changed = True
                if is_generic_company(existing.company) and not is_generic_company(job["company"]):
                    existing.company = job["company"]
                    changed = True
                if changed:
                    db.flush()
                    updated += 1
                skipped += 1
                continue

            # ── Insert genuinely new application ─────────────────────────────
            applied_at = None
            if job.get("applied_date"):
                try:
                    applied_at = datetime.strptime(job["applied_date"], "%Y-%m-%d")
                except ValueError:
                    applied_at = datetime.now()

            new_app = Application(
                user_id=current_user.id,
                company=job["company"],
                role=job["job_title"],
                platform=safe_platform(job.get("platform")),
                status=new_status,
                applied_at=applied_at,
                source_email_id=job["gmail_message_id"],
                source_email_subject=job["notes"],
                auto_detected=True,
                notes=job["notes"],
            )
            db.add(new_app)
            db.flush()
            imported += 1

        db.commit()
        return {
            "success":  True,
            "imported": imported,
            "skipped":  skipped,
            "updated":  updated,
            "message":  f"Imported {imported} new, updated {updated}, skipped {skipped}",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print("=== IMPORT ERROR ===")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")