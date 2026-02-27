from __future__ import annotations

from datetime import datetime
from sqlmodel import SQLModel


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


class SubmissionCreate(SQLModel):
    """Schema for creating a submission."""
    exam_id: int
    answers: list[AnswerInput]


class GradingResponse(SQLModel):
    """Response from grading endpoint."""
    grades: list[GradeResult]
    total_score: int
    max_score: int
    is_final: bool


class SubmissionRead(SQLModel):
    """Schema for reading a submission."""
    id: int
    exam_id: int
    answers: list[AnswerInput]
    grades: list[GradeResult] | None
    total_score: int | None
    is_final: bool
    created_at: datetime
