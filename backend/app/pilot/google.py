"""Google sign-in (OAuth 2.0 authorization code flow) for teacher accounts.

Google only proves who the person is. Whether they may sign in is decided by
the pilot_users table: an admin adds the teacher's email first, and only an
active account with that exact, Google-verified email gets a session.
"""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.pilot.config import pilot_settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
CALLBACK_PATH = "/api/pilot/auth/google/callback"


class GoogleSignInError(Exception):
    pass


@dataclass
class GoogleIdentity:
    email: str
    name: str


def redirect_uri() -> str:
    return pilot_settings.public_url.rstrip("/") + CALLBACK_PATH


def authorization_url(state: str) -> str:
    query = {
        "client_id": pilot_settings.google_client_id,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{AUTH_URL}?{urlencode(query)}"


async def fetch_identity(code: str) -> GoogleIdentity:
    """Exchange the authorization code and return the verified Google identity."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            token = await client.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": pilot_settings.google_client_id,
                    "client_secret": pilot_settings.google_client_secret,
                    "redirect_uri": redirect_uri(),
                    "grant_type": "authorization_code",
                },
            )
            token.raise_for_status()
            access_token = token.json()["access_token"]
            info = await client.get(USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
            info.raise_for_status()
            data = info.json()
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        raise GoogleSignInError("Google sign-in failed") from exc
    if not data.get("email") or data.get("email_verified") is not True:
        raise GoogleSignInError("Google account has no verified email")
    return GoogleIdentity(email=data["email"].lower(), name=data.get("name") or "")
