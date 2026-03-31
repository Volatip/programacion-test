# PostgreSQL: rol dedicado de aplicación

## Objetivo

Preparar preproducción/producción para que la aplicación NO use `postgres` como credencial runtime.

## Principios

- `POSTGRES_USER` / `POSTGRES_PASSWORD` deben representar el rol runtime de la app.
- `POSTGRES_ADMIN_*` deben reservarse para backup, restore, mantenimiento y migraciones operativas.
- Los secretos reales NO se guardan en el repositorio.
- TLS debe quedar explícito (`sslmode=require` o más estricto).

## Flujo recomendado

1. Crear el rol dedicado a partir de `api/scripts/sql/create_app_role_template.sql`.
2. Guardar el password real en el gestor de secretos del entorno o en `.env.local` local, nunca en `.env`.
3. Configurar el runtime con `POSTGRES_USER=<rol_app>` y `POSTGRES_PASSWORD=<secret_real>`.
4. Mantener `POSTGRES_ADMIN_*` separados si backup/restore o Alembic necesitan más privilegios.
5. Validar sin tocar datos:

   ```bash
   python -m api.scripts.postgres_role_audit --json
   python -m api.scripts.postgres_readiness --json
   python -m api.scripts.pre_migration_diagnostics --json
   ```

## Qué revisa cada script

- `postgres_role_audit`: clasifica el runtime actual como `superuser`, `bootstrap_admin_role`, `elevated_role` o `dedicated_app_role_candidate`, y revisa permisos básicos read-only.
- `postgres_readiness`: conectividad, versión, `sslmode`, estado migratorio y auditoría del rol runtime.
- `pre_migration_diagnostics`: baseline/stamp/head y duplicados que bloquearían constraints.
- `postgres_backup` / `postgres_restore`: requieren binarios cliente PostgreSQL (`pg_dump`, `pg_restore`, `psql`) en `PATH` cuando se ejecutan desde el host local.

## Checklist final antes de abrir tráfico

- [ ] `SECRET_KEY` real gestionado fuera del repo
- [ ] `POSTGRES_USER` distinto de `postgres`
- [ ] `POSTGRES_ADMIN_*` separados si existen tareas administrativas
- [ ] `sslmode=require` o `verify-ca` / `verify-full`
- [ ] backup lógico validado
- [ ] restore probado en base aislada
- [ ] host local con cliente PostgreSQL en `PATH` o procedimiento equivalente validado desde el contenedor
- [ ] `python -m alembic upgrade head` ejecutado donde corresponda
- [ ] `GET /readyz` responde OK
- [ ] `python -m api.scripts.postgres_role_audit --json` no devuelve clasificación elevada

## Nota importante

Estos artefactos son deliberadamente NO destructivos. Provisionan referencia y validación, pero NO cambian roles reales existentes por sí solos.
