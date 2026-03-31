import hashlib

import pytest
from sqlalchemy import create_engine, text

from api import database, runtime_config


@pytest.fixture(autouse=True)
def reset_env_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", False)


def test_database_url_uses_local_docker_default_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_PORT", raising=False)
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "postgres_local_2026")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    assert runtime_config.get_database_url() == (
        "postgresql+psycopg2://postgres:postgres_local_2026@127.0.0.1:5433/programacion?sslmode=disable"
    )


def test_load_environment_preserves_explicit_process_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg2://override-user:override-pass@127.0.0.1:5999/override-db",
    )

    runtime_config.load_environment()

    assert runtime_config.get_env("DATABASE_URL") == (
        "postgresql+psycopg2://override-user:override-pass@127.0.0.1:5999/override-db"
    )


def test_database_url_rejects_sqlite_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./sql_app.db")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="cannot use SQLite"):
        runtime_config.get_database_url()


def test_secret_key_rejects_placeholder_value_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "replace-with-a-long-random-secret")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="insecure placeholder"):
        runtime_config.get_secret_key()


def test_database_url_requires_explicit_host_and_port_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_HOST", raising=False)
    monkeypatch.delenv("POSTGRES_PORT", raising=False)
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "super-segura")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="POSTGRES_HOST, POSTGRES_PORT"):
        runtime_config.get_database_url()


def test_database_url_builds_from_explicit_remote_postgres_parts_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_HOST", "db.internal")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "super-segura")
    monkeypatch.setenv("POSTGRES_SSLMODE", "require")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    assert runtime_config.get_database_url() == (
        "postgresql+psycopg2://postgres:super-segura@db.internal:5432/programacion?sslmode=require"
    )


def test_database_url_requires_explicit_sslmode_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_HOST", "db.internal")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "super-segura")
    monkeypatch.delenv("POSTGRES_SSLMODE", raising=False)
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="SSL mode must be explicit"):
        runtime_config.get_database_url()


def test_database_url_rejects_local_postgres_host_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:super-segura@127.0.0.1:5432/programacion?sslmode=require",
    )
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="local-only PostgreSQL host"):
        runtime_config.get_database_url()


def test_schema_auto_create_requires_explicit_local_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("ENABLE_SCHEMA_AUTO_CREATE", raising=False)
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    assert runtime_config.should_create_schema_on_startup() is False


def test_schema_auto_create_can_be_enabled_explicitly_in_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_SCHEMA_AUTO_CREATE", "true")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    assert runtime_config.should_create_schema_on_startup() is True


