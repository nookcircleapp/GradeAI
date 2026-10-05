from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config import ENV_FILE


class PilotSettings(BaseSettings):
    """Pilot settings, read from GRADEAI_PILOT_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="GRADEAI_PILOT_", env_file=ENV_FILE, extra="ignore")

    # First admin account, created on startup if no admin exists yet
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = "Admin"

    session_days: int = 7
    cookie_name: str = "gradeai_session"
    cookie_secure: bool = True

    grading_model: str = "gpt-4o-mini"
    grading_concurrency: int = 4
    grading_attempts: int = 3
    grading_timeout_seconds: float = 60
    max_answer_chars: int = 20000


pilot_settings = PilotSettings()
