import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    if env_path.exists():
        raw_env = env_path.read_text(encoding="utf-8").strip()
        if raw_env.startswith(("postgres://", "postgresql://", "postgresql+psycopg://")):
            return raw_env

    return "sqlite:///./app.db"


@dataclass(frozen=True)
class Settings:
    database_url: str = get_database_url()
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "change-this-in-production")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


settings = Settings()
