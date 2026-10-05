"""Student endpoints. No accounts: a share code plus name and roll number.

Starting a paper returns a receipt token that the browser keeps; it is the
student's only key to submit and to see their result.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.database import SessionDep
from app.pilot import grader as grader_module
from app.pilot.config import pilot_settings
from app.pilot.jobs import grade_submission, paper_model
from app.pilot.logic import SUBMIT_GRACE, deadline, final_score, leaderboard, max_score, paper_state, results_visible
from app.pilot.models import Paper, PaperSubmission
from app.pilot.schemas import (
    GradeOut,
    PreviewRequest,
    PublicPaper,
    PublicQuestion,
    StartRequest,
    StartResponse,
    StudentResult,
    SubmitRequest,
    WinnersPage,
)
from app.pilot.security import hash_token, new_token, normalise_roll
from app.models_registry import get_model
from app.pilot.timeutil import as_utc, utcnow

router = APIRouter(prefix="/api/pilot/p", tags=["pilot-students"])

Receipt = Annotated[str, Header(alias="X-Receipt")]


def _paper(session: Session, code: str) -> Paper:
    paper = session.exec(select(Paper).where(Paper.share_code == code.upper())).first()
    if not paper or paper.status == "draft":
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


def _attempt(session: Session, paper: Paper, receipt: str) -> PaperSubmission:
    sub = session.exec(select(PaperSubmission).where(PaperSubmission.receipt_hash == hash_token(receipt))).first()
    if not sub or sub.paper_id != paper.id:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return sub


@router.get("/{code}", response_model=PublicPaper)
def get_paper(code: str, session: SessionDep) -> PublicPaper:
    paper = _paper(session, code)
    state = paper_state(paper)
    return PublicPaper(
        **paper.model_dump(include=set(PublicPaper.model_fields) - {"questions", "max_score", "accepting", "state"}),
        questions=[PublicQuestion(**q) for q in paper.questions],
        max_score=max_score(paper),
        accepting=state == "open",
        state=state,
    )


@router.post("/{code}/start", response_model=StartResponse, status_code=201)
def start(code: str, body: StartRequest, session: SessionDep) -> StartResponse:
    paper = _paper(session, code)
    if paper_state(paper) != "open":
        raise HTTPException(status_code=409, detail="This paper is not accepting answers")
    if paper.collect_section and not body.section:
        raise HTTPException(status_code=400, detail="Section is required")
    receipt = new_token()
    sub = PaperSubmission(
        paper_id=paper.id,
        student_name=body.student_name,
        roll_number=body.roll_number,
        roll_key=normalise_roll(body.roll_number),
        section=body.section,
        receipt_hash=hash_token(receipt),
        max_score=max_score(paper),
    )
    session.add(sub)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=409,
            detail="This roll number has already started this paper. Ask your teacher if you need to restart.",
        )
    session.refresh(sub)
    return StartResponse(receipt=receipt, started_at=sub.started_at, deadline=deadline(paper, sub))


@router.post("/{code}/preview", response_model=GradeOut)
async def preview(code: str, body: PreviewRequest, receipt: Receipt, session: SessionDep) -> GradeOut:
    """Try one answer against the AI without submitting. Off unless the teacher allows it."""
    paper = _paper(session, code)
    if not paper.allow_preview:
        raise HTTPException(status_code=403, detail="Preview is turned off for this paper")
    sub = _attempt(session, paper, receipt)
    if sub.status != "in_progress" or paper_state(paper) != "open":
        raise HTTPException(status_code=409, detail="This attempt is no longer open")
    if body.question_index >= len(paper.questions):
        raise HTTPException(status_code=400, detail="No such question")
    question = paper.questions[body.question_index]
    try:
        result = await grader_module.grade_question(question, body.answer[: pilot_settings.max_answer_chars], paper_model(paper))
    except Exception:
        raise HTTPException(status_code=502, detail="Grading is unavailable right now, try again")
    return GradeOut(
        question_index=body.question_index, score=result.score, max_score=int(question["marks"]), explanation=result.explanation
    )


@router.post("/{code}/submit", response_model=StudentResult)
def submit(
    code: str, body: SubmitRequest, receipt: Receipt, background: BackgroundTasks, session: SessionDep
) -> StudentResult:
    paper = _paper(session, code)
    sub = _attempt(session, paper, receipt)
    if sub.status != "in_progress":
        raise HTTPException(status_code=409, detail="This paper has already been submitted")
    if paper.status == "closed":
        raise HTTPException(status_code=409, detail="This paper has been closed")
    limit = deadline(paper, sub)
    if limit and utcnow() > limit + SUBMIT_GRACE:
        raise HTTPException(status_code=409, detail="Time is up for this paper")

    count = len(paper.questions)
    answers: dict[int, str] = {}
    for a in body.answers:
        if a.question_index >= count:
            raise HTTPException(status_code=400, detail="No such question")
        answers[a.question_index] = a.answer[: pilot_settings.max_answer_chars]
    sub.answers = [{"question_index": i, "answer": answers.get(i, "")} for i in range(count)]
    sub.status = "grading"
    sub.submitted_at = utcnow()
    session.add(sub)
    session.commit()
    session.refresh(sub)
    background.add_task(grade_submission, sub.id)
    return _result(paper, sub)


@router.get("/{code}/result", response_model=StudentResult)
def result(code: str, receipt: Receipt, session: SessionDep) -> StudentResult:
    paper = _paper(session, code)
    sub = _attempt(session, paper, receipt)
    out = _result(paper, sub)
    if paper.is_contest and out.results_visible:
        ranked = _ranked_ids(session, paper)
        out.participants = len(ranked)
        out.rank = ranked.index(sub.id) + 1 if sub.id in ranked else None
    return out


def _ranked_ids(session: Session, paper: Paper) -> list[int]:
    subs = session.exec(
        select(PaperSubmission).where(PaperSubmission.paper_id == paper.id, PaperSubmission.status == "graded")
    ).all()
    return [s.id for s in sorted(subs, key=lambda s: (-(s.ai_score or 0), as_utc(s.submitted_at)))]


def _result(paper: Paper, sub: PaperSubmission) -> StudentResult:
    visible = results_visible(paper, sub)
    out = StudentResult(
        paper_title=paper.title,
        is_contest=paper.is_contest,
        status=sub.status if sub.status != "failed" else "grading",  # failures are retried by the teacher
        student_name=sub.student_name,
        roll_number=sub.roll_number,
        submitted_at=sub.submitted_at,
        results_visible=visible,
        max_score=sub.max_score,
    )
    if visible:
        # Teacher overrides replace the AI's score for that question.
        out.total_score = final_score(sub)
        out.grades = []
        for g in sub.grades:
            override = sub.overrides.get(str(g["question_index"]))
            out.grades.append(
                GradeOut(
                    question_index=g["question_index"],
                    score=g["score"] if override is None else override,
                    max_score=g["max_score"],
                    explanation=g["explanation"],
                )
            )
    return out


@router.get("/{code}/winners", response_model=WinnersPage)
def winners(code: str, session: SessionDep) -> WinnersPage:
    paper = _paper(session, code)
    if not paper.is_contest or not paper.winners_revealed:
        raise HTTPException(status_code=404, detail="Winners have not been announced yet")
    entries = leaderboard(session, paper, hide_rolls=paper.hide_roll_numbers_on_winners)
    spec = get_model(paper_model(paper))
    return WinnersPage(
        title=paper.title,
        subject=paper.subject,
        share_code=paper.share_code,
        participants=len(entries),
        grading_model=spec.label if spec else paper_model(paper),
        date=paper.closes_at or paper.updated_at,
        max_score=max_score(paper),
        entries=entries,
    )
