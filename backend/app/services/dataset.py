"""Flatten stored submissions into a row-per-(submission, question, model) view.

This is the shape the fine-tuning dataset is built from: the model's score and
explanation next to an empty column for the teacher's score, so the gap between
them can be measured directly.

Only FINAL submissions are exported. A "Try" is a student poking at one question
mid-draft; it is not the answer they stand behind, and including it would put
half-written text in the training set.
"""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any, Iterable, Sequence

from sqlmodel import Session, select

from app.models.exam import Exam
from app.models.human_score import HumanScore
from app.models.submission import Submission
from app.models_registry import get_model
from app.schemas.dataset import (
    DatasetRow,
    HumanScoreImportResult,
    HumanScoreIn,
)


# Column order of the CSV. Fixed and explicit: the file is handed to a teacher
# and then handed back, so the header must be stable enough to diff.
CSV_COLUMNS: tuple[str, ...] = (
    "submission_id",
    "created_at",
    "exam_id",
    "question_index",
    "question_text",
    "max_score",
    "student_answer",
    "model_id",
    "model_label",
    "model_status",
    "model_error",
    "model_score",
    "model_explanation",
    "model_recovered",
    "model_run_cost_usd",
    "model_run_latency_ms",
    "human_score",
    "grader_note",
)

# The columns an import reads back. Everything else in the file is context for
# the human and is ignored on the way in.
IMPORT_KEY_COLUMNS = ("submission_id", "question_index")
IMPORT_VALUE_COLUMNS = ("human_score", "grader_note")

# Used when a submission references a model id that is no longer in the registry
# (or a legacy row that predates multi-model grading).
_UNKNOWN_MODEL_LABEL = ""


def _question_lookup(exam: Exam | None) -> list[dict[str, Any]]:
    """The exam's questions as plain dicts, or [] when the exam is gone."""
    if exam is None or not exam.questions:
        return []
    return [q if isinstance(q, dict) else dict(q) for q in exam.questions]


def _answer_lookup(submission: Submission) -> dict[int, str]:
    """question_index -> the student's answer text."""
    answers: dict[int, str] = {}
    for entry in submission.answers or []:
        if not isinstance(entry, dict):
            continue
        idx = entry.get("question_index")
        if isinstance(idx, int):
            answers[idx] = entry.get("answer") or ""
    return answers


def _model_label(model_id: str, fallback: str | None) -> str:
    if fallback:
        return fallback
    spec = get_model(model_id)
    return spec.label if spec else _UNKNOWN_MODEL_LABEL


def _model_runs(submission: Submission) -> list[dict[str, Any]]:
    """The stored per-model results, normalised.

    Rows persisted before multi-model grading have no ``results`` array, only
    the legacy ``grades`` column. Those still carry a student answer and still
    need a human-score slot, so they are exported as a single pseudo-run with a
    blank model id rather than dropped.
    """
    results = submission.results
    if isinstance(results, list) and results:
        return [r for r in results if isinstance(r, dict)]

    grades = submission.grades
    if isinstance(grades, list) and grades:
        return [
            {
                "model_id": "",
                "label": "",
                "status": "ok",
                "grades": grades,
                "metrics": None,
            }
        ]
    return []


