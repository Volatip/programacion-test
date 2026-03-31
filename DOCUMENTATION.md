# Documentación Técnica del Proyecto Programación Médica

## 1. Arquitectura Tecnológica

El sistema está diseñado como una aplicación web moderna de página única (SPA) con una arquitectura desacoplada (Frontend y Backend separados), optimizada para rendimiento, escalabilidad y seguridad.

### Stack Tecnológico

| Componente | Tecnología | Versión | Justificación |
| :--- | :--- | :--- | :--- |
| **Frontend** | React | 18.3.1 | Biblioteca líder para interfaces de usuario dinámicas y reactivas. |
| **Lenguaje (Front)** | TypeScript | 5.8.3 | Tipado estático para reducir errores en tiempo de compilación y mejorar mantenibilidad. |
| **Build Tool** | Vite | 6.3.5 | Entorno de desarrollo ultrarrápido con HMR (Hot Module Replacement) optimizado. |
| **Estilos** | Tailwind CSS | 3.4.17 | Framework "utility-first" para diseño rápido y consistente. |
| **Backend** | Python (FastAPI) | 3.14 / 0.115 | Framework moderno de alto rendimiento para APIs, con validación automática de datos y soporte asíncrono. |
| **ORM** | SQLAlchemy | 2.0.38 | Mapeo objeto-relacional robusto y flexible para interactuar con la base de datos. |
| **Base de Datos** | SQLite / PostgreSQL local | 3.x / 15 | SQLite sigue disponible para flujos livianos; PostgreSQL local con Docker es el baseline recomendado para validar el runtime real sin migrar datos existentes. |
| **Autenticación** | JWT (JOSE) | 3.3.0 | Estándar seguro y sin estado para la gestión de sesiones. |

### Diagrama de Arquitectura (Conceptual)

```mermaid
graph TD
    Client[Cliente (Browser)] <-->|HTTPS/JSON| API[Backend (FastAPI)]
    Client <-->|WebSocket| WS[Canal de Notificaciones]
    API -->|SQL| DB[(Base de Datos)]
    API -->|Auth| Sec[Módulo de Seguridad]
```

---

## 2. Infraestructura y Deployment

### Entorno Local (Desarrollo)
La infraestructura actual está configurada para ejecución local:
*   **Servidor Frontend:** Vite Dev Server en `http://localhost:5173`.
*   **Servidor Backend:** Uvicorn (ASGI) en `http://localhost:8000`, ejecutando la aplicación FastAPI.
*   **Base de Datos:** PostgreSQL local en Docker (`localhost:5433` por defecto) como baseline recomendado para evitar choques con instalaciones nativas de PostgreSQL en Windows; SQLite `sql_app.db` queda disponible como fallback solo para desarrollo local liviano.

### Configuración de Entornos
El sistema utiliza variables de entorno para gestionar secretos y configuraciones:
*   Copiar `.env` a `.env.local` (no incluido en control de versiones).
*   Variables clave: `SECRET_KEY`, `DATABASE_URL` o `POSTGRES_*`, `POSTGRES_SSLMODE`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.

### PostgreSQL local con Docker
1. Copiar `.env` a `.env.local` y completar valores reales, especialmente `SECRET_KEY` y `POSTGRES_PASSWORD`.
2. Levantar PostgreSQL local:
   ```bash
   docker compose --env-file .env.local up -d postgres
   ```
   El `docker-compose.yml` incluye `healthcheck` con `pg_isready`; verifica estado con `docker compose --env-file .env.local ps postgres`.
3. Iniciar backend y frontend de forma habitual. En local, si `DATABASE_URL` no está definido pero existen `POSTGRES_*`, el backend construye la conexión automáticamente. El puerto recomendado para Docker es `5433` salvo que tengas la certeza de que `5432` está libre. El template deja `DATABASE_URL` comentado para no forzar SQLite por accidente.
4. Durante el startup el backend valida la conectividad real, la presencia del esquema completo (tablas + compatibilidad crítica) y —fuera de local por defecto— la alineación de Alembic (`alembic_version` + head esperado). Si detecta localmente el drift legacy de `revoked_tokens`, aplica una auto-reparación controlada: agrega `token_hash` si falta, backfillea el hash SHA-256 desde `token`, recrea el índice único y corrige `token` a nullable para que logout/refresh no fallen con el hardening actual. Si faltan otras piezas del esquema, si la base no está stamp/upgradeada, o si la auto-reparación local está desactivada con `ENABLE_LOCAL_SCHEMA_REPAIR=false`, aborta con error explícito en lugar de arrancar “a medias”. Usa migraciones o `ENABLE_SCHEMA_AUTO_CREATE=true` solo para bootstraps locales controlados.
5. Si no quieres usar Docker en un flujo puntual, puedes omitir `DATABASE_URL` y `POSTGRES_*`; el backend seguirá cayendo a SQLite solo en local/dev.

