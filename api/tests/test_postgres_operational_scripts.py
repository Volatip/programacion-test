from __future__ import annotations

from argparse import Namespace
from pathlib import Path
from typing import cast

import pytest

from api import runtime_config
from api.scripts import (
    postgres_backup,
    postgres_ops_common,
    postgres_readiness,
    postgres_restore,
    postgres_role_audit,
)


@pytest.fixture(autouse=True)
def reset_env_loader(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(runtime_config, "_ENV_LOADED", True)


def test_resolve_admin_settings_falls_back_to_admin_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5433")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "programacion_app")
    monkeypatch.setenv("POSTGRES_PASSWORD", "app-secret")
    monkeypatch.setenv("POSTGRES_SSLMODE", "require")
    monkeypatch.setenv("POSTGRES_ADMIN_USER", "postgres")
    monkeypatch.setenv("POSTGRES_ADMIN_PASSWORD", "admin-secret")
    monkeypatch.setenv("POSTGRES_ADMIN_DB", "postgres")

    settings = postgres_ops_common.resolve_postgres_settings(admin=True)

    assert settings.user == "postgres"
    assert settings.password == "admin-secret"
    assert settings.database == "postgres"
    assert settings.sslmode == "require"


def test_admin_settings_generate_full_sqlalchemy_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_ADMIN_USER", "postgres")
    monkeypatch.setenv("POSTGRES_ADMIN_PASSWORD", "admin-secret")
    monkeypatch.setenv("POSTGRES_ADMIN_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_ADMIN_PORT", "5433")
    monkeypatch.setenv("POSTGRES_ADMIN_DB", "programacion")
    monkeypatch.setenv("POSTGRES_ADMIN_SSLMODE", "disable")

    settings = postgres_ops_common.resolve_postgres_settings(admin=True)

    assert settings.sqlalchemy_dsn().startswith(
        "postgresql+psycopg2://postgres:admin-secret@127.0.0.1:5433/programacion"
    )
    assert "sslmode=disable" in settings.sqlalchemy_dsn()


def test_backup_command_uses_custom_format_by_default(tmp_path: Path) -> None:
    command = postgres_backup.build_backup_command(output_path=tmp_path / "sample.dump")

    assert command[:3] == ["pg_dump", "--format=custom", "--verbose"]
    assert "--schema-only" not in command


def test_restore_requires_runtime_target_override(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    backup_file = tmp_path / "sample.dump"
    backup_file.write_text("dummy", encoding="utf-8")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://app:secret@127.0.0.1:5433/programacion?sslmode=disable")
    monkeypatch.setenv("POSTGRES_ADMIN_USER", "postgres")
    monkeypatch.setenv("POSTGRES_ADMIN_PASSWORD", "admin-secret")
    monkeypatch.setenv("POSTGRES_ADMIN_DB", "programacion")
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5433")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "app")
    monkeypatch.setenv("POSTGRES_PASSWORD", "secret")

    args = Namespace(
        input=str(backup_file),
        database_url=None,
        target_db=None,
        dry_run=True,
        confirm_destructive_restore=False,
        allow_runtime_target=False,
        single_transaction=False,
    )

    with pytest.raises(RuntimeError, match="Refusing to target the runtime database"):
        postgres_restore.execute_restore(args)


def test_restore_allows_dry_run_against_isolated_db(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    backup_file = tmp_path / "sample.dump"
    backup_file.write_text("dummy", encoding="utf-8")
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg2://app:secret@127.0.0.1:5433/programacion?sslmode=disable")
    monkeypatch.setenv("POSTGRES_ADMIN_USER", "postgres")
    monkeypatch.setenv("POSTGRES_ADMIN_PASSWORD", "admin-secret")
    monkeypatch.setenv("POSTGRES_ADMIN_DB", "programacion_restore_check")
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5433")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "app")
    monkeypatch.setenv("POSTGRES_PASSWORD", "secret")

    args = Namespace(
        input=str(backup_file),
        database_url=None,
        target_db=None,
        dry_run=True,
        confirm_destructive_restore=False,
        allow_runtime_target=False,
        single_transaction=False,
    )

    assert postgres_restore.execute_restore(args) == 0


def test_postgres_readiness_uses_runtime_sslmode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_SSLMODE", "require")

    settings = postgres_ops_common.resolve_postgres_settings(
        database_url="postgresql+psycopg2://app:secret@db.internal:5432/programacion"
    )

    assert settings.sslmode == "require"


def test_collect_postgres_runtime_summary_returns_masked_dsn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_SSLMODE", "require")

    class FakeResult:
        def mappings(self):
            return self

        def one(self):
            return {
                "current_database": "programacion",
                "current_user": "programacion_app",
                "server_version_num": "150008",
                "server_version": "15.8",
                "application_name": "programacion-api",
            }

    class FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, _query):
            return FakeResult()

    class FakeEngine:
        def connect(self):
            return FakeConnection()

    monkeypatch.setattr(postgres_readiness, "create_engine", lambda *args, **kwargs: FakeEngine())
    monkeypatch.setattr(
        postgres_readiness,
        "collect_runtime_role_audit",
        lambda _connection: {
            "classification": "dedicated_app_role_candidate",
            "attributes": {"is_superuser": False},
            "basic_privileges": {},
        },
    )
    monkeypatch.setattr(
        postgres_readiness,
        "collect_readiness_diagnostics",
        lambda _engine: {"migration_state": {"status": "up_to_date"}, "has_blockers": False},
    )

    summary = postgres_readiness.collect_postgres_runtime_summary(
        "postgresql+psycopg2://programacion_app:super-secret@db.internal:5432/programacion?sslmode=require"
    )

    dsn = cast(str, summary["dsn"])
    assert dsn.endswith("sslmode=require")
    assert "super-secret" not in dsn
    assert summary["migration_status"] == "up_to_date"
    assert summary["role_classification"] == "dedicated_app_role_candidate"


def test_classify_runtime_role_detects_superuser() -> None:
    assert (
        postgres_ops_common.classify_runtime_role(
            role_name="postgres",
            is_superuser=True,
            can_create_role=True,
            can_create_db=True,
            can_replicate=True,
            can_bypass_rls=True,
        )
        == "superuser"
    )


def test_classify_runtime_role_detects_dedicated_app_candidate() -> None:
    assert (
        postgres_ops_common.classify_runtime_role(
            role_name="programacion_app",
            is_superuser=False,
            can_create_role=False,
            can_create_db=False,
            can_replicate=False,
            can_bypass_rls=False,
        )
        == "dedicated_app_role_candidate"
    )


def test_role_audit_main_returns_exit_code_2_for_superuser(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        postgres_role_audit,
        "parse_args",
        lambda: Namespace(database_url=None, schema="public", json=False),
    )
    monkeypatch.setattr(postgres_role_audit.runtime_config, "load_environment", lambda: None)
    monkeypatch.setattr(
        postgres_role_audit.runtime_config,
        "get_database_url",
        lambda: "postgresql+psycopg2://postgres:secret@127.0.0.1:5433/programacion?sslmode=disable",
    )
    monkeypatch.setattr(
        postgres_role_audit,
        "collect_postgres_role_audit",
        lambda _database_url, schema="public": {
            "dsn": "postgresql+psycopg2://postgres:***@127.0.0.1:5433/programacion?sslmode=disable",
            "database": "programacion",
            "current_user": "postgres",
            "session_user": "postgres",
            "classification": "superuser",
            "warning": "usa superuser",
            "attributes": {"is_superuser": True},
            "basic_privileges": {"database_connect": {"status": "ok"}},
        },
    )

    assert postgres_role_audit.main() == 2
