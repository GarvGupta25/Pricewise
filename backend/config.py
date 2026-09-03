"""Configuration and deliberately narrow external-service boundaries."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


RETAILER_ALLOWLIST = frozenset(
    {
        "amazon.in",
        "flipkart.com",
        "croma.com",
        "reliancedigital.in",
        "mdcomputers.in",
    }
)


class Settings(BaseSettings):
    """Runtime settings loaded from ``backend/.env`` or process variables."""

    model_config = SettingsConfigDict(env_file=Path(__file__).with_name(".env"), extra="ignore")

    groq_api_key: str | None = None
    groq_model: str = "llama-3.3-70b-versatile"
    firecrawl_api_key: str | None = None
    database_url: str | None = None
    ollama_base_url: str = "http://localhost:11434"
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    allowed_origins: str = "http://localhost:5173"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
