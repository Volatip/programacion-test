from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import argparse

from api.scripts.postgres_ops_common import (
    build_pg_env,
    ensure_binary_available,
    ensure_parent_dir,
    format_command,
    resolve_postgres_settings,
    run_command,
)


def build_backup_command(*, output_path: Path, schema_only: bool = False) -> list[str]:
    command = [
        "pg_dump",
        "--format=custom",
        "--verbose",
        "--file",
        str(output_path),
        "--no-owner",
        "--no-privileges",
    ]
    if schema_only:
        command.append("--schema-only")
    return command


def default_output_path() -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    return Path("output") / "postgres" / f"programacion-{timestamp}.dump"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Genera un backup lógico seguro de PostgreSQL usando la configuración runtime actual.",
    )
    parser.add_argument("--output", help="Ruta del archivo .dump a generar.")
    parser.add_argument("--database-url", help="Sobrescribe la URL PostgreSQL runtime.")
    parser.add_argument("--schema-only", action="store_true", help="Exporta solo el esquema.")
    parser.add_argument("--dry-run", action="store_true", help="Muestra la operación sin ejecutar pg_dump.")
    parser.add_argument("--force", action="store_true", help="Permite sobrescribir el archivo de salida si ya existe.")
    return parser.parse_args()


def execute_backup(args: argparse.Namespace) -> int:
    output_path = Path(args.output) if args.output else default_output_path()
    if output_path.exists() and not args.force:
        raise RuntimeError("The output file already exists. Use --force to overwrite it.")

    settings = resolve_postgres_settings(database_url=args.database_url)
    ensure_parent_dir(output_path)
    command = build_backup_command(output_path=output_path, schema_only=args.schema_only)

    print(f"Target database: {settings.masked_dsn()}")
    print(f"Output file: {output_path}")
    print(f"Command: {format_command(command)}")

    if not args.dry_run:
        ensure_binary_available("pg_dump")

    return run_command(command, env=build_pg_env(settings), dry_run=args.dry_run)


def main() -> int:
    try:
        return execute_backup(parse_args())
    except Exception as exc:
        print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
