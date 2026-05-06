import base64
import re
from datetime import datetime
from googleapiclient.discovery import build
from app.gmail_auth import get_gmail_credentials


# Keywords that suggest a job application email
APPLICATION_KEYWORDS = [
    "application received",
    "thank you for applying",
    "thanks for applying",
    "we have received your application",
    "your application has been received",
    "application confirmation",
    "application submitted",
    "you applied for",
    "application for",
    "job application",
    "we received your cv",
    "we received your resume",
    "shortlisted",
    "interview invitation",
    "invite you to interview",
    "unfortunately",
    "not successful",
    "not been selected",
    "application unsuccessful",
    "regret to inform",
    "position has been filled",
    "offer of employment",
    "pleased to offer",
    "job offer",
]

STATUS_PATTERNS = {
    "Interview": [
        "interview", "invite you to interview", "shortlisted",
        "next stage", "assessment centre", "assessment center",
        "phone screen", "video call",
    ],
    "Rejected": [
        "unfortunately", "not successful", "not been selected",
        "unsuccessful", "regret to inform", "position has been filled",
        "not progressing", "not moving forward", "other candidates",
    ],
    "Offer": [
        "offer of employment", "pleased to offer", "job offer",
        "offer letter", "we would like to offer", "conditional offer",
    ],
    "Applied": [
        "application received", "thank you for applying", "thanks for applying",
        "application confirmation", "application submitted",
        "we have received your application",
    ],
}

IGNORED_SENDER_NAMES = {
    "indeed", "linkedin", "reed", "totaljobs", "cv-library", "cv library",
    "glassdoor", "monster", "jobsite", "fish4jobs", "guardian jobs",
    "noreply", "no reply", "no-reply", "careers", "recruitment", "hiring",
    "talent", "jobs", "notifications", "alerts", "awad pervez", "awad",
}

JOB_BOARD_DOMAINS = {
    "indeed", "linkedin", "reed", "totaljobs", "cv-library", "glassdoor",
    "monster", "jobsite", "workday", "greenhouse", "taleo", "successfactors",
    "applytojob", "smartrecruiters", "lever", "jobvite",
}


def get_gmail_service():
    creds = get_gmail_credentials()
    return build("gmail", "v1", credentials=creds)


def detect_status(subject: str, body: str) -> str:
    text = (subject + " " + body).lower()
    for status, keywords in STATUS_PATTERNS.items():
        for keyword in keywords:
            if keyword in text:
                return status
    return "Applied"


def clean_company_name(name: str) -> str:
    name = re.sub(
        r"\s*(no.?reply|careers|recruitment|jobs|hiring|talent|notifications|"
        r"alerts|team|hr|people|do not reply|donotreply)\s*$",
        "", name, flags=re.IGNORECASE
    ).strip()
    name = re.sub(r"^(careers|jobs|recruitment)\s+at\s+", "", name, flags=re.IGNORECASE).strip()
    return name


def extract_company_from_email(sender: str, subject: str, body: str) -> str:
    sender_match = re.match(r'^"?([^"<]+)"?\s*<', sender)
    if sender_match:
        sender_name = sender_match.group(1).strip()
        sender_name = clean_company_name(sender_name)
        if (sender_name and len(sender_name) > 2
                and "@" not in sender_name
                and sender_name.lower() not in IGNORED_SENDER_NAMES):
            return sender_name

    subject_patterns = [
        r"application (?:to|at|with)\s+([A-Z][A-Za-z0-9\s&'\-\.]{2,40}?)(?:\s+for|\s*[-]|\s*$)",
        r"(?:from|with)\s+([A-Z][A-Za-z0-9\s&'\-\.]{2,40}?)(?:\s+team|\s+careers|\s*$)",
        r"([A-Z][A-Za-z0-9\s&'\-\.]{2,40}?)\s+(?:careers|jobs|recruitment|hiring)",
    ]
    for pattern in subject_patterns:
        match = re.search(pattern, subject)
        if match:
            candidate = match.group(1).strip()
            candidate = clean_company_name(candidate)
            if (candidate and len(candidate) > 2
                    and candidate.lower() not in IGNORED_SENDER_NAMES
                    and not re.search(r'\b(the|position|role|job|vacancy|ref|req)\b', candidate, re.IGNORECASE)):
                return candidate

    email_match = re.search(r"@([^>]+)", sender)
    if email_match:
        full_domain = email_match.group(1).lower().strip()
        domain_parts = full_domain.split(".")
        main_domain = domain_parts[0] if domain_parts else ""
        if main_domain in ["noreply", "mail", "jobs", "careers", "no-reply", "mailer"]:
            main_domain = domain_parts[1] if len(domain_parts) > 1 else main_domain
        if (main_domain and main_domain not in JOB_BOARD_DOMAINS
                and main_domain not in ["gmail", "yahoo", "hotmail", "outlook", "noreply"]):
            return main_domain.replace("-", " ").title()

    return "Unknown Company"


