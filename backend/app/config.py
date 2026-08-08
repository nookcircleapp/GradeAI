from pathlib import Path

from pydantic_settings import BaseSettings


# Resolve .env relative to this module (backend/app/config.py -> backend/.env) so
# the file is found regardless of the directory uvicorn was started from.
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    database_url: str = "sqlite:///./data.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    groq_api_key: str = ""
    # Comma-separated model ids from app.models_registry used when a grading
    # request omits model_ids. Mirrors the models flagged default_selected in
    # the registry so the server-side fallback matches the UI's default picks.
    default_model_ids: str = "gpt-4o-mini,llama-3.1-8b-instant"
    # Per-API-call budget and retry policy for the grading service.
    grading_timeout_seconds: float = 60.0
    grading_max_attempts: int = 2
    # A provider rejecting its own malformed JSON (Groq's "json_validate_failed")
    # is sampling variance, not a bad request, so it gets a larger budget than
    # ordinary transient errors. Never lower than grading_max_attempts.
    grading_json_max_attempts: int = 3
    # Shared secret required by the exam write endpoints (POST /api/exams/ and
    # PATCH /api/exams/{id}), sent by the admin UI in the X-Admin-Token header.
    # Reads and the whole student flow stay unauthenticated. Empty means "no
    # token configured", which app/security.py treats as fail-closed: writes are
    # rejected rather than allowed.
    admin_token: str = ""
    db_echo: bool = False
    # Server-side log verbosity. Retry attempts log at INFO; model failures at
    # ERROR with a traceback. Users still only ever see the short friendly error.
    log_level: str = "INFO"

    model_config = {
        "env_prefix": "GRADEAI_",
        "env_file": ENV_FILE,
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
