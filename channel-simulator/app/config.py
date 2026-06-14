from pydantic_settings import BaseSettings
import os


def _build_url(env_var: str, default_scheme: str, default_path: str = "") -> str:
    """Build a full URL from hostport or return the raw value if already a URL."""
    raw = os.getenv(env_var, "")
    if not raw:
        return ""
    if "://" in raw:
        return raw
    return f"{default_scheme}://{raw}{default_path}"


class Settings(BaseSettings):
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CRM_RECEIPT_URL: str = "http://localhost:8000"

    class Config:
        env_file = ".env"


# Build full URLs from host:port if needed (Render pserv gives host:port)
_broker = _build_url("CELERY_BROKER_URL", "redis", "/1")
_result = _build_url("CELERY_RESULT_BACKEND", "redis", "/2")
_receipt = _build_url("CRM_RECEIPT_URL", "http")

if _broker:
    os.environ["CELERY_BROKER_URL"] = _broker
if _result:
    os.environ["CELERY_RESULT_BACKEND"] = _result
if _receipt:
    os.environ["CRM_RECEIPT_URL"] = _receipt

settings = Settings()
