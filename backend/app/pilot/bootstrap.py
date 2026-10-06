import logging

from sqlmodel import Session, select

from app.database import create_db_and_tables, engine
from app.pilot.config import pilot_settings
from app.pilot.jobs import resume_pending
from app.pilot.models import User
from app.pilot.security import hash_password
from app.pilot.seed import seed_templates

logger = logging.getLogger(__name__)


def ensure_admin() -> None:
    email = pilot_settings.bootstrap_admin_email.strip().lower()
    password = pilot_settings.bootstrap_admin_password
    if not email or not password:
        return
    with Session(engine) as session:
        if session.exec(select(User).where(User.role == "admin")).first():
            return
        session.add(
            User(email=email, name=pilot_settings.bootstrap_admin_name, password_hash=hash_password(password), role="admin")
        )
        session.commit()
        logger.info("Created bootstrap admin %s", email)


async def on_startup() -> None:
    create_db_and_tables()
    ensure_admin()
    with Session(engine) as session:
        seed_templates(session)
    await resume_pending()
