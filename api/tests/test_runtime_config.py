import pytest

from api import runtime_config


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
        "postgresql+psycopg2://postgres:postgres_local_2026@127.0.0.1:5433/programacion"
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
