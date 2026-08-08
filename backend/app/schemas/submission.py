from __future__ import annotations

from datetime import datetime
from sqlmodel import Field, SQLModel


# Pydantic v2 reserves the "model_" attribute prefix; the API contract uses
# model_id / model_ids, so opt out of the protected namespace on those schemas.
_ALLOW_MODEL_PREFIX = {"protected_namespaces": ()}


class AnswerInput(SQLModel):
    """A student's answer to a question."""
    question_index: int
    answer: str


class GradeResult(SQLModel):
    """Grading result for a single answer."""
    question_index: int
    score: int
    max_score: int
    explanation: str
    # True when the provider rejected its own malformed JSON and this grade was
    # recovered from the rejected text rather than read from a clean response.
    # The score and explanation are still the model's own words — nothing is
    # invented — but the flag keeps the provenance auditable.
    recovered: bool = False


class ModelInfo(SQLModel):
    """A registry entry as exposed by GET /api/models."""
    id: str
    label: str
    provider: str
    tier: str
    available: bool
    # True -> the student view pre-ticks this model on load (when it is also
    # available). Expensive models are opt-in, so this is False for them.
    default_selected: bool = False
    price_in_per_mtok: float
    price_out_per_mtok: float


class ModelMetrics(SQLModel):
    """Cost/latency telemetry for one model's grading run.

    Token counts and cost are None when the provider omitted `usage` — they are
    never estimated.
    """
    latency_ms: int
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    cost_usd: float | None = None


class ModelResult(SQLModel):
    """One model's independent grading run."""
    model_config = _ALLOW_MODEL_PREFIX

    model_id: str
    label: str
    tier: str
    status: str  # "ok" | "error"
    error: str | None = None
    total_score: int | None = None
    grades: list[GradeResult] = Field(default_factory=list)
    metrics: ModelMetrics | None = None


class Comparison(SQLModel):
    """Head-to-head summary across the successful models."""
    cheapest_model_id: str | None = None
    fastest_model_id: str | None = None
    cost_ratio: float | None = None
    speed_ratio: float | None = None
    max_total_score_delta: int | None = None


class SubmissionCreate(SQLModel):
    """Schema for creating a submission."""
    model_config = _ALLOW_MODEL_PREFIX

    exam_id: int
    answers: list[AnswerInput]
    model_ids: list[str] | None = None


class GradingResponse(SQLModel):
    """Response from the grading endpoints (preview and final)."""
    max_score: int
    is_final: bool
    submission_id: int | None = None
    results: list[ModelResult] = Field(default_factory=list)
    comparison: Comparison | None = None


class SubmissionRead(SQLModel):
    """Schema for reading a submission."""
    id: int
    exam_id: int
    answers: list[AnswerInput]
    grades: list[GradeResult] | None = None
    total_score: int | None = None
    is_final: bool
    created_at: datetime
    results: list[ModelResult] | None = None
    comparison: Comparison | None = None
