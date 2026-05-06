from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from rapidfuzz import fuzz

from app.database import get_db
from app.models import Application, User
from app.schemas import DuplicateCheckRequest, DuplicateCheckResponse
from app.routers.auth import get_current_user
from app.utils.fingerprint import make_fingerprint

router = APIRouter(prefix="/duplicate", tags=["duplicate"])

EXACT_THRESHOLD = 95
FUZZY_THRESHOLD = 78


@router.post("/check", response_model=DuplicateCheckResponse)
def check_duplicate(
    payload: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate_fingerprint = make_fingerprint(payload.company, payload.role)
    candidate_label = f"{payload.company.lower()} {payload.role.lower()}"

    existing = db.query(Application).filter(
        Application.user_id == current_user.id
    ).all()

    best_score = 0.0
    best_match = None

    for app in existing:
        if app.fingerprint == candidate_fingerprint:
            return DuplicateCheckResponse(
                is_duplicate=True,
                confidence=1.0,
                matched_application=app,
                message=f"You already applied to {app.role} at {app.company} on {app.applied_at.strftime('%d %b %Y')} via {app.platform.value}.",
            )

        if payload.job_url and app.job_url:
            if _normalise_url(payload.job_url) == _normalise_url(app.job_url):
                return DuplicateCheckResponse(
                    is_duplicate=True,
                    confidence=0.99,
                    matched_application=app,
                    message=f"This job URL matches an application you already submitted for {app.role} at {app.company}.",
                )

        existing_label = f"{app.company.lower()} {app.role.lower()}"
        score = fuzz.token_sort_ratio(candidate_label, existing_label) / 100.0

        if score > best_score:
            best_score = score
            best_match = app

    if best_score >= EXACT_THRESHOLD / 100:
        return DuplicateCheckResponse(
            is_duplicate=True,
            confidence=round(best_score, 2),
            matched_application=best_match,
            message=f"This looks very similar to your application for {best_match.role} at {best_match.company}.",
        )

    if best_score >= FUZZY_THRESHOLD / 100:
        return DuplicateCheckResponse(
            is_duplicate=True,
            confidence=round(best_score, 2),
            matched_application=best_match,
            message=f"Possible duplicate — you may have already applied for {best_match.role} at {best_match.company}. Check before submitting.",
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