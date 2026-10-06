import secrets
import time
from collections import defaultdict, deque
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlmodel import select

from app.database import SessionDep
from app.pilot import google
from app.pilot.config import pilot_settings
from app.pilot.models import User
from app.pilot.schemas import AuthConfig, LoginRequest, PasswordChange, UserRead
from app.pilot.security import CurrentUser, end_session, hash_password, start_session, verify_password

router = APIRouter(prefix="/api/pilot/auth", tags=["pilot-auth"])

# Failed logins per email: at most 10 in 15 minutes. In-memory, so per process.
_FAIL_WINDOW = 15 * 60
_FAIL_LIMIT = 10
_failures: dict[str, deque] = defaultdict(deque)


def _recent_failures(email: str) -> deque:
    attempts = _failures[email]
    cutoff = time.monotonic() - _FAIL_WINDOW
    while attempts and attempts[0] < cutoff:
        attempts.popleft()
    return attempts


@router.post("/login", response_model=UserRead)
def login(body: LoginRequest, response: Response, session: SessionDep) -> User:
    email = body.email.lower()
    failures = _recent_failures(email)
    if len(failures) >= _FAIL_LIMIT:
        raise HTTPException(status_code=429, detail="Too many failed attempts, try again in 15 minutes")
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        failures.append(time.monotonic())
        raise HTTPException(status_code=401, detail="Wrong email or password")
    if pilot_settings.google_enabled and user.role != "admin":
        raise HTTPException(status_code=403, detail="Teachers sign in with Google")
    _failures.pop(email, None)
    start_session(session, user, response)
    return user


@router.get("/config", response_model=AuthConfig)
def auth_config() -> AuthConfig:
    return AuthConfig(google=pilot_settings.google_enabled)


_STATE_COOKIE = "gradeai_oauth_state"
_STATE_MAX_AGE = 10 * 60


def _safe_next(next_path: str | None) -> str:
    """Only allow returning to a teacher page on this site."""
    if next_path and next_path.startswith("/t") and not next_path.startswith("//") and "\\" not in next_path:
        return next_path
    return "/t"


def _app_url(path: str) -> str:
    return (pilot_settings.app_url or pilot_settings.public_url).rstrip("/") + path


def _login_error(code: str) -> RedirectResponse:
    response = RedirectResponse(_app_url("/login?" + urlencode({"error": code})), status_code=303)
    response.delete_cookie(_STATE_COOKIE, path="/api/pilot/auth/google")
    return response


@router.get("/google/start")
def google_start(next: str | None = None) -> RedirectResponse:
    if not pilot_settings.google_enabled:
        raise HTTPException(status_code=404, detail="Google sign-in is not set up")
    state = secrets.token_urlsafe(24)
    response = RedirectResponse(google.authorization_url(state), status_code=303)
    response.set_cookie(
        _STATE_COOKIE,
        f"{state}|{_safe_next(next)}",
        max_age=_STATE_MAX_AGE,
        httponly=True,
        secure=pilot_settings.cookie_secure,
        samesite="lax",
        path="/api/pilot/auth/google",
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    session: SessionDep,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if not pilot_settings.google_enabled:
        raise HTTPException(status_code=404, detail="Google sign-in is not set up")
    saved_state, _, next_path = (request.cookies.get(_STATE_COOKIE) or "").partition("|")
    if error:
        return _login_error("cancelled")
    if not code or not state or not saved_state or not secrets.compare_digest(state, saved_state):
        return _login_error("expired")
    try:
        identity = await google.fetch_identity(code)
    except google.GoogleSignInError:
        return _login_error("google")
    user = session.exec(select(User).where(User.email == identity.email)).first()
    if not user:
        return _login_error("not_allowed")
    if not user.is_active:
        return _login_error("disabled")
    if not user.name.strip() and identity.name:
        user.name = identity.name
        session.add(user)
    response = RedirectResponse(_app_url(_safe_next(next_path)), status_code=303)
    response.delete_cookie(_STATE_COOKIE, path="/api/pilot/auth/google")
    start_session(session, user, response)
    return response


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, session: SessionDep) -> None:
    end_session(session, request, response)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> User:
    return user


@router.post("/password", status_code=204)
def change_password(body: PasswordChange, user: CurrentUser, session: SessionDep) -> None:
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is wrong")
    user.password_hash = hash_password(body.new_password)
    session.add(user)
    session.commit()
