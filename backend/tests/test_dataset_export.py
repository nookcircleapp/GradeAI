"""The fine-tuning dataset: export shape, human-score storage, import round-trip.

The plan this serves: ~100 students answer, the models grade, real teachers
score the same answers, and the gap between the two becomes training data. So
the export has to be a file a teacher can open in Excel and type into, and the
import has to take that same file back.

Run with:  .venv/bin/python -m pytest tests -q
"""

from __future__ import annotations

import csv
import io
import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool

import app.models.exam  # noqa: F401 - register tables
import app.models.human_score  # noqa: F401 - register tables
import app.models.submission  # noqa: F401 - register tables
from app import security
from app.database import get_session
from app.main import app as fastapi_app
from app.models.exam import Exam
from app.models.human_score import HumanScore
from app.models.submission import Submission
from app.seed import DEMO_EXAM_DATA
from app.services.dataset import CSV_COLUMNS


GOOD_TOKEN = "correct-horse-battery-staple"
AUTH = {"X-Admin-Token": GOOD_TOKEN}

ANSWER_0 = "Artificial intelligence is the study of intelligent machines."
ANSWER_1 = 'Supervised uses labels, unsupervised does not — "obviously", he said.'


def _submission(is_final: bool, answers, results) -> Submission:
    return Submission(
        exam_id=1,
        answers=answers,
        grades=results[0]["grades"] if results else None,
        total_score=results[0]["total_score"] if results else None,
        results=results,
        comparison=None,
        is_final=is_final,
    )


def _model_run(model_id: str, label: str, scores: dict[int, int], cost: float, latency: int):
    return {
        "model_id": model_id,
        "label": label,
        "tier": "small",
        "status": "ok",
        "error": None,
        "total_score": sum(scores.values()),
        "grades": [
            {
                "question_index": index,
                "score": score,
                "max_score": DEMO_EXAM_DATA["questions"][index]["credit"],
                "explanation": f"{label} says {score}.",
                "recovered": False,
            }
            for index, score in sorted(scores.items())
        ],
        "metrics": {
            "latency_ms": latency,
            "prompt_tokens": 1000,
            "completion_tokens": 100,
            "total_tokens": 1100,
            "cost_usd": cost,
        },
    }


@pytest.fixture()
def client(monkeypatch):
    """One exam, two final submissions and one Try, over an in-memory DB."""
    monkeypatch.setattr(security.settings, "admin_token", GOOD_TOKEN, raising=False)

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    answers = [
        {"question_index": 0, "answer": ANSWER_0},
        {"question_index": 1, "answer": ANSWER_1},
    ]
    with Session(engine) as session:
        session.add(Exam(**DEMO_EXAM_DATA))
        session.add(
            _submission(
                True,
                answers,
                [
                    _model_run("llama-3.1-8b-instant", "Llama 3.1 8B Instant", {0: 2, 1: 3}, 0.00012, 900),
                    _model_run("gpt-4o-mini", "GPT-4o mini", {0: 1, 1: 5}, 0.00045, 1500),
                ],
            )
        )
        session.add(
            _submission(
                True,
                [{"question_index": 0, "answer": ANSWER_0}],
                [_model_run("gpt-4o-mini", "GPT-4o mini", {0: 2}, 0.0002, 700)],
            )
        )
        # A "Try": must never appear in the dataset.
        session.add(
            _submission(
                False,
                [{"question_index": 0, "answer": "a half-written draft answer"}],
                [_model_run("gpt-4o-mini", "GPT-4o mini", {0: 0}, 0.0001, 500)],
            )
        )
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session
    with TestClient(fastapi_app) as test_client:
        test_client.engine = engine  # type: ignore[attr-defined]
        yield test_client
    fastapi_app.dependency_overrides.clear()


def _rows(client) -> list[dict]:
    response = client.get("/api/dataset/export.csv", headers=AUTH)
    assert response.status_code == 200
    return list(csv.DictReader(io.StringIO(response.text)))


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def test_export_is_admin_only(client):
    for path in (
        "/api/dataset/export.csv",
        "/api/dataset/export.jsonl",
        "/api/dataset/rows",
        "/api/dataset/human-scores",
    ):
        assert client.get(path).status_code == 401, path
        assert client.get(path, headers={"X-Admin-Token": "nope"}).status_code == 401, path


def test_export_is_one_row_per_submission_question_model(client):
    rows = _rows(client)

    keys = [(r["submission_id"], r["question_index"], r["model_id"]) for r in rows]
    assert keys == [
        ("1", "0", "gpt-4o-mini"),
        ("1", "0", "llama-3.1-8b-instant"),
        ("1", "1", "gpt-4o-mini"),
        ("1", "1", "llama-3.1-8b-instant"),
        ("2", "0", "gpt-4o-mini"),
    ]
    assert len(keys) == len(set(keys))


