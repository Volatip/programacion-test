from __future__ import annotations

import argparse
import json

from sqlalchemy import create_engine

from api import runtime_config
from api.scripts.postgres_ops_common import collect_runtime_role_audit, resolve_postgres_settings


def collect_postgres_role_audit(database_url: str, *, schema: str = "public") -> dict:
    engine = create_engine(database_url, **runtime_config.get_sqlalchemy_engine_options(database_url))
    with engine.connect() as connection:
        audit = collect_runtime_role_audit(connection, schema=schema)

    settings = resolve_postgres_settings(database_url=database_url)
    audit["dsn"] = settings.masked_dsn()
    return audit


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audita de forma read-only si el runtime PostgreSQL usa SUPERUSER, rol elevado o un candidato razonable a rol dedicado de aplicación.",
    )
    parser.add_argument("--database-url", help="Sobrescribe la URL runtime.")
    parser.add_argument("--schema", default="public", help="Esquema a validar para permisos básicos.")
    parser.add_argument("--json", action="store_true", help="Emite el resultado en JSON.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        runtime_config.load_environment()
        database_url = args.database_url or runtime_config.get_database_url()
        audit = collect_postgres_role_audit(database_url, schema=args.schema)
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1

    if args.json:
        print(json.dumps(audit, indent=2, ensure_ascii=False))
    else:
        print("=== PostgreSQL runtime role audit ===")
        print(f"dsn: {audit['dsn']}")
        print(f"database: {audit['database']}")
        print(f"current_user: {audit['current_user']}")
        print(f"session_user: {audit['session_user']}")
        print(f"classification: {audit['classification']}")
        print(f"is_superuser: {audit['attributes']['is_superuser']}")
        if audit["warning"]:
            print(f"warning: {audit['warning']}")
        print("basic_privileges:")
        for check_name, details in audit["basic_privileges"].items():
            detail_suffix = ""
            if details.get("detail"):
                detail_suffix = f" ({details['detail']})"
            print(f"- {check_name}: {details['status']}{detail_suffix}")

    return 0 if audit["classification"] == "dedicated_app_role_candidate" else 2


if __name__ == "__main__":
    raise SystemExit(main())
