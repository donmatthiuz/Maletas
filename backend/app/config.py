from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: Literal["testing", "production"] = "testing"
    app_name: str = "Maletas API"
    api_prefix: str = "/api/v1"
    mongo_url: str = "mongodb://mongo:27017"
    mongo_database: str = "maletas"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    source_workbook: str = "/seed/source.xlsm"
    seed_from_workbook: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @model_validator(mode="after")
    def validate_environment_database(self):
        if self.app_env != "production":
            return self

        normalized_url = self.mongo_url.lower()
        local_hosts = ("localhost", "127.0.0.1", "0.0.0.0", "mongo:27017")
        if not normalized_url.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError("MONGO_URL debe ser una URI válida de MongoDB")
        if any(host in normalized_url for host in local_hosts):
            raise ValueError(
                "APP_ENV=production no puede utilizar MongoDB local; configura la URI de Atlas"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
