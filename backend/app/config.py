from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    database_url: str = "sqlite:///./data.db"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:5174"]

    model_config = {
        "env_prefix": "GRADEAI_"
    }


settings = Settings()
