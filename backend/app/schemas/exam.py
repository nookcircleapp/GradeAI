from __future__ import annotations

from datetime import datetime
from sqlmodel import SQLModel


class QuestionSchema(SQLModel):
    """Question structure with rubric."""
    text: str
    credit: int
    min_words: int
    rubric: list[str]


class ExamCreate(SQLModel):
    """Schema for creating an exam."""
    title: str
    questions: list[QuestionSchema]


class ExamRead(SQLModel):
    """Schema for reading an exam."""
    id: int
    title: str
    questions: list[QuestionSchema]
    created_at: datetime
    updated_at: datetime


class ExamUpdate(SQLModel):
    """Schema for updating an exam (all fields optional)."""
    title: str | None = None
    questions: list[QuestionSchema] | None = None
