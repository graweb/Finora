from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Finora API"
    app_env: str = "development"
    database_url: str
    cors_origins: str = "http://localhost:3000"
    brapi_token: str | None = None
    brapi_fii_list_url: str = "https://brapi.dev/api/v2/fii/list"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
