import asyncio

import pytest
from fastapi import status
from fastapi import HTTPException
from sqlalchemy import select
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


def test_login_accepts_raw_rut_without_formatting(db_session) -> None:
    active_user = models.User(
        email="admin@example.com",
        password_hash=auth.get_password_hash("Admin123!"),
        name="Administrador",
        rut="12.345.678-5",
        role="admin",
        status="activo",
    )
    db_session.add(active_user)
    db_session.commit()

    request = Request({"type": "http", "method": "POST", "path": "/api/users/login", "headers": []})
    response = users.login(request, schemas.UserLogin(rut="123456785", password="Admin123!"), db_session)

    assert response["token_type"] == "bearer"
    assert response["user"].rut == "12.345.678-5"


def test_get_user_from_token_rejects_hashed_revoked_token(db_session) -> None:
    active_user = make_user(user_id=32)
    db_session.add(active_user)
    db_session.commit()

    access_token = auth.create_access_token({"sub": active_user.rut})
    auth.revoke_token(db_session, access_token)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        auth.get_user_from_token(access_token, db_session, expected_type="access")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Token has been revoked"


def test_get_user_from_token_keeps_legacy_plaintext_revocation_compatibility(db_session) -> None:
    active_user = make_user(user_id=33)
    db_session.add(active_user)
    db_session.commit()

    access_token = auth.create_access_token({"sub": active_user.rut})
    db_session.add(models.RevokedToken(token_hash=auth.hash_token(access_token), token=access_token))
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        auth.get_user_from_token(access_token, db_session, expected_type="access")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Token has been revoked"


def test_refresh_stores_hashed_revoked_refresh_token(db_session) -> None:
    active_user = make_user(user_id=34)
    db_session.add(active_user)
    db_session.commit()

    refresh_token = auth.create_refresh_token({"sub": active_user.rut})
    request = Request({"type": "http", "method": "POST", "path": "/api/users/refresh", "headers": []})

    response = users.refresh_token(request, schemas.TokenRefresh(refresh_token=refresh_token), db_session)
    revoked_tokens = db_session.execute(select(models.RevokedToken)).scalars().all()

    assert response["refresh_token"] != refresh_token
    assert len(revoked_tokens) == 1
    assert revoked_tokens[0].token_hash == auth.hash_token(refresh_token)
    assert revoked_tokens[0].token is None


def test_logout_stores_only_token_hashes(db_session) -> None:
    active_user = make_user(user_id=35)
    db_session.add(active_user)
    db_session.commit()

    access_token = auth.create_access_token({"sub": active_user.rut})
    refresh_token = auth.create_refresh_token({"sub": active_user.rut})

    response = users.logout(
        logout_data=schemas.LogoutRequest(refresh_token=refresh_token),
        current_user=active_user,
        token=access_token,
        db=db_session,
    )
    revoked_tokens = db_session.execute(select(models.RevokedToken)).scalars().all()

    assert response == {"message": "Successfully logged out"}
    assert {row.token_hash for row in revoked_tokens} == {
        auth.hash_token(access_token),
        auth.hash_token(refresh_token),
    }
    assert all(row.token is None for row in revoked_tokens)


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
