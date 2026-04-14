import hashlib
from email.message import EmailMessage

import pytest
from sqlalchemy import create_engine, text

from api import database, models, runtime_config, schemas
from api.routers import config as config_router


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
        for head_revision in database._get_alembic_head_revisions():
            connection.execute(
                text("INSERT INTO alembic_version (version_num) VALUES (:revision)"),
                {"revision": head_revision},
            )

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


def test_smtp_settings_response_hides_password(db_session) -> None:
    db_session.add_all([
        models.Config(key="smtp_host", value="smtp.example.com"),
        models.Config(key="smtp_port", value="587"),
        models.Config(key="smtp_username", value="mailer"),
        models.Config(key="smtp_password", value="secret"),
        models.Config(key="smtp_from_email", value="noreply@example.com"),
        models.Config(key="smtp_from_name", value="Programacion"),
        models.Config(key="smtp_use_tls", value="true"),
        models.Config(key="smtp_use_ssl", value="false"),
        models.Config(key="smtp_review_fix_required_subject", value="Asunto {{funcionario_nombre}}"),
        models.Config(key="smtp_review_fix_required_body", value="Cuerpo {{programming_id}}"),
    ])
    db_session.commit()

    payload = config_router.get_smtp_settings_payload(db_session)

    assert payload.host == "smtp.example.com"
    assert payload.password_configured is True
    assert payload.use_ssl is False
    assert payload.review_fix_required_subject == "Asunto {{funcionario_nombre}}"
    assert payload.review_fix_required_body == "Cuerpo {{programming_id}}"
    assert not hasattr(payload, "password")


def test_smtp_settings_update_preserves_existing_password_when_empty(db_session) -> None:
    db_session.add(models.Config(key="smtp_password", value="persisted-secret"))
    db_session.commit()

    payload = config_router.upsert_smtp_settings(
        db_session,
        schemas.SmtpSettingsUpdate(
            host="smtp.example.com",
            port=465,
            username="mailer",
            password="",
            from_email="noreply@example.com",
            from_name="Programacion",
            use_tls=True,
            use_ssl=True,
            review_fix_required_subject="Arreglar {{funcionario_nombre}}",
            review_fix_required_body="Observación: {{comentario}}",
        ),
    )

    stored_password = db_session.query(models.Config).filter(models.Config.key == "smtp_password").one()
    stored_tls = db_session.query(models.Config).filter(models.Config.key == "smtp_use_tls").one()
    stored_ssl = db_session.query(models.Config).filter(models.Config.key == "smtp_use_ssl").one()

    assert payload.password_configured is True
    assert payload.use_tls is False
    assert payload.use_ssl is True
    assert stored_password.value == "persisted-secret"
    assert stored_tls.value == "false"
    assert stored_ssl.value == "true"


def test_send_test_email_uses_saved_smtp_settings(db_session, monkeypatch: pytest.MonkeyPatch) -> None:
    db_session.add_all([
        models.Config(key="smtp_host", value="smtp.example.com"),
        models.Config(key="smtp_port", value="587"),
        models.Config(key="smtp_username", value="mailer"),
        models.Config(key="smtp_password", value="secret"),
        models.Config(key="smtp_from_email", value="noreply@example.com"),
        models.Config(key="smtp_from_name", value="Programacion"),
        models.Config(key="smtp_use_tls", value="true"),
        models.Config(key="smtp_use_ssl", value="false"),
    ])
    db_session.commit()

    sent_messages: list[EmailMessage] = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert host == "smtp.example.com"
            assert port == 587
            assert timeout == 10

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            return None

        def login(self, username, password):
            assert username == "mailer"
            assert password == "secret"

        def send_message(self, message):
            sent_messages.append(message)

    monkeypatch.setattr(config_router.smtplib, "SMTP", FakeSMTP)

    payload = config_router.send_test_email(db_session, "destino@example.com")

    assert payload.recipient == "destino@example.com"
    assert payload.message == "Correo de prueba enviado a destino@example.com."
    assert len(sent_messages) == 1
    assert sent_messages[0]["Subject"] == "Prueba de configuración SMTP"
    assert sent_messages[0]["To"] == "destino@example.com"
    assert "Servidor: smtp.example.com:587" in sent_messages[0].get_content()


def test_send_test_email_requires_configured_password(db_session) -> None:
    db_session.add_all([
        models.Config(key="smtp_host", value="smtp.example.com"),
        models.Config(key="smtp_port", value="587"),
        models.Config(key="smtp_from_email", value="noreply@example.com"),
        models.Config(key="smtp_from_name", value="Programacion"),
    ])
    db_session.commit()

    with pytest.raises(config_router.HTTPException) as exc_info:
        config_router.send_test_email(db_session, "destino@example.com")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "SMTP no configurado. Guarda host, puerto, remitente y contraseña antes de enviar una prueba."


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
