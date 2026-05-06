from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, applications, duplicate
from app.routers import gmail

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ApplyWise API",
    description="UK job application tracker — never apply twice",
    version="0.1.0",
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

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.1.0"}