def build_rows(
    submissions: Sequence[Submission],
    exams: dict[int, Exam],
    human_scores: dict[tuple[int, int], HumanScore],
) -> list[DatasetRow]:
    """One row per (submission, answered question, grading model)."""
    rows: list[DatasetRow] = []

    for submission in submissions:
        if submission.id is None:
            continue
        questions = _question_lookup(exams.get(submission.exam_id))
        answers = _answer_lookup(submission)

        for run in _model_runs(submission):
            model_id = str(run.get("model_id") or "")
            label = _model_label(model_id, run.get("label"))
            status = str(run.get("status") or "ok")
            metrics = run.get("metrics") if isinstance(run.get("metrics"), dict) else {}
            cost = metrics.get("cost_usd") if metrics else None
            latency = metrics.get("latency_ms") if metrics else None

            grades = {
                g["question_index"]: g
                for g in (run.get("grades") or [])
                if isinstance(g, dict) and isinstance(g.get("question_index"), int)
            }

            # Every answered question gets a row, even from a model that failed:
            # the teacher still has to score that answer, and a missing row is
            # a silently missing training example.
            for question_index in sorted(answers):
                question = (
                    questions[question_index]
                    if 0 <= question_index < len(questions)
                    else {}
                )
                grade = grades.get(question_index)
                human = human_scores.get((submission.id, question_index))

                rows.append(
                    DatasetRow(
                        submission_id=submission.id,
                        created_at=submission.created_at,
                        exam_id=submission.exam_id,
                        question_index=question_index,
                        question_text=str(question.get("text") or ""),
                        max_score=int(question.get("credit") or 0),
                        student_answer=answers[question_index],
                        model_id=model_id,
                        model_label=label,
                        model_status=status,
                        model_error=run.get("error"),
                        model_score=grade.get("score") if grade else None,
                        model_explanation=grade.get("explanation") if grade else None,
                        model_recovered=grade.get("recovered") if grade else None,
                        model_run_cost_usd=cost,
                        model_run_latency_ms=latency,
                        human_score=human.human_score if human else None,
                        grader_note=human.grader_note if human else None,
                    )
                )

    rows.sort(key=lambda r: (r.submission_id, r.question_index, r.model_id))
    return rows


def collect_rows(session: Session) -> list[DatasetRow]:
    """Load every final submission and flatten it. Three queries, no N+1."""
    submissions = list(
        session.exec(
            select(Submission)
            .where(Submission.is_final == True)  # noqa: E712 - SQL expression
            .order_by(Submission.id)
        ).all()
    )
    if not submissions:
        return []

    exam_ids = {s.exam_id for s in submissions}
    exams = {
        exam.id: exam
        for exam in session.exec(select(Exam).where(Exam.id.in_(exam_ids))).all()  # type: ignore[union-attr]
        if exam.id is not None
    }

    submission_ids = {s.id for s in submissions if s.id is not None}
    human_scores = {
        (hs.submission_id, hs.question_index): hs
        for hs in session.exec(
            select(HumanScore).where(HumanScore.submission_id.in_(submission_ids))  # type: ignore[union-attr]
        ).all()
    }

    return build_rows(submissions, exams, human_scores)


