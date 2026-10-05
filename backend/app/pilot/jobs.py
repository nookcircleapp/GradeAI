"""Background grading of submitted papers, with a cap on concurrent API calls."""
from __future__ import annotations

import asyncio
import logging

from sqlmodel import Session, select

from app.database import engine
from app.pilot import grader as grader_module
from app.pilot.config import pilot_settings
from app.pilot.models import Paper, PaperSubmission
from app.pilot.timeutil import utcnow

logger = logging.getLogger(__name__)

_semaphore: asyncio.Semaphore | None = None


def _limit() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(pilot_settings.grading_concurrency)
    return _semaphore


def paper_model(paper: Paper) -> str:
    return paper.grading_model or pilot_settings.grading_model


async def _graded(question: dict, answer: str, model: str):
    async with _limit():
        return await grader_module.grade_question(question, answer, model)


async def grade_submission(submission_id: int) -> None:
    with Session(engine) as session:
        sub = session.get(PaperSubmission, submission_id)
        if not sub or sub.status not in ("grading", "failed"):
            return
        paper = session.get(Paper, sub.paper_id)
        questions = list(paper.questions)
        answers = {a["question_index"]: a["answer"] for a in sub.answers}
        model = paper_model(paper)

    try:
        results = await asyncio.gather(
            *(_graded(q, answers.get(i, ""), model) for i, q in enumerate(questions))
        )
    except Exception as exc:
        logger.exception("Grading submission %s failed", submission_id)
        with Session(engine) as session:
            sub = session.get(PaperSubmission, submission_id)
            sub.status = "failed"
            sub.grading_error = str(exc)[:1000]
            session.add(sub)
            session.commit()
        return

    grades = [
        {
            "question_index": i,
            "score": r.score,
            "max_score": int(q["marks"]),
            "explanation": r.explanation,
            "suspected_manipulation": r.suspected_manipulation,
            "raw": r.raw,
        }
        for i, (q, r) in enumerate(zip(questions, results))
    ]
    with Session(engine) as session:
        sub = session.get(PaperSubmission, submission_id)
        sub.grades = grades
        sub.ai_score = sum(g["score"] for g in grades)
        sub.grading_model = model
        sub.prompt_version = grader_module.PROMPT_VERSION
        sub.grading_error = None
        sub.status = "graded"
        sub.graded_at = utcnow()
        session.add(sub)
        session.commit()


async def resume_pending() -> None:
    """Re-queue submissions left mid-grading by a restart."""
    with Session(engine) as session:
        ids = session.exec(select(PaperSubmission.id).where(PaperSubmission.status == "grading")).all()
    for submission_id in ids:
        asyncio.create_task(grade_submission(submission_id))
