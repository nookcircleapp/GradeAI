"""Teacher endpoints: papers, records, review, contest."""
from __future__ import annotations

import csv
import io

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from app.database import SessionDep
from app.pilot.jobs import grade_submission
from app.pilot.logic import final_score, leaderboard, paper_read, submission_detail, submission_row
from app.pilot.models import Paper, PaperSubmission, User
from app.pilot.schemas import (
    LeaderboardEntry,
    PaperCreate,
    PaperRead,
    PaperStatusChange,
    PaperUpdate,
    ReviewUpdate,
    SubmissionDetail,
    SubmissionRow,
)
from app.pilot.security import CurrentUser, new_share_code
from app.pilot.timeutil import utcnow

router = APIRouter(prefix="/api/pilot/papers", tags=["pilot-papers"])


class Toggle(BaseModel):
    value: bool


def _own_paper(session: Session, paper_id: int, user: User) -> Paper:
    paper = session.get(Paper, paper_id)
    if not paper or (paper.owner_id != user.id and user.role != "admin"):
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


def _own_submission(session: Session, paper: Paper, submission_id: int) -> PaperSubmission:
    sub = session.get(PaperSubmission, submission_id)
    if not sub or sub.paper_id != paper.id:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


def _has_submissions(session: Session, paper: Paper) -> bool:
    return session.exec(select(PaperSubmission.id).where(PaperSubmission.paper_id == paper.id)).first() is not None


def _unique_share_code(session: Session) -> str:
    while True:
        code = new_share_code()
        if not session.exec(select(Paper.id).where(Paper.share_code == code)).first():
            return code


@router.get("", response_model=list[PaperRead])
def list_papers(user: CurrentUser, session: SessionDep) -> list[PaperRead]:
    query = select(Paper).where(Paper.is_template == False).order_by(Paper.created_at.desc())  # noqa: E712
    if user.role != "admin":
        query = query.where(Paper.owner_id == user.id)
    return [paper_read(session, p) for p in session.exec(query).all()]


@router.get("/templates", response_model=list[PaperRead])
def list_templates(_: CurrentUser, session: SessionDep) -> list[PaperRead]:
    """Pre-made papers any teacher can copy."""
    query = select(Paper).where(Paper.is_template == True).order_by(Paper.created_at)  # noqa: E712
    return [paper_read(session, p) for p in session.exec(query).all()]


@router.post("/{paper_id}/copy", response_model=PaperRead, status_code=201)
def copy_paper(paper_id: int, user: CurrentUser, session: SessionDep) -> PaperRead:
    """Copy a template, or one of your own papers, into a new draft you own."""
    source = session.get(Paper, paper_id)
    if not source or not (source.is_template or source.owner_id == user.id or user.role == "admin"):
        raise HTTPException(status_code=404, detail="Paper not found")
    fields = PaperCreate.model_validate(source.model_dump(include=set(PaperCreate.model_fields))).model_dump()
    if not source.is_template:
        fields["title"] = f"{source.title} (copy)"
    paper = Paper(**fields, owner_id=user.id, share_code=_unique_share_code(session))
    session.add(paper)
    session.commit()
    session.refresh(paper)
    return paper_read(session, paper)


@router.post("", response_model=PaperRead, status_code=201)
def create_paper(body: PaperCreate, user: CurrentUser, session: SessionDep) -> PaperRead:
    data = body.model_dump()
    paper = Paper(**data, owner_id=user.id, share_code=_unique_share_code(session))
    session.add(paper)
    session.commit()
    session.refresh(paper)
    return paper_read(session, paper)


@router.get("/{paper_id}", response_model=PaperRead)
def get_paper(paper_id: int, user: CurrentUser, session: SessionDep) -> PaperRead:
    return paper_read(session, _own_paper(session, paper_id, user))


@router.patch("/{paper_id}", response_model=PaperRead)
def update_paper(paper_id: int, body: PaperUpdate, user: CurrentUser, session: SessionDep) -> PaperRead:
    paper = _own_paper(session, paper_id, user)
    changes = body.model_dump(exclude_unset=True)
    if "questions" in changes and _has_submissions(session, paper):
        raise HTTPException(status_code=409, detail="Questions cannot change once students have started")
    for key, value in changes.items():
        setattr(paper, key, value)
    paper.updated_at = utcnow()
    session.add(paper)
    session.commit()
    session.refresh(paper)
    return paper_read(session, paper)


@router.delete("/{paper_id}", status_code=204)
def delete_paper(paper_id: int, user: CurrentUser, session: SessionDep) -> None:
    paper = _own_paper(session, paper_id, user)
    if _has_submissions(session, paper):
        raise HTTPException(status_code=409, detail="Papers with submissions cannot be deleted; close them instead")
    session.delete(paper)
    session.commit()


@router.post("/{paper_id}/status", response_model=PaperRead)
def set_status(paper_id: int, body: PaperStatusChange, user: CurrentUser, session: SessionDep) -> PaperRead:
    paper = _own_paper(session, paper_id, user)
    if paper.is_template:
        raise HTTPException(status_code=400, detail="Copy this pre-made paper before running it")
    if body.status == "open" and not paper.questions:
        raise HTTPException(status_code=400, detail="Add at least one question before opening the paper")
    paper.status = body.status
    paper.updated_at = utcnow()
    session.add(paper)
    session.commit()
    session.refresh(paper)
    return paper_read(session, paper)


@router.post("/{paper_id}/results-released", response_model=PaperRead)
def release_results(paper_id: int, body: Toggle, user: CurrentUser, session: SessionDep) -> PaperRead:
    paper = _own_paper(session, paper_id, user)
    paper.results_released = body.value
    session.add(paper)
    session.commit()
    session.refresh(paper)
    return paper_read(session, paper)


