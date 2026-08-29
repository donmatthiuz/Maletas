from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
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


@lru_cache
def get_settings() -> Settings:
    return Settings()

