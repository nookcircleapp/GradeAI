"""``max_score`` must count the questions actually answered, not the whole exam.

The frontend grew a per-question "Try" that submits a single answer. With the
old rule — sum the credit of every question on the exam — a perfect answer to
the 2-point question rendered as "2/15", which reads as a fail. ``total_score``
has always summed only the graded answers, so the denominator was the half that
was wrong.

Run with:  .venv/bin/python -m pytest tests -q
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

import app.models.exam  # noqa: F401 - register tables
import app.models.human_score  # noqa: F401 - register tables
import app.models.submission  # noqa: F401 - register tables
from app.database import get_session
from app.main import app as fastapi_app
from app.models.exam import Exam
from app.models_registry import MODEL_REGISTRY
from app.schemas.submission import AnswerInput
from app.seed import DEMO_EXAM_DATA
from app.services import grading
from app.services.grading import answered_max_score, exam_max_score

from tests.test_grading_multi_model import install_stub, perfect_scorer


SMALL = MODEL_REGISTRY["llama-3.1-8b-instant"]
QUESTIONS = DEMO_EXAM_DATA["questions"]  # credits 2, 5, 8 -> 15 total

ANSWER_TEXT = {
    0: "Artificial intelligence is the study of intelligent machines.",
    1: "Supervised learning uses labelled data; unsupervised does not.",
    2: "AI in healthcare brings both real benefits and real risks.",
}


@pytest.fixture(autouse=True)
def _keys_configured(monkeypatch):
    monkeypatch.setattr(grading.settings, "openai_api_key", "test-openai-key", raising=False)
    monkeypatch.setattr(grading.settings, "groq_api_key", "test-groq-key", raising=False)
    from app import models_registry

    monkeypatch.setattr(models_registry.settings, "openai_api_key", "k", raising=False)
    monkeypatch.setattr(models_registry.settings, "groq_api_key", "k", raising=False)


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Exam(**DEMO_EXAM_DATA))
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


def _answers(*indices: int) -> list[dict]:
    return [{"question_index": i, "answer": ANSWER_TEXT[i]} for i in indices]


# ---------------------------------------------------------------------------
# The helper
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "indices, expected",
    [
        ((0,), 2),
        ((1,), 5),
        ((2,), 8),
        ((0, 1), 7),
        ((0, 1, 2), 15),
    ],
)
def test_answered_max_score_sums_only_the_answered_questions(indices, expected):
    answers = [AnswerInput(question_index=i, answer="x" * 40) for i in indices]
    assert answered_max_score(QUESTIONS, answers) == expected


def test_answered_max_score_ignores_duplicates_and_out_of_range_indices():
    answers = [
        AnswerInput(question_index=0, answer="x" * 40),
        AnswerInput(question_index=0, answer="x" * 40),  # duplicate
        AnswerInput(question_index=99, answer="x" * 40),  # no such question
        AnswerInput(question_index=-1, answer="x" * 40),  # nor this
    ]
    assert answered_max_score(QUESTIONS, answers) == 2


def test_exam_max_score_still_means_the_whole_exam():
    """The old helper is unchanged — it just is not what the response reports."""
    assert exam_max_score(QUESTIONS) == 15


# ---------------------------------------------------------------------------
# The endpoints
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("index, credit", [(0, 2), (1, 5), (2, 8)])
def test_preview_of_one_question_is_scored_out_of_that_question(
    client, monkeypatch, index, credit
):
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/preview",
        json={"exam_id": 1, "answers": _answers(index), "model_ids": [SMALL.id]},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["max_score"] == credit
    # The pair is now consistent: a perfect single answer reads credit/credit.
    assert payload["results"][0]["total_score"] == credit


def test_preview_of_a_subset_sums_only_that_subset(client, monkeypatch):
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/preview",
        json={"exam_id": 1, "answers": _answers(0, 1), "model_ids": [SMALL.id]},
    )
    assert response.json()["max_score"] == 7


def test_preview_of_every_question_is_unchanged_at_the_exam_total(client, monkeypatch):
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/preview",
        json={"exam_id": 1, "answers": _answers(0, 1, 2), "model_ids": [SMALL.id]},
    )
    payload = response.json()
    assert payload["max_score"] == 15 == exam_max_score(QUESTIONS)
    assert payload["results"][0]["total_score"] == 15


def test_final_submission_is_unchanged_in_practice(client, monkeypatch):
    """A final submit answers everything, so the new rule gives the same number."""
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/",
        json={"exam_id": 1, "answers": _answers(0, 1, 2), "model_ids": [SMALL.id]},
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["max_score"] == 15
    assert payload["is_final"] is True
    assert payload["submission_id"] is not None


def test_a_partial_final_submission_is_also_self_consistent(client, monkeypatch):
    """Nothing enforces "answer everything", so the same rule has to hold here."""
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/",
        json={"exam_id": 1, "answers": _answers(2), "model_ids": [SMALL.id]},
    )
    payload = response.json()

    assert payload["max_score"] == 8
    assert payload["results"][0]["total_score"] == 8