> Importante: este lote NO migra datos existentes. Un contenedor nuevo parte con una base vacía y el backend crea el esquema solo en runtime local.

### Migraciones Alembic y baseline operativo
- `alembic.ini` apunta a `api/migrations` y `api/migrations/env.py` reutiliza `runtime_config.get_database_url()`, así que las migraciones usan la MISMA resolución de entorno que el backend.
- Además, `api/migrations/env.py` reutiliza los mismos `connect_args` runtime (`sslmode`, `connect_timeout`, `application_name` y opciones PostgreSQL) para que la ruta real de despliegue sea consistente entre backend y Alembic.
- En PostgreSQL real o cualquier entorno no local, el flujo esperado es `python -m alembic upgrade head` antes del arranque del servicio.
- La revisión baseline inicial es `0001_initial_schema` y el head actual es `0002_operational_db_hardening`.
- Si recibes una base preexistente ya compatible con el esquema baseline pero sin tabla `alembic_version`, NO recrees tablas ni mezcles `ENABLE_SCHEMA_AUTO_CREATE` con producción: valida la compatibilidad, registra el baseline con `python -m alembic stamp 0001_initial_schema` y luego ejecuta `python -m alembic upgrade head`.
- La revisión `0002_operational_db_hardening` endurece producción con `sslmode` explícito, timeouts de conexión/sesión útiles para PostgreSQL y constraints únicos en `programmings`, `user_officials` y `user_hidden_officials`. Si la migración detecta duplicados, falla de forma deliberada para que limpies los datos antes de imponer unicidad.
- `ENABLE_SCHEMA_AUTO_CREATE=true` y la auto-reparación local de `revoked_tokens` siguen siendo ayudas de DESARROLLO LOCAL, no mecanismos de migración de despliegue.

#### Diagnóstico previo seguro antes de `alembic upgrade head`

Ejecuta esta utilidad read-only contra la configuración runtime activa:

```bash
python -m api.scripts.pre_migration_diagnostics
```

La utilidad revisa:

- conectividad con la base configurada
- estado de `alembic_version`
- necesidad de baseline/stamp
- duplicados que bloquearían las nuevas constraints únicas de `0002_operational_db_hardening`

También acepta `--database-url` para inspeccionar una base distinta y `--json` para integraciones operativas/CI. Devuelve exit code `2` si encuentra bloqueos no destructivos.

#### Scripts operativos seguros PostgreSQL

- Backup lógico no destructivo:

  ```bash
  python -m api.scripts.postgres_backup --output output/postgres/preprod.dump
  ```

  - usa la conexión runtime PostgreSQL actual
  - genera formato custom de `pg_dump`
  - no sobrescribe archivos salvo `--force`
  - `--dry-run` permite validar comando/ruta sin tocar datos

- Restore lógico protegido:

  ```bash
  python -m api.scripts.postgres_restore --input output/postgres/preprod.dump --target-db programacion_restore_check --dry-run
  ```

  - pensado para bases aisladas de validación
  - un restore real exige `--confirm-destructive-restore`
  - rechaza por defecto apuntar a la base runtime si no pasas `--allow-runtime-target`
  - usa `POSTGRES_ADMIN_*` si defines un rol administrativo separado; si no, cae a `POSTGRES_*`

- Wrapper de readiness PostgreSQL:

  ```bash
  python -m api.scripts.postgres_readiness --json
  ```

  - valida conectividad real
  - informa base actual, usuario, versión, `sslmode` y estado migratorio
  - incluye auditoría read-only del rol runtime (`superuser`, `bootstrap_admin_role`, `elevated_role` o `dedicated_app_role_candidate`)
  - reutiliza el diagnóstico no destructivo de Alembic/duplicados

- Auditoría específica del rol runtime:

  ```bash
  python -m api.scripts.postgres_role_audit --json
  ```

  - NO modifica usuarios, grants ni datos
  - detecta si la app corre como `postgres`, como superuser o como rol elevado
  - valida permisos básicos de runtime sobre base/esquema/tablas/secuencias del esquema inspeccionado
  - devuelve exit code `2` si el runtime no parece un rol dedicado de aplicación

#### SQL operativo de referencia para diagnóstico manual de duplicados

