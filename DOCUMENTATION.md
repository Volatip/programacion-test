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
*   Copiar `.env.example` a `.env.local` (no incluido en control de versiones).
*   Variables clave: `SECRET_KEY`, `DATABASE_URL` o `POSTGRES_*`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.

### PostgreSQL local con Docker
1. Copiar `.env.example` a `.env.local` y completar valores reales, especialmente `SECRET_KEY` y `POSTGRES_PASSWORD`.
2. Levantar PostgreSQL local:
   ```bash
   docker compose --env-file .env.local up -d postgres
   ```
3. Iniciar backend y frontend de forma habitual. En local, si `DATABASE_URL` no está definido pero existen `POSTGRES_*`, el backend construye la conexión automáticamente. El puerto recomendado para Docker es `5433` salvo que tengas la certeza de que `5432` está libre.
4. Si no quieres usar Docker en un flujo puntual, puedes omitir `DATABASE_URL` y `POSTGRES_*`; el backend seguirá cayendo a SQLite solo en local/dev.

> Importante: este lote NO migra datos existentes. Un contenedor nuevo parte con una base vacía y el backend crea el esquema solo en runtime local.

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
*   **Cabeceras de Seguridad:** Middleware personalizado que inyecta cabeceras `HSTS`, `X-Content-Type-Options`, `X-Frame-Options` y `CSP`.
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
    # Copiar .env.example a .env.local y completar:
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
*   **Error de CORS:** Verifica que el origen del frontend esté listado en `origins` en `api/main.py`.
