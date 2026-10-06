from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response
from sqlmodel import Session, select

from app.database import SessionDep
from app.pilot.config import pilot_settings
from app.pilot.models import AuthSession, User
from app.pilot.timeutil import as_utc, utcnow

_SCRYPT_N, _SCRYPT_R, _SCRYPT_P = 2**14, 8, 1


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P)
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, digest = stored.split("$")
        candidate = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate.hex(), digest)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


_SHARE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I


def new_share_code(length: int = 6) -> str:
    return "".join(secrets.choice(_SHARE_ALPHABET) for _ in range(length))


def normalise_roll(roll: str) -> str:
    return re.sub(r"\s+", "", roll).upper()


def start_session(session: Session, user: User, response: Response) -> None:
    token = new_token()
    session.add(
        AuthSession(
            token_hash=hash_token(token),
            user_id=user.id,
            expires_at=utcnow() + timedelta(days=pilot_settings.session_days),
        )
    )
    session.commit()
    response.set_cookie(
        pilot_settings.cookie_name,
        token,
        max_age=pilot_settings.session_days * 86400,
        httponly=True,
        secure=pilot_settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def end_session(session: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(pilot_settings.cookie_name)
    if token:
        row = session.exec(select(AuthSession).where(AuthSession.token_hash == hash_token(token))).first()
        if row:
            session.delete(row)
            session.commit()
    response.delete_cookie(pilot_settings.cookie_name, path="/")


def current_user(request: Request, session: SessionDep) -> User:
    token = request.cookies.get(pilot_settings.cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    auth = session.exec(select(AuthSession).where(AuthSession.token_hash == hash_token(token))).first()
    if not auth or as_utc(auth.expires_at) < utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
    user = session.get(User, auth.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account disabled")
    return user


def require_admin(user: Annotated[User, Depends(current_user)]) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
AdminUser = Annotated[User, Depends(require_admin)]
