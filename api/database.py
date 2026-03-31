import ast
from collections.abc import Iterable
import hashlib
from pathlib import Path
from typing import Any, cast

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

from . import runtime_config

runtime_config.load_environment()

SQLALCHEMY_DATABASE_URL = runtime_config.get_database_url()
engine_options = runtime_config.get_sqlalchemy_engine_options(SQLALCHEMY_DATABASE_URL)

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
ALEMBIC_CONFIG_PATH = Path(__file__).resolve().parent.parent / "alembic.ini"
ALEMBIC_VERSIONS_PATH = Path(__file__).resolve().parent / "migrations" / "versions"


def _get_table_columns(current_engine: Engine, table_name: str) -> dict[str, dict[str, Any]]:
    inspector = inspect(current_engine)
    return {
        cast(str, column_info["name"]): cast(dict[str, Any], column_info)
        for column_info in inspector.get_columns(table_name)
    }


def _get_missing_columns(current_engine: Engine, expected_tables: Iterable[str]) -> dict[str, list[str]]:
    missing_columns: dict[str, list[str]] = {}

    for table_name in expected_tables:
        expected_table = Base.metadata.tables.get(table_name)
        if expected_table is None:
            continue

        existing_columns = set(_get_table_columns(current_engine, table_name))
        expected_columns = {column.name for column in expected_table.columns}
        table_missing_columns = sorted(expected_columns - existing_columns)
        if table_missing_columns:
            missing_columns[table_name] = table_missing_columns

    return missing_columns


def _get_schema_compatibility_issues(current_engine: Engine, expected_tables: Iterable[str]) -> list[str]:
    issues: list[str] = []

    if "revoked_tokens" not in expected_tables:
        return issues

    revoked_token_columns = _get_table_columns(current_engine, "revoked_tokens")
    token_column = revoked_token_columns.get("token")
    if token_column and token_column.get("nullable") is False:
        issues.append("revoked_tokens.token must allow NULL values")

    return issues


def _hash_legacy_token(token: object) -> str:
    if not isinstance(token, str) or not token:
        raise RuntimeError(
            "Local schema auto-repair could not backfill revoked_tokens.token_hash because "
            "one or more legacy rows do not contain the original token value. "
            "Restore from a healthy backup or recreate the local database."
        )

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _repair_sqlite_revoked_tokens_schema(
    current_engine: Engine,
    *,
    has_token_hash_column: bool,
) -> None:
    with current_engine.begin() as connection:
        rows = connection.execute(
            text(
                "SELECT id, token, revoked_at"
                + (", token_hash" if has_token_hash_column else "")
                + " FROM revoked_tokens ORDER BY id"
            )
        ).mappings().all()

        normalized_rows = [
            {
                "id": row["id"],
                "token": row["token"],
                "revoked_at": row["revoked_at"],
                "token_hash": (
                    row.get("token_hash")
                    if has_token_hash_column and isinstance(row.get("token_hash"), str) and row.get("token_hash")
                    else _hash_legacy_token(row["token"])
                ),
            }
            for row in rows
        ]

        connection.execute(text("DROP TABLE IF EXISTS revoked_tokens__repair"))
        connection.execute(
            text(
                "CREATE TABLE revoked_tokens__repair ("
                "id INTEGER NOT NULL PRIMARY KEY, "
                "token_hash VARCHAR(64) NOT NULL, "
                "token VARCHAR NULL, "
                "revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )

        for row in normalized_rows:
            connection.execute(
                text(
                    "INSERT INTO revoked_tokens__repair (id, token_hash, token, revoked_at) "
                    "VALUES (:id, :token_hash, :token, :revoked_at)"
                ),
                row,
            )

        connection.execute(text("DROP TABLE revoked_tokens"))
        connection.execute(text("ALTER TABLE revoked_tokens__repair RENAME TO revoked_tokens"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_revoked_tokens_id ON revoked_tokens (id)"))
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_revoked_tokens_token_hash "
                "ON revoked_tokens (token_hash)"
            )
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_revoked_tokens_token "
                "ON revoked_tokens (token)"
            )
        )


def _repair_local_revoked_tokens_schema(
    current_engine: Engine,
    missing_columns: dict[str, list[str]],
    compatibility_issues: list[str],
) -> bool:
    revoked_token_missing_columns = missing_columns.get("revoked_tokens", [])
    token_hash_missing = revoked_token_missing_columns == ["token_hash"]
    token_nullability_drift = "revoked_tokens.token must allow NULL values" in compatibility_issues

    if not token_hash_missing and not token_nullability_drift:
        return False

    if not runtime_config.should_auto_repair_local_schema():
        return False

    dialect_name = current_engine.dialect.name
    if dialect_name not in {"sqlite", "postgresql"}:
        return False

    if dialect_name == "sqlite":
        _repair_sqlite_revoked_tokens_schema(
            current_engine,
            has_token_hash_column=not token_hash_missing,
        )
        return True

    with current_engine.begin() as connection:
        if token_hash_missing:
            connection.execute(text("ALTER TABLE revoked_tokens ADD COLUMN token_hash VARCHAR(64)"))

        legacy_rows = connection.execute(
            text(
                "SELECT id, token FROM revoked_tokens "
                "WHERE token_hash IS NULL OR token_hash = ''"
            )
        ).mappings().all()

        for row in legacy_rows:
            connection.execute(
                text("UPDATE revoked_tokens SET token_hash = :token_hash WHERE id = :row_id"),
                {
                    "row_id": row["id"],
                    "token_hash": _hash_legacy_token(row["token"]),
                },
            )

        if token_nullability_drift:
            connection.execute(text("ALTER TABLE revoked_tokens ALTER COLUMN token DROP NOT NULL"))

        if dialect_name == "postgresql":
            connection.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_revoked_tokens_token_hash "
                    "ON revoked_tokens (token_hash)"
                )
            )
            connection.execute(
                text("ALTER TABLE revoked_tokens ALTER COLUMN token_hash SET NOT NULL")
            )
    return True


