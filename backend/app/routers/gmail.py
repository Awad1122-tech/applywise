from fastapi import APIRouter, HTTPException
from app.gmail_parser import fetch_job_emails
from app.gmail_auth import get_gmail_credentials, TOKEN_FILE
from app.models import ApplicationStatus, Platform
import os

router = APIRouter(prefix="/gmail", tags=["Gmail"])


@router.get("/auth-status")
def gmail_auth_status():
    """Check if Gmail is authenticated."""
    if os.path.exists(TOKEN_FILE):
        try:
            creds = get_gmail_credentials()
            if creds and creds.valid:
                return {"authenticated": True, "message": "Gmail connected successfully"}
        except Exception as e:
            return {"authenticated": False, "message": str(e)}
    return {"authenticated": False, "message": "No token found. Please authenticate."}


@router.post("/authenticate")
def gmail_authenticate():
    """Trigger Gmail OAuth flow."""
    try:
        creds = get_gmail_credentials()
        if creds and creds.valid:
            return {"success": True, "message": "Gmail authenticated successfully!"}
        else:
            raise HTTPException(status_code=500, detail="Authentication failed")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auth error: {str(e)}")


@router.get("/scan")
def scan_gmail(max_results: int = 50):
    """
    Scan Gmail for job application emails and return parsed results.
    Does NOT save to database — preview only.
    """
    try:
        jobs = fetch_job_emails(max_results=max_results)
        return {
            "success": True,
            "count": len(jobs),
            "jobs": jobs,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gmail scan failed: {str(e)}")


@router.post("/import")
def import_gmail_jobs(max_results: int = 50):
    """
    Scan Gmail and save new job applications to the database.
    Skips duplicates based on source_email_id.
    Requires a user_id — uses first user in DB for now.
    """
    from app.database import SessionLocal
    from app.models import Application, User

    db = SessionLocal()
    try:
        # Get first user from DB (single-user mode for now)
        user = db.query(User).first()
        if not user:
            raise HTTPException(status_code=404, detail="No user found in database. Please log in first.")

        jobs = fetch_job_emails(max_results=max_results)
        imported = 0
        skipped = 0

        for job in jobs:
            # Check for duplicate by source_email_id
            existing = (
                db.query(Application)
                .filter(Application.source_email_id == job["gmail_message_id"])
                .first()
            )

            if existing:
                skipped += 1
                continue

            # Map status string to enum
            status_map = {
                "Applied": ApplicationStatus.applied,
                "Interview": ApplicationStatus.in_process,
                "Rejected": ApplicationStatus.rejected,
                "Offer": ApplicationStatus.selected,
            }
            status = status_map.get(job["status"], ApplicationStatus.applied)

            new_job = Application(
                user_id=user.id,
                company=job["company"],
                role=job["job_title"],
                platform=Platform[job.get("platform", "other")],
                status=status,
                source_email_id=job["gmail_message_id"],
                source_email_subject=job["notes"],
                auto_detected=True,
                notes=job["notes"],
            )
            db.add(new_job)
            imported += 1

        db.commit()
        return {
            "success": True,
            "imported": imported,
            "skipped": skipped,
            "message": f"Imported {imported} new jobs, skipped {skipped} duplicates",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        db.close()