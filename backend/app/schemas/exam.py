"""Exam request/response schemas.

Two read shapes exist on purpose, and the difference is a privacy boundary
rather than a convenience:

* :class:`ExamRead` is what an anonymous visitor gets. The student view calls
  ``GET /api/exams/`` and ``GET /api/exams/{id}`` with no credentials, so this
  shape must contain nothing a student is not allowed to see. ``rubric`` stays
  in — it is deliberately shown as "Marking criteria" — but reference answers
  are the teacher's model answers and would hand out the marks.
* :class:`ExamAdminRead` is the full object, returned only from routes gated on
  ``require_admin_token``. The admin editor needs it to round-trip an edit.

The stripping is structural, not a filter someone has to remember to call: the
public question shape simply has no ``reference_answers`` field, so a Pydantic
response_model of ``ExamRead`` cannot serialize one even though the underlying
JSON column still holds it.
"""

from __future__ import annotations

from datetime import datetime
from sqlmodel import Field, SQLModel


class QuestionSchema(SQLModel):
    """Full question structure: rubric AND teacher reference answers.

    Used for writes (create/update) and for the admin read. Rubric and
    reference answers are used *together* when grading — the rubric says what
    must be present, the reference answers show what full-credit work looks
    like.

    ``reference_answers`` defaults to an empty list so every exam written
    before this field existed still validates unchanged.
    """

    text: str
    credit: int
    min_words: int
    rubric: list[str]
    reference_answers: list[str] = Field(default_factory=list)


class PublicQuestionSchema(SQLModel):
    """Student-visible question fields. Deliberately has no reference answers."""

    text: str
    credit: int
    min_words: int
    rubric: list[str]


class ExamCreate(SQLModel):
    """Schema for creating an exam."""
    title: str
    questions: list[QuestionSchema]


class ExamRead(SQLModel):
    """Student-safe exam read. NEVER add reference answers to this shape."""
    id: int
    title: str
    questions: list[PublicQuestionSchema]
    created_at: datetime
    updated_at: datetime


class ExamAdminRead(SQLModel):
    """Full exam read, including reference answers. Admin-token routes only."""
    id: int
    title: str
    questions: list[QuestionSchema]
    created_at: datetime
    updated_at: datetime


class ExamUpdate(SQLModel):
    """Schema for updating an exam (all fields optional)."""
    title: str | None = None
    questions: list[QuestionSchema] | None = None