```sql
SELECT funcionario_id, period_id, COUNT(*)
FROM programmings
GROUP BY funcionario_id, period_id
HAVING COUNT(*) > 1;

SELECT user_id, funcionario_id, COUNT(*)
FROM user_officials
GROUP BY user_id, funcionario_id
HAVING COUNT(*) > 1;

SELECT user_id, funcionario_rut, COUNT(*)
FROM user_hidden_officials
GROUP BY user_id, funcionario_rut
HAVING COUNT(*) > 1;
```

### Checklist operativo de arranque real
1. Definir `SECRET_KEY` real.
2. Definir `DATABASE_URL` o `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_HOST` y `POSTGRES_PORT` completos. Si usas PostgreSQL, deja `sslmode` explícito en la URL o define `POSTGRES_SSLMODE`.
3. Definir `CORS_ALLOWED_ORIGINS` y `TRUSTED_HOSTS`; `WEBSOCKET_ALLOWED_ORIGINS` puede declararse aparte o heredar desde CORS si el mismo origen cubre ambos casos.
4. Ejecutar `python -m alembic upgrade head` en bases nuevas, o `python -m alembic stamp 0001_initial_schema` SOLO si la base existente ya fue verificada como compatible.
5. Mantener `ENABLE_SCHEMA_AUTO_CREATE=false` y `ENABLE_BOOTSTRAP_ADMIN=false` fuera de bootstraps locales deliberados.
6. Levantar la API y comprobar `GET /readyz` antes de enrutar tráfico; la respuesta ahora distingue conectividad, compatibilidad de esquema y estado de migraciones.
7. Activar `ENABLE_HSTS=true` únicamente cuando el acceso externo ya esté protegido por HTTPS real.

### Checklist final de preproducción / rollout real

1. **Backup y restore**
   - generar backup lógico previo con `python -m api.scripts.postgres_backup --output output/postgres/programacion-preupgrade.dump`
   - ejecutar restore de prueba SOLO en una base aislada con `python -m api.scripts.postgres_restore --input output/postgres/programacion-preupgrade.dump --target-db programacion_restore_check --dry-run`
   - si vas a ejecutar restore real, usar credenciales administrativas y confirmar explícitamente con `--confirm-destructive-restore`
   - en local, estos scripts requieren binarios cliente PostgreSQL (`pg_dump`, `pg_restore`, `psql`) en `PATH`; si no existen en el host, instala el cliente o ejecuta la validación operativa desde el contenedor PostgreSQL aislando siempre la base destino
2. **Rol dedicado PostgreSQL**
   - usar un rol de aplicación distinto de `postgres` en `POSTGRES_USER` / `POSTGRES_PASSWORD`
   - reservar `POSTGRES_ADMIN_*` para backup/restore y tareas de mantenimiento
   - conceder permisos mínimos sobre la base y el esquema objetivo
   - validar el runtime real con `python -m api.scripts.postgres_role_audit --json` antes de abrir tráfico
3. **TLS / sslmode**
    - usar `sslmode=require` como mínimo en entornos reales
    - subir a `verify-ca` / `verify-full` cuando la plataforma entregue CA/certificados verificables
   - si el proveedor expone CA propia, distribuirla por secreto/volumen gestionado y NO hardcodearla en el repositorio
4. **Variables requeridas**
    - `SECRET_KEY`
    - `DATABASE_URL` o `POSTGRES_*` completos
    - `POSTGRES_SSLMODE` si la URL no trae `sslmode`
    - `CORS_ALLOWED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS` y `TRUSTED_HOSTS`
   - `POSTGRES_ADMIN_*` cuando backup/restore o migraciones operativas usen un rol distinto del runtime
5. **Baseline / stamp / upgrade**
    - base vacía: `python -m alembic upgrade head`
    - base existente: correr `python -m api.scripts.pre_migration_diagnostics`, validar backup, ejecutar `python -m alembic stamp 0001_initial_schema` SOLO si el baseline ya coincide y finalmente `python -m alembic upgrade head`
   - preferir migraciones con rol administrativo separado; el runtime de aplicación no debería requerir `CREATEDB`, `CREATEROLE` ni `SUPERUSER`
6. **Healthchecks**
     - contenedor PostgreSQL Docker: `docker compose --env-file .env.local ps postgres` -> `healthy`
     - si el contenedor fue creado antes de que `docker-compose.yml` declarara `healthcheck`, recrearlo de forma controlada para que Docker aplique el probe real
     - `GET /healthz` = liveness liviano
     - `GET /readyz` = dependencia real de base + esquema + migraciones
