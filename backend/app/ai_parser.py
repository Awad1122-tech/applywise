import json
import re
import anthropic
from app.config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

SHIFT_WORK_KEYWORDS = [
    "shift application", "shift availability", "shift accepted",
    "shift unsuccessful", "shift rejected", "shift confirmed",
    "shift cancelled", "shift reminder", "shift booking",
]


def ai_extract_job_info(subject: str, sender: str, body: str = "") -> dict:
    for keyword in SHIFT_WORK_KEYWORDS:
        if keyword in subject.lower():
            print(f"Skipping shift work email: {subject}")
            return None

    prompt = f"""You are an expert job application email analyser. Read every part of this email carefully.

EMAIL SENDER: {sender}
EMAIL SUBJECT: {subject}
EMAIL BODY:
{body[:2000] if body else "(no body)"}

TASK: Analyse this email and return a single JSON object.

FIELD RULES:

is_job_application (true/false):
- true = email is directly about a job application the person submitted: confirmation, rejection, interview invite, offer, assessment
- false = job alert newsletter, promotional, cold recruiter outreach, shift scheduling, marketing
- false = "invite to apply" or "invitetoapply" sender emails
- false = emails saying "your background could be a match" or "we think you'd be great for"
- false = emails suggesting jobs you haven't applied to yet
- false = any email where the person has NOT already submitted an application

email_type:
- "update" = email contains ANY decision or status change about an application: rejection, interview invite, offer, assessment result, shortlisting outcome. THIS TAKES PRIORITY — if the email contains a decision, it is ALWAYS "update" regardless of subject line
- "new" = ONLY a plain confirmation that application was received with NO decision whatsoever
- "reminder" = action required, complete your application, assessment reminder
- "skip" = not a real job application email

status (read the FULL body carefully, understand meaning not just keywords):
- "Rejected" = they are NOT moving forward. These ALL mean Rejected:
  * "regret to inform" or "I regret to inform you"
  * "on this occasion" (combined with any negative context)
  * "application has not been successful"
  * "not been successful"
  * "unsuccessful"
  * "not been selected"
  * "not shortlisted"
  * "decided not to proceed"
  * "will not be moving forward"
  * "not taken forward"
  * "not proceeding"
  * "role has been filled"
  * "unable to offer"
  * "not been progressed"
  * "we won't be taking your application further"
  * "not able to offer you a position"
  * "we will not be progressing"
  * "decided to go in a different direction"
- "Interview" = they want to meet: interview invitation, pleased to invite, shortlisted for interview, assessment centre, next stage, would like to speak
- "Offer" = they are offering the job
- "Applied" = ONLY a plain confirmation they received the application with absolutely no decision

company (the actual hiring employer, NOT any job board):
- Read the FULL email body carefully for the employer name
- For Indeed emails (sender contains indeed.com): the company name is in the body, look for patterns like "Application submitted\n[JOB TITLE]\n[COMPANY NAME]" or "sent to [COMPANY]" or "The following items were sent to [COMPANY]"
- For any ATS platform sender (greenhouse.io, lever.co, workday.com, taleo.net, successfactors.com, ashbyhq.com): extract company from email body
- If not in body, extract from sender domain:
  * hrsystems@reading.ac.uk → "University of Reading"
  * recruitment@dominos.co.uk → "Domino's Pizza"
  * donotreply.nokiaME@people.nokia.com → "Nokia"
  * nhsjobs@notifications.service.gov.uk → "NHS"
  * careers@barnardos.org.uk → "Barnardo's"
- NEVER return: LinkedIn, Indeed, Reed, Glassdoor, Totaljobs, Gradcracker, Brightnetwork, or any job board name
- If truly impossible to determine, return null

job_title (clean job title only):
- Search subject AND body for: "your application for [ROLE]", "applied for the [ROLE] role", "position of [ROLE]", "the [ROLE] position", "Application submitted\n[ROLE]"
- Use the EXACT title wording from the email
- STRIP job reference numbers: "Data Analyst (C9155-CRAC-0426-16)" → "Data Analyst", "Data Science Trainee - 34891" → "Data Science Trainee"
- STRIP salary: "Graduate Analyst - £48,000 + Share Options" → "Graduate Analyst"
- STRIP location: "Data Scientist Internship - London" → "Data Scientist Internship"
- STRIP dates: "Graduate Trainee - September 2026" → "Graduate Trainee"
- STRIP company name appended: "Applied Scientist Intern, Amazon University Talent Acquisition" → "Applied Scientist Intern"
- STRIP year prefixes: "2026 Applied Scientist Intern" → "Applied Scientist Intern"
- STRIP Stirling/location in parentheses: "Technology Internship (Stirling)" → "Technology Internship"
- Clean title only, nothing else
- Only use "General Application" if absolutely no title exists anywhere

platform:
- "linkedin" = mentions LinkedIn or linkedin.com
- "indeed" = sender contains indeed.com or mentions Indeed
- "reed" = mentions Reed or reed.co.uk
- "totaljobs" = mentions Totaljobs
- "cv_library" = mentions CV-Library
- "nhs_jobs" = sender is nhsjobs or mentions NHS Jobs portal
- "civil_service" = mentions Civil Service Jobs
- "workday" = sender domain contains workday or email mentions Workday
- "greenhouse" = sender domain contains greenhouse or mentions Greenhouse
- "taleo" = mentions Taleo
- "successfactors" = mentions SuccessFactors
- "brightnetwork" = mentions Bright Network
- "gradcracker" = mentions Gradcracker
- "direct" = applied directly on company website, no job board mentioned
- "other" = cannot determine

Respond with ONLY this JSON, no markdown, no explanation:
{{
    "is_job_application": true or false,
    "email_type": "new" or "update" or "reminder" or "skip",
    "status": "Applied" or "Rejected" or "Interview" or "Offer",
    "company": "exact employer name or null",
    "job_title": "clean job title only or General Application",
    "platform": "linkedin/indeed/reed/totaljobs/cv_library/nhs_jobs/civil_service/workday/greenhouse/taleo/successfactors/brightnetwork/gradcracker/direct/other"
}}"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        response_text = message.content[0].text.strip()

        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            print(f"AI parser: no JSON in response for subject: {subject}")
            return None

        result = json.loads(json_match.group())
        

        if not result.get("is_job_application", True):
            return None

        email_type = result.get("email_type", "new")
        if email_type == "skip":
            return None

        return {
            "company":    result.get("company") or "Unknown Company",
            "job_title":  result.get("job_title") or "General Application",
            "platform":   result.get("platform") or "other",
            "email_type": email_type,
            "status":     result.get("status") or "Applied",
        }

    except Exception as e:
        print(f"AI parser error: {e}")
        return None