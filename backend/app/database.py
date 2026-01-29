from typing import Annotated
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy import event
from fastapi import Depends

from app.config import settings


# Create SQLite engine with thread safety disabled (required for SQLite)
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=True,  # Log SQL statements for development
)


# Enable WAL mode for better concurrency
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Set SQLite to use Write-Ahead Logging (WAL) mode."""
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


def get_session():
    """Dependency that provides a database session."""
    with Session(engine) as session:
        yield session


# Type alias for dependency injection
SessionDep = Annotated[Session, Depends(get_session)]


def create_db_and_tables():
    """Create all database tables defined in SQLModel models."""
    SQLModel.metadata.create_all(engine)
