from __future__ import annotations

import argparse
import json
from typing import Any

from sqlalchemy import create_engine, text

from api import runtime_config
from api.scripts.postgres_ops_common import collect_runtime_role_audit, resolve_postgres_settings
from api.scripts.pre_migration_diagnostics import collect_readiness_diagnostics


def collect_postgres_runtime_summary(database_url: str) -> dict[str, Any]:
    engine = create_engine(database_url, **runtime_config.get_sqlalchemy_engine_options(database_url))
    with engine.connect() as connection:
        row = connection.execute(
            text(
                """
                SELECT current_database() AS current_database,
                       current_user AS current_user,
                       current_setting('server_version_num') AS server_version_num,
                       current_setting('server_version') AS server_version,
                       current_setting('application_name', true) AS application_name
                """
            )
        ).mappings().one()
        role_audit = collect_runtime_role_audit(connection)
        diagnostics = collect_readiness_diagnostics(engine)

    settings = resolve_postgres_settings(database_url=database_url)
    return {
        "database": row["current_database"],
        "user": row["current_user"],
        "server_version_num": int(row["server_version_num"]),
        "server_version": row["server_version"],
        "application_name": row["application_name"],
        "sslmode": settings.sslmode,
        "dsn": settings.masked_dsn(),
        "migration_status": diagnostics["migration_state"]["status"],
        "has_blockers": diagnostics["has_blockers"],
        "role_classification": role_audit["classification"],
        "role_audit": role_audit,
        "diagnostics": diagnostics,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Comprueba conectividad PostgreSQL y resume el estado operativo/migratorio sin modificar datos.",
    )
    parser.add_argument("--database-url", help="Sobrescribe la URL runtime.")
    parser.add_argument("--json", action="store_true", help="Emite el resultado en JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        runtime_config.load_environment()
        database_url = args.database_url or runtime_config.get_database_url()
        summary = collect_postgres_runtime_summary(database_url)
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1

    if args.json:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    else:
        print("=== PostgreSQL readiness ===")
        print(f"dsn: {summary['dsn']}")
        print(f"database: {summary['database']}")
        print(f"user: {summary['user']}")
        print(f"server_version: {summary['server_version']} ({summary['server_version_num']})")
        print(f"application_name: {summary['application_name']}")
        print(f"sslmode: {summary['sslmode']}")
        print(f"role_classification: {summary['role_classification']}")
        print(f"migration_status: {summary['migration_status']}")
        print(f"blockers: {'yes' if summary['has_blockers'] else 'no'}")

    return 2 if summary["has_blockers"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