def _cell(value: Any) -> str:
    """CSV cell text. None becomes empty, which is what the teacher fills in."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def rows_to_csv(rows: Iterable[DatasetRow]) -> str:
    """The export as CSV text, with a header row."""
    buffer = io.StringIO()
    # QUOTE_ALL keeps answers containing commas, quotes or newlines readable in
    # Excel, which is where these files are actually going to be edited.
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL, lineterminator="\n")
    writer.writerow(CSV_COLUMNS)
    for row in rows:
        payload = row.model_dump()
        payload["created_at"] = row.created_at.isoformat()
        writer.writerow([_cell(payload[column]) for column in CSV_COLUMNS])
    return buffer.getvalue()


def _parse_int(value: str | None) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _parse_score(value: str | None) -> float | None:
    text = (value or "").strip()
    if not text:
        return None
    return float(text)  # ValueError handled by the caller


def parse_human_score_csv(text: str) -> tuple[list[HumanScoreIn], list[str]]:
    """Read teacher scores back out of an edited export.

    The export has one row per model, so the SAME (submission, question) appears
    two or three times and the teacher will realistically type their score into
    only one of them — or into all of them. Both are accepted: rows are folded
    by key, blanks are ignored, and only a genuine disagreement (two different
    non-empty scores for one question) is refused, because guessing which one
    the teacher meant is exactly the sort of silent corruption a training set
    cannot recover from.
    """
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        return [], ["The file is empty."]

    missing = [c for c in IMPORT_KEY_COLUMNS if c not in reader.fieldnames]
    if missing:
        return [], [f"Missing required column(s): {', '.join(missing)}"]
    if not any(c in reader.fieldnames for c in IMPORT_VALUE_COLUMNS):
        return [], [
            "The file has no human_score or grader_note column — nothing to import."
        ]

    folded: dict[tuple[int, int], HumanScoreIn] = {}
    # Keys whose rows disagree. Dropped entirely rather than resolved: taking
    # the first value would record a number the teacher may not have meant, and
    # a wrong label is worse for the dataset than a missing one.
    conflicted: set[tuple[int, int]] = set()
    errors: list[str] = []

    for line_number, raw in enumerate(reader, start=2):
        submission_id = _parse_int(raw.get("submission_id"))
        question_index = _parse_int(raw.get("question_index"))
        if submission_id is None or question_index is None:
            errors.append(
                f"Line {line_number}: submission_id/question_index is missing or "
                "not a whole number."
            )
            continue

        try:
            score = _parse_score(raw.get("human_score"))
        except ValueError:
            errors.append(
                f"Line {line_number}: human_score "
                f"{raw.get('human_score')!r} is not a number."
            )
            continue

        note = (raw.get("grader_note") or "").strip() or None
        grader = (raw.get("grader_name") or "").strip() or None

        # A row the teacher did not touch carries no information. Skipping it
        # keeps a re-imported fresh export from creating thousands of empties.
        if score is None and note is None:
            continue

        key = (submission_id, question_index)
        if key in conflicted:
            continue

        existing = folded.get(key)
        if existing is None:
            folded[key] = HumanScoreIn(
                submission_id=submission_id,
                question_index=question_index,
                human_score=score,
                grader_note=note,
                grader_name=grader,
            )
            continue

        if (
            score is not None
            and existing.human_score is not None
            and score != existing.human_score
        ):
            errors.append(
                f"Line {line_number}: submission {submission_id} question "
                f"{question_index} has conflicting human_score values "
                f"({existing.human_score} and {score}) — neither was imported."
            )
            conflicted.add(key)
            folded.pop(key, None)
            continue

        if score is not None:
            existing.human_score = score
        if note is not None and not existing.grader_note:
            existing.grader_note = note
        if grader is not None and not existing.grader_name:
            existing.grader_name = grader

    return list(folded.values()), errors


def upsert_human_scores(
    session: Session, entries: Sequence[HumanScoreIn]
) -> HumanScoreImportResult:
    """Insert or update one teacher score per (submission_id, question_index)."""
    result = HumanScoreImportResult()
    if not entries:
        return result

    keys = {(e.submission_id, e.question_index) for e in entries}
    submission_ids = {sid for sid, _ in keys}

    known_submissions = {
        sid
        for sid in session.exec(
            select(Submission.id).where(Submission.id.in_(submission_ids))  # type: ignore[union-attr]
        ).all()
        if sid is not None
    }

    existing = {
        (hs.submission_id, hs.question_index): hs
        for hs in session.exec(
            select(HumanScore).where(HumanScore.submission_id.in_(submission_ids))  # type: ignore[union-attr]
        ).all()
    }

    for entry in entries:
        if entry.submission_id not in known_submissions:
            # Refuse to record a score against a submission that does not exist:
            # it would be an orphan row that never appears in any export.
            result.skipped += 1
            result.errors.append(
                f"Submission {entry.submission_id} does not exist — skipped."
            )
            continue

        key = (entry.submission_id, entry.question_index)
        row = existing.get(key)
        if row is None:
            row = HumanScore(
                submission_id=entry.submission_id,
                question_index=entry.question_index,
                human_score=entry.human_score,
                grader_note=entry.grader_note,
                grader_name=entry.grader_name,
            )
            session.add(row)
            existing[key] = row
            result.created += 1
            continue

        changed = False
        for field in ("human_score", "grader_note", "grader_name"):
            new_value = getattr(entry, field)
            # None means "not supplied in this import", not "clear it".
            if new_value is not None and getattr(row, field) != new_value:
                setattr(row, field, new_value)
                changed = True

        if changed:
            row.updated_at = datetime.utcnow()
            session.add(row)
            result.updated += 1
        else:
            result.unchanged += 1

    session.commit()
    return result


def rows_to_jsonl(rows: Iterable[DatasetRow]) -> str:
    """The same rows as newline-delimited JSON — the shape a training script wants.

    Free to add: it is the identical row objects, serialized differently.
    """
    lines = []
    for row in rows:
        payload = row.model_dump()
        payload["created_at"] = row.created_at.isoformat()
        lines.append(json.dumps(payload, ensure_ascii=False))
    return "\n".join(lines) + ("\n" if lines else "")
