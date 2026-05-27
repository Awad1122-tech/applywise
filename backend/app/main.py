from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.database import Base, engine
from app.routers import auth, applications, duplicate
from app.routers import gmail
from app.routers.auth import get_current_user
from app.models import User

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ApplyWise API",
    description="UK job application tracker — never apply twice",
    version="0.1.0",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(duplicate.router)
app.include_router(gmail.router)


class ExtractJobRequest(BaseModel):
    prompt: str


@app.post("/ai/extract-job")
def extract_job(
    payload: ExtractJobRequest,
    current_user: User = Depends(get_current_user),
):
    import json
    import re
    from app.config import settings
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": payload.prompt}]
        )
        response_text = message.content[0].text.strip()
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if not json_match:
            return {"is_job_page": False, "company": None, "job_title": None}
        return json.loads(json_match.group())
    except Exception as e:
        return {"is_job_page": False, "company": None, "job_title": None, "error": str(e)}


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}