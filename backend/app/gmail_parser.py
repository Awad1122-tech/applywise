import re
import base64
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from app.ai_parser import ai_extract_job_info


# Status detection — SUBJECT ONLY
STATUS_PATTERNS = {
    "Interview": [
        "interview invitation",
        "invited to interview",
        "invite you to interview",
        "shortlisted for interview",
        "pleased to invite",
        "video interview",
        "phone interview",
        "we would like to interview",
    ],
    "Rejected": [
        "unfortunately",
        "not successful",
        "not been selected",
        "unsuccessful",
        "regret to inform",
        "position has been filled",
        "not progressing",
        "not moving forward",
        "application was unsuccessful",
        "unable to progress",
        "not taken forward",
    ],
    "Offer": [
        "offer of employment",
        "pleased to offer",
        "job offer",
        "offer letter",
        "we would like to offer",
        "conditional offer",
        "formal offer",
    ],
}

FETCH_KEYWORDS = [
    "application", "applied", "applying",
    "interview", "shortlisted", "recruitment",
    "unfortunately", "not successful", "not been selected",
    "offer of employment", "job offer",
    "thank you for", "acknowledgement",
    "we received", "your application",
    "assessment", "next stage",
]


def get_gmail_service(credentials: Credentials = None):
    """Build Gmail service using provided credentials."""
    if credentials is None:
        from app.gmail_auth import get_gmail_credentials
        credentials = get_gmail_credentials()
    return build("gmail", "v1", credentials=credentials)


def detect_status(subject: str) -> str:
    """Detect status from SUBJECT ONLY."""
    text = subject.lower()
    for status, keywords in STATUS_PATTERNS.items():
        for keyword in keywords:
            if keyword in text:
                return status
    return "Applied"


def is_worth_checking(subject: str) -> bool:
    text = subject.lower()
    return any(keyword in text for keyword in FETCH_KEYWORDS)


def extract_text_from_html(html: str) -> str:
    """Strip HTML tags and return clean plain text."""
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    html = re.sub(r'<br\s*/?>', '\n', html)
    html = re.sub(r'<p[^>]*>', '\n', html)
    html = re.sub(r'</p>', '\n', html)
    html = re.sub(r'<td[^>]*>', ' ', html)
    html = re.sub(r'<tr[^>]*>', '\n', html)
    html = re.sub(r'<li[^>]*>', '\n- ', html)
    html = re.sub(r'<h[1-6][^>]*>', '\n', html)
    html = re.sub(r'</h[1-6]>', '\n', html)
    html = re.sub(r'<[^>]+>', '', html)
    html = html.replace('&nbsp;', ' ')
    html = html.replace('&amp;', '&')
    html = html.replace('&lt;', '<')
    html = html.replace('&gt;', '>')
    html = html.replace('&quot;', '"')
    html = html.replace('&#39;', "'")
    html = re.sub(r'[ \t]+', ' ', html)
    html = re.sub(r'\n\s*\n', '\n', html)
    return html.strip()


def decode_part(part_body: dict) -> str:
    """Decode base64 encoded email part."""
    data = part_body.get("data", "")
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def get_email_body(payload) -> str:
    """Extract ALL text from email — handles every format."""
    plain_texts = []
    html_texts = []

    def extract_all_parts(part):
        mime_type = part.get("mimeType", "")

        if mime_type == "text/plain":
            text = decode_part(part.get("body", {}))
            if text.strip():
                plain_texts.append(text)

        elif mime_type == "text/html":
            text = decode_part(part.get("body", {}))
            if text.strip():
                html_texts.append(text)

        elif mime_type.startswith("multipart/"):
            for subpart in part.get("parts", []):
                extract_all_parts(subpart)

        else:
            if "text" in mime_type:
                text = decode_part(part.get("body", {}))
                if text.strip():
                    plain_texts.append(text)

    try:
        if "parts" in payload:
            for part in payload["parts"]:
                extract_all_parts(part)
        else:
            extract_all_parts(payload)

        if plain_texts:
            combined = "\n".join(plain_texts)
            return combined[:1500].strip()

        if html_texts:
            combined = "\n".join(html_texts)
            clean = extract_text_from_html(combined)
            return clean[:1500].strip()

    except Exception as e:
        print(f"Body extraction error: {e}")

    return ""


def fetch_job_emails(
    max_results: int = 100,
    blocked_ids: set = None,
    credentials: Credentials = None,
) -> list[dict]:
    """
    Fetch and parse job application emails from Gmail using AI.
    Uses provided credentials — each user gets their own Gmail data.
    """
    service = get_gmail_service(credentials)
    if blocked_ids is None:
        blocked_ids = set()

    query = (
        "subject:(application OR applied OR interview OR offer OR shortlisted OR "
        "recruitment OR acknowledgement OR assessment OR unfortunately OR thank) "
        "newer_than:12m"
    )

    results = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )

    messages = results.get("messages", [])
    parsed_jobs = []

    for msg in messages:
        try:
            if msg["id"] in blocked_ids:
                continue

            full_msg = (
                service.users()
                .messages()
                .get(
                    userId="me",
                    id=msg["id"],
                    format="full",
                )
                .execute()
            )

            payload = full_msg.get("payload", {})
            headers = {
                h["name"]: h["value"]
                for h in payload.get("headers", [])
            }

            subject = headers.get("Subject", "")
            sender = headers.get("From", "")

            if not is_worth_checking(subject):
                continue

            body = get_email_body(payload)
            extracted = ai_extract_job_info(subject, sender, body)

            if extracted is None:
                continue

            company = extracted["company"]
            job_title = extracted["job_title"]
            platform = extracted["platform"]
            email_type = extracted.get("email_type", "new")
            status = detect_status(subject)

            internal_date_ms = full_msg.get("internalDate")
            if internal_date_ms:
                applied_date = datetime.fromtimestamp(int(internal_date_ms) / 1000).date().isoformat()
            else:
                applied_date = datetime.now().date().isoformat()

            parsed_jobs.append({
                "gmail_message_id": msg["id"],
                "company": company,
                "job_title": job_title,
                "status": status,
                "platform": platform,
                "applied_date": applied_date,
                "email_type": email_type,
                "source": "Gmail",
                "notes": f"Auto-imported from Gmail. Subject: {subject[:100]}",
            })

        except Exception as e:
            print(f"Error parsing message {msg['id']}: {e}")
            continue

    return parsed_jobs