import asyncio

import pytest
from fastapi import status
from fastapi import HTTPException
from starlette.requests import Request

from api import auth, main, models, schemas
from api.routers import users


def make_user(*, user_id: int, role: str = "user", status_value: str = "activo") -> models.User:
    return models.User(
        id=user_id,
        email=f"user-{user_id}@example.com",
        password_hash=auth.get_password_hash("secret"),
        name=f"User {user_id}",
        rut=f"{user_id}-K",
        role=role,
        status=status_value,
    )


class FakeWebSocket:
    def __init__(self, headers: dict[str, str]):
        self.headers = headers
        self.close_code: int | None = None
        self.accepted_subprotocol: str | None = None

    async def accept(self, subprotocol: str | None = None):
        self.accepted_subprotocol = subprotocol

    async def close(self, code: int):
        self.close_code = code

    async def receive_text(self) -> str:
        raise AssertionError("receive_text should not be called for rejected websocket connections")


def test_refresh_rejects_inactive_user(db_session) -> None:
    inactive_user = make_user(user_id=30, status_value="inactivo")
    db_session.add(inactive_user)
    db_session.commit()

    refresh_token = auth.create_refresh_token({"sub": inactive_user.rut})
    request = Request({"type": "http", "method": "POST", "path": "/api/users/refresh", "headers": []})

    with pytest.raises(HTTPException) as exc_info:
        users.refresh_token(request, schemas.TokenRefresh(refresh_token=refresh_token), db_session)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Inactive user"


def test_websocket_rejects_missing_bearer_subprotocol() -> None:
    websocket = FakeWebSocket({"origin": "http://localhost:5173"})

    asyncio.run(main.websocket_endpoint(websocket))

    assert websocket.close_code == status.WS_1008_POLICY_VIOLATION
    assert websocket.accepted_subprotocol is None


def test_websocket_rejects_inactive_user_token(monkeypatch, db_session) -> None:
    inactive_user = make_user(user_id=31, role="admin", status_value="inactivo")
    db_session.add(inactive_user)
    db_session.commit()

    access_token = auth.create_access_token({"sub": inactive_user.rut})
    websocket = FakeWebSocket(
        {
            "origin": "http://localhost:5173",
            "sec-websocket-protocol": f"bearer, {access_token}",
        }
    )

    monkeypatch.setattr(main.database, "SessionLocal", lambda: db_session)

    asyncio.run(main.websocket_endpoint(websocket))

    assert websocket.close_code == status.WS_1008_POLICY_VIOLATION
    assert websocket.accepted_subprotocol is None
