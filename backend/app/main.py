from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_db_and_tables


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


@app.on_event("startup")
def on_startup():
    """Initialize database on application startup."""
    create_db_and_tables()


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
