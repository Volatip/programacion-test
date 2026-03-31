from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import shlex
import shutil
import subprocess
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection
from sqlalchemy.engine import URL, make_url

from api import runtime_config


@dataclass(frozen=True)
class PostgresConnectionSettings:
    host: str
    port: str
    database: str
    user: str
    password: str
    sslmode: str | None

    def masked_dsn(self) -> str:
        query = {}
        if self.sslmode:
            query["sslmode"] = self.sslmode
        return (
            URL.create(
                "postgresql+psycopg2",
                username=self.user,
                password="***",
                host=self.host,
                port=int(self.port),
                database=self.database,
                query=query,
            ).render_as_string(hide_password=False)
        )

    def sqlalchemy_dsn(self) -> str:
        query = {}
        if self.sslmode:
            query["sslmode"] = self.sslmode
        return (
            URL.create(
                "postgresql+psycopg2",
                username=self.user,
                password=self.password,
                host=self.host,
                port=int(self.port),
                database=self.database,
                query=query,
            ).render_as_string(hide_password=False)
        )


def _normalize_sslmode_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, tuple):
        if not value:
            return None
        last_value = value[-1]
        return str(last_value) if last_value else None
    normalized = str(value).strip()
    return normalized or None


def classify_runtime_role(
    *,
    role_name: str,
    is_superuser: bool,
    can_create_role: bool,
    can_create_db: bool,
    can_replicate: bool,
    can_bypass_rls: bool,
) -> str:
    if is_superuser:
        return "superuser"
    if role_name == "postgres":
        return "bootstrap_admin_role"
    if any((can_create_role, can_create_db, can_replicate, can_bypass_rls)):
        return "elevated_role"
    return "dedicated_app_role_candidate"


def role_classification_warning(classification: str) -> str | None:
    if classification == "superuser":
        return "El runtime actual usa un rol PostgreSQL con SUPERUSER. Cambia a un rol dedicado de aplicación antes de preproducción/producción."
    if classification == "bootstrap_admin_role":
        return "El runtime actual usa el rol bootstrap `postgres`. Reserva ese rol para administración y usa un rol dedicado para la aplicación."
    if classification == "elevated_role":
        return "El runtime actual usa un rol elevado (CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS). Revisa si la app realmente necesita esos privilegios."
    return None


