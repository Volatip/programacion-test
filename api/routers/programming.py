from fastapi import APIRouter, Depends, HTTPException, status, Body, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
import logging
import bleach

from .. import models, schemas, database, auth
from ..commission_service import clear_partial_commission_programming, ensure_partial_commission_base_fields, ensure_partial_commission_hours, is_partial_commission_selection, merge_partial_observation, requires_performance_unit, upsert_partial_commission_item
from ..dismiss_reasons import format_dismiss_reason_label
from ..permissions import PermissionChecker
from ..audit import AuditLogger
from ..query_bounds import normalize_limit, normalize_skip

router = APIRouter()
logger = logging.getLogger(__name__)

DEFAULT_PROGRAMMING_LIMIT = 200
MAX_PROGRAMMING_LIMIT = 1000


def validate_programming_version(current_version: int, requested_version: Optional[int]):
    if requested_version is None:
        raise HTTPException(
            status_code=409,
            detail="Conflicto de edición: falta la versión actual de la programación. Recargue la página e intente nuevamente."
        )

    if requested_version != current_version:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Conflicto de edición: la programación fue modificada por otro usuario "
                f"(versión actual {current_version}, versión enviada {requested_version}). "
                "Recargue la página antes de guardar."
            )
        )

def sanitize_input(text: str) -> str:
    """
    Sanitize text input to prevent XSS.
    Allowed tags: none (strip all HTML)
    """
    if not text:
        return text
    return bleach.clean(text, tags=[], strip=True)

def validate_items(items: List[dict], is_medical: bool = False):
    """
    Validate that all activity items have required fields.
    """
    if not items:
        # If no items are provided, is it an error?
        # User said: "Implementar validación obligatoria para TODAS las filas del campo Actividad"
        # ensuring "ninguna fila pueda quedar vacía".
        # This usually means IF there are items, they must be valid.
        # But does it require AT LEAST ONE item?
        # "Todas las actividades ... (incluyendo ...)"
        # The prompt implies row-level validation.
        # I will strictly validate the items present.
        return

    for index, item in enumerate(items):
        # Activity Name
        if not item.get("activity_name") or not item.get("activity_name").strip():
            raise HTTPException(status_code=400, detail=f"La actividad en la fila {index + 1} es obligatoria.")
        
        # Sanitize text fields
        item["activity_name"] = sanitize_input(item.get("activity_name"))
        item["description"] = sanitize_input(item.get("description"))
        item["subtitle"] = sanitize_input(item.get("subtitle"))

        # Specialty (Only required for Medical officials)
        if is_medical:
            if not item.get("specialty") or not item.get("specialty").strip():
                raise HTTPException(status_code=400, detail=f"La especialidad en la fila {index + 1} es obligatoria.")
            
        # Hours
        hours = item.get("assigned_hours", 0.0)
        if hours <= 0:
            raise HTTPException(status_code=400, detail=f"Las horas en la fila {index + 1} deben ser mayores a 0.")
            
        # Performance
        performance = item.get("performance", 0.0)
        if performance < 0:
            raise HTTPException(status_code=400, detail=f"El rendimiento en la fila {index + 1} no puede ser negativo.")

