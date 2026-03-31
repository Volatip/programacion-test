from pathlib import Path
from urllib.parse import parse_qs, quote_plus, urlsplit
import os

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
LOCAL_ENVIRONMENTS = {"development", "dev", "local", "test", "testing"}
INSECURE_SECRET_KEYS = {
    "local-development-secret-key-change-me",
    "replace-with-a-long-random-secret",
}
LOCAL_DATABASE_HOSTS = {"127.0.0.1", "localhost", "db"}
VALID_POSTGRES_SSLMODES = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}
LOCAL_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5176",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
LOCAL_TRUSTED_HOSTS = ["localhost", "127.0.0.1", "testserver"]

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


def env_int(name: str, default: int) -> int:
    value = get_env(name)
    if value is None or not value.strip():
        return default
    return int(value)


def env_list(*names: str) -> list[str]:
    for name in names:
        value = get_env(name)
        if value is None:
            continue
        items = [item.strip() for item in value.split(",") if item.strip()]
        if items:
            return items
    return []


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
        if not is_local_runtime() and secret_key in INSECURE_SECRET_KEYS:
            raise RuntimeError("SECRET_KEY uses an insecure placeholder value outside local/development environments.")
        return secret_key

    if is_local_runtime():
        return "local-development-secret-key-change-me"

    raise RuntimeError("SECRET_KEY must be configured outside local/development environments.")


def _is_postgres_database_url(database_url: str) -> bool:
    return database_url.startswith("postgresql")


def _get_database_url_host(database_url: str) -> str | None:
    parsed = urlsplit(database_url)
    return parsed.hostname.lower() if parsed.hostname else None


def _get_database_url_query_value(database_url: str, key: str) -> str | None:
    parsed = urlsplit(database_url)
    values = parse_qs(parsed.query).get(key)
    if not values:
        return None
    value = values[-1].strip()
    return value or None


def get_postgres_sslmode(database_url: str | None = None) -> str | None:
    configured_sslmode = (get_env("POSTGRES_SSLMODE") or "").strip().lower()
    if configured_sslmode:
        if configured_sslmode not in VALID_POSTGRES_SSLMODES:
            raise RuntimeError(
                "POSTGRES_SSLMODE must be one of: " + ", ".join(sorted(VALID_POSTGRES_SSLMODES))
            )
        return configured_sslmode

    if database_url and _is_postgres_database_url(database_url):
        url_sslmode = _get_database_url_query_value(database_url, "sslmode")
        if url_sslmode:
            normalized_sslmode = url_sslmode.lower()
            if normalized_sslmode not in VALID_POSTGRES_SSLMODES:
                raise RuntimeError(
                    "PostgreSQL sslmode in DATABASE_URL must be one of: "
                    + ", ".join(sorted(VALID_POSTGRES_SSLMODES))
                )
            return normalized_sslmode

    if is_local_runtime():
        return "disable"

    raise RuntimeError("PostgreSQL SSL mode must be explicit outside local/development environments.")


def build_postgres_database_url() -> str | None:
    user = (get_env("POSTGRES_USER") or "").strip()
    password = (get_env("POSTGRES_PASSWORD") or "").strip()
    database = (get_env("POSTGRES_DB") or "").strip()
    raw_host = (get_env("POSTGRES_HOST") or "").strip()
    raw_port = (get_env("POSTGRES_PORT") or "").strip()
    host = raw_host or "127.0.0.1"
    port = raw_port or "5433"

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
    if not is_local_runtime():
        if not raw_host:
            missing.append("POSTGRES_HOST")
        if not raw_port:
            missing.append("POSTGRES_PORT")

    if missing:
        raise RuntimeError(
            "Incomplete PostgreSQL configuration. Missing: " + ", ".join(missing)
        )

    if not is_local_runtime() and host.lower() in LOCAL_DATABASE_HOSTS:
        raise RuntimeError("POSTGRES_HOST points to a local-only default outside local/development environments.")

    sslmode = get_postgres_sslmode()
    if sslmode is None:
        raise RuntimeError("PostgreSQL SSL mode resolution failed.")
    resolved_sslmode: str = sslmode

    return (
        "postgresql+psycopg2://"
        f"{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{quote_plus(database)}"
        f"?sslmode={quote_plus(resolved_sslmode)}"
    )


