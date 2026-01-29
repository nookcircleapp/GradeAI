from __future__ import annotations

from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON


class ExamBase(SQLModel):
    """Base exam model with shared fields."""
    title: str


class Exam(ExamBase, table=True):
    """Exam database table model."""
    id: int | None = Field(default=None, primary_key=True)
    questions: list = Field(sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