7. **Startup validation**
   - el backend aborta el arranque si falla la conexión, falta esquema o las migraciones no están al día
   - no uses `ENABLE_SCHEMA_AUTO_CREATE` como sustituto de migraciones reales

#### SQL de referencia para rol dedicado (adaptar nombres/secretos)

```sql
CREATE ROLE programacion_app LOGIN PASSWORD 'REEMPLAZAR_PASSWORD_SEGURA';
GRANT CONNECT ON DATABASE programacion TO programacion_app;
GRANT USAGE ON SCHEMA public TO programacion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO programacion_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO programacion_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO programacion_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO programacion_app;
```

> Recomendación operativa: usar este SQL como plantilla y ejecutarlo con un rol administrativo fuera del runtime de aplicación. El repositorio incluye una versión parametrizable en `api/scripts/sql/create_app_role_template.sql` y una guía paso a paso en `docs/postgresql-dedicated-role.md`.

### Migración local SQLite -> PostgreSQL
La utilidad histórica de migración local quedó archivada en `NoNecesario/scripts/migrate_sqlite_to_postgres.py` para uso estrictamente local. No forma parte del baseline publicable ni del flujo recomendado del repositorio.

---

## 3. Seguridad de la Plataforma

La seguridad ha sido una prioridad en el diseño, implementando múltiples capas de defensa:

### 3.1 Autenticación y Gestión de Sesiones
*   **JWT (JSON Web Tokens):** Implementación robusta con tokens de acceso (15 min) y tokens de refresco (7 días).
*   **Logout Seguro:** Sistema de "Blacklisting" (Lista Negra) en base de datos (`RevokedToken`) para invalidar tokens inmediatamente al cerrar sesión.
*   **Hashing de Contraseñas:** Uso de `pbkdf2_sha256` para almacenamiento seguro de credenciales.

### 3.2 Autorización (RBAC)
*   **Middleware de Permisos:** Clase `PermissionChecker` que verifica roles y propiedad de recursos antes de permitir acciones críticas.
*   **Mitigación IDOR:** Validación estricta para asegurar que un usuario solo pueda modificar programaciones de funcionarios asignados a él o si es administrador.
*   **Superficie de configuración acotada:** `GET /api/config/configs` queda restringido a administradores; la lectura por clave solo permanece pública para una allowlist explícita y mínima (`header_info_text`) porque alimenta la barra informativa del header sin exponer el resto de configuraciones.

### 3.3 Protección de Datos e Integridad
*   **Sanitización de Entradas:** Uso de librería `bleach` para limpiar todos los campos de texto libre, previniendo ataques XSS (Cross-Site Scripting).
*   **Rate Limiting:** Implementación de `slowapi` para limitar intentos de login (5/minuto por IP) y proteger contra fuerza bruta.
*   **Cabeceras de Seguridad:** Middleware personalizado que inyecta cabeceras `HSTS`, `X-Content-Type-Options`, `X-Frame-Options` y `CSP`. La directiva `connect-src` se construye desde la URL efectiva del request más los orígenes configurados para CORS/WebSocket, evitando listas hardcodeadas solo locales siempre que exista configuración runtime.
*   **Bloqueo Optimista:** Control de concurrencia mediante versionado en la tabla `Programming` para evitar sobreescritura accidental de datos por múltiples usuarios simultáneos.

### 3.4 Auditoría
*   **Registro de Auditoría:** Sistema `AuditLogger` que registra todas las operaciones de creación, modificación y eliminación de programaciones en la tabla `OfficialAudit`, permitiendo trazabilidad forense.

---

## 4. Documentación de APIs

El backend expone una API RESTful documentada automáticamente.

### Acceso a Documentación Interactiva
*   **Swagger UI:** Disponible en `http://localhost:8000/docs` solo en local/dev o con `EXPOSE_API_DOCS=true`.
*   **ReDoc:** Disponible en `http://localhost:8000/redoc` solo en local/dev o con `EXPOSE_API_DOCS=true`.

### Endpoints Clave

#### Autenticación
*   `POST /api/users/login`: Inicia sesión y devuelve par de tokens.
*   `POST /api/users/refresh`: Renueva el token de acceso.
*   `POST /api/users/logout`: Revoca el token actual.

#### Programación
*   `GET /api/programming/`: Lista programaciones (con filtros).
*   `POST /api/programming/`: Crea una nueva programación.
*   `PUT /api/programming/{id}`: Actualiza una programación existente (con control de versiones).

---

## 5. Guías de Instalación y Configuración