@router.post("/{paper_id}/winners-revealed", response_model=PaperRead)
def reveal_winners(paper_id: int, body: Toggle, user: CurrentUser, session: SessionDep) -> PaperRead:
    paper = _own_paper(session, paper_id, user)
    if not paper.is_contest:
        raise HTTPException(status_code=400, detail="The winners screen is off for this paper")
    paper.winners_revealed = body.value
    session.add(paper)
    session.commit()
    session.refresh(paper)
    return paper_read(session, paper)


@router.get("/{paper_id}/submissions", response_model=list[SubmissionRow])
def list_submissions(paper_id: int, user: CurrentUser, session: SessionDep) -> list[SubmissionRow]:
    paper = _own_paper(session, paper_id, user)
    subs = session.exec(
        select(PaperSubmission).where(PaperSubmission.paper_id == paper.id).order_by(PaperSubmission.started_at)
    ).all()
    return [submission_row(s) for s in subs]


@router.get("/{paper_id}/submissions/{submission_id}", response_model=SubmissionDetail)
def get_submission(paper_id: int, submission_id: int, user: CurrentUser, session: SessionDep) -> SubmissionDetail:
    paper = _own_paper(session, paper_id, user)
    return submission_detail(_own_submission(session, paper, submission_id))


@router.patch("/{paper_id}/submissions/{submission_id}", response_model=SubmissionDetail)
def review_submission(
    paper_id: int, submission_id: int, body: ReviewUpdate, user: CurrentUser, session: SessionDep
) -> SubmissionDetail:
    paper = _own_paper(session, paper_id, user)
    sub = _own_submission(session, paper, submission_id)
    changes = body.model_dump(exclude_unset=True)
    if "overrides" in changes:
        overrides = dict(sub.overrides)
        for key, score in body.overrides.items():
            try:
                index = int(key)
                marks = int(paper.questions[index]["marks"])
            except (ValueError, IndexError):
                raise HTTPException(status_code=400, detail=f"No question {key}")
            if score is None:
                overrides.pop(str(index), None)
            elif not 0 <= score <= marks:
                raise HTTPException(status_code=400, detail=f"Question {index + 1} is out of {marks}")
            else:
                overrides[str(index)] = score
        sub.overrides = overrides
    if "teacher_note" in changes:
        sub.teacher_note = body.teacher_note or ""
    if "ai_fooled" in changes:
        sub.ai_fooled = body.ai_fooled
    session.add(sub)
    session.commit()
    session.refresh(sub)
    return submission_detail(sub)


@router.delete("/{paper_id}/submissions/{submission_id}", status_code=204)
def reset_attempt(paper_id: int, submission_id: int, user: CurrentUser, session: SessionDep) -> None:
    """Remove an attempt so the student can start again (e.g. lost their browser)."""
    paper = _own_paper(session, paper_id, user)
    session.delete(_own_submission(session, paper, submission_id))
    session.commit()


@router.post("/{paper_id}/submissions/{submission_id}/regrade", response_model=SubmissionRow)
def regrade(
    paper_id: int, submission_id: int, background: BackgroundTasks, user: CurrentUser, session: SessionDep
) -> SubmissionRow:
    paper = _own_paper(session, paper_id, user)
    sub = _own_submission(session, paper, submission_id)
    if sub.status not in ("failed", "graded"):
        raise HTTPException(status_code=409, detail="Only submitted papers can be regraded")
    sub.status = "grading"
    session.add(sub)
    session.commit()
    session.refresh(sub)
    background.add_task(grade_submission, sub.id)
    return submission_row(sub)


@router.get("/{paper_id}/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(paper_id: int, user: CurrentUser, session: SessionDep) -> list[LeaderboardEntry]:
    return leaderboard(session, _own_paper(session, paper_id, user))


@router.get("/{paper_id}/export.csv")
def export_csv(paper_id: int, user: CurrentUser, session: SessionDep) -> Response:
    """Full record: one row per student, per-question answers and scores."""
    paper = _own_paper(session, paper_id, user)
    subs = session.exec(
        select(PaperSubmission).where(PaperSubmission.paper_id == paper.id).order_by(PaperSubmission.started_at)
    ).all()
    header = [
        "student_name", "roll_number", "section", "status", "started_at", "submitted_at",
        "ai_score", "final_score", "max_score", "ai_fooled", "teacher_note", "grading_model", "prompt_version",
    ]
    for i in range(len(paper.questions)):
        n = i + 1
        header += [f"q{n}_answer", f"q{n}_ai_score", f"q{n}_teacher_score", f"q{n}_explanation", f"q{n}_suspected_manipulation"]

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(header)
    for s in subs:
        answers = {a["question_index"]: a["answer"] for a in s.answers}
        grades = {g["question_index"]: g for g in (s.grades or [])}
        row = [
            s.student_name, s.roll_number, s.section, s.status, s.started_at, s.submitted_at,
            s.ai_score, final_score(s), s.max_score, s.ai_fooled, s.teacher_note, s.grading_model, s.prompt_version,
        ]
        for i in range(len(paper.questions)):
            g = grades.get(i, {})
            row += [answers.get(i, ""), g.get("score"), s.overrides.get(str(i)), g.get("explanation"), g.get("suspected_manipulation")]
        writer.writerow(_safe_csv(row))

    filename = f"paper-{paper.share_code}-records.csv"
    return Response(
        content="﻿" + out.getvalue(),  # BOM so Excel reads UTF-8 names correctly
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _safe_csv(row: list) -> list:
    # Student text opened in Excel must not run as a formula.
    return [f"'{v}" if isinstance(v, str) and v[:1] in ("=", "+", "-", "@") else v for v in row]