def test_try_attempts_are_excluded(client):
    """Only is_final submissions. Submission 3 is a Try."""
    assert all(r["submission_id"] != "3" for r in _rows(client))
    assert all("half-written" not in r["student_answer"] for r in _rows(client))


def test_a_row_carries_everything_the_dataset_needs(client):
    row = next(
        r
        for r in _rows(client)
        if (r["submission_id"], r["question_index"], r["model_id"])
        == ("1", "1", "gpt-4o-mini")
    )

    assert list(row) == list(CSV_COLUMNS)
    assert row["exam_id"] == "1"
    assert row["question_text"] == DEMO_EXAM_DATA["questions"][1]["text"]
    assert row["max_score"] == "5"
    # Quoting survives an answer containing a comma, an em dash and quote marks.
    assert row["student_answer"] == ANSWER_1
    assert row["model_label"] == "GPT-4o mini"
    assert row["model_score"] == "5"
    assert row["model_explanation"] == "GPT-4o mini says 5."
    assert row["model_run_cost_usd"] == "0.00045"
    assert row["model_run_latency_ms"] == "1500"
    assert row["created_at"]
    # The slot the teacher fills in.
    assert row["human_score"] == ""
    assert row["grader_note"] == ""


def test_reference_answers_are_not_in_the_export(client):
    """The export is admin-only, but it is also not the place for teacher keys."""
    body = client.get("/api/dataset/export.csv", headers=AUTH).text
    assert "reference_answers" not in body
    for question in DEMO_EXAM_DATA["questions"]:
        for reference in question["reference_answers"]:
            assert reference[:60] not in body


def test_jsonl_export_matches_the_csv_rows(client):
    response = client.get("/api/dataset/export.jsonl", headers=AUTH)
    assert response.status_code == 200

    lines = [json.loads(line) for line in response.text.splitlines() if line.strip()]
    assert len(lines) == len(_rows(client))
    assert set(lines[0]) == set(CSV_COLUMNS)
    assert lines[0]["human_score"] is None  # typed null, not ""


