from contextlib import asynccontextmanager
import logging
from urllib.parse import urlsplit, urlunsplit

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter
from .routers import users, funcionarios, stats, groups, config, periods, programming
from . import models, database, auth, runtime_config
from .websockets import manager
import os


def configure_logging() -> None:
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return

    log_level_name = (runtime_config.get_env("LOG_LEVEL", "INFO") or "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


logger = logging.getLogger("api.main")


def normalize_origin(origin: str) -> str | None:
    raw_origin = (origin or "").strip()
    if not raw_origin:
        return None

    parsed = urlsplit(raw_origin)
    if not parsed.scheme or not parsed.netloc:
        return None

    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), "", "", ""))


def to_websocket_origin(origin: str) -> str | None:
    normalized_origin = normalize_origin(origin)
    if not normalized_origin:
        return None

    parsed = urlsplit(normalized_origin)
    scheme = parsed.scheme
    if scheme == "http":
        ws_scheme = "ws"
    elif scheme == "https":
        ws_scheme = "wss"
    elif scheme in {"ws", "wss"}:
        ws_scheme = scheme
    else:
        return None

    return urlunsplit((ws_scheme, parsed.netloc, "", "", ""))


def build_csp_connect_sources(
    request: Request,
    cors_allowed_origins: list[str],
    websocket_allowed_origins: list[str],
) -> list[str]:
    sources: list[str] = ["'self'"]
    seen = {"'self'"}

    request_origin = normalize_origin(str(request.base_url))
    websocket_request_origin = to_websocket_origin(str(request.base_url))

    for candidate in (
        request_origin,
        websocket_request_origin,
        *[normalize_origin(origin) for origin in cors_allowed_origins],
        *[normalize_origin(origin) for origin in websocket_allowed_origins],
        *[to_websocket_origin(origin) for origin in cors_allowed_origins],
        *[to_websocket_origin(origin) for origin in websocket_allowed_origins],
    ):
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        sources.append(candidate)

    return sources


def should_expose_api_docs() -> bool:
    if runtime_config.env_flag("EXPOSE_API_DOCS", default=False):
        return True
    return runtime_config.get_runtime_environment() not in {"production", "prod"}


def get_docs_urls() -> tuple[str | None, str | None, str | None]:
    if not should_expose_api_docs():
        return None, None, None
    return "/openapi.json", "/docs", "/redoc"


def get_allowed_origins() -> list[str]:
    return runtime_config.get_allowed_origins()


def get_websocket_allowed_origins() -> list[str]:
    return runtime_config.get_websocket_allowed_origins()


def get_trusted_hosts() -> list[str]:
    return runtime_config.get_trusted_hosts()


def is_allowed_websocket_origin(origin: str | None, allowed_origins: list[str]) -> bool:
    if not origin:
        return True
    return origin in allowed_origins

async def rate_limit_exception_handler(request: Request, exc: Exception):
    return _rate_limit_exceeded_handler(request, exc)  # type: ignore[arg-type]

runtime_config.load_environment()
configure_logging()

openapi_url, docs_url, redoc_url = get_docs_urls()


def bootstrap_initial_data() -> None:
    db = database.SessionLocal()
    try:
        enable_bootstrap_admin = runtime_config.should_bootstrap_admin()
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        admin_rut = os.getenv("ADMIN_RUT", "12345678-9")

        if not enable_bootstrap_admin:
            logger.info("Bootstrap admin disabled by runtime configuration")
            return

        if not admin_email or not admin_password:
            logger.warning(
                "Skipping bootstrap admin creation because ADMIN_EMAIL or ADMIN_PASSWORD is missing"
            )
            return

        user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not user:
            logger.info("Creating bootstrap admin user for configured admin email")
            hashed_password = auth.get_password_hash(admin_password)
            db_user = models.User(
                email=admin_email,
                password_hash=hashed_password,
                name="Administrador",
                rut=admin_rut,
                role="admin",
                status="activo"
            )
            db.add(db_user)
            db.commit()
            logger.info("Bootstrap admin user created for %s", admin_email)
            return

        logger.info("Bootstrap admin user already exists for %s", admin_email)
    except Exception:
        db.rollback()
        logger.exception("Bootstrap admin initialization failed")
        raise
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting Dashboard API")
    if runtime_config.should_create_schema_on_startup():
        logger.info("Schema auto-create enabled; ensuring schema exists before readiness checks")
        database.create_schema()

    logger.info("Running database readiness check during startup")
    database.ensure_database_ready()
    logger.info("Database readiness check passed")
    bootstrap_initial_data()
    logger.info("Dashboard API startup completed")
    yield
    logger.info("Dashboard API shutdown completed")