def create_schema(target_engine: Engine | None = None) -> None:
    Base.metadata.create_all(bind=target_engine or engine)


def should_validate_migrations() -> bool:
    return (not runtime_config.is_local_runtime()) or runtime_config.env_flag(
        "VALIDATE_MIGRATIONS_IN_LOCAL",
        default=False,
    )


def _has_alembic_assets() -> bool:
    return ALEMBIC_CONFIG_PATH.exists() and ALEMBIC_VERSIONS_PATH.exists()


def _extract_alembic_revision_metadata(file_path: Path) -> tuple[str | None, tuple[str, ...]]:
    module = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
    revision: str | None = None
    down_revisions: tuple[str, ...] = ()

    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if not isinstance(target, ast.Name):
                continue
            if target.id == "revision" and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                revision = node.value.value
            if target.id != "down_revision":
                continue
            if isinstance(node.value, ast.Constant):
                down_revisions = (node.value.value,) if isinstance(node.value.value, str) else ()
            elif isinstance(node.value, (ast.Tuple, ast.List)):
                down_revisions = tuple(
                    element.value
                    for element in node.value.elts
                    if isinstance(element, ast.Constant) and isinstance(element.value, str)
                )

    return revision, down_revisions


def _get_alembic_head_revisions() -> set[str]:
    all_revisions: set[str] = set()
    referenced_revisions: set[str] = set()

    for migration_file in ALEMBIC_VERSIONS_PATH.glob("*.py"):
        revision, down_revisions = _extract_alembic_revision_metadata(migration_file)
        if not revision:
            continue
        all_revisions.add(revision)
        referenced_revisions.update(down_revisions)

    return all_revisions - referenced_revisions


def _get_all_alembic_revisions() -> set[str]:
    all_revisions: set[str] = set()

    for migration_file in ALEMBIC_VERSIONS_PATH.glob("*.py"):
        revision, _ = _extract_alembic_revision_metadata(migration_file)
        if revision:
            all_revisions.add(revision)

    return all_revisions


def validate_database_migrations(target_engine: Engine | None = None) -> None:
    if not _has_alembic_assets():
        return

    current_engine = target_engine or engine
    expected_heads = _get_alembic_head_revisions()
    known_revisions = _get_all_alembic_revisions()
    inspector = inspect(current_engine)
    existing_tables = set(inspector.get_table_names())
    has_alembic_version_table = "alembic_version" in existing_tables
    current_heads: set[str] = set()

    if has_alembic_version_table:
        with current_engine.connect() as connection:
            current_heads = {
                row[0]
                for row in connection.execute(text("SELECT version_num FROM alembic_version"))
                if row[0]
            }

    if not has_alembic_version_table:
        if existing_tables:
            raise RuntimeError(
                "Database migrations are not stamped. The schema exists but alembic_version is missing. "
                "Validate the baseline, run `python -m alembic stamp 0001_initial_schema`, and then `python -m alembic upgrade head`."
            )
        raise RuntimeError("Database migrations are not initialized. Run `python -m alembic upgrade head`.")

    if not current_heads:
        raise RuntimeError(
            "Database migrations are not stamped correctly. alembic_version is present but no revision was recorded. "
            "Run `python -m alembic stamp 0001_initial_schema` (after validating the baseline) and then `python -m alembic upgrade head`."
        )

    unknown_heads = sorted(current_heads - known_revisions)
    if unknown_heads:
        raise RuntimeError(
            "Database migration state is unknown. Unrecognized revision(s): " + ", ".join(unknown_heads)
        )

    if current_heads != expected_heads:
        raise RuntimeError(
            "Database migrations are out of date. Current revision(s): "
            + ", ".join(sorted(current_heads))
            + ". Expected head revision(s): "
            + ", ".join(sorted(expected_heads))
            + ". Run `python -m alembic upgrade head`."
        )


def ensure_database_ready(
    target_engine: Engine | None = None,
    *,
    required_tables: Iterable[str] | None = None,
) -> None:
    current_engine = target_engine or engine

    with current_engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    inspector = inspect(current_engine)
    existing_tables = set(inspector.get_table_names())
    expected_tables = set(required_tables or Base.metadata.tables.keys())
    missing_tables = sorted(expected_tables - existing_tables)

    if missing_tables:
        raise RuntimeError(
            "Database schema is incomplete. Missing tables: " + ", ".join(missing_tables)
        )

    missing_columns = _get_missing_columns(current_engine, expected_tables)
    compatibility_issues = _get_schema_compatibility_issues(current_engine, expected_tables)
    if (missing_columns or compatibility_issues) and _repair_local_revoked_tokens_schema(
        current_engine,
        missing_columns,
        compatibility_issues,
    ):
        missing_columns = _get_missing_columns(current_engine, expected_tables)
        compatibility_issues = _get_schema_compatibility_issues(current_engine, expected_tables)

    if missing_columns:
        formatted_missing_columns = ", ".join(
            f"{table_name}.{column_name}"
            for table_name, column_names in sorted(missing_columns.items())
            for column_name in column_names
        )
        raise RuntimeError(
            "Database schema is incomplete. Missing columns: " + formatted_missing_columns
        )

    if compatibility_issues:
        raise RuntimeError(
            "Database schema is incompatible. " + "; ".join(compatibility_issues)
        )

    if should_validate_migrations():
        validate_database_migrations(current_engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
