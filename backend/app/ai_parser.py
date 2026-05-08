import json
import re
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

# Pre-filter: reject these immediately without calling AI
SHIFT_WORK_KEYWORDS = [
    "shift application",
    "shift availability",
    "shift accepted",
    "shift unsuccessful",
    "shift rejected",
    "shift confirmed",
    "shift cancelled",
    "shift reminder",
    "shift booking",
]


def ai_extract_job_info(subject: str, sender: str, body: str = "") -> dict:
    """
    Use Claude Haiku to extract job info and classify email type.
    Returns None for emails that are not real job application emails.
    """
    # Pre-filter shift work emails immediately
    subject_lower = subject.lower()
    for keyword in SHIFT_WORK_KEYWORDS:
        if keyword in subject_lower:
            print(f"Skipping shift work email: {subject}")
            return None

    # Use body only if it has meaningful content
    body_section = ""
    if body and len(body.strip()) > 20:
        body_section = f"\nEmail body (first 1500 chars): {body[:1500]}"

    prompt = f"""You are a job application email classifier and parser.

Email sender: {sender}
Email subject: {subject}{body_section}

Your job is to:
1. Decide if this is a real job application email
2. Classify what TYPE of email it is
3. Extract company name and job title

STEP 1 — Is this a real job application email?
YES if it is:
- Application confirmation from a company
- Interview invitation
- Rejection email
- Job offer
- Assessment invitation
- Application reminder or update

NO if it is:
- Job alert or newsletter ("1 new job matching your profile")
- Promotional email or advertisement
- General career newsletter
- Recruiter cold outreach (not response to your application)
- Shift work email

STEP 2 — What TYPE of email is it?
- "new" → First confirmation email ("thank you for applying", "we received your application", "application submitted", "application received")
- "update" → Status update ("interview invitation", "unfortunately", "we regret", "pleased to offer", "next stage", "shortlisted")
- "reminder" → Reminder or action required ("reminder", "incomplete", "please complete", "action required", "don't forget", "assessment invitation", "complete your application", "online assessment")
- "skip" → Not a real job application email

STEP 3 — Extract info:
- company: actual employer name. Not Indeed/LinkedIn/job boards. If truly unknown use null
- job_title: exact job title from subject OR body. Never return null — use "General Application" if nothing found

You MUST respond with ONLY a valid JSON object. No questions, no explanations, no markdown:
{{
    "is_job_application": true or false,
    "email_type": "new" or "update" or "reminder" or "skip",
    "company": "actual employer name or null",
    "job_title": "job title or General Application",
    "platform": "one of: linkedin, indeed, reed, totaljobs, cv_library, nhs_jobs, civil_service, workday, greenhouse, taleo, successfactors, brightnetwork, gradcracker, direct, other"
}}"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = message.content[0].text.strip()
        
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            print(f"AI parser error: no JSON found in response: {response_text}")
            return None
            
        result = json.loads(json_match.group())

        if not result.get("is_job_application", True):
            return None

        email_type = result.get("email_type", "new")
        
        if email_type == "skip":
            return None

        return {
            "company": result.get("company") or "Unknown Company",
            "job_title": result.get("job_title") or "General Application",
            "platform": result.get("platform") or "other",
            "email_type": email_type,
        }
    except Exception as e:
        print(f"AI parser error: {e}")
        return None