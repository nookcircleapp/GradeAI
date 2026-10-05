"""Shared rules for papers and submissions."""
from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session, func, select

from app.pilot.models import Paper, PaperSubmission
from app.pilot.schemas import LeaderboardEntry, PaperRead, SubmissionDetail, SubmissionRow
from app.pilot.timeutil import as_utc, utcnow

# Extra time allowed after a time limit runs out, for slow networks.
SUBMIT_GRACE = timedelta(minutes=2)


def max_score(paper: Paper) -> int:
    return sum(int(q["marks"]) for q in paper.questions)


def paper_state(paper: Paper) -> str:
    """not_open | open | closed, from the status and the time window."""
    now = utcnow()
    if paper.status == "closed" or (paper.closes_at and as_utc(paper.closes_at) <= now):
        return "closed"
    if paper.status != "open" or (paper.opens_at and as_utc(paper.opens_at) > now):
        return "not_open"
    return "open"


def deadline(paper: Paper, sub: PaperSubmission):
    limits = []
    if paper.time_limit_minutes:
        limits.append(as_utc(sub.started_at) + timedelta(minutes=paper.time_limit_minutes))
    if paper.closes_at:
        limits.append(as_utc(paper.closes_at))
    return min(limits) if limits else None


def final_score(sub: PaperSubmission) -> int | None:
    """AI score with any teacher overrides applied per question."""
    if not sub.grades:
        return None
    total = 0
    for g in sub.grades:
        override = sub.overrides.get(str(g["question_index"]))
        total += g["score"] if override is None else override
    return total


def results_visible(paper: Paper, sub: PaperSubmission) -> bool:
    if sub.status != "graded":
        return False
    return paper.results_mode == "immediate" or paper.results_released


def paper_read(session: Session, paper: Paper) -> PaperRead:
    count = session.exec(
        select(func.count()).select_from(PaperSubmission).where(PaperSubmission.paper_id == paper.id)
    ).one()
    return PaperRead(
        **paper.model_dump(exclude={"questions"}),
        questions=paper.questions,
        max_score=max_score(paper),
        submission_count=count,
    )


def question_scores(sub: PaperSubmission) -> list[int | None]:
    if not sub.grades:
        return []
    scores = []
    for g in sub.grades:
        override = sub.overrides.get(str(g["question_index"]))
        scores.append(g["score"] if override is None else override)
    return scores


def is_flagged(sub: PaperSubmission) -> bool:
    return any(g.get("suspected_manipulation") for g in sub.grades or [])


_COMPUTED = {"final_score", "question_scores", "flagged"}


def submission_row(sub: PaperSubmission) -> SubmissionRow:
    return SubmissionRow(
        **sub.model_dump(include=set(SubmissionRow.model_fields) - _COMPUTED),
        final_score=final_score(sub),
        question_scores=question_scores(sub),
        flagged=is_flagged(sub),
    )


def submission_detail(sub: PaperSubmission) -> SubmissionDetail:
    return SubmissionDetail(
        **sub.model_dump(include=set(SubmissionDetail.model_fields) - _COMPUTED),
        final_score=final_score(sub),
        question_scores=question_scores(sub),
        flagged=is_flagged(sub),
    )


def leaderboard(session: Session, paper: Paper, hide_rolls: bool = False) -> list[LeaderboardEntry]:
    """Contest ranking on the AI score; ties go to the earlier submission."""
    subs = session.exec(
        select(PaperSubmission).where(
            PaperSubmission.paper_id == paper.id, PaperSubmission.status == "graded"
        )
    ).all()
    subs = sorted(subs, key=lambda s: (-(s.ai_score or 0), as_utc(s.submitted_at)))
    entries = []
    for i, s in enumerate(subs):
        entries.append(
            LeaderboardEntry(
                rank=i + 1,
                student_name=s.student_name,
                roll_number=None if hide_rolls else s.roll_number,
                section=s.section,
                score=s.ai_score or 0,
                max_score=s.max_score,
                submitted_at=s.submitted_at,
            )
        )
    return entries
