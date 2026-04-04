from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import auth, database, models, schemas
from ..dismiss_reasons import read_dismiss_reasons
from ..permissions import PermissionChecker

router = APIRouter()


def serialize_reason(reason: models.DismissReason) -> schemas.DismissReasonResponse:
    suboptions = sorted(reason.suboptions, key=lambda item: (item.sort_order, item.name.lower()))
    return schemas.DismissReasonResponse(
        id=reason.id,
        name=reason.name,
        description=reason.description or "",
        action_type=reason.action_type,
        reason_category=reason.reason_category,
        sort_order=reason.sort_order,
        is_active=reason.is_active,
        suboptions=[
            schemas.DismissReasonSuboptionResponse(
                id=suboption.id,
                name=suboption.name,
                description=suboption.description or "",
                sort_order=suboption.sort_order,
            )
            for suboption in suboptions
        ],
    )


@router.get("/reasons", response_model=list[schemas.DismissReasonResponse])
def list_dismiss_reasons(
    active_only: bool = Query(True),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if not active_only:
        PermissionChecker.check_can_manage_dismiss_reasons(current_user)
    reasons = read_dismiss_reasons(db, active_only=active_only)
    return [serialize_reason(reason) for reason in reasons]


@router.post("/reasons", response_model=schemas.DismissReasonResponse, status_code=status.HTTP_201_CREATED)
def create_dismiss_reason(
    payload: schemas.DismissReasonCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_dismiss_reasons(current_user)

    reason = models.DismissReason(
        name=payload.name.strip(),
        description=payload.description.strip(),
        action_type=payload.action_type,
        reason_category=payload.reason_category,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    reason.suboptions = [
        models.DismissReasonSuboption(
            name=suboption.name.strip(),
            description=suboption.description.strip(),
            sort_order=suboption.sort_order,
        )
        for suboption in payload.suboptions
    ]
    db.add(reason)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un motivo o subopción con ese nombre.")

    db.refresh(reason)
    return serialize_reason(reason)


@router.put("/reasons/{reason_id}", response_model=schemas.DismissReasonResponse)
def update_dismiss_reason(
    reason_id: int,
    payload: schemas.DismissReasonUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_dismiss_reasons(current_user)
    reason = db.query(models.DismissReason).filter(models.DismissReason.id == reason_id).first()
    if reason is None:
        raise HTTPException(status_code=404, detail="Reason not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        if isinstance(value, str):
            setattr(reason, field_name, value.strip())
        else:
            setattr(reason, field_name, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe un motivo con ese nombre.")

    db.refresh(reason)
    return serialize_reason(reason)


@router.delete("/reasons/{reason_id}")
def delete_dismiss_reason(
    reason_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_dismiss_reasons(current_user)
    reason = db.query(models.DismissReason).filter(models.DismissReason.id == reason_id).first()
    if reason is None:
        raise HTTPException(status_code=404, detail="Reason not found")

    db.delete(reason)
    db.commit()
    return {"message": "Reason deleted"}


@router.post("/reasons/{reason_id}/suboptions", response_model=schemas.DismissReasonResponse, status_code=status.HTTP_201_CREATED)
def create_dismiss_suboption(
    reason_id: int,
    payload: schemas.DismissReasonSuboptionCreate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_dismiss_reasons(current_user)
    reason = db.query(models.DismissReason).filter(models.DismissReason.id == reason_id).first()
    if reason is None:
        raise HTTPException(status_code=404, detail="Reason not found")

    db.add(models.DismissReasonSuboption(
        reason_id=reason.id,
        name=payload.name.strip(),
        description=payload.description.strip(),
        sort_order=payload.sort_order,
    ))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una subopción con ese nombre para este motivo.")

    db.refresh(reason)
    return serialize_reason(reason)


@router.put("/suboptions/{suboption_id}", response_model=schemas.DismissReasonResponse)
def update_dismiss_suboption(
    suboption_id: int,
    payload: schemas.DismissReasonSuboptionUpdate,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_dismiss_reasons(current_user)
    suboption = db.query(models.DismissReasonSuboption).filter(models.DismissReasonSuboption.id == suboption_id).first()
    if suboption is None:
        raise HTTPException(status_code=404, detail="Suboption not found")

    updates = payload.model_dump(exclude_unset=True)
    for field_name, value in updates.items():
        if isinstance(value, str):
            setattr(suboption, field_name, value.strip())
        else:
            setattr(suboption, field_name, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una subopción con ese nombre para este motivo.")

    db.refresh(suboption.reason)
    return serialize_reason(suboption.reason)


@router.delete("/suboptions/{suboption_id}", response_model=schemas.DismissReasonResponse)
def delete_dismiss_suboption(
    suboption_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_dismiss_reasons(current_user)
    suboption = db.query(models.DismissReasonSuboption).filter(models.DismissReasonSuboption.id == suboption_id).first()
    if suboption is None:
        raise HTTPException(status_code=404, detail="Suboption not found")

    reason = suboption.reason
    db.delete(suboption)
    db.commit()
    db.refresh(reason)
    return serialize_reason(reason)
