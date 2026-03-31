import asyncio

import pytest
from fastapi import status
from fastapi import HTTPException
from sqlalchemy import select
from starlette.requests import Request

from api import auth, main, models, schemas, session_audit
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


def make_request(
    path: str,
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
    client: tuple[str, int] = ("127.0.0.1", 12345),
) -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": headers or [],
            "client": client,
        }
    )


def test_refresh_rejects_inactive_user(db_session) -> None:
    inactive_user = make_user(user_id=30, status_value="inactivo")
    db_session.add(inactive_user)
    db_session.commit()

    refresh_token = auth.create_refresh_token({"sub": inactive_user.rut})
    request = make_request("/api/users/refresh")

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

    request = make_request(
        "/api/users/login",
        headers=[
            (b"user-agent", b"pytest-agent/1.0"),
            (b"x-forwarded-for", b"203.0.113.10, 10.0.0.2"),
        ],
    )
    response = users.login(request, schemas.UserLogin(rut="123456785", password="Admin123!"), db_session)
    audit_events = db_session.execute(select(models.SessionAuditEvent)).scalars().all()

    assert response["token_type"] == "bearer"
    assert response["user"].rut == "12.345.678-5"
    assert len(audit_events) == 1
    assert audit_events[0].event_type == session_audit.EVENT_LOGIN_SUCCESS
    assert audit_events[0].success is True
    assert audit_events[0].ip_address == "203.0.113.10"
    assert audit_events[0].user_agent == "pytest-agent/1.0"
    assert audit_events[0].session_jti_hash is not None


def test_login_failure_creates_audit_event(db_session) -> None:
    request = make_request(
        "/api/users/login",
        headers=[(b"x-real-ip", b"198.51.100.25"), (b"user-agent", b"bad-actor/2.0")],
    )

    with pytest.raises(HTTPException) as exc_info:
        users.login(request, schemas.UserLogin(rut="123456785", password="incorrecta"), db_session)

    audit_events = db_session.execute(select(models.SessionAuditEvent)).scalars().all()

    assert exc_info.value.status_code == 401
    assert len(audit_events) == 1
    assert audit_events[0].event_type == session_audit.EVENT_LOGIN_FAILURE
    assert audit_events[0].success is False
    assert audit_events[0].failure_reason == "invalid_credentials"
    assert audit_events[0].user_rut == "12.345.678-5"
    assert audit_events[0].ip_address == "198.51.100.25"


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
    request = make_request("/api/users/refresh")

    response = users.refresh_token(request, schemas.TokenRefresh(refresh_token=refresh_token), db_session)
    revoked_tokens = db_session.execute(select(models.RevokedToken)).scalars().all()
    audit_events = db_session.execute(select(models.SessionAuditEvent)).scalars().all()

    assert response["refresh_token"] != refresh_token
    assert len(revoked_tokens) == 1
    assert revoked_tokens[0].token_hash == auth.hash_token(refresh_token)
    assert revoked_tokens[0].token is None
    assert len(audit_events) == 1
    assert audit_events[0].event_type == session_audit.EVENT_REFRESH_SUCCESS
    assert audit_events[0].success is True


def test_logout_stores_only_token_hashes(db_session) -> None:
    active_user = make_user(user_id=35)
    db_session.add(active_user)
    db_session.commit()

    access_token = auth.create_access_token({"sub": active_user.rut})
    refresh_token = auth.create_refresh_token({"sub": active_user.rut})

    response = users.logout(
        request=make_request("/api/users/logout", headers=[(b"user-agent", b"logout-agent/1.0")]),
        logout_data=schemas.LogoutRequest(refresh_token=refresh_token),
        current_user=active_user,
        token=access_token,
        db=db_session,
    )
    revoked_tokens = db_session.execute(select(models.RevokedToken)).scalars().all()
    audit_events = db_session.execute(select(models.SessionAuditEvent)).scalars().all()

    assert response == {"message": "Successfully logged out"}
    assert {row.token_hash for row in revoked_tokens} == {
        auth.hash_token(access_token),
        auth.hash_token(refresh_token),
    }
    assert all(row.token is None for row in revoked_tokens)
    assert len(audit_events) == 1
    assert audit_events[0].event_type == session_audit.EVENT_LOGOUT
    assert audit_events[0].user_id == active_user.id
    assert audit_events[0].user_agent == "logout-agent/1.0"


def test_me_logs_session_validation_event(db_session) -> None:
    active_user = make_user(user_id=36)
    db_session.add(active_user)
    db_session.commit()

    response = users.read_users_me(
        request=make_request("/api/users/me", client=("192.0.2.55", 9000)),
        current_user=active_user,
        db=db_session,
    )
    audit_events = db_session.execute(select(models.SessionAuditEvent)).scalars().all()

    assert response.id == active_user.id
    assert len(audit_events) == 1
    assert audit_events[0].event_type == session_audit.EVENT_SESSION_VALIDATED
    assert audit_events[0].success is True
    assert audit_events[0].ip_address == "192.0.2.55"


def test_admin_can_filter_session_events(db_session) -> None:
    admin_user = make_user(user_id=37, role="admin")
    regular_user = make_user(user_id=38)
    db_session.add_all([admin_user, regular_user])
    db_session.commit()

    db_session.add_all(
        [
            models.SessionAuditEvent(user_id=regular_user.id, user_rut=regular_user.rut, event_type=session_audit.EVENT_LOGIN_SUCCESS, success=True),
            models.SessionAuditEvent(user_id=regular_user.id, user_rut=regular_user.rut, event_type=session_audit.EVENT_LOGIN_FAILURE, success=False, failure_reason="invalid_credentials"),
            models.SessionAuditEvent(user_id=admin_user.id, user_rut=admin_user.rut, event_type=session_audit.EVENT_LOGOUT, success=True),
        ]
    )
    db_session.commit()

    response = users.read_session_events(
        user_id=regular_user.id,
        event_type=session_audit.EVENT_LOGIN_FAILURE,
        success=False,
        db=db_session,
        current_user=admin_user,
    )

    assert len(response) == 1
    assert response[0].user_id == regular_user.id
    assert response[0].event_type == session_audit.EVENT_LOGIN_FAILURE


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
