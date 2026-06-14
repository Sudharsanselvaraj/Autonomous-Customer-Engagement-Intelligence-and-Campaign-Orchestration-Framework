from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import os


def _build_url(env_var: str, default_scheme: str, default_path: str = "", default_user: str = "", default_pass: str = "") -> str:
    """Build a full URL from hostport or return the raw value if already a URL."""
    raw = os.getenv(env_var, "")
    if not raw:
        return ""
    # If it already looks like a URL, return as-is
    if "://" in raw:
        return raw
    # If it's just host:port, build the URL
    if default_user and default_pass:
        return f"{default_scheme}://{default_user}:{default_pass}@{raw}{default_path}"
    return f"{default_scheme}://{raw}{default_path}"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CEIP CRM"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # Database — accepts full URL or host:port (Render pserv gives hostport)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ceip_crm"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Services
    CHANNEL_SIMULATOR_URL: str = "http://localhost:8001"
    CRM_RECEIPT_URL: str = "http://localhost:8000"

    # AI — primary (Groq)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    AI_MODEL: str = "anthropic/claude-sonnet-4-5"

    # AI — fallback (Gemini)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Auth
    SECRET_KEY: str = "supersecretkey-change-in-production-32chars"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    # Build full URLs from host:port if needed (Render pserv gives host:port)
    db_url = _build_url("DATABASE_URL", "postgresql", "/ceip_crm", "crm_user", "crm_password_2024")
    redis_url = _build_url("REDIS_URL", "redis", "/0")
    celery_broker = _build_url("CELERY_BROKER_URL", "redis", "/1")
    celery_result = _build_url("CELERY_RESULT_BACKEND", "redis", "/2")
    channel_sim = _build_url("CHANNEL_SIMULATOR_URL", "http")
    crm_receipt = _build_url("CRM_RECEIPT_URL", "http")

    # Override env vars so pydantic picks them up
    if db_url:
        os.environ["DATABASE_URL"] = db_url
    if redis_url:
        os.environ["REDIS_URL"] = redis_url
    if celery_broker:
        os.environ["CELERY_BROKER_URL"] = celery_broker
    if celery_result:
        os.environ["CELERY_RESULT_BACKEND"] = celery_result
    if channel_sim:
        os.environ["CHANNEL_SIMULATOR_URL"] = channel_sim
    if crm_receipt:
        os.environ["CRM_RECEIPT_URL"] = crm_receipt

    return Settings()


settings = get_settings()