def test_export_is_empty_but_valid_with_no_submissions(monkeypatch):
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(security.settings, "admin_token", GOOD_TOKEN, raising=False)

    def override_session():
        with Session(engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session
    with TestClient(fastapi_app) as test_client:
        csv_body = test_client.get("/api/dataset/export.csv", headers=AUTH).text
        assert csv_body.splitlines() == [",".join(f'"{c}"' for c in CSV_COLUMNS)]
        assert test_client.get("/api/dataset/export.jsonl", headers=AUTH).text == ""
    fastapi_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Human scores
# ---------------------------------------------------------------------------


def test_human_scores_are_stored_in_their_own_table_not_the_submission(client):
    response = client.post(
        "/api/dataset/human-scores",
        headers=AUTH,
        json={
            "scores": [
                {
                    "submission_id": 1,
                    "question_index": 0,
                    "human_score": 1.5,
                    "grader_note": "Definition fine, second application vague.",
                    "grader_name": "Dr Sharma",
                }
            ]
        },
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1

    with Session(client.engine) as session:  # type: ignore[attr-defined]
        stored = session.exec(select(HumanScore)).all()
        assert len(stored) == 1
        assert stored[0].human_score == 1.5  # half marks survive
        assert stored[0].grader_name == "Dr Sharma"
        # The submission itself is untouched — it is the evidence, not the label.
        submission = session.get(Submission, 1)
        assert "human_score" not in json.dumps(submission.results)
        assert "human_score" not in json.dumps(submission.answers)


def test_recording_the_same_question_twice_updates_rather_than_duplicates(client):
    body = {"scores": [{"submission_id": 1, "question_index": 0, "human_score": 1.0}]}
    assert client.post("/api/dataset/human-scores", headers=AUTH, json=body).json()["created"] == 1

    body["scores"][0]["human_score"] = 2.0
    result = client.post("/api/dataset/human-scores", headers=AUTH, json=body).json()
    assert result["updated"] == 1 and result["created"] == 0

    scores = client.get("/api/dataset/human-scores", headers=AUTH).json()
    assert len(scores) == 1
    assert scores[0]["human_score"] == 2.0


def test_a_score_against_a_missing_submission_is_refused(client):
    result = client.post(
        "/api/dataset/human-scores",
        headers=AUTH,
        json={"scores": [{"submission_id": 999, "question_index": 0, "human_score": 1}]},
    ).json()

    assert result["created"] == 0 and result["skipped"] == 1
    assert "999" in result["errors"][0]


def test_a_recorded_score_appears_on_the_next_export(client):
    client.post(
        "/api/dataset/human-scores",
        headers=AUTH,
        json={
            "scores": [
                {"submission_id": 1, "question_index": 0, "human_score": 1.5,
                 "grader_note": "Vague second example."}
            ]
        },
    )

    rows = _rows(client)
    scored = [r for r in rows if r["submission_id"] == "1" and r["question_index"] == "0"]
    # One human score, shown on every model row for that question.
    assert len(scored) == 2
    assert all(r["human_score"] == "1.5" for r in scored)
    assert all(r["grader_note"] == "Vague second example." for r in scored)
    # ...and it does not bleed onto a different question.
    other = next(r for r in rows if r["question_index"] == "1")
    assert other["human_score"] == ""


# ---------------------------------------------------------------------------
# Import round-trip
# ---------------------------------------------------------------------------


def _filled_csv(client, filler) -> bytes:
    """Download the export, run `filler(row)` over each row, hand it back."""
    text = client.get("/api/dataset/export.csv", headers=AUTH).text
    rows = list(csv.DictReader(io.StringIO(text)))
    for row in rows:
        filler(row)

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(CSV_COLUMNS), quoting=csv.QUOTE_ALL)
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue().encode("utf-8")


def _upload(client, payload: bytes):
    return client.post(
        "/api/dataset/human-scores/import",
        headers=AUTH,
        files={"file": ("dataset.csv", payload, "text/csv")},
    )


def test_the_exported_csv_can_be_filled_in_and_uploaded_back(client):
    def fill(row):
        row["human_score"] = "2" if row["question_index"] == "0" else "4"
        row["grader_note"] = "marked by hand"

    result = _upload(client, _filled_csv(client, fill)).json()

    # Three distinct (submission, question) pairs across five model rows.
    assert result["created"] == 3
    assert result["errors"] == []

    rows = _rows(client)
    assert {(r["question_index"], r["human_score"]) for r in rows} == {("0", "2.0"), ("1", "4.0")}


def test_a_score_typed_into_only_one_of_the_model_rows_still_counts(client):
    """The realistic case: the teacher fills one row per question, not all three."""
    seen: set[tuple[str, str]] = set()

    def fill(row):
        key = (row["submission_id"], row["question_index"])
        if key in seen:
            return
        seen.add(key)
        row["human_score"] = "1"

    result = _upload(client, _filled_csv(client, fill)).json()
    assert result["created"] == 3 and result["errors"] == []


def test_an_untouched_export_imports_as_a_no_op(client):
    """Re-uploading a fresh export must not create thousands of empty rows."""
    result = _upload(client, _filled_csv(client, lambda row: None)).json()

    assert result == {"created": 0, "updated": 0, "unchanged": 0, "skipped": 0, "errors": []}
    assert client.get("/api/dataset/human-scores", headers=AUTH).json() == []


def test_contradictory_scores_for_one_question_are_refused_not_guessed(client):
    """Two different numbers for one answer is a mistake, not something to average."""
    counter = {"n": 0}

    def fill(row):
        if row["submission_id"] == "1" and row["question_index"] == "0":
            counter["n"] += 1
            row["human_score"] = str(counter["n"])  # 1 then 2 — a genuine conflict

    result = _upload(client, _filled_csv(client, fill)).json()

    assert result["created"] == 0
    assert result["skipped"] == 1
    assert "conflicting human_score" in result["errors"][0]


def test_a_non_numeric_score_is_reported_with_its_line_number(client):
    def fill(row):
        if row["question_index"] == "1":
            row["human_score"] = "four"

    result = _upload(client, _filled_csv(client, fill)).json()

    assert result["created"] == 0
    assert any("is not a number" in e for e in result["errors"])


def test_a_file_without_the_key_columns_is_rejected_cleanly(client):
    payload = b"foo,bar\n1,2\n"
    result = _upload(client, payload).json()

    assert result["created"] == 0
    assert "Missing required column" in result["errors"][0]


def test_a_bom_prefixed_excel_export_still_imports(client):
    """Excel writes a UTF-8 BOM, which would otherwise corrupt the first header."""

    def fill(row):
        if row["question_index"] == "0":
            row["human_score"] = "2"

    payload = b"\xef\xbb\xbf" + _filled_csv(client, fill)
    result = _upload(client, payload).json()

    assert result["created"] == 2 and result["errors"] == []
