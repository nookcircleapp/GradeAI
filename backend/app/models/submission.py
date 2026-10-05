from __future__ import annotations

from datetime import datetime, timezone
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class SubmissionBase(SQLModel):
    """Base submission model with shared fields."""
    exam_id: int


class Submission(SubmissionBase, table=True):
    """Submission database table model."""
    id: int | None = Field(default=None, primary_key=True)
    answers: list = Field(sa_column=Column(JSON))
    # Legacy single-model columns, kept populated from the first successful
    # model so existing read paths keep working.
    grades: list | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    total_score: int | None = Field(default=None, nullable=True)
    # Full multi-model payload: the `results` array and `comparison` object
    # exactly as returned by the grading endpoints.
    results: list | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    comparison: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    is_final: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