def validate_programming_rules(db: Session, funcionario_id: int, data: dict):
    """
    Validate business rules based on official type and configuration.
    """
    # Sanitize observation
    if "observation" in data:
        data["observation"] = sanitize_input(data.get("observation"))

    # 0. Check for Exempt Status (Renuncia/Cambio de servicio/Inactivo)
    # If status is one of these, we skip most mandatory field checks
    assigned_status = (data.get("assigned_status") or "").strip()
    is_exempt = assigned_status in {"Inactivo", "inactivo"} or (
        bool(assigned_status) and assigned_status not in {"Activo", "activo"}
    )

    # Assigned Status is ALWAYS required (must be present and not empty string/None if key exists)
    if "assigned_status" in data and not data["assigned_status"]:
        raise HTTPException(status_code=400, detail="Debe seleccionar un Estado")

    if is_exempt:
        return True
    
    # 0.5. Validate Available Hours (Must NOT be negative)
    # We need to calculate this based on contract and assigned hours.
    # But `data` here is the `Programming` object payload, it doesn't contain the full items list if this is just `validate_programming_rules`.
    # Wait, `create_programming` extracts `items_data` separately.
    # The validation of "Total Hours" needs to happen in the main logic where we have both Funcionario info and Items.
    # We will move this check to `create_programming` and `update_programming` or pass items here.
    # Let's keep `validate_programming_rules` for configuration rules and add a separate check for hours.
    
    # PRAIS is ALWAYS required (Unless exempt, handled above)
    if "prais" in data and data["prais"] is None:
        raise HTTPException(status_code=400, detail="Debe seleccionar una opción para PRAIS")


    func = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()
    if not func:
        raise HTTPException(status_code=404, detail="Funcionario not found")

    # 1. Medical Validation
    is_medical = func.title in ["Médico(a) Cirujano(a)", "Medico Cirujano"]
    if is_medical:
        # Prevent medical officials from having selected_process
        if "selected_process" in data and data["selected_process"]:
             # If it's being set to something non-null/non-empty
             logger.warning("Clearing selected_process for medical official %s", func.name)
             data["selected_process"] = None
        
        # Ensure specialty is provided if it's being set (optional check)
        # global_specialty = data.get("global_specialty")
        # if global_specialty is None and "global_specialty" in data:
        #    raise HTTPException(status_code=400, detail="Especialidad es requerida para Médicos")
        pass

    # 2. Law 15076 Validation
    # is_ley_15076 = func.law_code and "15076" in func.law_code
    # is_liberado = func.observations and "liberado de guardia" in func.observations.lower()
    
    # if is_ley_15076 and not is_liberado:
    #     if "selected_performance_unit" in data and not data["selected_performance_unit"]:
    #         # Only warn or enforce depending on requirements. 
    #         # For draft saving, we might be lenient.
    #         pass
    
    # 3. Mandatory Selection Validation
    # (PRAIS and Assigned Status checks moved to top of function)
    
    # Global Specialty (Required for Medical)
    if is_medical:
        if "global_specialty" in data and not data["global_specialty"]:
             raise HTTPException(status_code=400, detail="Debe seleccionar una Especialidad Principal")

    # Process (Required for Non-Medical)
    # Note: If function is called with partial update data that doesn't include 'selected_process',
    # we might skip this check. But for creation/full-save, it should be there.
    if not is_medical:
        # Check if key is present to avoid error on partial updates that don't touch process
        if "selected_process" in data:
            if not data["selected_process"]:
                 raise HTTPException(status_code=400, detail="Debe seleccionar un Proceso")

    return True

def validate_hours_balance(db: Session, funcionario_id: int, items_data: List[dict], time_unit: str = "hours"):
    """
    Ensure total scheduled hours do not exceed available contract hours.
    """
    func = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()
    if not func:
        return # Should be caught elsewhere
        
    # Calculate Total Contract Hours
    total_contract_hours = 0.0
    
    # Fetch all contracts for this person (same RUT and Period) to simulate relationship
    contracts = []
    if func.rut:
        contracts = db.query(models.Funcionario).filter(
            models.Funcionario.rut == func.rut,
            models.Funcionario.period_id == func.period_id
        ).all()
    
    # If no other contracts found (or no RUT), use the single record
    if not contracts:
        contracts = [func]

    for contract in contracts:
        # Logic from frontend: Exclude Law 15076 unless "liberado de guardia"
        is_law_15076 = contract.law_code and "15076" in contract.law_code
        obs = (contract.observations or "").lower()
        is_liberado = "liberado de guardia" in obs
        
        if is_law_15076 and not is_liberado:
            continue
        total_contract_hours += float(contract.hours_per_week or 0)

    # Calculate Lunch Deduction
    # Use the max lunch time found across contracts? Or just from the main one?
    # Usually lunch is per day, but here it's "minutes". 
    # Let's use the current record's lunch time as representative or sum?
    # Logic in frontend/consolidation used: max(grouped_people[key]["lunch_minutes"], contract.lunch_time_minutes or 0)
    # We should probably do the same.
    lunch_minutes = 0
    for contract in contracts:
        if (contract.lunch_time_minutes or 0) > lunch_minutes:
            lunch_minutes = contract.lunch_time_minutes

    lunch_hours = lunch_minutes / 60.0
    
    # Calculate Scheduled Hours
    total_scheduled = 0.0
    if items_data:
        for item in items_data:
            h = float(item.get("assigned_hours", 0))
            if time_unit == "minutes":
                h = h / 60.0
            total_scheduled += h
            
    available = total_contract_hours - total_scheduled - lunch_hours
    
    # Tolerance for float math
    if available < -0.01:
        raise HTTPException(
            status_code=400, 
            detail=f"No se puede guardar: Las horas programadas exceden las disponibles. Disponibles: {available:.1f} hrs"
        )


