-- Template operativo SEGURO para crear un rol dedicado PostgreSQL de aplicación.
-- Adaptar placeholders fuera del repositorio y ejecutar con un rol administrativo.
-- NO reutilices `postgres` como credencial runtime de la aplicación.

-- Variables a reemplazar manualmente antes de ejecutar:
--   {{APP_ROLE}}            -> nombre del rol runtime (ej. programacion_app)
--   {{APP_PASSWORD}}        -> secreto real gestionado fuera del repo
--   {{TARGET_DATABASE}}     -> base objetivo
--   {{TARGET_SCHEMA}}       -> esquema objetivo (por defecto public)

CREATE ROLE {{APP_ROLE}} LOGIN PASSWORD '{{APP_PASSWORD}}'
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOREPLICATION
    NOBYPASSRLS;

GRANT CONNECT ON DATABASE {{TARGET_DATABASE}} TO {{APP_ROLE}};
GRANT USAGE ON SCHEMA {{TARGET_SCHEMA}} TO {{APP_ROLE}};

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA {{TARGET_SCHEMA}}
TO {{APP_ROLE}};

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA {{TARGET_SCHEMA}}
TO {{APP_ROLE}};

ALTER DEFAULT PRIVILEGES IN SCHEMA {{TARGET_SCHEMA}}
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {{APP_ROLE}};

ALTER DEFAULT PRIVILEGES IN SCHEMA {{TARGET_SCHEMA}}
GRANT USAGE, SELECT ON SEQUENCES TO {{APP_ROLE}};

-- Validación manual sugerida después de provisionar:
--   python -m api.scripts.postgres_role_audit --json
