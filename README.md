# Programación Médica

Baseline listo para publicar en GitHub con frontend React/Vite y backend FastAPI/SQLAlchemy.

## Requisitos

- Node.js 18+
- Python 3.10+
- Docker Desktop o Docker Engine

## Levantar local con PostgreSQL Docker

1. Copia el template seguro:

   ```bash
   cp .env .env.local
   ```

   En Windows PowerShell:

   ```powershell
   Copy-Item .env .env.local
   ```

2. Completa al menos `SECRET_KEY` y `POSTGRES_PASSWORD` en `.env.local`. El template deja `DATABASE_URL` comentado a propósito para evitar que SQLite tape accidentalmente la configuración PostgreSQL local.
3. Levanta PostgreSQL local:

   ```bash
   docker compose --env-file .env.local up -d postgres
   ```

   El servicio ahora publica `healthcheck` con `pg_isready`, así que puedes confirmar el estado con:

   ```bash
   docker compose --env-file .env.local ps postgres
   ```

4. Instala dependencias:

   ```bash
   npm install
   python -m pip install -r requirements.txt
   ```

5. Inicia el backend y el frontend en terminales separadas:

   ```bash
   python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
   npm run dev
   ```

   El backend valida en startup la conectividad real a la base, las tablas, la compatibilidad crítica del esquema y —fuera de local por defecto— el estado de Alembic (`alembic_version` + head actual). Si detecta en local una base legacy de `revoked_tokens`, intenta repararla automáticamente agregando/backfilleando `token_hash` y dejando `token` como columna nullable para que logout/refresh sigan funcionando con el hardening actual; fuera de ese caso aborta con un error explícito para evitar que el servidor arranque “a medias”. Puedes desactivar esa auto-reparación local con `ENABLE_LOCAL_SCHEMA_REPAIR=false` y activar también la validación de migraciones en local con `VALIDATE_MIGRATIONS_IN_LOCAL=true` cuando quieras probar ese flujo.

## Migraciones y baseline Alembic

- Las migraciones viven en `api/migrations` y `alembic.ini` ya resuelve la URL real usando la misma configuración runtime del backend.
- `api/migrations/env.py` reutiliza también los `connect_args` runtime (`sslmode`, `connect_timeout`, `application_name` y timeouts de sesión PostgreSQL), así que Alembic y el backend siguen el MISMO camino de conexión real.
- Base nueva o contenedor PostgreSQL vacío: ejecuta `python -m alembic upgrade head` ANTES de levantar el backend en un entorno real.
- Base existente ya compatible pero sin `alembic_version`: valida primero el esquema real, registra el baseline con `python -m alembic stamp 0001_initial_schema` y después ejecuta `python -m alembic upgrade head`.
- `ENABLE_SCHEMA_AUTO_CREATE=true` sigue siendo solo una ayuda local para bootstraps controlados; NO reemplaza Alembic en despliegues reales.
- El head actual es `0002_operational_db_hardening`; agrega constraints únicos para `programmings`, `user_officials` y `user_hidden_officials`. Si la migración falla por duplicados, primero limpia esos datos antes de reintentar.

### Diagnóstico seguro previo a `upgrade head`

Antes de aplicar `0002_operational_db_hardening` sobre una base con datos, ejecuta:

```bash
python -m api.scripts.pre_migration_diagnostics
```

Qué valida SIN tocar datos:

- estado de `alembic_version` (vacía, sin stamp, head desactualizado o al día)
- duplicados que bloquearían las nuevas constraints únicas de:
  - `programmings(funcionario_id, period_id)`
  - `user_officials(user_id, funcionario_id)`
  - `user_hidden_officials(user_id, funcionario_rut)`

Si necesitas integrarlo en automatización, usa `--json`. El script devuelve exit code `2` cuando encuentra bloqueos operativos no destructivos (duplicados o baseline/stamp inconsistente).

### Checklist operativo mínimo para arranque real

1. Configurar `SECRET_KEY` real y `DATABASE_URL` o `POSTGRES_*` completos. En PostgreSQL real deja `sslmode` explícito en `DATABASE_URL` o define `POSTGRES_SSLMODE`.
2. Configurar `CORS_ALLOWED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS` (o dejar que herede de CORS si aplica) y `TRUSTED_HOSTS`.
3. Ejecutar `python -m alembic upgrade head` o `python -m alembic stamp 0001_initial_schema` si estás haciendo baseline de una base ya existente y compatible.
4. Verificar que `ENABLE_SCHEMA_AUTO_CREATE` y `ENABLE_BOOTSTRAP_ADMIN` estén desactivados fuera de un bootstrap local deliberado.
5. Levantar backend y comprobar `GET /readyz` antes de exponer tráfico real; ahora también reporta si las migraciones están al día.
6. Si el despliegue usa HTTPS terminando en proxy, habilitar `ENABLE_HSTS=true` solo cuando el tráfico externo ya sea TLS de extremo a extremo o esté correctamente terminado aguas arriba.

