import re
import base64
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from app.ai_parser import ai_extract_job_info

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
    if credentials is None:
        from app.gmail_auth import get_gmail_credentials
        credentials = get_gmail_credentials()
    return build("gmail", "v1", credentials=credentials)


def is_worth_checking(subject: str) -> bool:
    text = subject.lower()
    return any(keyword in text for keyword in FETCH_KEYWORDS)


def extract_text_from_html(html: str) -> str:
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
    html = html.replace('&nbsp;', ' ').replace('&amp;', '&')
    html = html.replace('&lt;', '<').replace('&gt;', '>')
    html = html.replace('&quot;', '"').replace('&#39;', "'")
    html = re.sub(r'[ \t]+', ' ', html)
    html = re.sub(r'\n\s*\n', '\n', html)
    return html.strip()


def decode_part(part_body: dict) -> str:
    data = part_body.get("data", "")
    if not data:
        return ""
    try:
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    except Exception:
        return ""


def get_email_body(payload) -> str:
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
            return "\n".join(plain_texts)[:2000].strip()
        if html_texts:
            combined = "\n".join(html_texts)
            return extract_text_from_html(combined)[:2000].strip()

    except Exception as e:
        print(f"Body extraction error: {e}")

    return ""


def fetch_job_emails(
    max_results: int = 100,
    blocked_ids: set = None,
    credentials: Credentials = None,
) -> list[dict]:
    service = get_gmail_service(credentials)
    if blocked_ids is None:
        blocked_ids = set()

    query = (
    "in:inbox subject:(application OR applied OR interview OR offer OR shortlisted OR "
    "recruitment OR acknowledgement OR assessment OR unfortunately OR thank) "
    "newer_than:12m"
)

    results = (
        service.users().messages()
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
                service.users().messages()
                .get(userId="me", id=msg["id"], format="full")
                .execute()
            )

            payload = full_msg.get("payload", {})
            headers = {h["name"]: h["value"] for h in payload.get("headers", [])}
            subject = headers.get("Subject", "")
            sender  = headers.get("From", "")

            if not is_worth_checking(subject):
                continue

            body = get_email_body(payload)
            extracted = ai_extract_job_info(subject, sender, body)
            if extracted is None:
                continue

            internal_date_ms = full_msg.get("internalDate")
            applied_date = (
                datetime.fromtimestamp(int(internal_date_ms) / 1000).date().isoformat()
                if internal_date_ms else
                datetime.now().date().isoformat()
            )

            parsed_jobs.append({
                "gmail_message_id": msg["id"],
                "company":          extracted["company"],
                "job_title":        extracted["job_title"],
                "status":           extracted["status"],
                "platform":         extracted["platform"],
                "applied_date":     applied_date,
                "email_type":       extracted["email_type"],
                "notes": f"Auto-imported from Gmail. Subject: {subject[:100]}",
            })

        except Exception as e:
            print(f"Error parsing message {msg['id']}: {e}")
            continue

    return parsed_jobs