from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from .. import models, schemas, database, auth
from ..permissions import PermissionChecker

router = APIRouter()

@router.get("", response_model=List[schemas.GroupResponse])
def read_groups(
    user_id: Optional[int] = None, 
    period_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    effective_user_id = PermissionChecker.resolve_user_scope(current_user, user_id)

    # Query groups with a count of associated officials (unique persons by RUT)
    query = db.query(
        models.Group,
        func.count(func.distinct(models.Funcionario.rut)).label("count")
    ).outerjoin(
        models.UserOfficial,
        models.Group.id == models.UserOfficial.group_id
    ).outerjoin(
        models.Funcionario,
        (models.UserOfficial.funcionario_id == models.Funcionario.id) & (models.Funcionario.status == 'activo') # Filter active only
    ).group_by(models.Group.id)

    if effective_user_id is not None:
        query = query.filter(models.Group.user_id == effective_user_id)

    if period_id is not None:
        query = query.filter(models.Group.period_id == period_id)
    
    results = query.offset(skip).limit(limit).all()
    
    # Map results to schema
    return [
        {**group.__dict__, "count": count} 
        for group, count in results
    ]

@router.post("", response_model=schemas.GroupResponse)
def create_group(
    group: schemas.GroupCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.require_read_only_access(current_user)
    owner_id = current_user.id if group.user_id is None else PermissionChecker.resolve_user_scope(current_user, group.user_id)

    target_period_id = group.period_id
    if target_period_id is None:
        active_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.status == "ACTIVO").first()
        if active_period is None:
            active_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).first()
        if active_period is None:
            raise HTTPException(status_code=400, detail="No hay un período activo para crear el grupo")
        target_period_id = active_period.id

    db_group = models.Group(name=group.name, user_id=owner_id, period_id=target_period_id)
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group

@router.put("/{group_id}", response_model=schemas.GroupResponse)
def update_group(
    group_id: int, 
    group_update: schemas.GroupUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.require_read_only_access(current_user)
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")

    PermissionChecker.check_can_manage_group(current_user, group_id, db)
    
    update_data = group_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_group, key, value)
    
    db.commit()
    db.refresh(db_group)
    return db_group

@router.delete("/{group_id}")
def delete_group(
    group_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.require_read_only_access(current_user)
    db_group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Group not found")

    PermissionChecker.check_can_manage_group(current_user, group_id, db)
    
    # Check if there are officials assigned to this group?
    # If we delete the group, the foreign key in UserOfficial is nullable, 
    # but we might want to manually nullify them if cascading isn't set up to do so 
    # or if we want to be explicit.
    # Default behavior depends on DB. Assuming it's fine or we can just delete.
    # If the FK has ON DELETE SET NULL, it's automatic. SQLAlchemy default is usually NO ACTION.
    # Let's manually set them to null to be safe.
    
    officials = db.query(models.UserOfficial).filter(models.UserOfficial.group_id == group_id).all()
    for official in officials:
        setattr(official, "group_id", None)
    
    db.delete(db_group)
    db.commit()
    return {"message": "Group deleted successfully"}
