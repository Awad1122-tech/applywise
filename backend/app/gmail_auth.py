import os
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")
REDIRECT_URI = "http://localhost:8001/gmail/oauth/callback"

# Allow OAuth over HTTP for local development
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"


def get_gmail_credentials_from_token(token_json: str) -> Credentials:
    """
    Returns valid Gmail credentials from a token JSON string stored in database.
    Refreshes if expired.
    """
    creds = Credentials.from_authorized_user_info(
        json.loads(token_json), SCOPES
    )
    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    return creds


def get_gmail_credentials() -> Credentials:
    """
    Legacy function — loads from token.json file.
    Only used as fallback.
    """
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
    return creds


def generate_oauth_url(user_id: str) -> str:
    """
    Generate Google OAuth URL for user to authenticate.
    Encodes user_id in state parameter so we know which user to save token for.
    """
    if not os.path.exists(CREDENTIALS_FILE):
        raise FileNotFoundError(
            f"credentials.json not found at {CREDENTIALS_FILE}. "
            "Download it from Google Cloud Console."
        )

    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
        autogenerate_code_verifier=False,
    )

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=str(user_id),
    )

    return auth_url


def exchange_code_for_token(code: str) -> str:
    """
    Exchange OAuth code for token.
    Returns token as JSON string to store in database.
    """
    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
        autogenerate_code_verifier=False,
    )

    flow.fetch_token(code=code)
    creds = flow.credentials

    return creds.to_json()