"""Admin-token protection for the exam write endpoints.

The public demo has no accounts: anyone can read an exam and submit answers,
but only someone holding the shared secret may rewrite the questions or
rubrics. These tests pin down the boundary — which routes are gated, which
stay open, and that a server with no secret configured refuses writes instead
of accepting them.

Run with:  .venv/bin/python -m pytest tests -q
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

import app.models.exam  # noqa: F401 - register tables
import app.models.submission  # noqa: F401 - register tables
from app import security
from app.database import get_session
from app.main import app as fastapi_app
from app.models.exam import Exam
from app.seed import DEMO_EXAM_DATA


GOOD_TOKEN = "correct-horse-battery-staple"
NEW_EXAM = {
    "title": "Brand New Exam",
    "questions": [
        {"text": "What is 2 + 2?", "credit": 1, "min_words": 1, "rubric": ["Says 4"]}
    ],
}


@pytest.fixture()
def client(monkeypatch):
    """A TestClient over an in-memory DB with a known admin token configured."""
    monkeypatch.setattr(security.settings, "admin_token", GOOD_TOKEN, raising=False)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
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


# ---------------------------------------------------------------------------
# Rejected: no token, wrong token
# ---------------------------------------------------------------------------


def test_patch_exam_without_token_is_401(client):
    response = client.patch("/api/exams/1", json={"title": "Hacked"})

    assert response.status_code == 401
    assert "X-Admin-Token" in response.json()["detail"]
    # And the exam is untouched.
    assert client.get("/api/exams/1").json()["title"] == DEMO_EXAM_DATA["title"]


def test_patch_exam_with_wrong_token_is_401(client):
    response = client.patch(
        "/api/exams/1",
        json={"title": "Hacked"},
        headers={"X-Admin-Token": "not-the-password"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == security.INVALID_TOKEN_DETAIL
    assert client.get("/api/exams/1").json()["title"] == DEMO_EXAM_DATA["title"]


def test_patch_exam_with_empty_token_header_is_401(client):
    """An empty header value is "missing", never a match against the secret."""
    response = client.patch(
        "/api/exams/1", json={"title": "Hacked"}, headers={"X-Admin-Token": ""}
    )

    assert response.status_code == 401


def test_create_exam_without_token_is_401(client):
    response = client.post("/api/exams/", json=NEW_EXAM)

    assert response.status_code == 401
    assert client.get("/api/exams/").json() == client.get("/api/exams/").json()
    assert len(client.get("/api/exams/").json()) == 1


def test_create_exam_with_wrong_token_is_401(client):
    response = client.post(
        "/api/exams/", json=NEW_EXAM, headers={"X-Admin-Token": "wrong"}
    )

    assert response.status_code == 401
    assert len(client.get("/api/exams/").json()) == 1


def test_auth_is_checked_before_the_body_is_validated(client):
    """A garbage body from an unauthenticated caller is still a 401, not a 422.

    Route-level dependencies run before the request model is parsed, so an
    anonymous caller cannot use validation errors to probe the schema.
    """
    response = client.patch("/api/exams/1", json={"questions": "not a list"})

    assert response.status_code == 401


def test_auth_is_checked_before_the_exam_is_looked_up(client):
    """No token on a missing exam is 401, not 404 — no existence oracle."""
    response = client.patch("/api/exams/9999", json={"title": "x"})

    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Accepted: correct token
# ---------------------------------------------------------------------------


def test_patch_exam_with_correct_token_succeeds_and_persists(client):
    response = client.patch(
        "/api/exams/1",
        json={"title": "Edited By Admin"},
        headers={"X-Admin-Token": GOOD_TOKEN},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Edited By Admin"
    # Questions untouched by a title-only patch.
    assert len(response.json()["questions"]) == len(DEMO_EXAM_DATA["questions"])
    # And the change is durable, not just echoed back.
    assert client.get("/api/exams/1").json()["title"] == "Edited By Admin"


def test_patch_exam_questions_with_correct_token_succeeds(client):
    new_questions = [
        {"text": "New question?", "credit": 3, "min_words": 10, "rubric": ["Answers it"]}
    ]

    response = client.patch(
        "/api/exams/1",
        json={"questions": new_questions},
        headers={"X-Admin-Token": GOOD_TOKEN},
    )

    assert response.status_code == 200
    assert client.get("/api/exams/1").json()["questions"] == new_questions


def test_create_exam_with_correct_token_succeeds(client):
    response = client.post(
        "/api/exams/", json=NEW_EXAM, headers={"X-Admin-Token": GOOD_TOKEN}
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Brand New Exam"
    assert len(client.get("/api/exams/").json()) == 2


# ---------------------------------------------------------------------------
# Fail closed when unconfigured
# ---------------------------------------------------------------------------


def test_empty_configured_token_rejects_even_the_empty_token(client, monkeypatch):
    """An unconfigured server refuses writes; "" must not authenticate."""
    monkeypatch.setattr(security.settings, "admin_token", "", raising=False)

    for headers in ({}, {"X-Admin-Token": ""}, {"X-Admin-Token": "anything"}):
        response = client.patch("/api/exams/1", json={"title": "Hacked"}, headers=headers)
        assert response.status_code == 401, headers
        assert response.json()["detail"] == security.UNCONFIGURED_DETAIL

    assert client.get("/api/exams/1").json()["title"] == DEMO_EXAM_DATA["title"]


def test_empty_configured_token_rejects_creates(client, monkeypatch):
    monkeypatch.setattr(security.settings, "admin_token", "", raising=False)

    response = client.post(
        "/api/exams/", json=NEW_EXAM, headers={"X-Admin-Token": ""}
    )

    assert response.status_code == 401
    assert len(client.get("/api/exams/").json()) == 1


def test_warn_if_admin_token_unset_reports_and_logs(monkeypatch, caplog):
    monkeypatch.setattr(security.settings, "admin_token", "", raising=False)
    with caplog.at_level("WARNING", logger="app.security"):
        assert security.warn_if_admin_token_unset() is False
    assert "GRADEAI_ADMIN_TOKEN" in caplog.text

    monkeypatch.setattr(security.settings, "admin_token", GOOD_TOKEN, raising=False)
    assert security.warn_if_admin_token_unset() is True


# ---------------------------------------------------------------------------
# Everything else stays open
# ---------------------------------------------------------------------------


def test_reads_stay_open_without_any_token(client):
    assert client.get("/api/exams/").status_code == 200
    assert client.get("/api/exams/1").status_code == 200
    assert client.get("/api/exams/1").json()["title"] == DEMO_EXAM_DATA["title"]


def test_reads_stay_open_even_when_no_token_is_configured(client, monkeypatch):
    monkeypatch.setattr(security.settings, "admin_token", "", raising=False)

    assert client.get("/api/exams/").status_code == 200
    assert client.get("/api/exams/1").status_code == 200


def test_student_submission_endpoints_need_no_token(client):
    """The student flow must stay 100% open — no auth on submissions at all.

    A bad-request response proves the request reached the handler; a 401 would
    mean the auth gate had leaked onto a student route.
    """
    response = client.post("/api/submissions/preview", json={"exam_id": 1, "answers": []})

    assert response.status_code != 401
