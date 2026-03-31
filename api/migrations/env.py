from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from api import models, runtime_config
from api.database import Base
from api.scripts.postgres_ops_common import resolve_postgres_settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_database_url() -> str:
    runtime_config.load_environment()
    return runtime_config.get_database_url()


def get_migration_database_url() -> str:
    runtime_config.load_environment()
    runtime_database_url = runtime_config.get_database_url()

    if runtime_database_url.startswith("postgresql") and runtime_config.get_env("POSTGRES_ADMIN_USER"):
        admin_settings = resolve_postgres_settings(admin=True)
        return admin_settings.sqlalchemy_dsn()

    return runtime_database_url


def get_connect_args(database_url: str | None = None) -> dict[str, object]:
    resolved_database_url = database_url or get_migration_database_url()
    return runtime_config.get_sqlalchemy_connect_args(resolved_database_url)


def run_migrations_offline() -> None:
    context.configure(
        url=get_migration_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    database_url = get_migration_database_url()
    configuration["sqlalchemy.url"] = database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=get_connect_args(database_url),
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