def test_postgres_engine_options_enable_production_pool_hardening(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("POSTGRES_SSLMODE", "require")
    monkeypatch.setenv("SQLALCHEMY_POOL_RECYCLE", "1200")
    monkeypatch.setenv("SQLALCHEMY_POOL_SIZE", "7")
    monkeypatch.setenv("SQLALCHEMY_MAX_OVERFLOW", "14")
    monkeypatch.setenv("SQLALCHEMY_POOL_TIMEOUT", "45")
    monkeypatch.setenv("POSTGRES_CONNECT_TIMEOUT", "6")
    monkeypatch.setenv("POSTGRES_APPLICATION_NAME", "programacion-api-prod")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    engine_options = runtime_config.get_sqlalchemy_engine_options(
        "postgresql+psycopg2://postgres:super-segura@db.internal:5432/programacion?sslmode=require"
    )

    assert engine_options == {
        "connect_args": {
            "connect_timeout": 6,
            "application_name": "programacion-api-prod",
            "options": "-c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000",
        },
        "pool_pre_ping": True,
        "pool_use_lifo": True,
        "pool_recycle": 1200,
        "pool_size": 7,
        "max_overflow": 14,
        "pool_timeout": 45,
    }


def test_sqlite_engine_options_keep_local_test_compatibility() -> None:
    engine_options = runtime_config.get_sqlalchemy_engine_options("sqlite:///:memory:")

    assert engine_options == {
        "connect_args": {"check_same_thread": False},
    }


def test_database_readiness_requires_alembic_stamp_in_production(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-missing-alembic-version.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    database.create_schema(engine)

    with pytest.raises(RuntimeError, match="alembic_version is missing"):
        database.ensure_database_ready(engine, required_tables=("users", "revoked_tokens"))


def test_database_readiness_requires_head_revision_in_production(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-outdated-alembic-head.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    database.create_schema(engine)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('0001_initial_schema')"))

    with pytest.raises(RuntimeError, match="out of date"):
        database.ensure_database_ready(engine, required_tables=("users", "revoked_tokens"))


def test_database_readiness_accepts_current_head_revision_in_production(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-current-alembic-head.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    database.create_schema(engine)
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(text("INSERT INTO alembic_version (version_num) VALUES ('0002_operational_db_hardening')"))

    database.ensure_database_ready(engine, required_tables=("users", "revoked_tokens"))


def test_allowed_origins_require_explicit_configuration_outside_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="CORS_ALLOWED_ORIGINS"):
        runtime_config.get_allowed_origins()


def test_websocket_allowed_origins_can_override_cors_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("WEBSOCKET_ALLOWED_ORIGINS", "https://ws.example.com")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    assert runtime_config.get_allowed_origins() == ["https://app.example.com"]
    assert runtime_config.get_websocket_allowed_origins() == ["https://ws.example.com"]


def test_trusted_hosts_require_explicit_configuration_outside_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("TRUSTED_HOSTS", raising=False)
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    with pytest.raises(RuntimeError, match="TRUSTED_HOSTS"):
        runtime_config.get_trusted_hosts()


def test_database_readiness_fails_when_schema_is_missing(tmp_path) -> None:
    sqlite_path = tmp_path / "startup-missing-schema.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with pytest.raises(RuntimeError, match="Database schema is incomplete"):
        database.ensure_database_ready(engine, required_tables=("users",))


def test_database_readiness_passes_after_schema_creation(tmp_path) -> None:
    sqlite_path = tmp_path / "startup-ready.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    database.create_schema(engine)
    database.ensure_database_ready(engine, required_tables=("users", "revoked_tokens"))


def test_database_readiness_fails_when_required_column_is_missing(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-missing-column.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE revoked_tokens (id INTEGER PRIMARY KEY, token VARCHAR NOT NULL, revoked_at DATETIME)"))

    with pytest.raises(RuntimeError, match=r"Missing columns: revoked_tokens\.token_hash"):
        database.ensure_database_ready(engine, required_tables=("revoked_tokens",))


def test_database_readiness_repairs_local_legacy_revoked_tokens_schema(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("ENABLE_LOCAL_SCHEMA_REPAIR", raising=False)
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-legacy-revoked-tokens.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE revoked_tokens (id INTEGER PRIMARY KEY, token VARCHAR NOT NULL, revoked_at DATETIME)"))
        connection.execute(text("INSERT INTO revoked_tokens (id, token) VALUES (1, 'legacy-access-token')"))

    database.ensure_database_ready(engine, required_tables=("revoked_tokens",))

    with engine.connect() as connection:
        repaired_row = connection.execute(
            text("SELECT token_hash FROM revoked_tokens WHERE id = 1")
        ).one()
        columns = connection.execute(text("PRAGMA table_info(revoked_tokens)")).fetchall()
        indexes = connection.execute(text("PRAGMA index_list(revoked_tokens)")).fetchall()

    assert repaired_row.token_hash == hashlib.sha256(b"legacy-access-token").hexdigest()
    assert any(column[1] == "token" and column[3] == 0 for column in columns)
    assert any(index[1] == "ix_revoked_tokens_token_hash" for index in indexes)


def test_database_readiness_can_disable_local_schema_auto_repair(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_LOCAL_SCHEMA_REPAIR", "false")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-auto-repair-disabled.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE revoked_tokens (id INTEGER PRIMARY KEY, token VARCHAR NOT NULL, revoked_at DATETIME)"))

    with pytest.raises(RuntimeError, match=r"Missing columns: revoked_tokens\.token_hash"):
        database.ensure_database_ready(engine, required_tables=("revoked_tokens",))


def test_database_readiness_rejects_incompatible_revoked_tokens_nullability_outside_local(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)

    sqlite_path = tmp_path / "startup-incompatible-nullability.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE revoked_tokens ("
                "id INTEGER PRIMARY KEY, "
                "token_hash VARCHAR(64) NOT NULL, "
                "token VARCHAR NOT NULL, "
                "revoked_at DATETIME"
                ")"
            )
        )

    with pytest.raises(RuntimeError, match=r"Database schema is incompatible"):
        database.ensure_database_ready(engine, required_tables=("revoked_tokens",))
