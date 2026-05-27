from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    app_env: str = "development"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8001"
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()