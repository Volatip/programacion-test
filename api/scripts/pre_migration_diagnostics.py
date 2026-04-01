from __future__ import annotations

from dataclasses import dataclass
import argparse
import json
from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine

from api import database, runtime_config


@dataclass(frozen=True)
class DuplicateCheck:
    table_name: str
    columns: tuple[str, ...]
    constraint_name: str


DUPLICATE_CHECKS: tuple[DuplicateCheck, ...] = (
    DuplicateCheck(
        table_name="programmings",
        columns=("funcionario_id", "period_id"),
        constraint_name="uq_programmings_funcionario_period",
    ),
    DuplicateCheck(
        table_name="user_officials",
        columns=("user_id", "funcionario_id"),
        constraint_name="uq_user_officials_user_funcionario",
    ),
    DuplicateCheck(
        table_name="user_hidden_officials",
        columns=("user_id", "funcionario_rut", "period_id"),
        constraint_name="uq_user_hidden_officials_user_rut_period",
    ),
)


def _serialize_duplicate_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    serialized_rows: list[dict[str, Any]] = []
    for row in rows:
        serialized_rows.append(
            {
                key: value.isoformat() if hasattr(value, "isoformat") else value
                for key, value in row.items()
            }
        )
    return serialized_rows


def find_duplicate_groups(
    target_engine: Engine,
    *,
    table_name: str,
    columns: tuple[str, ...],
    limit: int,
) -> list[dict[str, Any]]:
    select_columns = ", ".join(columns)
    order_by = ", ".join(["duplicate_count DESC", *columns])

    with target_engine.connect() as connection:
        rows = connection.execute(
            text(
                f"""
                SELECT {select_columns}, COUNT(*) AS duplicate_count
                FROM {table_name}
                GROUP BY {select_columns}
                HAVING COUNT(*) > 1
                ORDER BY {order_by}
                LIMIT :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()

    return [dict(row) for row in rows]


def get_migration_state(target_engine: Engine) -> dict[str, Any]:
    inspector = inspect(target_engine)
    existing_tables = set(inspector.get_table_names())
    expected_heads = sorted(database._get_alembic_head_revisions())

    state: dict[str, Any] = {
        "expected_heads": expected_heads,
        "current_heads": [],
        "status": "unknown",
        "detail": None,
    }

    if "alembic_version" not in existing_tables:
        if existing_tables:
            state["status"] = "missing_alembic_version"
            state["detail"] = (
                "Schema existente sin alembic_version. Validar baseline, luego `python -m alembic stamp 0001_initial_schema` y `python -m alembic upgrade head`."
            )
        else:
            state["status"] = "uninitialized"
            state["detail"] = "Base vacía. Ejecutar `python -m alembic upgrade head`."
        return state

    with target_engine.connect() as connection:
        current_heads = sorted(
            row[0]
            for row in connection.execute(text("SELECT version_num FROM alembic_version"))
            if row[0]
        )

    state["current_heads"] = current_heads

    if not current_heads:
        state["status"] = "empty_alembic_version"
        state["detail"] = (
            "alembic_version existe pero no tiene revisión registrada. Rehacer stamp baseline antes de upgrade."
        )
        return state

    unknown_heads = sorted(set(current_heads) - set(expected_heads) - {"0001_initial_schema"})
    if unknown_heads:
        state["status"] = "unknown_revision"
        state["detail"] = "Revisión Alembic desconocida: " + ", ".join(unknown_heads)
        return state

    if current_heads != expected_heads:
        state["status"] = "outdated"
        state["detail"] = (
            "Base fuera de head. Ejecutar `python -m alembic upgrade head` después del diagnóstico de duplicados."
        )
        return state

    state["status"] = "up_to_date"
    state["detail"] = "Base alineada con el head actual de Alembic."
    return state


def collect_readiness_diagnostics(target_engine: Engine, *, limit: int = 10) -> dict[str, Any]:
    inspector = inspect(target_engine)
    existing_tables = set(inspector.get_table_names())
    duplicate_checks: list[dict[str, Any]] = []
    has_duplicate_blockers = False

    for check in DUPLICATE_CHECKS:
        if check.table_name not in existing_tables:
            duplicate_checks.append(
                {
                    "table": check.table_name,
                    "constraint": check.constraint_name,
                    "columns": list(check.columns),
                    "status": "missing_table",
                    "detail": "Tabla ausente en la base inspeccionada.",
                    "duplicate_groups": [],
                }
            )
            continue

        table_columns = {column["name"] for column in inspector.get_columns(check.table_name)}
        missing_columns = [column for column in check.columns if column not in table_columns]
        if missing_columns:
            duplicate_checks.append(
                {
                    "table": check.table_name,
                    "constraint": check.constraint_name,
                    "columns": list(check.columns),
                    "status": "missing_columns",
                    "detail": "Columnas ausentes para validar la constraint: " + ", ".join(missing_columns),
                    "duplicate_groups": [],
                }
            )
            continue

        duplicates = find_duplicate_groups(
            target_engine,
            table_name=check.table_name,
            columns=check.columns,
            limit=limit,
        )
        if duplicates:
            has_duplicate_blockers = True
            status = "duplicates_found"
            detail = "Se encontraron filas que bloquearían la constraint única."
        else:
            status = "ok"
            detail = "No se detectaron duplicados para esta constraint."

        duplicate_checks.append(
            {
                "table": check.table_name,
                "constraint": check.constraint_name,
                "columns": list(check.columns),
                "status": status,
                "detail": detail,
                "duplicate_groups": _serialize_duplicate_rows(duplicates),
            }
        )

    migration_state = get_migration_state(target_engine)
    blockers = has_duplicate_blockers or migration_state["status"] in {
        "missing_alembic_version",
        "empty_alembic_version",
        "unknown_revision",
    }

    return {
        "database_url": str(target_engine.url).replace(target_engine.url.password or "", "***")
        if target_engine.url.password
        else str(target_engine.url),
        "dialect": target_engine.dialect.name,
        "migration_state": migration_state,
        "duplicate_checks": duplicate_checks,
        "has_blockers": blockers,
    }


def render_text_report(diagnostics: dict[str, Any]) -> str:
    lines = [
        "=== Pre-migration readiness diagnostics ===",
        f"dialect: {diagnostics['dialect']}",
        f"database: {diagnostics['database_url']}",
        "",
        "Migration state:",
        f"- status: {diagnostics['migration_state']['status']}",
        f"- expected_heads: {', '.join(diagnostics['migration_state']['expected_heads']) or '(none)'}",
        f"- current_heads: {', '.join(diagnostics['migration_state']['current_heads']) or '(none)'}",
        f"- detail: {diagnostics['migration_state']['detail']}",
        "",
        "Duplicate checks:",
    ]

    for check in diagnostics["duplicate_checks"]:
        lines.append(
            f"- {check['table']} ({', '.join(check['columns'])}) -> {check['status']}"
        )
        lines.append(f"  detail: {check['detail']}")
        if check["duplicate_groups"]:
            for row in check["duplicate_groups"]:
                key_values = ", ".join(
                    f"{key}={value!r}"
                    for key, value in row.items()
                    if key != "duplicate_count"
                )
                lines.append(
                    f"  duplicate: {key_values} (count={row['duplicate_count']})"
                )

    lines.extend(
        [
            "",
            f"blockers: {'yes' if diagnostics['has_blockers'] else 'no'}",
        ]
    )
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Diagnostica duplicados y estado Alembic antes de `alembic upgrade head`.",
    )
    parser.add_argument("--database-url", help="Sobrescribe la URL de base de datos runtime.")
    parser.add_argument("--limit", type=int, default=10, help="Máximo de grupos duplicados por tabla.")
    parser.add_argument("--json", action="store_true", help="Emite el diagnóstico en JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    runtime_config.load_environment()
    database_url = args.database_url or runtime_config.get_database_url()
    engine = create_engine(database_url, **runtime_config.get_sqlalchemy_engine_options(database_url))

    try:
        diagnostics = collect_readiness_diagnostics(engine, limit=args.limit)
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1

    if args.json:
        print(json.dumps(diagnostics, indent=2, ensure_ascii=False))
    else:
        print(render_text_report(diagnostics))

    return 2 if diagnostics["has_blockers"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
