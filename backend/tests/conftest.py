import os
import tempfile

# Configure before the app is imported: throwaway DB, plain-http cookies, a known admin.
_db_dir = tempfile.mkdtemp()
os.environ["GRADEAI_DATABASE_URL"] = f"sqlite:///{_db_dir}/test.db"
os.environ["GRADEAI_PILOT_COOKIE_SECURE"] = "false"
os.environ["GRADEAI_PILOT_BOOTSTRAP_ADMIN_EMAIL"] = "admin@example.com"
os.environ["GRADEAI_PILOT_BOOTSTRAP_ADMIN_PASSWORD"] = "admin-password-123"
os.environ["GRADEAI_PILOT_GRADING_ATTEMPTS"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.pilot import grader as grader_module  # noqa: E402
from app.pilot.grader import QuestionGrade  # noqa: E402


async def fake_grade(question: dict, answer: str, model: str) -> QuestionGrade:
    """Deterministic stand-in for the LLM: one mark per occurrence of 'good'."""
    if "explode" in answer:
        raise RuntimeError("model unavailable")
    score = answer.lower().count("good")
    return QuestionGrade(score, f"Found {score} good points.", "ignore" in answer.lower(), '{"fake": true}')


@pytest.fixture(autouse=True)
def _fake_grader(monkeypatch):
    monkeypatch.setattr(grader_module, "grader", fake_grade)


@pytest.fixture
def admin():
    with TestClient(app) as client:
        r = client.post("/api/pilot/auth/login", json={"email": "admin@example.com", "password": "admin-password-123"})
        assert r.status_code == 200, r.text
        yield client


@pytest.fixture
def anon():
    with TestClient(app) as client:
        yield client
