import logging

from sqlalchemy import inspect, text
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


def migrate() -> None:
    """Add columns that create_all cannot add to existing tables."""
    columns = {c["name"] for c in inspect(engine).get_columns("pilot_users")}
    if "is_approved" in columns:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE pilot_users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT 1"))
        # This release brings back admin approval for new teachers
        conn.execute(text("UPDATE pilot_site_settings SET open_teacher_signup = 0"))
    logger.info("Migrated pilot_users: added is_approved; auto-approve turned off")


async def on_startup() -> None:
    create_db_and_tables()
    migrate()
    ensure_admin()
    with Session(engine) as session:
        seed_templates(session)
    await resume_pending()
