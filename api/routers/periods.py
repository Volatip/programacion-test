from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import models, schemas, database, auth
from datetime import datetime

router = APIRouter()


def delete_related_period_data(db: Session, period_id: int):
    """
    Remove records linked to a programming period before deleting it.
    Keeps current schema stable and avoids orphaned rows when DB-level cascades
    are not configured for all relations.
    """
    officials = db.query(models.Funcionario).filter(models.Funcionario.period_id == period_id).all()
    official_ids = [official.id for official in officials]

    if official_ids:
        db.query(models.Schedule).filter(models.Schedule.funcionario_id.in_(official_ids)).delete(synchronize_session=False)
        db.query(models.UserOfficial).filter(models.UserOfficial.funcionario_id.in_(official_ids)).delete(synchronize_session=False)

    programming_ids = [row[0] for row in db.query(models.Programming.id).filter(models.Programming.period_id == period_id).all()]
    if programming_ids:
        db.query(models.ProgrammingItem).filter(models.ProgrammingItem.programming_id.in_(programming_ids)).delete(synchronize_session=False)

    db.query(models.Programming).filter(models.Programming.period_id == period_id).delete(synchronize_session=False)
    db.query(models.SpecialtyStat).filter(
        models.SpecialtyStat.specialty_id.in_(
            db.query(models.Specialty.id).filter(models.Specialty.period_id == period_id)
        )
    ).delete(synchronize_session=False)
    db.query(models.Specialty).filter(models.Specialty.period_id == period_id).delete(synchronize_session=False)
    db.query(models.Process).filter(models.Process.period_id == period_id).delete(synchronize_session=False)
    db.query(models.ActivityType).filter(models.ActivityType.period_id == period_id).delete(synchronize_session=False)
    db.query(models.PerformanceUnit).filter(models.PerformanceUnit.period_id == period_id).delete(synchronize_session=False)

    if official_ids:
        db.query(models.Funcionario).filter(models.Funcionario.period_id == period_id).delete(synchronize_session=False)

@router.post("", response_model=schemas.ProgrammingPeriodResponse)
def create_period(
    period: schemas.ProgrammingPeriodCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    # Check if name exists
    if db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.name == period.name).first():
        raise HTTPException(status_code=400, detail="Period name already exists")
    
    # Sync is_active with status if status is provided, or vice versa
    if period.status == "ACTIVO":
        period.is_active = True
    elif period.is_active: # If user sent is_active=True but status is something else or None
        period.status = "ACTIVO"
    else:
        # If status is not active, ensure is_active is False
        period.is_active = False
        if not period.status:
            period.status = "ANTIGUO" # Default

    db_period = models.ProgrammingPeriod(**period.dict())
    
    # If set as active, deactivate others
    if db_period.status == "ACTIVO":
        # Only change currently active ones to ANTIGUO
        db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.status == "ACTIVO").update({"status": "ANTIGUO", "is_active": False})
        # Fallback for legacy data that might rely on is_active but has different status
        db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).update({"is_active": False})
    
    db.add(db_period)
    db.commit()
    db.refresh(db_period)
    return db_period

@router.get("", response_model=List[schemas.ProgrammingPeriodResponse])
def read_periods(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    return db.query(models.ProgrammingPeriod).order_by(models.ProgrammingPeriod.start_date.desc()).offset(skip).limit(limit).all()

@router.get("/active", response_model=schemas.ProgrammingPeriodResponse)
def get_active_period(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.status == "ACTIVO").first()
    if not period:
        # Fallback
        period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).first()
        
    if not period:
        raise HTTPException(status_code=404, detail="No active period found")
    return period

@router.put("/{period_id}", response_model=schemas.ProgrammingPeriodResponse)
def update_period(
    period_id: int, 
    period: schemas.ProgrammingPeriodUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    db_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id == period_id).first()
    if not db_period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    update_data = period.dict(exclude_unset=True)
    
    # Handle status logic
    new_status = update_data.get("status")
    is_active_flag = update_data.get("is_active")
    
    # If status is changing to ACTIVO
    if new_status == "ACTIVO" or (new_status is None and is_active_flag is True):
        # Update payload to ensure consistency
        update_data["status"] = "ACTIVO"
        update_data["is_active"] = True
        
        # Deactivate others (Change current ACTIVO to ANTIGUO)
        db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id != period_id, models.ProgrammingPeriod.status == "ACTIVO").update({"status": "ANTIGUO", "is_active": False})
        db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id != period_id, models.ProgrammingPeriod.is_active == True).update({"is_active": False})
    elif new_status in ["ANTIGUO", "OCULTO"]:
        update_data["is_active"] = False
        
    for key, value in update_data.items():
        setattr(db_period, key, value)
        
    db.commit()
    db.refresh(db_period)
    return db_period

@router.post("/{period_id}/activate")
def activate_period(
    period_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    db_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id == period_id).first()
    if not db_period:
        raise HTTPException(status_code=404, detail="Period not found")
    
    # Change current ACTIVO to ANTIGUO
    db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.status == "ACTIVO").update({"status": "ANTIGUO", "is_active": False})
    db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).update({"is_active": False})
    
    # Activate target
    db_period.status = "ACTIVO"
    db_period.is_active = True
    db.commit()
    
    return {"message": f"Period {db_period.name} activated"}

@router.delete("/{period_id}")
def delete_period(
    period_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    db_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id == period_id).first()
    if not db_period:
        raise HTTPException(status_code=404, detail="Period not found")

    delete_related_period_data(db, period_id)
    db.delete(db_period)
    db.commit()
    return {"message": "Period and all associated data deleted safely"}