### Prerrequisitos
*   Node.js v18+
*   Python 3.10+
*   Git

### Pasos de Instalación

1.  **Clonar el repositorio**
    ```bash
    git clone <url-del-repo>
    cd Programacion
    ```

2.  **Configurar Backend**
    ```bash
    # Crear entorno virtual
    python -m venv venv
    source venv/bin/activate  # o venv\Scripts\activate en Windows

    # Instalar dependencias
    python -m pip install -r requirements.txt

    # Configurar variables de entorno
    # Copiar .env a .env.local y completar:
    # SECRET_KEY=tu_clave_secreta_muy_larga
    # POSTGRES_PASSWORD=tu_password_local
    ```

3.  **Configurar Frontend**
    ```bash
    npm install
    ```

4.  **Levantar PostgreSQL local**
    ```bash
    docker compose --env-file .env.local up -d postgres
    ```

5.  **Iniciar el Proyecto**
    Usar arranque manual en terminales separadas:
    *   Terminal 1 (Backend): `python -m uvicorn api.main:app --reload --host 127.0.0.1 --port 8000`
    *   Terminal 2 (Frontend): `npm run dev`

    Los launchers históricos de Windows quedaron archivados en `NoNecesario/scripts/local-launchers/` solo para referencia local.

### Baseline GitHub-ready

El repositorio queda preparado para checks mínimos en GitHub Actions sin ejecutar build:

- `python -m pytest`
- `npm run test:run`
- `npm run check`

El workflow vive en `.github/workflows/security-readiness.yml`.

### Checklist de publicación GitHub-ready

Antes de publicar o abrir PR:

1. Verificar que `.env`, `.env.local`, bases locales (`*.db`) y caches no estén incluidos en el commit.
2. Confirmar que el baseline local sigue verde:
   - `python -m pytest`
   - `npm run test:run`
   - `npm run check`
3. Confirmar que Docker Desktop esté activo si tu `.env.local` usa `POSTGRES_*` para PostgreSQL local.
4. Revisar que la documentación de variables y riesgos abiertos siga alineada con el runtime real.
5. Publicar solo artefactos fuente; `dist/`, `coverage/`, `output/`, bases locales y `NoNecesario/` NO deben versionarse.

### Rollout / rollback recomendado

- Rollout local: iniciar PostgreSQL si aplica, levantar backend + frontend manualmente y después ejecutar la baseline de checks.
- Rollback de configuración local: quitar `DATABASE_URL` / `POSTGRES_*` de la configuración local para volver al fallback SQLite en desarrollo liviano.
- Rollback de código: revertir por lote (`repo hygiene`, `backend hardening`, `frontend runtime`) para aislar regresiones sin desmontar todo el cambio.

### Riesgos abiertos

- Producción todavía requiere definir el `DATABASE_URL` final y el motor objetivo; el cambio endurece el runtime, pero NO decide el despliegue productivo.
- La allowlist pública de configuraciones sigue limitada a `header_info_text`; si aparecen nuevas claves públicas deberá revisarse explícitamente.
- El baseline local con PostgreSQL depende de Docker Desktop tras reinicios del equipo.

---

## 6. Testing y Calidad

*   **Linting:** Configuración de ESLint para asegurar calidad de código en el frontend.
*   **Validación de Esquemas:** Uso extensivo de Pydantic en el backend para garantizar que los datos de entrada y salida cumplan con los formatos esperados.
*   **Manejo de Errores:** Sistema centralizado de excepciones HTTP para devolver mensajes de error consistentes y seguros al cliente.
*   **Baseline de verificación sin build:** `python -m pytest`, `npm run test:run`, `npm run check`.

---

## 7. Mantenimiento y Troubleshooting

### Logs
El backend emite logs detallados a la salida estándar (stdout), capturando:
*   Errores de validación.
*   Intentos de acceso no autorizado.
*   Operaciones críticas (creación/edición de datos).

### Problemas Comunes
*   **Error 401 Unauthorized:** El token ha expirado o ha sido revocado. El frontend intentará renovarlo automáticamente; si falla, redirigirá al login.
*   **Error 409 Conflict:** Otro usuario modificó la programación mientras la editabas. Recarga la página para obtener la última versión.
*   **Error de CORS / WebSocket origin:** Verifica `CORS_ALLOWED_ORIGINS`, `WEBSOCKET_ALLOWED_ORIGINS` y `TRUSTED_HOSTS`; la CSP `connect-src` ahora se alinea con esa misma configuración runtime en lugar de depender de una lista local fija en código.
