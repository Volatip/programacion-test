from __future__ import annotations

from pathlib import Path
import argparse

from api.scripts.postgres_ops_common import (
    build_pg_env,
    ensure_binary_available,
    format_command,
    resolve_postgres_settings,
    run_command,
)


def build_restore_command(*, input_path: Path, plain_sql: bool = False, single_transaction: bool = False) -> list[str]:
    if plain_sql:
        command = ["psql", "--set", "ON_ERROR_STOP=1", "--file", str(input_path)]
        if single_transaction:
            command.append("--single-transaction")
        return command

    command = [
        "pg_restore",
        "--verbose",
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
    ]
    if single_transaction:
        command.append("--single-transaction")
    command.append(str(input_path))
    return command


def detect_plain_sql(input_path: Path) -> bool:
    return input_path.suffix.lower() in {".sql", ".psql"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Restaura un backup lógico PostgreSQL con protecciones explícitas contra operaciones destructivas accidentales.",
    )
    parser.add_argument("--input", required=True, help="Ruta del backup lógico (.dump o .sql).")
    parser.add_argument("--database-url", help="URL PostgreSQL administrativa explícita para el restore.")
    parser.add_argument("--target-db", help="Base destino. Si se omite, usa POSTGRES_ADMIN_DB/POSTGRES_DB.")
    parser.add_argument("--dry-run", action="store_true", help="Muestra la operación sin ejecutar restore.")
    parser.add_argument(
        "--confirm-destructive-restore",
        action="store_true",
        help="Confirmación obligatoria para ejecutar un restore real.",
    )
    parser.add_argument(
        "--allow-runtime-target",
        action="store_true",
        help="Permite apuntar a la misma base usada por el runtime. Solo úsalo conscientemente.",
    )
    parser.add_argument(
        "--single-transaction",
        action="store_true",
        help="Intenta ejecutar todo el restore dentro de una sola transacción.",
    )
    return parser.parse_args()


def execute_restore(args: argparse.Namespace) -> int:
    input_path = Path(args.input)
    if not input_path.exists():
        raise RuntimeError("The input backup file does not exist.")

    target_settings = resolve_postgres_settings(
        database_url=args.database_url,
        admin=True,
        override_database=args.target_db,
    )
    runtime_settings = resolve_postgres_settings()

    if target_settings.database == runtime_settings.database and not args.allow_runtime_target:
        raise RuntimeError(
            "Refusing to target the runtime database without --allow-runtime-target. Restore into an isolated database first."
        )

    if not args.dry_run and not args.confirm_destructive_restore:
        raise RuntimeError("Real restore requires --confirm-destructive-restore.")

    plain_sql = detect_plain_sql(input_path)
    command = build_restore_command(
        input_path=input_path,
        plain_sql=plain_sql,
        single_transaction=args.single_transaction,
    )

    print("WARNING: restore is a destructive operation on the target database.")
    print(f"Target database: {target_settings.masked_dsn()}")
    print(f"Input file: {input_path}")
    print(f"Command: {format_command(command)}")

    binary_name = "psql" if plain_sql else "pg_restore"
    if not args.dry_run:
        ensure_binary_available(binary_name)

    return run_command(command, env=build_pg_env(target_settings), dry_run=args.dry_run)


def main() -> int:
    try:
        return execute_restore(parse_args())
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