def resolve_programming_dismiss_context(
    db: Session,
    *,
    dismiss_reason_id: int | None,
    dismiss_suboption_id: int | None,
    dismiss_partial_hours: int | None,
) -> tuple[models.DismissReason | None, models.DismissReasonSuboption | None, int | None]:
    reason = None
    suboption = None

    if dismiss_reason_id is not None:
        reason = db.query(models.DismissReason).filter(models.DismissReason.id == dismiss_reason_id).first()
        if reason is None:
            raise HTTPException(status_code=400, detail="Motivo de baja inválido para la programación.")

    if dismiss_suboption_id is not None:
        suboption = db.query(models.DismissReasonSuboption).filter(models.DismissReasonSuboption.id == dismiss_suboption_id).first()
        if suboption is None:
            raise HTTPException(status_code=400, detail="Subopción de baja inválida para la programación.")
        if reason is not None and suboption.reason_id != reason.id:
            raise HTTPException(status_code=400, detail="La subopción no corresponde al motivo de baja seleccionado.")
        if reason is None:
            reason = suboption.reason

    partial_hours = ensure_partial_commission_hours(reason, suboption, dismiss_partial_hours)
    return reason, suboption, partial_hours


def apply_programming_dismiss_metadata(
    db: Session,
    *,
    programming: models.Programming,
    dismiss_reason_id: int | None,
    dismiss_suboption_id: int | None,
    dismiss_partial_hours: int | None,
) -> None:
    reason, suboption, partial_hours = resolve_programming_dismiss_context(
        db,
        dismiss_reason_id=dismiss_reason_id,
        dismiss_suboption_id=dismiss_suboption_id,
        dismiss_partial_hours=dismiss_partial_hours,
    )

    if partial_hours is not None and reason is not None and suboption is not None:
        programming.dismiss_reason_id = reason.id
        programming.dismiss_suboption_id = suboption.id
        programming.dismiss_partial_hours = partial_hours
        programming.assigned_status = format_dismiss_reason_label(reason.name, suboption.name)
        programming.observation = merge_partial_observation(programming.observation, partial_hours)
        upsert_partial_commission_item(db, programming=programming, hours=partial_hours)
        return

    if programming.dismiss_partial_hours is not None and not is_partial_commission_selection(reason, suboption):
        clear_partial_commission_programming(programming)


def build_items_for_hours_validation(
    db: Session,
    *,
    items_data: List[dict],
    dismiss_reason_id: int | None,
    dismiss_suboption_id: int | None,
    dismiss_partial_hours: int | None,
) -> List[dict]:
    _, _, partial_hours = resolve_programming_dismiss_context(
        db,
        dismiss_reason_id=dismiss_reason_id,
        dismiss_suboption_id=dismiss_suboption_id,
        dismiss_partial_hours=dismiss_partial_hours,
    )

    validation_items = list(items_data)
    if partial_hours is not None:
        validation_items.append({
            "activity_name": "Otras Actividades No Clínicas",
            "assigned_hours": float(partial_hours),
            "performance": 0.0,
        })
    return validation_items