def _collect_basic_privilege_checks(connection: Connection, schema: str) -> dict[str, Any]:
    checks: dict[str, Any] = {}

    database_row = connection.execute(
        text(
            """
            SELECT current_database() AS database_name,
                   has_database_privilege(current_user, current_database(), 'CONNECT') AS has_connect
            """
        )
    ).mappings().one()
    checks["database_connect"] = {
        "status": "ok" if database_row["has_connect"] else "missing",
        "database": database_row["database_name"],
    }

    schema_row = connection.execute(
        text(
            """
            SELECT has_schema_privilege(current_user, :schema, 'USAGE') AS has_usage,
                   has_schema_privilege(current_user, :schema, 'CREATE') AS has_create
            """
        ),
        {"schema": schema},
    ).mappings().one()
    checks["schema_usage"] = {"status": "ok" if schema_row["has_usage"] else "missing", "schema": schema}
    checks["schema_create"] = {
        "status": "ok" if schema_row["has_create"] else "not_granted",
        "schema": schema,
        "optional": True,
        "detail": "CREATE en el esquema no suele ser necesario para la app runtime si Alembic/migraciones usan un rol administrativo.",
    }

    table_rows = connection.execute(
        text(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = :schema
            ORDER BY tablename
            """
        ),
        {"schema": schema},
    ).mappings().all()
    table_names = [row["tablename"] for row in table_rows]
    if not table_names:
        checks["table_dml"] = {
            "status": "not_applicable",
            "schema": schema,
            "detail": "No se encontraron tablas en el esquema inspeccionado.",
            "missing_tables": [],
        }
    else:
        missing_table_privileges: list[str] = []
        for table_name in table_names:
            privilege_row = connection.execute(
                text(
                    """
                    SELECT has_table_privilege(current_user, format('%I.%I', :schema, :table_name), 'SELECT') AS can_select,
                           has_table_privilege(current_user, format('%I.%I', :schema, :table_name), 'INSERT') AS can_insert,
                           has_table_privilege(current_user, format('%I.%I', :schema, :table_name), 'UPDATE') AS can_update,
                           has_table_privilege(current_user, format('%I.%I', :schema, :table_name), 'DELETE') AS can_delete
                    """
                ),
                {"schema": schema, "table_name": table_name},
            ).mappings().one()
            if not all(
                (
                    privilege_row["can_select"],
                    privilege_row["can_insert"],
                    privilege_row["can_update"],
                    privilege_row["can_delete"],
                )
            ):
                missing_table_privileges.append(table_name)
        checks["table_dml"] = {
            "status": "ok" if not missing_table_privileges else "missing",
            "schema": schema,
            "checked_tables": len(table_names),
            "missing_tables": missing_table_privileges,
        }

    sequence_rows = connection.execute(
        text(
            """
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = :schema
            ORDER BY sequencename
            """
        ),
        {"schema": schema},
    ).mappings().all()
    sequence_names = [row["sequencename"] for row in sequence_rows]
    if not sequence_names:
        checks["sequence_usage"] = {
            "status": "not_applicable",
            "schema": schema,
            "detail": "No se encontraron secuencias en el esquema inspeccionado.",
            "missing_sequences": [],
        }
    else:
        missing_sequence_privileges: list[str] = []
        for sequence_name in sequence_names:
            privilege_row = connection.execute(
                text(
                    """
                    SELECT has_sequence_privilege(current_user, format('%I.%I', :schema, :sequence_name), 'USAGE') AS can_use,
                           has_sequence_privilege(current_user, format('%I.%I', :schema, :sequence_name), 'SELECT') AS can_select
                    """
                ),
                {"schema": schema, "sequence_name": sequence_name},
            ).mappings().one()
            if not all((privilege_row["can_use"], privilege_row["can_select"])):
                missing_sequence_privileges.append(sequence_name)
        checks["sequence_usage"] = {
            "status": "ok" if not missing_sequence_privileges else "missing",
            "schema": schema,
            "checked_sequences": len(sequence_names),
            "missing_sequences": missing_sequence_privileges,
        }

    return checks


def collect_runtime_role_audit(connection: Connection, *, schema: str = "public") -> dict[str, Any]:
    role_row = connection.execute(
        text(
            """
            SELECT current_database() AS current_database,
                   current_user AS current_user,
                   session_user AS session_user,
                   r.rolsuper AS is_superuser,
                   r.rolcreaterole AS can_create_role,
                   r.rolcreatedb AS can_create_db,
                   r.rolreplication AS can_replicate,
                   r.rolbypassrls AS can_bypass_rls,
                   r.rolcanlogin AS can_login
            FROM pg_roles AS r
            WHERE r.rolname = current_user
            """
        )
    ).mappings().one()

    classification = classify_runtime_role(
        role_name=role_row["current_user"],
        is_superuser=role_row["is_superuser"],
        can_create_role=role_row["can_create_role"],
        can_create_db=role_row["can_create_db"],
        can_replicate=role_row["can_replicate"],
        can_bypass_rls=role_row["can_bypass_rls"],
    )
    warning = role_classification_warning(classification)
    basic_privileges = _collect_basic_privilege_checks(connection, schema)

    return {
        "database": role_row["current_database"],
        "current_user": role_row["current_user"],
        "session_user": role_row["session_user"],
        "classification": classification,
        "warning": warning,
        "attributes": {
            "is_superuser": role_row["is_superuser"],
            "can_create_role": role_row["can_create_role"],
            "can_create_db": role_row["can_create_db"],
            "can_replicate": role_row["can_replicate"],
            "can_bypass_rls": role_row["can_bypass_rls"],
            "can_login": role_row["can_login"],
        },
        "basic_privileges": basic_privileges,
    }


def _normalize_postgres_url(database_url: str) -> URL:
    parsed = make_url(database_url)
    if not parsed.drivername.startswith("postgresql"):
        raise RuntimeError("The selected database is not PostgreSQL.")
    return parsed


def resolve_postgres_settings(
    *,
    database_url: str | None = None,
    admin: bool = False,
    override_database: str | None = None,
) -> PostgresConnectionSettings:
    runtime_config.load_environment()

    if database_url:
        parsed = _normalize_postgres_url(database_url)
        sslmode = _normalize_sslmode_value(parsed.query.get("sslmode") if parsed.query else None)
        if sslmode is None:
            sslmode = runtime_config.get_postgres_sslmode(database_url)
        return PostgresConnectionSettings(
            host=parsed.host or "127.0.0.1",
            port=str(parsed.port or 5432),
            database=override_database or (parsed.database or "postgres"),
            user=parsed.username or "",
            password=parsed.password or "",
            sslmode=sslmode,
        )

    if admin:
        user = (runtime_config.get_env("POSTGRES_ADMIN_USER") or runtime_config.get_env("POSTGRES_USER") or "").strip()
        password = (runtime_config.get_env("POSTGRES_ADMIN_PASSWORD") or runtime_config.get_env("POSTGRES_PASSWORD") or "").strip()
        database = (
            override_database
            or (runtime_config.get_env("POSTGRES_ADMIN_DB") or "").strip()
            or (runtime_config.get_env("POSTGRES_DB") or "").strip()
            or "postgres"
        )
        host = (runtime_config.get_env("POSTGRES_ADMIN_HOST") or runtime_config.get_env("POSTGRES_HOST") or "127.0.0.1").strip()
        port = (runtime_config.get_env("POSTGRES_ADMIN_PORT") or runtime_config.get_env("POSTGRES_PORT") or "5433").strip()
        sslmode = (runtime_config.get_env("POSTGRES_ADMIN_SSLMODE") or runtime_config.get_env("POSTGRES_SSLMODE") or "").strip() or None
    else:
        parsed = _normalize_postgres_url(runtime_config.get_database_url())
        sslmode = _normalize_sslmode_value(parsed.query.get("sslmode") if parsed.query else None)
        if sslmode is None:
            sslmode = runtime_config.get_postgres_sslmode(str(parsed))
        user = parsed.username or ""
        password = parsed.password or ""
        database = override_database or (parsed.database or "")
        host = parsed.host or "127.0.0.1"
        port = str(parsed.port or 5432)

    if not all((user, password, database, host, port)):
        raise RuntimeError("Incomplete PostgreSQL credentials for the requested operation.")

    return PostgresConnectionSettings(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password,
        sslmode=sslmode,
    )


def build_pg_env(settings: PostgresConnectionSettings) -> dict[str, str]:
    env = os.environ.copy()
    env.update(
        {
            "PGHOST": settings.host,
            "PGPORT": settings.port,
            "PGDATABASE": settings.database,
            "PGUSER": settings.user,
            "PGPASSWORD": settings.password,
        }
    )
    if settings.sslmode:
        env["PGSSLMODE"] = settings.sslmode
    return env


def format_command(command: list[str]) -> str:
    return shlex.join(command)


def ensure_binary_available(binary_name: str) -> None:
    if shutil.which(binary_name):
        return
    raise RuntimeError(f"Required PostgreSQL binary not found in PATH: {binary_name}")


def ensure_parent_dir(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def run_command(command: list[str], *, env: dict[str, str], dry_run: bool = False) -> int:
    if dry_run:
        return 0
    completed = subprocess.run(command, env=env, check=False)
    return completed.returncode