def get_database_url() -> str:
    database_url = (get_env("DATABASE_URL") or "").strip()
    if database_url:
        if not is_local_runtime() and database_url.startswith("sqlite"):
            raise RuntimeError("DATABASE_URL cannot use SQLite outside local/development environments.")
        if _is_postgres_database_url(database_url):
            host = _get_database_url_host(database_url)
            if not is_local_runtime() and host in LOCAL_DATABASE_HOSTS:
                raise RuntimeError("DATABASE_URL points to a local-only PostgreSQL host outside local/development environments.")
            get_postgres_sslmode(database_url)
        return database_url

    postgres_url = build_postgres_database_url()
    if postgres_url:
        return postgres_url

    if is_local_runtime():
        return "sqlite:///./sql_app.db"

    raise RuntimeError(
        "DATABASE_URL or local PostgreSQL settings must be configured outside local/development environments."
    )


def _get_postgres_runtime_options() -> list[str]:
    runtime_options: list[str] = []
    default_statement_timeout = 30000 if not is_local_runtime() else 0
    default_lock_timeout = 5000 if not is_local_runtime() else 0
    default_idle_in_tx_timeout = 60000 if not is_local_runtime() else 0

    for parameter_name, env_name, default_value in (
        ("statement_timeout", "POSTGRES_STATEMENT_TIMEOUT_MS", default_statement_timeout),
        ("lock_timeout", "POSTGRES_LOCK_TIMEOUT_MS", default_lock_timeout),
        (
            "idle_in_transaction_session_timeout",
            "POSTGRES_IDLE_IN_TRANSACTION_SESSION_TIMEOUT_MS",
            default_idle_in_tx_timeout,
        ),
    ):
        value = env_int(env_name, default_value)
        if value > 0:
            runtime_options.append(f"-c {parameter_name}={value}")

    return runtime_options


def get_sqlalchemy_connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}

    connect_args: dict[str, object] = {}
    if not _is_postgres_database_url(database_url):
        return connect_args

    if _get_database_url_query_value(database_url, "sslmode") is None:
        connect_args["sslmode"] = get_postgres_sslmode(database_url)

    connect_args["connect_timeout"] = env_int("POSTGRES_CONNECT_TIMEOUT", 5)
    connect_args["application_name"] = (
        (get_env("POSTGRES_APPLICATION_NAME") or "").strip() or "programacion-api"
    )

    runtime_options = _get_postgres_runtime_options()
    if runtime_options:
        connect_args["options"] = " ".join(runtime_options)

    return connect_args


def get_sqlalchemy_engine_options(database_url: str) -> dict[str, object]:
    engine_options: dict[str, object] = {
        "connect_args": get_sqlalchemy_connect_args(database_url),
    }

    if database_url.startswith("sqlite"):
        return engine_options

    engine_options.update(
        {
            "pool_pre_ping": True,
            "pool_use_lifo": True,
        }
    )

    if not is_local_runtime():
        engine_options.update(
            {
                "pool_recycle": env_int("SQLALCHEMY_POOL_RECYCLE", 1800),
                "pool_size": env_int("SQLALCHEMY_POOL_SIZE", 5),
                "max_overflow": env_int("SQLALCHEMY_MAX_OVERFLOW", 10),
                "pool_timeout": env_int("SQLALCHEMY_POOL_TIMEOUT", 30),
            }
        )

    return engine_options


def should_create_schema_on_startup() -> bool:
    return is_local_runtime() and env_flag("ENABLE_SCHEMA_AUTO_CREATE", default=False)


def should_auto_repair_local_schema() -> bool:
    return is_local_runtime() and env_flag("ENABLE_LOCAL_SCHEMA_REPAIR", default=True)


def should_bootstrap_admin() -> bool:
    return is_local_runtime() and env_flag("ENABLE_BOOTSTRAP_ADMIN", default=False)


def get_allowed_origins() -> list[str]:
    configured_origins = env_list("CORS_ALLOWED_ORIGINS", "ALLOWED_ORIGINS")
    if configured_origins:
        return configured_origins

    if is_local_runtime():
        return LOCAL_ALLOWED_ORIGINS.copy()

    raise RuntimeError("CORS_ALLOWED_ORIGINS must be configured outside local/development environments.")


def get_websocket_allowed_origins() -> list[str]:
    configured_origins = env_list("WEBSOCKET_ALLOWED_ORIGINS", "WS_ALLOWED_ORIGINS")
    if configured_origins:
        return configured_origins
    return get_allowed_origins()


def get_trusted_hosts() -> list[str]:
    configured_hosts = env_list("TRUSTED_HOSTS")
    if configured_hosts:
        return configured_hosts

    if is_local_runtime():
        return LOCAL_TRUSTED_HOSTS.copy()

    raise RuntimeError("TRUSTED_HOSTS must be configured outside local/development environments.")
