"""Shared test setup.

The local scorer (app/services/sbert.py) is switched OFF for the whole suite by
default. Two reasons:

  * Speed and CI. Loading all-MiniLM-L6-v2 costs seconds and hundreds of MB of
    RSS, and importing torch alone dominates the suite's runtime. No test that
    is about the OpenAI path should pay for that.
  * Determinism. A machine with the weights present and a machine without them
    would otherwise disagree about `available`, and tests that pin the contract
    of GET /api/models would pass or fail depending on the box.

Tests that are about the local scorer opt back in explicitly — either by
monkeypatching `settings.sbert_enabled` (with a stub embedder, so still no
torch), or by injecting an `embed` callable straight into `score_answer`.
"""

from __future__ import annotations

import os
import tempfile

# Set before anything imports app.config: a throwaway database so a test run
# never writes to backend/data.db, plus plain-http cookies and a known admin
# for the pilot API tests.
os.environ.setdefault("GRADEAI_DATABASE_URL", f"sqlite:///{tempfile.mkdtemp()}/test.db")
os.environ["GRADEAI_PILOT_COOKIE_SECURE"] = "false"
os.environ["GRADEAI_PILOT_BOOTSTRAP_ADMIN_EMAIL"] = "admin@example.com"
os.environ["GRADEAI_PILOT_BOOTSTRAP_ADMIN_PASSWORD"] = "admin-password-123"
os.environ["GRADEAI_PILOT_GRADING_ATTEMPTS"] = "1"

import pytest

from app.config import settings
from app.services import sbert


@pytest.fixture(autouse=True)
def _local_scorer_off_by_default():
    """Disable the local scorer unless a test turns it on."""
    previous = settings.sbert_enabled
    settings.sbert_enabled = False
    sbert.reset_for_tests()
    try:
        yield
    finally:
        settings.sbert_enabled = previous
        sbert.reset_for_tests()
