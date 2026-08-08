"""Fine-tuning dataset export/import. Admin-token protected, end to end.

The long-term plan behind these routes: run ~100 students through the app, let
the models grade them, then have real teachers score the same answers. The gap
between the two is the training signal. So the export has to be something a
teacher can open in Excel and type into, and the import has to accept that same
file back without the teacher having to preserve anything but their own column.

Everything here is gated on the admin secret. The export contains every
student's answers and every model's grade for them; it is emphatically not part
of the anonymous student flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlmodel import select

from app.database import SessionDep
from app.models.human_score import HumanScore
from app.schemas.dataset import (
    DatasetRow,
    HumanScoreBulkIn,
    HumanScoreImportResult,
    HumanScoreRead,
)
from app.security import require_admin_token
from app.services.dataset import (
    collect_rows,
    parse_human_score_csv,
    rows_to_csv,
    rows_to_jsonl,
    upsert_human_scores,
)


router = APIRouter(
    prefix="/api/dataset",
    tags=["dataset"],
    dependencies=[Depends(require_admin_token)],
)


# 2 MB of CSV is roughly 100 students x 3 questions x 3 models with long
# answers. Bounded so a mis-picked file cannot be read into memory wholesale.
_MAX_IMPORT_BYTES = 2 * 1024 * 1024


@router.get("/export.csv", response_class=Response)
def export_csv(session: SessionDep) -> Response:
    """Final submissions as CSV: one row per (submission, question, model).

    ``human_score`` comes back empty for anything not yet scored — that is the
    column the teacher fills in. Cost and latency are per model RUN (the whole
    submission graded in one batch), not per question.
    """
    body = rows_to_csv(collect_rows(session))
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="gradeai-dataset.csv"'
        },
    )


@router.get("/export.jsonl", response_class=Response)
def export_jsonl(session: SessionDep) -> Response:
    """The same rows as newline-delimited JSON, for the training script."""
    body = rows_to_jsonl(collect_rows(session))
    return Response(
        content=body,
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="gradeai-dataset.jsonl"'
        },
    )


@router.get("/rows", response_model=list[DatasetRow])
def export_rows(session: SessionDep) -> list[DatasetRow]:
    """The export as JSON. Same rows, convenient for eyeballing in a browser."""
    return collect_rows(session)


@router.post("/human-scores", response_model=HumanScoreImportResult)
def record_human_scores(
    body: HumanScoreBulkIn, session: SessionDep
) -> HumanScoreImportResult:
    """Record teacher scores from JSON (upsert on submission+question)."""
    return upsert_human_scores(session, body.scores)


@router.post("/human-scores/import", response_model=HumanScoreImportResult)
async def import_human_scores(
    session: SessionDep, file: UploadFile = File(...)
) -> HumanScoreImportResult:
    """Take the edited export CSV back and record the human_score column.

    Only ``submission_id``, ``question_index``, ``human_score``, ``grader_note``
    and ``grader_name`` are read; every other column is context for the human
    and is ignored, so the teacher can delete or reorder them freely.
    """
    raw = await file.read(_MAX_IMPORT_BYTES + 1)
    if len(raw) > _MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"CSV is larger than {_MAX_IMPORT_BYTES // (1024 * 1024)} MB.",
        )
    try:
        # utf-8-sig: Excel writes a BOM, which would otherwise turn the first
        # header into "﻿submission_id" and break the key lookup.
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400, detail="The file is not valid UTF-8 text."
        ) from None

    entries, parse_errors = parse_human_score_csv(text)
    result = upsert_human_scores(session, entries)
    result.errors = parse_errors + result.errors
    result.skipped += len(parse_errors)
    return result


@router.get("/human-scores", response_model=list[HumanScoreRead])
def list_human_scores(session: SessionDep) -> list[HumanScore]:
    """Every recorded teacher score."""
    return list(
        session.exec(
            select(HumanScore).order_by(
                HumanScore.submission_id, HumanScore.question_index
            )
        ).all()
    )
