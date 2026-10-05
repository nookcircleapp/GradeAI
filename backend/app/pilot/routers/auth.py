from fastapi import APIRouter, HTTPException, Request, Response
from sqlmodel import select

from app.database import SessionDep
from app.pilot.models import User
from app.pilot.schemas import LoginRequest, PasswordChange, UserRead
from app.pilot.security import CurrentUser, end_session, hash_password, start_session, verify_password

router = APIRouter(prefix="/api/pilot/auth", tags=["pilot-auth"])


@router.post("/login", response_model=UserRead)
def login(body: LoginRequest, response: Response, session: SessionDep) -> User:
    user = session.exec(select(User).where(User.email == body.email.lower())).first()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong email or password")
    start_session(session, user, response)
    return user


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
