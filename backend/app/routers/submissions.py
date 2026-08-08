from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.database import SessionDep
from app.models.exam import Exam
from app.models.submission import Submission
from app.models_registry import ModelSpec, default_model_ids, get_model
from app.schemas.submission import (
    AnswerInput,
    Comparison,
    GradeResult,
    GradingResponse,
    ModelResult,
    SubmissionCreate,
    SubmissionRead,
)
from app.services.grading import exam_max_score, grade_submission


router = APIRouter(prefix="/api/submissions", tags=["submissions"])


def _resolve_exam(session: SessionDep, exam_id: int) -> Exam:
    """Load the exam or raise 404."""
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


def _resolve_models(model_ids: list[str] | None) -> list[ModelSpec]:
    """Map requested model ids to registry specs.

    An unknown model id is a bad request (400) — the caller asked for something
    that does not exist. An empty/omitted list falls back to the configured
    defaults; the response shape is identical either way.
    """
    requested = [m for m in (model_ids or []) if m]
    if not requested:
        requested = default_model_ids()

    if not requested:
        raise HTTPException(
            status_code=400,
            detail="No models requested and no default models are configured",
        )

    specs: list[ModelSpec] = []
    seen: set[str] = set()
    for model_id in requested:
        if model_id in seen:
            continue
        spec = get_model(model_id)
        if spec is None:
            raise HTTPException(status_code=400, detail=f"Unknown model id: {model_id}")
        seen.add(model_id)
        specs.append(spec)
    return specs


def _require_any_success(results: list[ModelResult]) -> None:
    """Non-200 only when EVERY model failed.

    Partial failure stays 200 with per-model status="error" — one provider being
    rate-limited must never blank the screen during the live demo.
    """
    if any(r.status == "ok" for r in results):
        return

    errors = "; ".join(f"{r.label}: {r.error}" for r in results if r.error)
    raise HTTPException(
        status_code=502,
        detail=f"All models failed. {errors}" if errors else "All models failed.",
    )


@router.post("/preview", response_model=GradingResponse)
async def preview_grading(body: SubmissionCreate, session: SessionDep) -> GradingResponse:
    """Preview grading without persisting (Try button).

    Grades every answer with every requested model, in parallel, and returns
    per-model scores, explanations, latency, tokens and cost.
    Results are NOT saved to the database, so `submission_id` is null.
    """
    exam = _resolve_exam(session, body.exam_id)
    specs = _resolve_models(body.model_ids)

    results, comparison = await grade_submission(
        exam_questions=exam.questions,
        answers=body.answers,
        specs=specs,
    )
    _require_any_success(results)

    return GradingResponse(
        max_score=exam_max_score(exam.questions),
        is_final=False,
        submission_id=None,
        results=results,
        comparison=comparison,
    )


@router.post("/", response_model=GradingResponse)
async def create_submission(body: SubmissionCreate, session: SessionDep) -> GradingResponse:
    """Final submission — grade with every requested model and persist."""
    exam = _resolve_exam(session, body.exam_id)
    specs = _resolve_models(body.model_ids)

    results, comparison = await grade_submission(
        exam_questions=exam.questions,
        answers=body.answers,
        specs=specs,
    )
    _require_any_success(results)

    # Legacy single-model columns stay populated from the first successful model
    # so existing read paths keep working unchanged.
    first_ok = next((r for r in results if r.status == "ok"), None)

    submission = Submission(
        exam_id=body.exam_id,
        answers=[a.model_dump() for a in body.answers],
        grades=[g.model_dump() for g in first_ok.grades] if first_ok else None,
        total_score=first_ok.total_score if first_ok else None,
        results=[r.model_dump() for r in results],
        comparison=comparison.model_dump() if comparison else None,
        is_final=True,
    )
    session.add(submission)
    session.commit()
    session.refresh(submission)

    return GradingResponse(
        max_score=exam_max_score(exam.questions),
        is_final=True,
        submission_id=submission.id,
        results=results,
        comparison=comparison,
    )


@router.get("/{submission_id}", response_model=SubmissionRead)
def get_submission(submission_id: int, session: SessionDep) -> SubmissionRead:
    """Get a submission with its grades and, when present, its multi-model results."""
    submission = session.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Deserialize JSON-stored lists back into typed objects
    answers = [AnswerInput(**a) if isinstance(a, dict) else a for a in submission.answers]

    grades = None
    if submission.grades is not None:
        grades = [GradeResult(**g) if isinstance(g, dict) else g for g in submission.grades]

    results = None
    if submission.results is not None:
        results = [ModelResult(**r) if isinstance(r, dict) else r for r in submission.results]

    comparison = None
    if submission.comparison is not None:
        comparison = (
            Comparison(**submission.comparison)
            if isinstance(submission.comparison, dict)
            else submission.comparison
        )

    return SubmissionRead(
        id=submission.id,
        exam_id=submission.exam_id,
        answers=answers,
        grades=grades,
        total_score=submission.total_score,
        is_final=submission.is_final,
        created_at=submission.created_at,
        results=results,
        comparison=comparison,
    )
