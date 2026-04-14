from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import auth, database, models, schemas

router = APIRouter()


@router.get("/summary", response_model=schemas.NotificationSummaryResponse)
def read_notifications_summary(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    unread_count = db.query(models.UserNotification).filter(
        models.UserNotification.user_id == current_user.id,
        models.UserNotification.read_at.is_(None),
    ).count()
    return schemas.NotificationSummaryResponse(unread_count=unread_count)


@router.get("", response_model=list[schemas.NotificationResponse])
def read_notifications(
    status: str = Query(default="unread", pattern="^(unread|all)$"),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    query = db.query(models.UserNotification).filter(models.UserNotification.user_id == current_user.id)
    if status == "unread":
        query = query.filter(models.UserNotification.read_at.is_(None))
    return query.order_by(models.UserNotification.created_at.desc(), models.UserNotification.id.desc()).all()


@router.post("/read", response_model=schemas.NotificationReadResponse)
def mark_notifications_as_read(
    payload: schemas.NotificationReadRequest,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    query = db.query(models.UserNotification).filter(models.UserNotification.user_id == current_user.id)
    if payload.all:
        notifications = query.filter(models.UserNotification.read_at.is_(None)).all()
    elif payload.ids:
        notifications = query.filter(models.UserNotification.id.in_(payload.ids)).all()
    else:
        notifications = []

    now = datetime.utcnow()
    updated = 0
    for notification in notifications:
        if notification.read_at is None:
            notification.read_at = now
            updated += 1

    db.commit()
    return schemas.NotificationReadResponse(updated=updated)
