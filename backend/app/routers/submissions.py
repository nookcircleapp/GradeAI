from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.config import settings
from app.database import SessionDep
from app.models.exam import Exam
from app.models.submission import Submission
from app.schemas.submission import GradingResponse, SubmissionCreate, SubmissionRead
from app.services.grading import grade_submission


router = APIRouter(prefix="/api/submissions", tags=["submissions"])


def _require_api_key() -> None:
    """Raise 400 if OpenAI API key is not configured."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key not configured",
        )


@router.post("/preview", response_model=GradingResponse)
async def preview_grading(body: SubmissionCreate, session: SessionDep) -> GradingResponse:
    """Preview grading without persisting (Try button).

    Grades each answer against its rubric and returns scores with explanations.
    Results are NOT saved to the database.
    """
    _require_api_key()

    exam = session.get(Exam, body.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    try:
        grades, total_score = await grade_submission(
            exam_questions=exam.questions,
            answers=body.answers,
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(exc)}") from exc

    max_score = sum(
        q["credit"] if isinstance(q, dict) else q.credit
        for q in exam.questions
    )

    return GradingResponse(
        grades=grades,
        total_score=total_score,
        max_score=max_score,
        is_final=False,
    )


@router.post("/", response_model=GradingResponse)
async def create_submission(body: SubmissionCreate, session: SessionDep) -> GradingResponse:
    """Final submission — grade and persist (Submit button).

    Grades each answer against its rubric, saves the submission to the database,
    and returns scores with explanations.
    """
    _require_api_key()

    exam = session.get(Exam, body.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    try:
        grades, total_score = await grade_submission(
            exam_questions=exam.questions,
            answers=body.answers,
            api_key=settings.openai_api_key,
            model=settings.openai_model,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Grading failed: {str(exc)}") from exc

    max_score = sum(
        q["credit"] if isinstance(q, dict) else q.credit
        for q in exam.questions
    )

    # Persist the submission
    submission = Submission(
        exam_id=body.exam_id,
        answers=[a.model_dump() for a in body.answers],
        grades=[g.model_dump() for g in grades],
        total_score=total_score,
        is_final=True,
    )
    session.add(submission)
    session.commit()
    session.refresh(submission)

    return GradingResponse(
        grades=grades,
        total_score=total_score,
        max_score=max_score,
        is_final=True,
    )


@router.get("/{submission_id}", response_model=SubmissionRead)
def get_submission(submission_id: int, session: SessionDep) -> SubmissionRead:
    """Get a submission with its grades."""
    submission = session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Deserialize JSON-stored lists back into typed objects
    from app.schemas.submission import AnswerInput, GradeResult

    answers = [AnswerInput(**a) if isinstance(a, dict) else a for a in submission.answers]
    grades = None
    if submission.grades is not None:
        grades = [GradeResult(**g) if isinstance(g, dict) else g for g in submission.grades]

    return SubmissionRead(
        id=submission.id,
        exam_id=submission.exam_id,
        answers=answers,
        grades=grades,
        total_score=submission.total_score,
        is_final=submission.is_final,
        created_at=submission.created_at,
    )