### Checklist final de preproducción

1. **Backup/restore validado**
   - generar backup lógico antes del primer `stamp/upgrade` real con `python -m api.scripts.postgres_backup --output output/postgres/preprod.dump`
   - probar restore SOLO en una base aislada con `python -m api.scripts.postgres_restore --input output/postgres/preprod.dump --target-db programacion_restore_check --dry-run`
   - para un restore real, el script exige `--confirm-destructive-restore` y rechaza por defecto apuntar a la base runtime sin `--allow-runtime-target`
   - en local, `postgres_backup` / `postgres_restore` requieren `pg_dump`, `pg_restore` y `psql` disponibles en `PATH`; si el host no los tiene, instala el cliente PostgreSQL o valida el flujo desde el contenedor local sin tocar la base runtime
2. **Rol dedicado PostgreSQL**
   - usar `POSTGRES_USER` / `POSTGRES_PASSWORD` para el rol de aplicación (`programacion_app`, por ejemplo), NO `postgres`
   - reservar `POSTGRES_ADMIN_*` para credenciales administrativas de backup/restore/mantenimiento
   - otorgar al rol de aplicación solo permisos sobre la base/esquema objetivo
   - validar el runtime real con `python -m api.scripts.postgres_role_audit --json` antes del rollout; el script devuelve exit code `2` si detecta superuser/rol elevado
3. **TLS / sslmode**
   - usar `sslmode=require` o más estricto en entornos reales
   - si el proveedor exige CA o verificación completa, pasar a `verify-ca` / `verify-full`
4. **Variables requeridas**
   - `SECRET_KEY`
   - `DATABASE_URL` o `POSTGRES_USER` + `POSTGRES_PASSWORD` + `POSTGRES_DB` + `POSTGRES_HOST` + `POSTGRES_PORT`
   - `POSTGRES_SSLMODE` si `DATABASE_URL` no trae `sslmode`
   - `CORS_ALLOWED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS` o herencia controlada, `TRUSTED_HOSTS`
5. **Baseline / stamp / upgrade**
    - base vacía: `python -m alembic upgrade head`
    - base existente sin `alembic_version`: correr primero `python -m api.scripts.pre_migration_diagnostics`, validar backup y recién entonces `python -m alembic stamp 0001_initial_schema` seguido de `python -m alembic upgrade head`
    - si Alembic debe correr con rol distinto del runtime, usar `POSTGRES_ADMIN_*` para operación y mantener `POSTGRES_USER` acotado a la app
6. **Healthchecks**
     - contenedor PostgreSQL: `docker compose --env-file .env.local ps postgres` debe mostrar estado `healthy`
     - si el contenedor ya existía antes de agregar el `healthcheck`, recrearlo de forma controlada (`docker compose --env-file .env.local up -d --force-recreate postgres`) para que Docker materialice el probe
     - `GET /healthz` para liveness
     - `GET /readyz` para conectividad, compatibilidad de esquema y migraciones
     - `python -m api.scripts.postgres_readiness --json` para comprobar además clasificación del rol runtime y resumen migratorio
7. **Startup validation**
    - el backend ya aborta el arranque si la base no responde, el esquema está incompleto o las migraciones no están al día
    - fuera de local NO dependas de `ENABLE_SCHEMA_AUTO_CREATE`
8. **Secrets reales**
   - `.env` sigue siendo solo template seguro; NUNCA subir secretos reales
   - mantener secretos reales en `.env.local` o en el gestor de secretos del entorno
   - no reutilizar la contraseña del rol administrativo para el rol runtime

### Provisión segura del rol dedicado

- SQL template de referencia: `api/scripts/sql/create_app_role_template.sql`
- Validación read-only del rol runtime: `python -m api.scripts.postgres_role_audit --json`
- Guía operativa: `docs/postgresql-dedicated-role.md`

## Verificaciones sin build

```bash
python -m pytest
npm run test:run
npm run check
python -m api.scripts.postgres_backup --dry-run --output output/postgres/local-check.dump
python -m api.scripts.postgres_restore --input output/postgres/local-check.dump --target-db programacion_restore_check --dry-run
python -m api.scripts.postgres_readiness --json
python -m api.scripts.postgres_role_audit --json
```

## Notas de seguridad

- `.env` queda solo como template seguro.
- Los secretos reales van en `.env.local`.
- Swagger/ReDoc se muestran solo en local/dev, salvo que `EXPOSE_API_DOCS=true`.

## CI

El repositorio incluye `.github/workflows/security-readiness.yml` con checks mínimos de GitHub Actions para:

- `python -m pytest`
- `npm run test:run`
- `npm run check`

## Documentación adicional

- `DOCUMENTATION.md` — arquitectura, seguridad y operación local.
- `NoNecesario/` — archivo local ignorado con scripts, migraciones y documentación secundaria fuera del baseline publicable.
