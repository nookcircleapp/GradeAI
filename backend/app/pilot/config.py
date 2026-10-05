from pydantic_settings import BaseSettings, SettingsConfigDict

from app.config import ENV_FILE


class PilotSettings(BaseSettings):
    """Pilot settings, read from GRADEAI_PILOT_* environment variables."""

    model_config = SettingsConfigDict(env_prefix="GRADEAI_PILOT_", env_file=ENV_FILE, extra="ignore")

    # First admin account, created on startup if no admin exists yet
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = "Admin"

    # Google sign-in for teachers. Create an OAuth "Web application" client in
    # Google Cloud and register {public_url}/api/pilot/auth/google/callback as
    # its redirect URI. When both are set, teachers can only sign in with
    # Google; admins can still use their password.
    google_client_id: str = ""
    google_client_secret: str = ""
    # Where the site is served, e.g. https://blinkscore.in (no trailing slash).
    public_url: str = ""
    # Where to send the browser after sign-in; defaults to public_url. Only
    # differs in local dev, where Vite and uvicorn run on different ports.
    app_url: str = ""

    session_days: int = 7
    cookie_name: str = "gradeai_session"
    cookie_secure: bool = True

    grading_model: str = "gpt-4o-mini"
    grading_concurrency: int = 4
    grading_attempts: int = 3
    grading_timeout_seconds: float = 60
    max_answer_chars: int = 20000

    @property
    def google_enabled(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret and self.public_url)


pilot_settings = PilotSettings()
