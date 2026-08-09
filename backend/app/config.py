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
    default_model_ids: str = "gpt-4o-mini,llama-3.1-8b-instant,minilm-l6-v2"
    # Minimum length, in characters after stripping whitespace, for an answer to
    # be sent to a model at all. Anything shorter is scored 0 deterministically
    # without an API call — see app/services/grading.py :: _skip_reason for why
    # that guard exists (models confabulate a plausible answer out of an empty
    # one). Set to 0 to disable the length rule; blank and whitespace-only
    # answers are always refused, whatever this is set to.
    min_answer_chars: int = 20
    # Per-API-call budget and retry policy for the grading service.
    grading_timeout_seconds: float = 60.0
    grading_max_attempts: int = 2
    # A provider rejecting its own malformed JSON (Groq's "json_validate_failed")
    # is sampling variance, not a bad request, so it gets a larger budget than
    # ordinary transient errors. Never lower than grading_max_attempts.
    grading_json_max_attempts: int = 3

    # -- Local sentence-embedding scorer (app/services/sbert.py) --------------
    # The no-LLM grading path: all-MiniLM-L6-v2 on the CPU, $0.00 per paper.
    # False switches it off entirely; GET /api/models then reports it
    # unavailable and it can never be selected.
    sbert_enabled: bool = True
    # Load the weights during application startup rather than on the first
    # request. Without this the first grading of the day pays the load cost
    # (seconds) live on stage. Turned off in the test suite so importing the app
    # never drags torch in.
    sbert_preload: bool = True
    # Directory holding a saved SentenceTransformer. Empty means
    # backend/models/all-MiniLM-L6-v2. A vendored directory needs no network and
    # is what production should use.
    sbert_model_dir: str = ""
    # Allowed to fall back to the Hugging Face hub name when no directory is
    # present (which downloads on a cache miss). Convenient on a dev box; set
    # false in production so a missing vendored copy fails loudly at deploy time
    # instead of silently depending on the venue's WiFi.
    sbert_allow_download: bool = True
    # Cosine similarity at which a rubric point counts as covered by its
    # best-matching sentence. 0.45 is chosen a priori from how this model family
    # scores phrase-to-sentence pairs, NOT fitted to any particular answer — see
    # the module docstring in app/services/sbert.py.
    sbert_coverage_threshold: float = 0.45
    # Weight of the secondary signal (whole answer vs the teacher's reference
    # answers) in the final mark:
    #     fraction = (1 - w) * rubric_coverage + w * reference_similarity
    # 0.0 reports the similarity without letting it move the score.
    sbert_reference_weight: float = 0.15
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
