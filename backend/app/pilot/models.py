from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.pilot.timeutil import utcnow


class User(SQLModel, table=True):
    """A teacher or admin. Students never get accounts."""

    __tablename__ = "pilot_users"

    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    password_hash: str
    role: str = Field(default="teacher")  # "admin" | "teacher"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)


class AuthSession(SQLModel, table=True):
    __tablename__ = "pilot_sessions"

    id: int | None = Field(default=None, primary_key=True)
    token_hash: str = Field(index=True, unique=True)
    user_id: int = Field(foreign_key="pilot_users.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime


class Paper(SQLModel, table=True):
    __tablename__ = "pilot_papers"

    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="pilot_users.id", index=True)
    title: str
    subject: str = ""
    instructions: str = ""
    # [{text, marks, min_words, rubric: [str], reference_answer}]
    questions: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))

    status: str = Field(default="draft")  # draft | open | closed
    share_code: str = Field(index=True, unique=True)
    time_limit_minutes: int | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    collect_section: bool = False
    results_mode: str = Field(default="immediate")  # immediate | on_release
    results_released: bool = False
    allow_preview: bool = False
    # Enables the winners screen (ranking + shareable results page)
    is_contest: bool = True
    hide_roll_numbers_on_winners: bool = False
    winners_revealed: bool = False
    grading_model: str | None = None
    # Pre-made papers every teacher can copy; never opened themselves.
    is_template: bool = False

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class PaperSubmission(SQLModel, table=True):
    """One student's attempt at one paper. Created when the student starts."""

    __tablename__ = "pilot_submissions"
    __table_args__ = (UniqueConstraint("paper_id", "roll_key"),)

    id: int | None = Field(default=None, primary_key=True)
    paper_id: int = Field(foreign_key="pilot_papers.id", index=True)
    student_name: str
    roll_number: str
    roll_key: str  # normalised roll number used for uniqueness
    section: str = ""
    receipt_hash: str = Field(index=True, unique=True)

    # in_progress | grading | graded | failed
    status: str = Field(default="in_progress")
    answers: list = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    # [{question_index, score, max_score, explanation, suspected_manipulation, raw}]
    grades: list | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    ai_score: int | None = None
    max_score: int = 0
    grading_model: str | None = None
    prompt_version: str | None = None
    grading_error: str | None = None

    # Teacher review
    overrides: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    teacher_note: str = ""
    ai_fooled: bool | None = None

    started_at: datetime = Field(default_factory=utcnow)
    submitted_at: datetime | None = None
    graded_at: datetime | None = None
