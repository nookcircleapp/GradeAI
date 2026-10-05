"""An empty answer must score 0 — without ever reaching a model.

Reproduced on production before this guard existed: submitting "" (or "   ")
for question 0 came back 1/2 with the explanation "The student provides a clear
definition of AI, but only one real-world application is mentioned." There was
no answer. The model confabulated one out of a degenerate prompt. Gibberish
("asdf asdf qwerty") scored 0 correctly, so the failure was specific to
near-empty input.

The fix cannot be prompt wording, because the failure mode IS the model
inventing content. So the answer is never sent: anything shorter than
``settings.min_answer_chars`` after stripping is scored 0 locally, instantly,
and unbillably. These tests assert the API call does not happen.

Run with:  .venv/bin/python -m pytest tests -q
"""

from __future__ import annotations

import asyncio

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

from tests.test_grading_multi_model import install_stub, perfect_scorer


SMALL = MODEL_REGISTRY["llama-3.1-8b-instant"]  # $0.05 in / $0.08 out per Mtok
LARGE = MODEL_REGISTRY["gpt-5.6-sol"]

QUESTIONS = DEMO_EXAM_DATA["questions"]  # credits 2, 5, 8

# Exactly 20 characters after stripping — the default threshold.
AT_THRESHOLD = "AI means machines th"
REAL_ANSWER = "Artificial intelligence is the study of intelligent machines."


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


def _grade_one(monkeypatch, answer: str):
    """Grade a single answer to question 0 and return (result, stub client)."""
    clients = install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})
    results, _ = asyncio.run(
        grading.grade_submission(
            QUESTIONS, [AnswerInput(question_index=0, answer=answer)], [SMALL]
        )
    )
    return results[0], clients[SMALL.api_model_name]


# ---------------------------------------------------------------------------
# The guard
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "answer, label",
    [
        ("", "empty string"),
        ("   ", "spaces only"),
        ("\n\t  \n", "whitespace only"),
        ("too short", "below the threshold"),
        ("AI means machines t", "one character below the threshold"),
    ],
)
def test_ungradeable_answers_score_zero_without_an_api_call(monkeypatch, answer, label):
    result, stub = _grade_one(monkeypatch, answer)

    assert stub.completions.calls == [], f"{label}: the model was called anyway"
    assert result.status == "ok"
    assert result.total_score == 0
    assert [(g.question_index, g.score, g.max_score) for g in result.grades] == [(0, 0, 2)]
    # Honest, and obviously not a model's voice.
    assert "no credit was awarded" in result.grades[0].explanation


def test_skipping_everything_costs_nothing(monkeypatch):
    result, _ = _grade_one(monkeypatch, "")

    assert result.metrics is not None
    assert result.metrics.cost_usd == 0.0
    assert result.metrics.total_tokens == 0
    assert result.metrics.latency_ms == 0


def test_an_answer_exactly_at_the_threshold_is_graded_normally(monkeypatch):
    assert len(AT_THRESHOLD) == 20
    result, stub = _grade_one(monkeypatch, AT_THRESHOLD)

    assert len(stub.completions.calls) == 1
    assert result.grades[0].score == 2  # perfect_scorer awards full marks
    assert result.metrics.cost_usd > 0


def test_a_mixed_submission_grades_only_the_real_answers(monkeypatch):
    """One empty answer among three must not distort the other two, or the cost."""
    clients = install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})
    answers = [
        AnswerInput(question_index=0, answer="   "),
        AnswerInput(question_index=1, answer="Supervised learning uses labelled data."),
        AnswerInput(question_index=2, answer="AI in healthcare raises hard questions."),
    ]

    results, _ = asyncio.run(grading.grade_submission(QUESTIONS, answers, [SMALL]))
    result = results[0]

    assert len(clients[SMALL.api_model_name].completions.calls) == 2
    assert [(g.question_index, g.score, g.max_score) for g in result.grades] == [
        (0, 0, 2),
        (1, 5, 5),
        (2, 8, 8),
    ]
    assert result.total_score == 13

    # perfect_scorer reports 1000 in / 100 out per call, and only 2 calls happened.
    assert result.metrics.prompt_tokens == 2000
    assert result.metrics.completion_tokens == 200
    expected = (2000 / 1_000_000) * SMALL.price_in_per_mtok + (
        200 / 1_000_000
    ) * SMALL.price_out_per_mtok
    assert result.metrics.cost_usd == pytest.approx(expected)


def test_the_threshold_is_a_setting_not_a_literal(monkeypatch):
    monkeypatch.setattr(grading.settings, "min_answer_chars", 200, raising=False)
    result, stub = _grade_one(monkeypatch, REAL_ANSWER)
    assert stub.completions.calls == []
    assert result.grades[0].score == 0

    # ...and 0 disables the length rule, though a blank answer is still refused.
    monkeypatch.setattr(grading.settings, "min_answer_chars", 0, raising=False)
    result, stub = _grade_one(monkeypatch, "short")
    assert len(stub.completions.calls) == 1

    result, stub = _grade_one(monkeypatch, "   ")
    assert stub.completions.calls == []
    assert result.grades[0].score == 0


# ---------------------------------------------------------------------------
# End to end
# ---------------------------------------------------------------------------


def test_preview_of_an_empty_answer_is_zero_over_the_question_credit(client, monkeypatch):
    """The demo-killer, at the HTTP layer: 0/2, not 1/2 and not 0/0."""
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/preview",
        json={
            "exam_id": 1,
            "answers": [{"question_index": 0, "answer": ""}],
            "model_ids": [SMALL.id],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    # The question WAS submitted, so its credit still counts in the denominator.
    assert payload["max_score"] == 2
    assert payload["results"][0]["status"] == "ok"
    assert payload["results"][0]["total_score"] == 0
    assert payload["results"][0]["grades"][0]["score"] == 0
    assert payload["results"][0]["metrics"]["cost_usd"] == 0.0


def test_a_wholly_empty_final_submission_is_zero_over_the_exam(client, monkeypatch):
    install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})

    response = client.post(
        "/api/submissions/",
        json={
            "exam_id": 1,
            "answers": [
                {"question_index": 0, "answer": ""},
                {"question_index": 1, "answer": "   "},
                {"question_index": 2, "answer": ""},
            ],
            "model_ids": [SMALL.id],
        },
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload["max_score"] == 15
    assert payload["results"][0]["total_score"] == 0
    assert payload["submission_id"] is not None


def test_the_hardened_prompt_forbids_inventing_content():
    """Layer 2: identical for every model, so it cannot skew the comparison."""
    assert "irrelevant to the question" in grading.SYSTEM_PROMPT
    assert "never credit a rubric point" in grading.SYSTEM_PROMPT
    assert "never infer, complete or assume" in grading.SYSTEM_PROMPT
