from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from app.database import SessionDep
from app.models.exam import Exam
from app.schemas.exam import ExamCreate, ExamRead, ExamUpdate


router = APIRouter(prefix="/api/exams", tags=["exams"])


@router.post("/", response_model=ExamRead)
def create_exam(exam: ExamCreate, session: SessionDep) -> Exam:
    """Create a new exam."""
    db_exam = Exam.model_validate(exam)
    session.add(db_exam)
    session.commit()
    session.refresh(db_exam)
    return db_exam


@router.get("/", response_model=list[ExamRead])
def list_exams(session: SessionDep) -> list[Exam]:
    """Get all exams."""
    exams = session.exec(select(Exam)).all()
    return list(exams)


@router.get("/{exam_id}", response_model=ExamRead)
def get_exam(exam_id: int, session: SessionDep) -> Exam:
    """Get a specific exam by ID."""
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.patch("/{exam_id}", response_model=ExamRead)
def update_exam(exam_id: int, exam: ExamUpdate, session: SessionDep) -> Exam:
    """Update an exam (partial update)."""
    db_exam = session.get(Exam, exam_id)
    if not db_exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Only update provided fields
    exam_data = exam.model_dump(exclude_unset=True)
    db_exam.sqlmodel_update(exam_data)

    # Update timestamp
    from datetime import datetime
    db_exam.updated_at = datetime.utcnow()

    session.add(db_exam)
    session.commit()
    session.refresh(db_exam)
    return db_exam
