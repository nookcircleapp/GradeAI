from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from app.database import SessionDep
from app.models.exam import Exam
from app.schemas.exam import ExamCreate, ExamRead, ExamUpdate
from app.security import require_admin_token


router = APIRouter(prefix="/api/exams", tags=["exams"])


# Writes are gated on the shared admin secret (see app/security.py). Reads
# below stay open on purpose: the student flow must work with no credentials.
@router.post("/", response_model=ExamRead, dependencies=[Depends(require_admin_token)])
def create_exam(exam: ExamCreate, session: SessionDep) -> Exam:
    """Create a new exam. Requires the X-Admin-Token header."""
    # model_dump() rather than model_validate(): Exam.questions is a plain JSON
    # column, and model_validate would hand it a list of QuestionSchema objects,
    # which json.dumps cannot serialize (500 on insert). Dump to dicts first.
    db_exam = Exam(**exam.model_dump())
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


@router.patch(
    "/{exam_id}", response_model=ExamRead, dependencies=[Depends(require_admin_token)]
)
def update_exam(exam_id: int, exam: ExamUpdate, session: SessionDep) -> Exam:
    """Update an exam (partial update). Requires the X-Admin-Token header."""
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
