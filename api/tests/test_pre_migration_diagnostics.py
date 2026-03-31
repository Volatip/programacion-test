from __future__ import annotations

from sqlalchemy import create_engine, text

from api.scripts import pre_migration_diagnostics


def test_collect_readiness_diagnostics_reports_duplicate_blockers(tmp_path) -> None:
    sqlite_path = tmp_path / "diagnostics-duplicates.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE programmings (id INTEGER PRIMARY KEY, funcionario_id INTEGER, period_id INTEGER)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO programmings (id, funcionario_id, period_id) VALUES "
                "(1, 10, 202601), (2, 10, 202601), (3, 11, 202601)"
            )
        )

    diagnostics = pre_migration_diagnostics.collect_readiness_diagnostics(engine)

    assert diagnostics["has_blockers"] is True
    duplicate_check = next(
        check for check in diagnostics["duplicate_checks"] if check["table"] == "programmings"
    )
    assert duplicate_check["status"] == "duplicates_found"
    assert duplicate_check["duplicate_groups"] == [
        {
            "funcionario_id": 10,
            "period_id": 202601,
            "duplicate_count": 2,
        }
    ]


def test_collect_readiness_diagnostics_reports_missing_alembic_version_as_blocker(tmp_path) -> None:
    sqlite_path = tmp_path / "diagnostics-missing-alembic.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))

    diagnostics = pre_migration_diagnostics.collect_readiness_diagnostics(engine)

    assert diagnostics["has_blockers"] is True
    assert diagnostics["migration_state"]["status"] == "missing_alembic_version"


def test_collect_readiness_diagnostics_accepts_current_head_without_duplicates(tmp_path) -> None:
    sqlite_path = tmp_path / "diagnostics-current-head.db"
    engine = create_engine(f"sqlite:///{sqlite_path}", connect_args={"check_same_thread": False})

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE programmings (id INTEGER PRIMARY KEY, funcionario_id INTEGER, period_id INTEGER)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE user_officials (id INTEGER PRIMARY KEY, user_id INTEGER, funcionario_id INTEGER)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE user_hidden_officials (id INTEGER PRIMARY KEY, user_id INTEGER, funcionario_rut VARCHAR)"
            )
        )
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"))
        connection.execute(
            text(
                "INSERT INTO alembic_version (version_num) VALUES ('0004_session_audit_events')"
            )
        )

    diagnostics = pre_migration_diagnostics.collect_readiness_diagnostics(engine)

    assert diagnostics["has_blockers"] is False
    assert diagnostics["migration_state"]["status"] == "up_to_date"
    assert all(check["status"] == "ok" for check in diagnostics["duplicate_checks"])
