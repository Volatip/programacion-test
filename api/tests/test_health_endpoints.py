import json

from fastapi.responses import JSONResponse
from starlette.requests import Request

from api import main


def test_healthz_returns_lightweight_liveness_payload() -> None:
    response = main.healthz()

    assert response == {
        "status": "ok",
        "service": "dashboard-api",
        "checks": {
            "liveness": "ok",
        },
    }


def test_readyz_reports_ready_when_database_is_healthy(monkeypatch) -> None:
    calls: list[str] = []

    def fake_ensure_database_ready() -> None:
        calls.append("called")

    monkeypatch.setattr(main.database, "ensure_database_ready", fake_ensure_database_ready)

    response = main.readyz()

    assert calls == ["called"]
    assert response == {
        "status": "ready",
        "service": "dashboard-api",
        "checks": {
            "database": "ok",
            "schema": "compatible",
            "migrations": "up_to_date",
        },
    }


def test_readyz_returns_503_with_schema_failure_details(monkeypatch) -> None:
    def fake_ensure_database_ready() -> None:
        raise RuntimeError("Database schema is incomplete. Missing tables: users")

    monkeypatch.setattr(main.database, "ensure_database_ready", fake_ensure_database_ready)

    response = main.readyz()

    assert isinstance(response, JSONResponse)
    assert response.status_code == 503
    assert json.loads(bytes(response.body)) == {
        "status": "not_ready",
        "checks": {
            "database": "ok",
            "schema": "error",
            "migrations": "up_to_date",
        },
        "detail": "Database schema is incomplete. Missing tables: users",
    }


def test_readyz_returns_503_with_database_failure_details(monkeypatch) -> None:
    def fake_ensure_database_ready() -> None:
        raise RuntimeError("database connection refused")

    monkeypatch.setattr(main.database, "ensure_database_ready", fake_ensure_database_ready)

    response = main.readyz()

    assert isinstance(response, JSONResponse)
    assert response.status_code == 503
    assert json.loads(bytes(response.body)) == {
        "status": "not_ready",
        "checks": {
            "database": "error",
            "schema": "unknown",
            "migrations": "unknown",
        },
        "detail": "database connection refused",
    }


def test_readyz_returns_503_with_migration_failure_details(monkeypatch) -> None:
    def fake_ensure_database_ready() -> None:
        raise RuntimeError("Database migrations are out of date. Current revision(s): 0001. Expected head revision(s): 0002.")

    monkeypatch.setattr(main.database, "ensure_database_ready", fake_ensure_database_ready)

    response = main.readyz()

    assert isinstance(response, JSONResponse)
    assert response.status_code == 503
    assert json.loads(bytes(response.body)) == {
        "status": "not_ready",
        "checks": {
            "database": "ok",
            "schema": "error",
            "migrations": "error",
        },
        "detail": "Database migrations are out of date. Current revision(s): 0001. Expected head revision(s): 0002.",
    }


def test_build_csp_connect_sources_aligns_with_runtime_origins() -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "scheme": "https",
            "server": ("api.example.com", 443),
            "headers": [],
            "path": "/docs",
        }
    )

    sources = main.build_csp_connect_sources(
        request,
        ["https://app.example.com", "https://app.example.com/"],
        ["https://ws.example.com"],
    )

    assert sources == [
        "'self'",
        "https://api.example.com",
        "wss://api.example.com",
        "https://app.example.com",
        "https://ws.example.com",
        "wss://app.example.com",
        "wss://ws.example.com",
    ]
