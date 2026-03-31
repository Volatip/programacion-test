from __future__ import annotations

import ipaddress

from fastapi import Request
from jose import JWTError, jwt
from sqlalchemy.orm import Query, Session

from . import auth, models


MAX_USER_AGENT_LENGTH = 512
MAX_FAILURE_REASON_LENGTH = 255
MAX_PATH_LENGTH = 255

EVENT_LOGIN_SUCCESS = "login_success"
EVENT_LOGIN_FAILURE = "login_failure"
EVENT_LOGOUT = "logout"
EVENT_SESSION_VALIDATED = "session_validated"
EVENT_REFRESH_SUCCESS = "refresh_success"


def _truncate(value: str | None, max_length: int) -> str | None:
    if not value:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    return normalized[:max_length]


def _normalize_ip_candidate(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    if candidate.startswith("[") and "]" in candidate:
        candidate = candidate[1:candidate.index("]")]
    elif candidate.count(":") == 1 and "." in candidate:
        host, _, port = candidate.partition(":")
        if port.isdigit():
            candidate = host

    try:
        return str(ipaddress.ip_address(candidate))
    except ValueError:
        return None


def extract_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    for candidate in forwarded_for.split(","):
        normalized_candidate = _normalize_ip_candidate(candidate)
        if normalized_candidate:
            return normalized_candidate

    real_ip = _normalize_ip_candidate(request.headers.get("x-real-ip"))
    if real_ip:
        return real_ip

    client = request.client
    if client is None:
        return None
    return _normalize_ip_candidate(client.host)


def extract_session_jti_hash(token: str | None) -> str | None:
    if not token:
        return None

    try:
        payload = jwt.get_unverified_claims(token)
    except JWTError:
        return None

    jti = payload.get("jti")
    if not isinstance(jti, str) or not jti:
        return None
    return auth.hash_token(jti)


def log_session_event(
    db: Session,
    request: Request,
    *,
    event_type: str,
    success: bool,
    user: models.User | None = None,
    user_rut: str | None = None,
    token: str | None = None,
    failure_reason: str | None = None,
) -> models.SessionAuditEvent:
    event = models.SessionAuditEvent(
        user_id=user.id if user else None,
        user_rut=_truncate(user_rut or getattr(user, "rut", None), 64),
        event_type=event_type,
        success=success,
        ip_address=extract_client_ip(request),
        user_agent=_truncate(request.headers.get("user-agent"), MAX_USER_AGENT_LENGTH),
        session_jti_hash=extract_session_jti_hash(token),
        failure_reason=_truncate(failure_reason, MAX_FAILURE_REASON_LENGTH),
        request_path=_truncate(request.url.path, MAX_PATH_LENGTH),
    )
    db.add(event)
    return event


def build_session_events_query(
    db: Session,
    *,
    user_id: int | None = None,
    event_type: str | None = None,
    success: bool | None = None,
) -> Query[models.SessionAuditEvent]:
    query: Query[models.SessionAuditEvent] = db.query(models.SessionAuditEvent)

    if user_id is not None:
        query = query.filter(models.SessionAuditEvent.user_id == user_id)
    if event_type:
        query = query.filter(models.SessionAuditEvent.event_type == event_type)
    if success is not None:
        query = query.filter(models.SessionAuditEvent.success == success)

    return query.order_by(models.SessionAuditEvent.occurred_at.desc(), models.SessionAuditEvent.id.desc())
