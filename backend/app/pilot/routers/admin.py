from fastapi import APIRouter, HTTPException
from sqlmodel import delete, select

from app.database import SessionDep
from app.pilot.models import AuthSession, User
from app.pilot.schemas import TeacherCreate, TeacherUpdate, UserRead
from app.pilot.security import AdminUser, hash_password

router = APIRouter(prefix="/api/pilot/admin", tags=["pilot-admin"])


@router.get("/teachers", response_model=list[UserRead])
def list_teachers(_: AdminUser, session: SessionDep) -> list[User]:
    return list(session.exec(select(User).order_by(User.name)).all())


@router.post("/teachers", response_model=UserRead, status_code=201)
def create_teacher(body: TeacherCreate, _: AdminUser, session: SessionDep) -> User:
    email = body.email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    # An empty hash never verifies, so such accounts can only use Google sign-in
    password_hash = hash_password(body.password) if body.password else ""
    user = User(email=email, name=body.name.strip(), password_hash=password_hash)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.patch("/teachers/{user_id}", response_model=UserRead)
def update_teacher(user_id: int, body: TeacherUpdate, admin: AdminUser, session: SessionDep) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.id == admin.id and body.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")
    if body.name is not None:
        user.name = body.name.strip()
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None or body.is_active is False:
        session.exec(delete(AuthSession).where(AuthSession.user_id == user.id))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
