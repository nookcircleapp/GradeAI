"""Schemas for the fine-tuning dataset export and the human-score write path."""

from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


# Pydantic v2 reserves the "model_" attribute prefix; the dataset columns are
# named after the grading model on purpose, so opt out of the namespace guard.
_ALLOW_MODEL_PREFIX = {"protected_namespaces": ()}


class DatasetRow(SQLModel):
    """One exported row: (submission, question, grading model).

    ``model_run_cost_usd`` and ``model_run_latency_ms`` are deliberately named
    "run": a model grades every question of a submission in one parallel batch,
    and the provider reports cost and latency for that batch, not per question.
    Splitting them across questions would be an invention, and this demo does
    not invent numbers.
    """

    model_config = _ALLOW_MODEL_PREFIX

    submission_id: int
    created_at: datetime
    exam_id: int
    question_index: int
    question_text: str
    max_score: int
    student_answer: str
    model_id: str
    model_label: str
    model_status: str
    model_error: str | None = None
    model_score: int | None = None
    model_explanation: str | None = None
    model_recovered: bool | None = None
    model_run_cost_usd: float | None = None
    model_run_latency_ms: int | None = None
    # The slot the teacher fills in. Empty on a fresh export; populated on
    # re-export once scores have been imported.
    human_score: float | None = None
    grader_note: str | None = None


class HumanScoreIn(SQLModel):
    """One teacher score to record (upsert keyed on submission+question)."""

    submission_id: int
    question_index: int
    human_score: float | None = None
    grader_note: str | None = None
    grader_name: str | None = None


class HumanScoreBulkIn(SQLModel):
    """Body of the JSON upsert endpoint."""

    scores: list[HumanScoreIn] = Field(default_factory=list)


class HumanScoreRead(SQLModel):
    """A stored teacher score."""

    id: int
    submission_id: int
    question_index: int
    human_score: float | None = None
    grader_note: str | None = None
    grader_name: str | None = None
    created_at: datetime
    updated_at: datetime


class HumanScoreImportResult(SQLModel):
    """What an import did, so a mistake is visible rather than silent."""

    created: int = 0
    updated: int = 0
    unchanged: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)