app = FastAPI(title="Dashboard API", openapi_url=openapi_url, docs_url=docs_url, redoc_url=redoc_url, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exception_handler)

# Security Headers Middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if runtime_config.env_flag("ENABLE_HSTS", default=False):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        connect_src = build_csp_connect_sources(request, cors_origins, websocket_origins)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            f"connect-src {' '.join(connect_src)};"
        )
        if request.url.path in {"/api/users/login", "/api/users/refresh", "/api/users/logout", "/api/users/me"}:
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

cors_origins = get_allowed_origins()
websocket_origins = get_websocket_allowed_origins()
trusted_hosts = get_trusted_hosts()

app.add_middleware(TrustedHostMiddleware, allowed_hosts=trusted_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(funcionarios.router, prefix="/api/funcionarios", tags=["funcionarios"])
app.include_router(groups.router, prefix="/api/groups", tags=["groups"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(periods.router, prefix="/api/periods", tags=["periods"])
app.include_router(programming.router, prefix="/api/programming", tags=["programming"])

@app.websocket("/ws/info-bar")
async def websocket_endpoint(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if not is_allowed_websocket_origin(origin, websocket_origins):
        logger.warning("Rejected websocket connection from non-allowed origin: %s", origin)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    protocol_header = websocket.headers.get("sec-websocket-protocol", "")
    protocols = [value.strip() for value in protocol_header.split(",") if value.strip()]

    token = None
    accepted_subprotocol = None

    if len(protocols) >= 2 and protocols[0].lower() == "bearer":
        token = protocols[1]
        accepted_subprotocol = protocols[0]

    if not token:
        logger.warning("Rejected websocket connection because bearer token subprotocol is missing")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = database.SessionLocal()
    try:
        user = auth.get_user_from_token(token, db, expected_type="access")
        user_status = getattr(user, "status", None)
        if not isinstance(user_status, str) or user_status != "activo":
            logger.warning("Rejected websocket connection for inactive user")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await manager.connect(websocket, user, subprotocol=accepted_subprotocol)
        while True:
            data = await websocket.receive_text()
            if not manager.is_admin_connection(websocket):
                logger.warning("Rejected websocket message from non-admin connection")
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except HTTPException as exc:
        logger.warning("WebSocket auth error: %s", exc.detail)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception:
        logger.exception("Unhandled websocket error")
        manager.disconnect(websocket)
    finally:
        db.close()


def build_readiness_failure_payload(exc: Exception) -> dict[str, object]:
    detail = str(exc)
    payload = {
        "status": "not_ready",
        "checks": {
            "database": "ok",
            "schema": "compatible",
            "migrations": "up_to_date",
        },
        "detail": detail,
    }

    detail_lower = detail.lower()
    if (
        "migration" in detail_lower
        or "alembic" in detail_lower
        or "revision" in detail_lower
        or "stamp" in detail_lower
    ):
        payload["checks"]["schema"] = "error"
        payload["checks"]["migrations"] = "error"
    elif "schema" in detail_lower or "missing table" in detail_lower or "missing column" in detail_lower:
        payload["checks"]["schema"] = "error"
    else:
        payload["checks"]["database"] = "error"
        payload["checks"]["schema"] = "unknown"
        payload["checks"]["migrations"] = "unknown"

    return payload


@app.get("/healthz")
def healthz() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "dashboard-api",
        "checks": {
            "liveness": "ok",
        },
    }


@app.get("/readyz", response_model=None)
def readyz() -> object:
    try:
        database.ensure_database_ready()
    except Exception as exc:
        logger.exception("Readiness probe failed")
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=build_readiness_failure_payload(exc))

    return {
        "status": "ready",
        "service": "dashboard-api",
        "checks": {
            "database": "ok",
            "schema": "compatible",
            "migrations": "up_to_date",
        },
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to Dashboard API"}