def validate_partial_commission_base_programming(
    db: Session,
    *,
    funcionario: models.Funcionario,
    dismiss_reason_id: int | None,
    dismiss_suboption_id: int | None,
    dismiss_partial_hours: int | None,
    global_specialty: str | None,
    selected_performance_unit: str | None,
) -> None:
    _, _, partial_hours = resolve_programming_dismiss_context(
        db,
        dismiss_reason_id=dismiss_reason_id,
        dismiss_suboption_id=dismiss_suboption_id,
        dismiss_partial_hours=dismiss_partial_hours,
    )

    if partial_hours is None:
        return

    ensure_partial_commission_base_fields(
        global_specialty,
        selected_performance_unit,
        requires_performance_unit_field=requires_performance_unit(funcionario),
    )

@router.post("", response_model=schemas.ProgrammingResponse)
def create_programming(
    programming: schemas.ProgrammingCreate = Body(..., embed=True), 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    user_id = current_user.id
    logger.info(
        "create_programming called funcionario_id=%s user_id=%s period_id=%s",
        programming.funcionario_id,
        user_id,
        programming.period_id,
    )
    
    # Permission Check
    PermissionChecker.check_can_edit_programming(current_user, programming.funcionario_id, db)

    # Check for existing programming to avoid duplicates
    existing = db.query(models.Programming).filter(
        models.Programming.funcionario_id == programming.funcionario_id,
        models.Programming.period_id == programming.period_id
    ).first()

    # Get Funcionario Info for Validation
    func = db.query(models.Funcionario).filter(models.Funcionario.id == programming.funcionario_id).first()
    if not func:
        raise HTTPException(status_code=404, detail="Funcionario not found")
    
    is_medical = func.title in ["Médico(a) Cirujano(a)", "Medico Cirujano"]

    if existing:
        validate_programming_version(existing.version, programming.version)

        # Strategy: Upsert (Update existing instead of creating duplicate)
        # We redirect to the update logic, but we need to adapt the schema
        logger.info(
            "Programming already exists for funcionario_id=%s; updating programming_id=%s instead of creating duplicate",
            programming.funcionario_id,
            existing.id,
        )
        
        # Map Create schema to Update schema
        update_data = programming.dict(exclude={"funcionario_id", "period_id"})
        update_data.pop("version", None)
        items_data = update_data.pop("items", [])
        dismiss_reason_id = update_data.get("dismiss_reason_id", existing.dismiss_reason_id)
        dismiss_suboption_id = update_data.get("dismiss_suboption_id", existing.dismiss_suboption_id)
        dismiss_partial_hours = update_data.get("dismiss_partial_hours", existing.dismiss_partial_hours)
        validate_partial_commission_base_programming(
            db,
            funcionario=func,
            dismiss_reason_id=dismiss_reason_id,
            dismiss_suboption_id=dismiss_suboption_id,
            dismiss_partial_hours=dismiss_partial_hours,
            global_specialty=update_data.get("global_specialty", existing.global_specialty),
            selected_performance_unit=update_data.get("selected_performance_unit", existing.selected_performance_unit),
        )
        validation_items = build_items_for_hours_validation(
            db,
            items_data=items_data,
            dismiss_reason_id=dismiss_reason_id,
            dismiss_suboption_id=dismiss_suboption_id,
            dismiss_partial_hours=dismiss_partial_hours,
        )
        
        # Validate Rules (pass existing funcionario_id)
        # Note: update_data might not contain all fields if exclude_unset=True was used and fields weren't sent.
        # But `validate_programming_rules` checks for keys in `data`.
        # If `selected_process` is not in update_data, it won't be validated/cleared.
        # However, frontend sends the full payload usually for "save".
        # If it's a partial update, we might miss some checks, but that's acceptable for now.
        validate_programming_rules(db, existing.funcionario_id, update_data)
        
        # Validate Items
        if items_data is not None:
             validate_items(items_data, is_medical=is_medical)
             
        # Validate Hours Balance (Pass updated items list)
        # Note: We need the full list of items to validate balance, but items_data might be partial if we were just updating some fields?
        # Actually, `items_data` here is the NEW list of items that will replace the old ones (Full Replacement).
        # So we can validate against `items_data`.
        if items_data is not None:
             validate_hours_balance(db, existing.funcionario_id, validation_items, update_data.get("time_unit", existing.time_unit))
        
        for key, value in update_data.items():
            if key != "items":
                setattr(existing, key, value)
        
        existing.updated_by_id = user_id
        existing.version += 1
        
        # Handle Items
        if items_data is not None:
            logger.debug("Updating items for programming_id=%s item_count=%s", existing.id, len(items_data))
            # Delete existing items
            db.query(models.ProgrammingItem).filter(models.ProgrammingItem.programming_id == existing.id).delete()
            
            # Add new items
            for item_data in items_data:
                db_item = models.ProgrammingItem(**item_data, programming_id=existing.id)
                db.add(db_item)

        db.flush()
        db.refresh(existing, attribute_names=['items'])
        apply_programming_dismiss_metadata(
            db,
            programming=existing,
            dismiss_reason_id=dismiss_reason_id,
            dismiss_suboption_id=dismiss_suboption_id,
            dismiss_partial_hours=dismiss_partial_hours,
        )

        db.commit()
        db.refresh(existing)
        # Force reload items to ensure they are returned
        db.refresh(existing, attribute_names=['items'])
        
        # Audit Update
        AuditLogger.log_action(
            db, user_id, "Update Programming", f"Actualización de programación (ID {existing.id})",
            funcionario_id=existing.funcionario_id,
            funcionario_name=func.name,
            rut=func.rut
        )
        
        return existing

    # Normal Creation Flow
    try:
        # Extract items
        programming_data = programming.dict()
        items_data = programming_data.pop("items", [])
        programming_data["version"] = 1
        validate_partial_commission_base_programming(
            db,
            funcionario=func,
            dismiss_reason_id=programming_data.get("dismiss_reason_id"),
            dismiss_suboption_id=programming_data.get("dismiss_suboption_id"),
            dismiss_partial_hours=programming_data.get("dismiss_partial_hours"),
            global_specialty=programming_data.get("global_specialty"),
            selected_performance_unit=programming_data.get("selected_performance_unit"),
        )
        validation_items = build_items_for_hours_validation(
            db,
            items_data=items_data,
            dismiss_reason_id=programming_data.get("dismiss_reason_id"),
            dismiss_suboption_id=programming_data.get("dismiss_suboption_id"),
            dismiss_partial_hours=programming_data.get("dismiss_partial_hours"),
        )
        logger.debug("Creating programming with item_count=%s", len(items_data))
        
        # Validate Rules
        validate_programming_rules(db, programming.funcionario_id, programming_data)
        
        # Validate Items
        validate_items(items_data, is_medical=is_medical)
        
        # Validate Hours Balance
        validate_hours_balance(db, programming.funcionario_id, validation_items, programming_data.get("time_unit", "hours"))
        
        db_programming = models.Programming(**programming_data)
        db_programming.created_by_id = user_id
        db_programming.updated_by_id = user_id
        
        db.add(db_programming)
        db.flush()
        db.refresh(db_programming)
        
        # Create items
        for item_data in items_data:
            db_item = models.ProgrammingItem(**item_data, programming_id=db_programming.id)
            db.add(db_item)

        db.flush()
        db.refresh(db_programming, attribute_names=['items'])
        apply_programming_dismiss_metadata(
            db,
            programming=db_programming,
            dismiss_reason_id=programming_data.get("dismiss_reason_id"),
            dismiss_suboption_id=programming_data.get("dismiss_suboption_id"),
            dismiss_partial_hours=programming_data.get("dismiss_partial_hours"),
        )

        db.commit()
        db.refresh(db_programming)
        # Force reload items
        db.refresh(db_programming, attribute_names=['items'])
        
        # Audit Creation
        AuditLogger.log_action(
            db, user_id, "Create Programming", f"Creación de nueva programación (ID {db_programming.id})",
            funcionario_id=db_programming.funcionario_id,
            funcionario_name=func.name,
            rut=func.rut
        )
        
        return db_programming
        
    except HTTPException as he:
        db.rollback()
        raise he
    except IntegrityError:
        db.rollback()
        logger.warning(
            "Programming unique constraint blocked a concurrent duplicate for funcionario_id=%s period_id=%s",
            programming.funcionario_id,
            programming.period_id,
        )
        raise HTTPException(
            status_code=409,
            detail="Ya existe una programación para ese funcionario en el período indicado. Recargue la página antes de guardar.",
        )
    except Exception:
        db.rollback()
        logger.exception("Error creating programming for funcionario_id=%s", programming.funcionario_id)
        raise HTTPException(status_code=500, detail="Error interno al guardar la programación")

@router.get("", response_model=List[schemas.ProgrammingResponse])
def read_programmings(
    skip: int = 0, 
    limit: int = DEFAULT_PROGRAMMING_LIMIT, 
    period_id: Optional[int] = None,
    user_id: Optional[int] = None,
    funcionario_id: Optional[int] = None,
    funcionario_ids: Optional[List[int]] = Query(default=None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    normalized_skip = normalize_skip(skip)
    requested_default_limit = DEFAULT_PROGRAMMING_LIMIT
    if funcionario_ids:
        requested_default_limit = max(requested_default_limit, len(funcionario_ids))
    normalized_limit = normalize_limit(
        limit,
        default=min(requested_default_limit, MAX_PROGRAMMING_LIMIT),
        max_value=MAX_PROGRAMMING_LIMIT,
    )

    query = db.query(models.Programming).options(
        joinedload(models.Programming.items),
        joinedload(models.Programming.created_by),
        joinedload(models.Programming.updated_by)
    )

    effective_user_id = PermissionChecker.resolve_user_scope(current_user, user_id)

    if effective_user_id is not None and (not PermissionChecker.is_admin(current_user) or PermissionChecker.is_supervisor(current_user) or user_id is not None):
        query = query.join(
            models.UserOfficial,
            models.UserOfficial.funcionario_id == models.Programming.funcionario_id
        ).filter(models.UserOfficial.user_id == effective_user_id)
    
    if period_id:
        query = query.filter(models.Programming.period_id == period_id)
    if funcionario_id:
        query = query.filter(models.Programming.funcionario_id == funcionario_id)
    if funcionario_ids:
        query = query.filter(models.Programming.funcionario_id.in_(funcionario_ids))
        
    return query.offset(normalized_skip).limit(normalized_limit).all()

@router.get("/{programming_id}", response_model=schemas.ProgrammingResponse)
def read_programming(
    programming_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_programming = db.query(models.Programming).options(
        joinedload(models.Programming.items),
        joinedload(models.Programming.created_by),
        joinedload(models.Programming.updated_by)
    ).filter(models.Programming.id == programming_id).first()
    if not db_programming:
        raise HTTPException(status_code=404, detail="Programming not found")

    PermissionChecker.check_can_access_funcionario(current_user, db_programming.funcionario_id, db)
    
    # Sort items by ID to maintain insertion order
    # Assuming IDs are auto-incrementing and items are re-created on update (as per create_programming logic)
    # The current create/update logic deletes all items and re-inserts them in the order provided by the frontend.
    # So sorting by ID should reflect the saved order.
    if db_programming.items:
        db_programming.items.sort(key=lambda x: x.id)
        
    return db_programming

@router.put("/{programming_id}", response_model=schemas.ProgrammingResponse)
def update_programming(
    programming_id: int, 
    programming: schemas.ProgrammingUpdate = Body(..., embed=True), 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    user_id = current_user.id
    db_programming = db.query(models.Programming).filter(models.Programming.id == programming_id).first()
    if not db_programming:
        raise HTTPException(status_code=404, detail="Programming not found")
    
    # Permission Check
    PermissionChecker.check_can_edit_programming(current_user, db_programming.funcionario_id, db)
    
    update_data = programming.dict(exclude_unset=True)
    requested_version = update_data.pop("version", None)
    items_data = update_data.pop("items", None)

    validate_programming_version(db_programming.version, requested_version)
    
    # Get Funcionario Info for Validation
    func = db.query(models.Funcionario).filter(models.Funcionario.id == db_programming.funcionario_id).first()
    is_medical = False
    if func:
        is_medical = func.title in ["Médico(a) Cirujano(a)", "Medico Cirujano"]

    # Validate Rules (pass existing funcionario_id)
    # Re-fetch items if needed to validate? No, validation is on incoming data.
    validate_programming_rules(db, db_programming.funcionario_id, update_data)

    dismiss_reason_id = update_data.get("dismiss_reason_id", db_programming.dismiss_reason_id)
    dismiss_suboption_id = update_data.get("dismiss_suboption_id", db_programming.dismiss_suboption_id)
    dismiss_partial_hours = update_data.get("dismiss_partial_hours", db_programming.dismiss_partial_hours)
    validate_partial_commission_base_programming(
        db,
        funcionario=func,
        dismiss_reason_id=dismiss_reason_id,
        dismiss_suboption_id=dismiss_suboption_id,
        dismiss_partial_hours=dismiss_partial_hours,
        global_specialty=update_data.get("global_specialty", db_programming.global_specialty),
        selected_performance_unit=update_data.get("selected_performance_unit", db_programming.selected_performance_unit),
    )
    validation_items = build_items_for_hours_validation(
        db,
        items_data=items_data or [],
        dismiss_reason_id=dismiss_reason_id,
        dismiss_suboption_id=dismiss_suboption_id,
        dismiss_partial_hours=dismiss_partial_hours,
    )
    
    # Validate Items if provided
    if items_data is not None:
        validate_items(items_data, is_medical=is_medical)
        # Validate Hours Balance
        validate_hours_balance(db, db_programming.funcionario_id, validation_items, update_data.get("time_unit", db_programming.time_unit))
    
    for key, value in update_data.items():
        setattr(db_programming, key, value)
    
    db_programming.updated_by_id = user_id
    db_programming.version += 1
    
    # Update Items if provided (Full replacement strategy)
    if items_data is not None:
        # Delete existing items
        db.query(models.ProgrammingItem).filter(models.ProgrammingItem.programming_id == programming_id).delete()
        
        # Add new items
        for item_data in items_data:
            db_item = models.ProgrammingItem(**item_data, programming_id=programming_id)
            db.add(db_item)

    db.flush()
    db.refresh(db_programming, attribute_names=['items'])
    apply_programming_dismiss_metadata(
        db,
        programming=db_programming,
        dismiss_reason_id=dismiss_reason_id,
        dismiss_suboption_id=dismiss_suboption_id,
        dismiss_partial_hours=dismiss_partial_hours,
    )

    db.commit()
    db.refresh(db_programming)
    db.refresh(db_programming, attribute_names=['items'])
    
    # Audit Manual Update
    func_info = db_programming.funcionario
    AuditLogger.log_action(
        db, user_id, "Update Programming", f"Actualización manual de programación (ID {programming_id})",
        funcionario_id=db_programming.funcionario_id,
        funcionario_name=func_info.name if func_info else "Unknown",
        rut=func_info.rut if func_info else None
    )
    
    return db_programming

@router.delete("/{programming_id}")
def delete_programming(
    programming_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    try:
        db_programming = db.query(models.Programming).filter(models.Programming.id == programming_id).first()
        if not db_programming:
            raise HTTPException(status_code=404, detail="Programming not found")
        
        # Permission Check
        PermissionChecker.check_can_edit_programming(current_user, db_programming.funcionario_id, db)

        linked_users_count = db.query(models.UserOfficial.user_id).filter(
            models.UserOfficial.funcionario_id == db_programming.funcionario_id
        ).distinct().count()

        if linked_users_count >= 2:
            raise HTTPException(
                status_code=409,
                detail=(
                    "No es posible eliminar la programación; solo se puede modificar "
                    "porque hay dos o más usuarios asociados a este funcionario."
                ),
            )
        
        # Get info before delete
        func_info = db_programming.funcionario
        func_name = func_info.name if func_info else "Unknown"
        func_rut = func_info.rut if func_info else None
        f_id = db_programming.funcionario_id

        db.delete(db_programming)
        db.commit()
        
        # Audit Deletion
        AuditLogger.log_action(
            db, current_user.id, "Delete Programming", f"Eliminación de programación (ID {programming_id})",
            funcionario_id=f_id,
            funcionario_name=func_name,
            rut=func_rut
        )
        
        return {"message": "Programming deleted"}
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Error deleting programming_id=%s", programming_id)
        raise HTTPException(status_code=500, detail="Error interno al eliminar la programación")

@router.post("/{programming_id}/items", response_model=schemas.ProgrammingItemResponse)
def create_programming_item(
    programming_id: int, 
    item: schemas.ProgrammingItemCreate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_programming = db.query(models.Programming).filter(models.Programming.id == programming_id).first()
    if not db_programming:
        raise HTTPException(status_code=404, detail="Programming not found")
    
    # Permission Check
    PermissionChecker.check_can_edit_programming(current_user, db_programming.funcionario_id, db)
    
    db_item = models.ProgrammingItem(**item.dict(), programming_id=programming_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.put("/{programming_id}/items/{item_id}", response_model=schemas.ProgrammingItemResponse)
def update_programming_item(
    programming_id: int, 
    item_id: int, 
    item: schemas.ProgrammingItemUpdate, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_item = db.query(models.ProgrammingItem).filter(
        models.ProgrammingItem.id == item_id,
        models.ProgrammingItem.programming_id == programming_id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Programming item not found")
    
    # Permission Check (via parent programming)
    db_prog = db.query(models.Programming).filter(models.Programming.id == programming_id).first()
    if db_prog:
        PermissionChecker.check_can_edit_programming(current_user, db_prog.funcionario_id, db)
    
    update_data = item.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    return db_item

@router.delete("/{programming_id}/items/{item_id}")
def delete_programming_item(
    programming_id: int, 
    item_id: int, 
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_item = db.query(models.ProgrammingItem).filter(
        models.ProgrammingItem.id == item_id,
        models.ProgrammingItem.programming_id == programming_id
    ).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Programming item not found")
    
    # Permission Check (via parent programming)
    db_prog = db.query(models.Programming).filter(models.Programming.id == programming_id).first()
    if db_prog:
        PermissionChecker.check_can_edit_programming(current_user, db_prog.funcionario_id, db)
    
    db.delete(db_item)
    db.commit()
    return {"message": "Item deleted"}

@router.post("/audit-copy")
def audit_copy_programming(
    payload: dict = Body(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    target_official_id = payload.get("target_official_id")
    source_official_id = payload.get("source_official_id")
    user_id = current_user.id
    
    if not all([target_official_id, source_official_id]):
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    target_func = db.query(models.Funcionario).filter(models.Funcionario.id == target_official_id).first()
    source_func = db.query(models.Funcionario).filter(models.Funcionario.id == source_official_id).first()
    
    if not target_func:
        raise HTTPException(status_code=404, detail="Target official not found")
    
    if not source_func:
        raise HTTPException(status_code=404, detail="Source official not found")

    PermissionChecker.check_can_access_funcionario(current_user, target_official_id, db)
    PermissionChecker.check_can_access_funcionario(current_user, source_official_id, db)
        
    # Backend Validation: Check Titles
    # Normalize for comparison (lowercase, strip)
    def normalize(text):
        return str(text).lower().strip() if text else ""
        
    if normalize(target_func.title) != normalize(source_func.title):
        # Log unauthorized attempt
        audit = models.OfficialAudit(
            funcionario_id=target_official_id,
            funcionario_name=target_func.name,
            rut=target_func.rut,
            period_id=target_func.period_id,
            user_id=user_id,
            action="Unauthorized Copy Attempt",
            reason=f"Intento de copia desde {source_func.name} (Título: {source_func.title}) hacia {target_func.name} (Título: {target_func.title})"
        )
        db.add(audit)
        db.commit()
        
        raise HTTPException(status_code=403, detail="No está permitido copiar programación entre funcionarios con distinto título.")
        
    audit = models.OfficialAudit(
        funcionario_id=target_official_id,
        funcionario_name=target_func.name,
        rut=target_func.rut,
        period_id=target_func.period_id,
        user_id=user_id,
        action="Copy Programming",
        reason=f"Copiado desde {source_func.name}"
    )
    db.add(audit)
    db.commit()
    
    return {"message": "Audit log created"}
