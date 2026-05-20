from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from rapidfuzz import fuzz
from app.database import get_db
from app.models import Application, User
from app.schemas import DuplicateCheckRequest, DuplicateCheckResponse
from app.routers.auth import get_current_user
from app.utils.fingerprint import make_fingerprint

router = APIRouter(prefix="/duplicate", tags=["duplicate"])

EXACT_THRESHOLD = 0.95
FUZZY_THRESHOLD = 0.78
COMPANY_ONLY_THRESHOLD = 0.90  # If company matches very strongly, flag it


@router.post("/check", response_model=DuplicateCheckResponse)
def check_duplicate(
    payload: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate_fingerprint = make_fingerprint(payload.company, payload.role)
    candidate_company = payload.company.lower().strip()
    candidate_role = payload.role.lower().strip()
    candidate_label = f"{candidate_company} {candidate_role}"

    existing = db.query(Application).filter(
        Application.user_id == current_user.id
    ).all()

    best_score = 0.0
    best_match = None
    best_company_score = 0.0
    best_company_match = None

    for app in existing:
        # Exact fingerprint match
        if app.fingerprint == candidate_fingerprint:
            return DuplicateCheckResponse(
                is_duplicate=True,
                confidence=1.0,
                matched_application=app,
                message=f"You already applied to {app.role} at {app.company} on {app.applied_at.strftime('%d %b %Y')} via {app.platform.value}.",
            )

        # URL match
        if payload.job_url and app.job_url:
            if _normalise_url(payload.job_url) == _normalise_url(app.job_url):
                return DuplicateCheckResponse(
                    is_duplicate=True,
                    confidence=0.99,
                    matched_application=app,
                    message=f"This job URL matches an application you already submitted for {app.role} at {app.company}.",
                )

        # Full label fuzzy match
        existing_label = f"{app.company.lower()} {app.role.lower()}"
        score = fuzz.token_sort_ratio(candidate_label, existing_label) / 100.0
        if score > best_score:
            best_score = score
            best_match = app

        # Company-only match (catches "General Application" vs real role)
        company_score = fuzz.token_sort_ratio(candidate_company, app.company.lower()) / 100.0
        if company_score > best_company_score:
            best_company_score = company_score
            best_company_match = app

    # Strong full match
    if best_score >= EXACT_THRESHOLD:
        return DuplicateCheckResponse(
            is_duplicate=True,
            confidence=round(best_score, 2),
            matched_application=best_match,
            message=f"You already applied to {best_match.role} at {best_match.company} on {best_match.applied_at.strftime('%d %b %Y')}.",
        )

    # Fuzzy full match
    if best_score >= FUZZY_THRESHOLD:
        return DuplicateCheckResponse(
            is_duplicate=True,
            confidence=round(best_score, 2),
            matched_application=best_match,
            message=f"This looks very similar to your application for {best_match.role} at {best_match.company}.",
        )

    # Company-only match — catches cases where role was saved as "General Application"
    if best_company_score >= COMPANY_ONLY_THRESHOLD:
        return DuplicateCheckResponse(
            is_duplicate=True,
            confidence=round(best_company_score, 2),
            matched_application=best_company_match,
            message=f"You already have an application at {best_company_match.company} on {best_company_match.applied_at.strftime('%d %b %Y')}. Check before applying again!",
        )

    return DuplicateCheckResponse(
        is_duplicate=False,
        confidence=round(best_score, 2),
        matched_application=None,
        message="No duplicate found. Good to apply!",
    )


def _normalise_url(url: str) -> str:
    import re
    url = url.lower().strip().rstrip("/")
    url = re.sub(r"\?.*$", "", url)
    url = re.sub(r"^https?://", "", url)
    url = re.sub(r"^www\.", "", url)
    return url