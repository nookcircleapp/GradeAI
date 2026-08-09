import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models.exam  # Register models with SQLModel.metadata
import app.models.human_score  # Register the teacher-score table with SQLModel.metadata
import app.models.submission  # Register submission model with SQLModel.metadata
from app.config import settings
from app.database import create_db_and_tables, engine
from app.routers.dataset import router as dataset_router
from app.routers.exams import router as exams_router
from app.routers.models import router as models_router
from app.routers.submissions import router as submissions_router
from app.security import warn_if_admin_token_unset


# Uvicorn only attaches handlers to its own loggers, so without this the
# application's own log records would fall through to logging.lastResort —
# WARNING and above, unformatted, no INFO. Configure the root logger once, here.
# basicConfig is a no-op when handlers already exist (e.g. under pytest).
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)


# Create FastAPI application
app = FastAPI(title="GradeAI API")


# Add CORS middleware FIRST (before any other middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(exams_router)
app.include_router(dataset_router)
app.include_router(models_router)
app.include_router(submissions_router)


@app.on_event("startup")
def on_startup():
    """Initialize database on application startup."""
    create_db_and_tables()

    # Surface a missing admin secret immediately: without it every exam write
    # is rejected (fail-closed), and a silent 401 later is far harder to debug.
    warn_if_admin_token_unset()

    # Load the local scorer's weights now rather than on the first request —
    # otherwise the first grading of the day pays several seconds of load time,
    # live. preload() never raises: if the weights or the library are missing,
    # that model reports available=false and the backend still starts.
    from app.services import sbert

    sbert.preload()

    # Seed demo exam
    from app.seed import seed_demo_exam
    seed_demo_exam(engine)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
