from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models.exam  # Register models with SQLModel.metadata
import app.models.submission  # Register submission model with SQLModel.metadata
from app.config import settings
from app.database import create_db_and_tables, engine
from app.routers.exams import router as exams_router
from app.routers.submissions import router as submissions_router
from app.pilot import register_pilot


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
app.include_router(submissions_router)
register_pilot(app)


@app.on_event("startup")
def on_startup():
    """Initialize database on application startup."""
    create_db_and_tables()

    # Seed demo exam
    from app.seed import seed_demo_exam
    seed_demo_exam(engine)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
