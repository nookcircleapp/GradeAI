"""Shared-secret protection for the exam write endpoints.

The app is a public demo with no user accounts: the student flow must stay
completely open (no login, no friction), so authentication exists only to stop
anonymous visitors from rewriting the exam questions and rubrics. That is a
single shared password sent in the ``X-Admin-Token`` request header, not an
auth system.

Two properties matter here:

* The comparison uses :func:`secrets.compare_digest`, never ``==``, so the
  response time does not leak how many leading characters of the guess were
  correct.
* It fails **closed**. If the server has no token configured, every write is
  rejected rather than waved through, and an empty-string secret can never
  authenticate — otherwise forgetting the env var would silently reopen exactly
  the hole this closes.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import Header, HTTPException

from app.config import settings


logger = logging.getLogger(__name__)


ADMIN_TOKEN_HEADER = "X-Admin-Token"

MISSING_TOKEN_DETAIL = (
    "Admin password required. Send it in the X-Admin-Token header."
)
INVALID_TOKEN_DETAIL = "Invalid admin password."
UNCONFIGURED_DETAIL = (
    "Admin writes are disabled: the server has no admin password configured "
    "(set GRADEAI_ADMIN_TOKEN)."
)


def warn_if_admin_token_unset() -> bool:
    """Log a loud warning when the admin token is unset. Returns True if set.

    Called at startup so the misconfiguration is obvious in the service log
    rather than only surfacing as a mystery 401 when someone tries to save.
    """
    if settings.admin_token:
        return True
    logger.warning(
        "GRADEAI_ADMIN_TOKEN is not set — every write to /api/exams is being "
        "rejected with 401. Set it in the backend .env to enable admin edits."
    )
    return False


def require_admin_token(
    x_admin_token: str | None = Header(default=None, alias=ADMIN_TOKEN_HEADER),
) -> None:
    """FastAPI dependency: allow the request only with the right shared secret.

    Raises 401 with a specific ``detail`` for each failure mode so the admin UI
    can tell "you typed the wrong password" apart from "this server was never
    given one".
    """
    expected = settings.admin_token
    if not expected:
        # Fail closed: no configured secret means no writes, ever. Note this is
        # checked before looking at the header, so an empty-string token in the
        # request can never match an empty-string token on the server.
        logger.warning(
            "Rejected admin write: GRADEAI_ADMIN_TOKEN is not configured."
        )
        raise HTTPException(status_code=401, detail=UNCONFIGURED_DETAIL)

    if not x_admin_token:
        raise HTTPException(status_code=401, detail=MISSING_TOKEN_DETAIL)

    # compare_digest over bytes — the str overload rejects non-ASCII input, and
    # a pasted password can contain anything.
    if not secrets.compare_digest(
        x_admin_token.encode("utf-8"), expected.encode("utf-8")
    ):
        logger.warning("Rejected admin write: incorrect admin token.")
        raise HTTPException(status_code=401, detail=INVALID_TOKEN_DETAIL)
