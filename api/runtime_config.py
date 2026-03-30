from pathlib import Path
from urllib.parse import quote_plus
import os

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
LOCAL_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}

_ENV_LOADED = False


def load_environment() -> None:
    global _ENV_LOADED
    if _ENV_LOADED:
        return

    load_dotenv(BASE_DIR / ".env.local")
    load_dotenv(BASE_DIR / ".env")
    _ENV_LOADED = True


def get_env(name: str, default: str | None = None) -> str | None:
    load_environment()
    return os.getenv(name, default)


def env_flag(name: str, default: bool = False) -> bool:
    value = get_env(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_runtime_environment() -> str:
    for key in ("APP_ENV", "ENVIRONMENT", "FASTAPI_ENV", "NODE_ENV"):
        value = get_env(key)
        if value and value.strip():
            return value.strip().lower()
    return "development"


def is_local_runtime() -> bool:
    return get_runtime_environment() in LOCAL_ENVIRONMENTS


def get_secret_key() -> str:
    secret_key = (get_env("SECRET_KEY") or "").strip()
    if secret_key:
        return secret_key

    if is_local_runtime():
        return "local-development-secret-key-change-me"

    raise RuntimeError("SECRET_KEY must be configured outside local/development environments.")


def build_postgres_database_url() -> str | None:
    user = (get_env("POSTGRES_USER") or "").strip()
    password = (get_env("POSTGRES_PASSWORD") or "").strip()
    database = (get_env("POSTGRES_DB") or "").strip()
    host = (get_env("POSTGRES_HOST") or "127.0.0.1").strip()
    port = (get_env("POSTGRES_PORT") or "5433").strip()

    if not any((user, password, database)):
        return None

    missing = [
        name
        for name, value in (
            ("POSTGRES_USER", user),
            ("POSTGRES_PASSWORD", password),
            ("POSTGRES_DB", database),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Incomplete local PostgreSQL configuration. Missing: " + ", ".join(missing)
        )

    return (
        "postgresql+psycopg2://"
        f"{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{quote_plus(database)}"
    )


def get_database_url() -> str:
    database_url = (get_env("DATABASE_URL") or "").strip()
    if database_url:
        return database_url

    postgres_url = build_postgres_database_url()
    if postgres_url:
        return postgres_url

    if is_local_runtime():
        return "sqlite:///./sql_app.db"

    raise RuntimeError(
        "DATABASE_URL or local PostgreSQL settings must be configured outside local/development environments."
    )


def get_sqlalchemy_connect_args(database_url: str) -> dict[str, bool]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def should_create_schema_on_startup() -> bool:
    return is_local_runtime()


def should_bootstrap_admin() -> bool:
    return is_local_runtime() and env_flag("ENABLE_BOOTSTRAP_ADMIN", default=False)
