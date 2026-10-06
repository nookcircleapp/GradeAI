"""Reference answers: they must reach the grader, and never reach a student.

A reference answer is the teacher's own full-credit answer. It is used TOGETHER
with the rubric when grading, and it is the one piece of exam material that
would hand out the marks if a student ever saw it. Two properties are pinned
down here:

* it appears in the prompt, clearly labelled as a benchmark rather than a
  target string, and identically for every model;
* it cannot be read out of any unauthenticated endpoint.

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
from app import security
from app.database import get_session
from app.main import app as fastapi_app
from app.models.exam import Exam
from app.models_registry import MODEL_REGISTRY
from app.schemas.submission import AnswerInput
from app.seed import DEMO_EXAM_DATA
from app.services import grading

from tests.test_grading_multi_model import install_stub, perfect_scorer


GOOD_TOKEN = "correct-horse-battery-staple"

LARGE = MODEL_REGISTRY["gpt-5.6-sol"]
SMALL = MODEL_REGISTRY["llama-3.1-8b-instant"]

SECRET_A = "REFERENCE-ALPHA: photosynthesis converts light into chemical energy."
SECRET_B = "REFERENCE-BETA: chlorophyll absorbs photons in the blue and red bands."

EXAM_WITH_REFERENCES = {
    "title": "Biology",
    "questions": [
        {
            "text": "Explain photosynthesis.",
            "credit": 4,
            "min_words": 20,
            "rubric": ["Mentions light", "Mentions chlorophyll"],
            "reference_answers": [SECRET_A, SECRET_B],
        },
        {
            "text": "Name one product of photosynthesis.",
            "credit": 1,
            "min_words": 1,
            "rubric": ["Says oxygen or glucose"],
            # Deliberately none: the empty case must not leave a dangling header.
            "reference_answers": [],
        },
    ],
}


@pytest.fixture(autouse=True)
def _keys_configured(monkeypatch):
    monkeypatch.setattr(grading.settings, "openai_api_key", "test-openai-key", raising=False)
    monkeypatch.setattr(grading.settings, "groq_api_key", "test-groq-key", raising=False)
    from app import models_registry

    monkeypatch.setattr(models_registry.settings, "openai_api_key", "k", raising=False)
    monkeypatch.setattr(models_registry.settings, "groq_api_key", "k", raising=False)


@pytest.fixture()
def client(monkeypatch):
    """TestClient over an in-memory DB holding one exam with reference answers."""
    monkeypatch.setattr(security.settings, "admin_token", GOOD_TOKEN, raising=False)

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Exam(**EXAM_WITH_REFERENCES))
        session.commit()

    def override_session():
        with Session(engine) as session:
            yield session

    fastapi_app.dependency_overrides[get_session] = override_session
    with TestClient(fastapi_app) as test_client:
        yield test_client
    fastapi_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# The prompt
# ---------------------------------------------------------------------------


def test_reference_answers_appear_in_the_prompt_as_a_benchmark():
    prompt = grading._build_user_prompt(
        "Explain photosynthesis.",
        ["Mentions light"],
        4,
        "Plants make food from sunlight.",
        [SECRET_A, SECRET_B],
    )

    assert SECRET_A in prompt
    assert SECRET_B in prompt
    # Delimited, so a long reference cannot be mistaken for the student's work.
    assert "--- REFERENCE ANSWER 1 ---" in prompt
    assert "--- END REFERENCE ANSWER 2 ---" in prompt
    assert "--- STUDENT ANSWER ---" in prompt
    # ...and labelled as full-credit examples, not text to reproduce.
    assert "full credit" in prompt
    assert "NOT as text the student is supposed to reproduce" in prompt
    assert "worded differently" in prompt
    # The scoring instruction is unchanged and still last.
    assert prompt.rstrip().endswith("Grade this answer out of 4 points.")


@pytest.mark.parametrize("references", [None, [], ["", "   "]])
def test_no_reference_answers_leaves_no_dangling_section(references):
    """An unset (or blank) list must not produce an empty header."""
    prompt = grading._build_user_prompt(
        "Name one product of photosynthesis.", ["Says oxygen"], 1, "Oxygen.", references
    )

    assert "REFERENCE" not in prompt.upper()
    assert "full-credit" not in prompt
    # The rubric flows straight into the student's answer, no blank gap.
    assert "- Says oxygen\n\nStudent's answer:" in prompt


def test_grading_run_sends_reference_answers_for_the_questions_that_have_them(monkeypatch):
    clients = install_stub(monkeypatch, {SMALL.api_model_name: perfect_scorer()})
    answers = [
        AnswerInput(question_index=0, answer="Plants use sunlight to build sugars."),
        AnswerInput(question_index=1, answer="Oxygen is one product of the reaction."),
    ]

    asyncio.run(
        grading.grade_submission(EXAM_WITH_REFERENCES["questions"], answers, [SMALL])
    )

    prompts = {
        call["messages"][1]["content"].split("\n", 1)[0]: call["messages"][1]["content"]
        for call in clients[SMALL.api_model_name].completions.calls
    }
    with_refs = prompts["Question: Explain photosynthesis."]
    without_refs = prompts["Question: Name one product of photosynthesis."]

    assert SECRET_A in with_refs and SECRET_B in with_refs
    assert "REFERENCE" not in without_refs.upper()


def test_prompt_is_identical_across_models_with_reference_answers(monkeypatch):
    """The fairness guarantee still holds once reference answers are in play."""
    clients = install_stub(
        monkeypatch,
        {LARGE.api_model_name: perfect_scorer(), SMALL.api_model_name: perfect_scorer()},
    )
    answers = [
        AnswerInput(question_index=0, answer="Plants use sunlight to build sugars."),
        AnswerInput(question_index=1, answer="Oxygen is one product of the reaction."),
    ]

    asyncio.run(
        grading.grade_submission(EXAM_WITH_REFERENCES["questions"], answers, [LARGE, SMALL])
    )

    def messages(client):
        return sorted(
            (call["messages"][0]["content"], call["messages"][1]["content"])
            for call in client.completions.calls
        )

    assert messages(clients[LARGE.api_model_name]) == messages(clients[SMALL.api_model_name])


# ---------------------------------------------------------------------------
# The privacy boundary
# ---------------------------------------------------------------------------


def _all_text(payload) -> str:
    import json

    return json.dumps(payload)


def test_unauthenticated_exam_reads_cannot_leak_reference_answers(client):
    """The student view calls both of these with no credentials."""
    for path in ("/api/exams/", "/api/exams/1"):
        response = client.get(path)
        assert response.status_code == 200, path
        body = _all_text(response.json())
        assert SECRET_A not in body, path
        assert SECRET_B not in body, path
        assert "reference_answers" not in body, path


def test_the_student_still_sees_the_rubric(client):
    """Rubric is shown as "Marking criteria" — only reference answers are stripped."""
    question = client.get("/api/exams/1").json()["questions"][0]

    assert question["rubric"] == ["Mentions light", "Mentions chlorophyll"]
    assert set(question) == {"text", "credit", "min_words", "rubric"}


def test_admin_reads_return_the_full_object(client):
    for path in ("/api/exams/admin", "/api/exams/admin/1"):
        response = client.get(path, headers={"X-Admin-Token": GOOD_TOKEN})
        assert response.status_code == 200, path
        payload = response.json()
        exam = payload[0] if isinstance(payload, list) else payload
        assert exam["questions"][0]["reference_answers"] == [SECRET_A, SECRET_B]
        assert exam["questions"][1]["reference_answers"] == []


@pytest.mark.parametrize("path", ["/api/exams/admin", "/api/exams/admin/1"])
def test_admin_reads_are_gated(client, path):
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"X-Admin-Token": "wrong"}).status_code == 401


def test_admin_can_round_trip_reference_answers(client):
    """The editor must be able to save an edit without dropping the references."""
    new_questions = [
        {
            "text": "Explain photosynthesis.",
            "credit": 4,
            "min_words": 20,
            "rubric": ["Mentions light"],
            "reference_answers": [SECRET_A, "REFERENCE-GAMMA: a third one."],
        }
    ]
    response = client.patch(
        "/api/exams/1",
        json={"questions": new_questions},
        headers={"X-Admin-Token": GOOD_TOKEN},
    )
    assert response.status_code == 200
    assert response.json()["questions"][0]["reference_answers"] == [
        SECRET_A,
        "REFERENCE-GAMMA: a third one.",
    ]

    # ...and it still does not escape through the public read.
    assert "REFERENCE-GAMMA" not in _all_text(client.get("/api/exams/1").json())


def test_exams_written_without_the_field_stay_valid(client):
    """Every exam in the live database predates reference_answers."""
    legacy = {
        "title": "Legacy",
        "questions": [
            {"text": "2+2?", "credit": 1, "min_words": 1, "rubric": ["Says 4"]}
        ],
    }
    response = client.post(
        "/api/exams/", json=legacy, headers={"X-Admin-Token": GOOD_TOKEN}
    )
    assert response.status_code == 200
    assert response.json()["questions"][0]["reference_answers"] == []


def test_the_seeded_demo_exam_ships_with_reference_answers():
    """These go on stage; an empty list would silently disable the feature."""
    for question in DEMO_EXAM_DATA["questions"]:
        references = question["reference_answers"]
        assert 1 <= len(references) <= 2
        for text in references:
            # Long enough to actually be a full-credit answer, not a stub.
            assert len(text.split()) >= 60
