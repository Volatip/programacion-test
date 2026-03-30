from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .limiter import limiter
from .routers import users, funcionarios, stats, groups, config, periods, programming
from . import models, database, auth, runtime_config
from .websockets import manager
import os


def should_expose_api_docs() -> bool:
    if runtime_config.env_flag("EXPOSE_API_DOCS", default=False):
        return True
    return runtime_config.get_runtime_environment() not in {"production", "prod"}


def get_docs_urls() -> tuple[str | None, str | None, str | None]:
    if not should_expose_api_docs():
        return None, None, None
    return "/openapi.json", "/docs", "/redoc"


def get_allowed_origins() -> list[str]:
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


def is_allowed_websocket_origin(origin: str | None, allowed_origins: list[str]) -> bool:
    if not origin:
        return True
    return origin in allowed_origins

async def rate_limit_exception_handler(request: Request, exc: Exception):
    return _rate_limit_exceeded_handler(request, exc)  # type: ignore[arg-type]

runtime_config.load_environment()

if runtime_config.should_create_schema_on_startup():
    models.Base.metadata.create_all(bind=database.engine)

openapi_url, docs_url, redoc_url = get_docs_urls()

app = FastAPI(title="Dashboard API", openapi_url=openapi_url, docs_url=docs_url, redoc_url=redoc_url)
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

        connect_src = [
            "'self'",
            "ws:",
            "wss:",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://localhost:5176",
            "http://127.0.0.1:5176",
        ]
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

origins = get_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
    if not is_allowed_websocket_origin(websocket.headers.get("origin"), origins):
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
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    db = database.SessionLocal()
    try:
        user = auth.get_user_from_token(token, db, expected_type="access")
        user_status = getattr(user, "status", None)
        if not isinstance(user_status, str) or user_status != "activo":
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await manager.connect(websocket, user, subprotocol=accepted_subprotocol)
        while True:
            data = await websocket.receive_text()
            if not manager.is_admin_connection(websocket):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except HTTPException as exc:
        print(f"WebSocket auth error: {exc.detail}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except Exception as e:
        print(f"WebSocket Error: {e}")
        manager.disconnect(websocket)
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to Dashboard API"}

@app.on_event("startup")
def create_initial_data():
    db = database.SessionLocal()
    try:
        enable_bootstrap_admin = runtime_config.should_bootstrap_admin()
        admin_email = os.getenv("ADMIN_EMAIL")
        admin_password = os.getenv("ADMIN_PASSWORD")
        admin_rut = os.getenv("ADMIN_RUT", "12345678-9")

        if not enable_bootstrap_admin:
            return

        if not admin_email or not admin_password:
            print("Skipping bootstrap admin creation: ADMIN_EMAIL or ADMIN_PASSWORD is missing.")
            return

        # Check if admin exists
        user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not user:
            print("Creating bootstrap admin user...")
            # Use the hashing function from auth module
            hashed_password = auth.get_password_hash(admin_password)
            db_user = models.User(
                email=admin_email,
                password_hash=hashed_password,
                name="Administrador",
                rut=admin_rut,
                role="admin", # Fixed to match frontend 'admin'
                status="activo"
            )
            db.add(db_user)
            db.commit()
            print(f"Bootstrap admin user created: {admin_email}")
    except Exception as e:
        print(f"Error creating initial data: {e}")
    finally:
        db.close()
