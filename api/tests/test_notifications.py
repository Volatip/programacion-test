from api import auth, models, schemas
from api.routers import notifications as notifications_router


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


def test_mark_notifications_as_read_updates_only_requested_ids(db_session) -> None:
    current_user = make_user(user_id=1201)
    other_user = make_user(user_id=1202)
    db_session.add_all([current_user, other_user])
    db_session.flush()

    target_notification = models.UserNotification(
        user_id=current_user.id,
        type="review_fix_required",
        title="Revisar programación",
        message="Observación larga para validar lectura individual.",
    )
    untouched_notification = models.UserNotification(
        user_id=current_user.id,
        type="review_fix_required",
        title="Completar programación",
        message="Pendiente de ajuste.",
    )
    foreign_notification = models.UserNotification(
        user_id=other_user.id,
        type="review_fix_required",
        title="Ajena",
        message="No debe tocarse.",
    )
    db_session.add_all([target_notification, untouched_notification, foreign_notification])
    db_session.commit()

    response = notifications_router.mark_notifications_as_read(
        schemas.NotificationReadRequest(ids=[target_notification.id]),
        db_session,
        current_user,
    )

    db_session.refresh(target_notification)
    db_session.refresh(untouched_notification)
    db_session.refresh(foreign_notification)

    assert response.updated == 1
    assert target_notification.read_at is not None
    assert untouched_notification.read_at is None
    assert foreign_notification.read_at is None


def test_read_notifications_summary_counts_only_unread_for_current_user(db_session) -> None:
    current_user = make_user(user_id=1203)
    other_user = make_user(user_id=1204)
    db_session.add_all([current_user, other_user])
    db_session.flush()

    unread_notification = models.UserNotification(
        user_id=current_user.id,
        type="review_fix_required",
        title="Pendiente",
        message="Debe contarse.",
    )
    read_notification = models.UserNotification(
        user_id=current_user.id,
        type="review_fix_required",
        title="Leída",
        message="No debe contarse.",
    )
    other_user_notification = models.UserNotification(
        user_id=other_user.id,
        type="review_fix_required",
        title="Ajena",
        message="No debe contarse.",
    )
    db_session.add_all([unread_notification, read_notification, other_user_notification])
    db_session.commit()

    notifications_router.mark_notifications_as_read(
        schemas.NotificationReadRequest(ids=[read_notification.id]),
        db_session,
        current_user,
    )

    summary = notifications_router.read_notifications_summary(db_session, current_user)

    assert summary.unread_count == 1