def extract_job_title(subject: str, body: str) -> str:
    patterns = [
        r"(?:application for|applied for|role of|position of|vacancy for|job title[:\s]+)\s*[:\-]?\s*([^\n\r,\.]{5,60})",
        r"(?:re:|fw:)?\s*([A-Z][A-Za-z\s\-\/]+(?:Manager|Engineer|Developer|Analyst|Officer|Assistant|Coordinator|Specialist|Nurse|Doctor|Administrator|Director|Lead|Senior|Junior)[A-Za-z\s\-]*)",
    ]
    for pattern in patterns:
        match = re.search(pattern, subject + " " + body[:500], re.IGNORECASE)
        if match:
            title = match.group(1).strip()
            if 3 < len(title) < 80:
                return title

    clean_subject = re.sub(
        r"^(re:|fw:|fwd:|your application|application confirmation)[:\s]*",
        "", subject, flags=re.IGNORECASE,
    ).strip()
    if clean_subject:
        return clean_subject[:80]

    return "Unknown Role"


def is_job_application_email(subject: str) -> bool:
    text = subject.lower()
    return any(keyword in text for keyword in APPLICATION_KEYWORDS)


def fetch_job_emails(max_results: int = 50) -> list[dict]:
    """
    Fetch and parse job application emails from Gmail.
    Uses metadata-only mode for speed.
    """
    service = get_gmail_service()

    query = (
        "subject:(application OR applied OR interview OR offer OR shortlisted OR recruitment) "
        "newer_than:6m"
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
            full_msg = (
                service.users()
                .messages()
                .get(
                    userId="me",
                    id=msg["id"],
                    format="metadata",
                    metadataHeaders=["Subject", "From", "Date"],
                )
                .execute()
            )

            headers = {
                h["name"]: h["value"]
                for h in full_msg.get("payload", {}).get("headers", [])
            }

            subject = headers.get("Subject", "")
            sender = headers.get("From", "")
            date_str = headers.get("Date", "")

            if not is_job_application_email(subject):
                continue

            company = extract_company_from_email(sender, subject, "")
            job_title = extract_job_title(subject, "")
            status = detect_status(subject, "")

            applied_date = None
            try:
                for fmt in [
                    "%a, %d %b %Y %H:%M:%S %z",
                    "%d %b %Y %H:%M:%S %z",
                    "%a, %d %b %Y %H:%M:%S %Z",
                ]:
                    try:
                        applied_date = datetime.strptime(date_str, fmt).date().isoformat()
                        break
                    except ValueError:
                        continue
            except Exception:
                applied_date = datetime.now().date().isoformat()

            parsed_jobs.append({
                "gmail_message_id": msg["id"],
                "company": company,
                "job_title": job_title,
                "status": status,
                "applied_date": applied_date,
                "source": "Gmail",
                "notes": f"Auto-imported from Gmail. Subject: {subject[:100]}",
            })

        except Exception as e:
            print(f"Error parsing message {msg['id']}: {e}")
            continue

    return parsed_jobs