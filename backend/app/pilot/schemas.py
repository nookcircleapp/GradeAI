from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models_registry import KIND_LOCAL, get_model


def _check_grading_model(value: str | None) -> str | None:
    if value is None:
        return value
    spec = get_model(value)
    if spec is None or spec.kind == KIND_LOCAL:
        raise ValueError("grading_model must be a hosted model from GET /api/models")
    return value


# --- Auth and accounts -------------------------------------------------------

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool


class TeacherCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=10, max_length=200)


class TeacherUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    password: str | None = Field(default=None, min_length=10, max_length=200)
    is_active: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=200)


# --- Papers ------------------------------------------------------------------

class Question(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    marks: int = Field(ge=1, le=100)
    min_words: int = Field(default=0, ge=0, le=5000)
    rubric: list[str] = Field(default_factory=list)
    reference_answer: str = ""


class PaperFields(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subject: str = Field(default="", max_length=200)
    instructions: str = Field(default="", max_length=5000)
    questions: list[Question] = Field(default_factory=list, max_length=50)
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    collect_section: bool = False
    results_mode: Literal["immediate", "on_release"] = "immediate"
    allow_preview: bool = False
    is_contest: bool = False
    hide_roll_numbers_on_winners: bool = False
    grading_model: str | None = None

    _grading_model = field_validator("grading_model")(classmethod(lambda cls, v: _check_grading_model(v)))


class PaperCreate(PaperFields):
    pass


class PaperUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    instructions: str | None = Field(default=None, max_length=5000)
    questions: list[Question] | None = Field(default=None, max_length=50)
    time_limit_minutes: int | None = Field(default=None, ge=1, le=600)
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    collect_section: bool | None = None
    results_mode: Literal["immediate", "on_release"] | None = None
    allow_preview: bool | None = None
    is_contest: bool | None = None
    hide_roll_numbers_on_winners: bool | None = None
    grading_model: str | None = None

    _grading_model = field_validator("grading_model")(classmethod(lambda cls, v: _check_grading_model(v)))


class PaperRead(PaperFields):
    id: int
    owner_id: int
    status: str
    is_template: bool = False
    share_code: str
    results_released: bool
    winners_revealed: bool
    max_score: int
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime


class PaperStatusChange(BaseModel):
    status: Literal["draft", "open", "closed"]


# --- Student side ------------------------------------------------------------

class PublicQuestion(BaseModel):
    text: str
    marks: int
    min_words: int


class PublicPaper(BaseModel):
    title: str
    subject: str
    instructions: str
    questions: list[PublicQuestion]
    max_score: int
    time_limit_minutes: int | None
    opens_at: datetime | None
    closes_at: datetime | None
    collect_section: bool
    allow_preview: bool
    is_contest: bool
    accepting: bool
    state: Literal["not_open", "open", "closed"]


class StartRequest(BaseModel):
    student_name: str = Field(min_length=1, max_length=120)
    roll_number: str = Field(min_length=1, max_length=40)
    section: str = Field(default="", max_length=40)

    @field_validator("student_name", "roll_number", "section")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()


class StartResponse(BaseModel):
    receipt: str
    started_at: datetime
    deadline: datetime | None


class AnswerIn(BaseModel):
    question_index: int = Field(ge=0)
    answer: str


class SubmitRequest(BaseModel):
    answers: list[AnswerIn]


class PreviewRequest(BaseModel):
    question_index: int = Field(ge=0)
    answer: str


class GradeOut(BaseModel):
    question_index: int
    score: int
    max_score: int
    explanation: str


class StudentResult(BaseModel):
    status: str
    paper_title: str = ""
    is_contest: bool = False
    # Contest papers only: current position on the leaderboard
    rank: int | None = None
    participants: int | None = None
    student_name: str
    roll_number: str
    submitted_at: datetime | None
    results_visible: bool
    total_score: int | None = None
    max_score: int
    grades: list[GradeOut] | None = None


# --- Teacher records ---------------------------------------------------------

class SubmissionRow(BaseModel):
    id: int
    # Per question: teacher override if set, else the AI score
    question_scores: list[int | None] = []
    flagged: bool = False
    student_name: str
    roll_number: str
    section: str
    status: str
    ai_score: int | None
    final_score: int | None
    max_score: int
    ai_fooled: bool | None
    started_at: datetime
    submitted_at: datetime | None


class SubmissionDetail(SubmissionRow):
    answers: list[dict]
    grades: list[dict] | None
    overrides: dict
    teacher_note: str
    grading_model: str | None
    prompt_version: str | None
    grading_error: str | None


class ReviewUpdate(BaseModel):
    # question index (as string, JSON keys) -> teacher's score; null clears it
    overrides: dict[str, int | None] | None = None
    teacher_note: str | None = Field(default=None, max_length=5000)
    ai_fooled: bool | None = None


class LeaderboardEntry(BaseModel):
    rank: int
    student_name: str
    roll_number: str | None
    section: str
    score: int
    max_score: int
    submitted_at: datetime | None


class WinnersPage(BaseModel):
    title: str
    subject: str
    share_code: str
    participants: int
    grading_model: str
    date: datetime | None
    max_score: int
    entries: list[LeaderboardEntry]
