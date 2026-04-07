from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, or_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
import logging
import pandas as pd
import io
from api import models, schemas, database, auth
from api.commission_service import apply_partial_commission_programming, clear_partial_commission_programming, ensure_partial_commission_base_programming, ensure_partial_commission_hours, is_partial_commission_selection
from api.dismiss_reasons import HIDE_ACTION, resolve_dismiss_selection, resolve_reason_category
from api.query_bounds import normalize_limit, normalize_skip
from api.permissions import MEDICAL_FUNCIONARIO_TITLE, PermissionChecker

router = APIRouter()

DEFAULT_FUNCIONARIOS_LIMIT = 1000
MAX_FUNCIONARIOS_LIMIT = 2000
DEFAULT_SEARCH_RESULTS_LIMIT = 100
MAX_SEARCH_RESULTS_LIMIT = 200

import json


logger = logging.getLogger(__name__)


def get_period_group_assignments(db: Session, period_id: Optional[int], user_id: Optional[int] = None) -> list[tuple[str, Optional[int]]]:
    query = db.query(models.Funcionario.rut, models.UserOfficial.group_id).join(
        models.UserOfficial,
        models.UserOfficial.funcionario_id == models.Funcionario.id,
    ).filter(models.Funcionario.rut.isnot(None))

    if period_id is not None:
        query = query.filter(models.Funcionario.period_id == period_id)

    if user_id is not None:
        query = query.filter(models.UserOfficial.user_id == user_id)

    return query.all()


def build_rut_to_group(assignments: list[tuple[str, Optional[int]]]) -> dict[str, Optional[int]]:
    rut_to_group: dict[str, Optional[int]] = {}
    for rut, group_id in assignments:
        if rut and rut not in rut_to_group:
            rut_to_group[rut] = group_id
    return rut_to_group


def get_user_scoped_ruts(
    db: Session,
    user_id: int,
    *,
    period_id: Optional[int] = None,
    include_hidden: bool = False,
) -> list[str]:
    linked_query = db.query(models.Funcionario.rut).join(
        models.UserOfficial,
        models.UserOfficial.funcionario_id == models.Funcionario.id,
    ).filter(models.UserOfficial.user_id == user_id)

    if period_id is not None:
        linked_query = linked_query.filter(models.Funcionario.period_id == period_id)

    linked_ruts = [row[0] for row in linked_query.all() if row[0]]

    hidden_query = db.query(models.UserHiddenOfficial.funcionario_rut).filter(
        models.UserHiddenOfficial.user_id == user_id
    )
    if period_id is not None:
        hidden_query = hidden_query.filter(models.UserHiddenOfficial.period_id == period_id)

    if include_hidden:
        hidden_ruts = [row[0] for row in hidden_query.all() if row[0]]
        return list(dict.fromkeys([*linked_ruts, *hidden_ruts]))

    hidden_ruts = {row[0] for row in hidden_query.all() if row[0]}
    return [rut for rut in linked_ruts if rut not in hidden_ruts]


def apply_role_based_funcionario_filter(query, user_role: str):
    if user_role == 'medical_coordinator':
        return query.filter(models.Funcionario.title == MEDICAL_FUNCIONARIO_TITLE)

    if user_role == 'non_medical_coordinator':
        return query.filter(
            or_(
                models.Funcionario.title.is_(None),
                models.Funcionario.title != MEDICAL_FUNCIONARIO_TITLE,
            )
        )

    return query

@router.post("/upload")
async def upload_funcionarios(
    file: UploadFile = File(...),
    period_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.require_admin(current_user, "Solo los administradores pueden subir archivos de RRHH.")

    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file.")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Normalize column names to lowercase
        # But keep a copy of original data for raw_data storage? 
        # Actually, let's store the row as dict with original keys if possible, or normalized keys.
        # To be safe and consistent, we'll use the normalized dataframe row converted to dict.
        
        # Store original columns before normalization for potential mapping debugging? 
        # No, just normalize for processing.
        
        df.columns = df.columns.str.lower().str.strip()
        
        # Replace NaN with None
        df = df.where(pd.notnull(df), None)
        
        logger.info("Procesando carga de funcionarios con columnas: %s", df.columns.tolist())
        
        # Helper to find column
        def find_col(keywords, default=None):
            for col in df.columns:
                for kw in keywords:
                    if kw in col:
                        return col
            return default

        created_count = 0
        updated_count = 0
        
        # Default to active period if not provided
        if not period_id:
            active_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).first()
            if active_period:
                period_id = active_period.id
        
        for idx, row in df.iterrows():
            # Prepare raw_data JSON
            # Convert row to dict, ensuring values are JSON serializable
            # We already replaced NaNs with None which maps to null in JSON
            try:
                raw_data_dict = row.to_dict()
                # Handle potential non-serializable types if any (e.g. Timestamps)
                # Pandas to_dict usually handles basic types well. 
                # Dates might need string conversion.
                for k, v in raw_data_dict.items():
                    if isinstance(v, (pd.Timestamp, pd.Timedelta)):
                        raw_data_dict[k] = str(v)
                
                raw_data_json = json.dumps(raw_data_dict, ensure_ascii=False)
            except Exception:
                logger.warning("No se pudo serializar la fila %s de funcionarios a JSON", idx, exc_info=True)
                raw_data_json = None

            # Find RUT column
            # PRIORITIZE 'RUT Programable' as per user instruction
            col_rut = find_col(['rut programable', 'rut_programable'])
            
            # If not found, fallback to standard
            if not col_rut:
                 col_rut = find_col(['rut', 'r.u.t', 'run'])
            
            if not col_rut:
                logger.warning("Se abortó la carga de funcionarios porque no se encontró una columna de RUT válida")
                break
                
            rut_raw = str(row.get(col_rut, '')).replace('.', '').strip()
            
            # DEBUG: Trace why rows are skipped
            if rut_raw == 'None' or not rut_raw:
                # if idx < 5: print(f"DEBUG: Skipping row {idx} due to empty RUT")
                continue

            # DV
            # Some excel files have 'DV' separate.
            # If RUT was numeric (from RUT Programable), we need DV.
            col_dv = None
            if 'dv' in df.columns:
                col_dv = 'dv'
            elif 'digito' in df.columns:
                col_dv = 'digito'
            else:
                col_dv = find_col(['dv', 'digito'])
                
            # Prefer 'DV' if exists (already covered by exact check above if normalized)
            if 'DV' in df.columns: col_dv = 'DV'
            
            if '-' in rut_raw:
                rut, dv = rut_raw.split('-')
            else:
                rut = rut_raw
                dv = str(row.get(col_dv, '')) if col_dv else ''
                if dv == 'None': dv = ''
            
            # Find Name column
            # Prioritize 'Nombre' as standard
            col_name = find_col(['nombre', 'nombres'])
            if not col_name:
                 col_name = find_col(['funcionario', 'apellidos'])
            
            name = row.get(col_name, '') if col_name else ''
            
            if not name or name == 'None':
                # if idx < 5: print(f"DEBUG: Skipping row {idx} due to empty Name (RUT: {rut})")
                continue

            # Helper to safely get int
            def get_int(val, default=0):
                try:
                    if val is None or val == 'None' or str(val).strip() == '': return default
                    return int(float(val))
                except (ValueError, TypeError):
                    return default

            # Helper to safely get string
            def get_str(val, default=''):
                if val is None or val == 'None': return default
                return str(val).strip()

            # Prepare data using smarter column finding
            
            # Title
            col_title = find_col(['cargo', 'titulo', 'estamento'])
            title = get_str(row.get(col_title, 'Funcionario')) if col_title else 'Funcionario'
            
            # Law Code
            col_law = find_col(['ley', 'codigo ley'])
            law_code = get_str(row.get(col_law, '')) if col_law else ''
            
            # Specialty
            col_spec = find_col(['especialidad', 'especialidad sis'])
            specialty_sis = get_str(row.get(col_spec, '')) if col_spec else ''
            
            # Transformation: Handle NaN/Empty -> "Sin Especialidad"
            if not specialty_sis or str(specialty_sis).lower() == 'nan':
                specialty_sis = "Sin Especialidad"
            else:
                # Transform "Cardiología_Neurología_Pediatría" -> "Cardiología, Neurología y Pediatría"
                
                # Split by underscore
                if '_' in str(specialty_sis):
                    raw_parts = str(specialty_sis).split('_')
                    
                    # Clean each part: strip whitespace and filter empty
                    clean_parts = [p.strip() for p in raw_parts if p and p.strip()]
                    
                    if len(clean_parts) == 0:
                        specialty_sis = "Sin Especialidad"
                    elif len(clean_parts) == 1:
                        specialty_sis = clean_parts[0]
                    else:
                        last_part = clean_parts.pop()
                        # Join remaining with comma
                        first_part = ", ".join(clean_parts)
                        specialty_sis = f"{first_part} y {last_part}"
                else:
                     specialty_sis = str(specialty_sis).strip()
            
            # Hours
            col_hours = find_col(['horas', 'jornada', 'semanales'])
            hours = get_int(row.get(col_hours, 44)) if col_hours else 44

            # Correlativo Contrato
            col_correlative = find_col(['correlativo', 'nro. contrato', 'num contrato'])
            contract_correlative = get_int(row.get(col_correlative, 0)) if col_correlative else None

            # Observations
            col_obs = find_col(['observaciones', 'comentarios'])
            observations = get_str(row.get(col_obs, '')) if col_obs else ''

            # Days/Time
            col_holidays = find_col(['feriados', 'vacaciones'])
            holiday_days = get_int(row.get(col_holidays, 0)) if col_holidays else 0
            
            col_admin = find_col(['administrativos'])
            administrative_days = get_int(row.get(col_admin, 0)) if col_admin else 0
            
            col_congress = find_col(['congreso'])
            congress_days = get_int(row.get(col_congress, 0)) if col_congress else 0
            
            col_breast = find_col(['lactancia'])
            breastfeeding_time = get_int(row.get(col_breast, 0)) if col_breast else 0
            
            col_lunch = find_col(['colacion', 'almuerzo'])
            lunch_time_minutes = get_int(row.get(col_lunch, 0)) if col_lunch else 0


            # Check if exists in this period with SPECIFIC contract details to differentiate
            # We match by RUT + Contract Correlative (if available)
            
            existing_query = db.query(models.Funcionario).filter(
                models.Funcionario.rut == rut,
                models.Funcionario.period_id == period_id
            )
            
            # Prioritize Correlative Match if available in both Excel and DB
            # If Excel has correlative, we should try to match it.
            if contract_correlative:
                 existing_query = existing_query.filter(models.Funcionario.contract_correlative == contract_correlative)
            else:
                 # Fallback to previous logic if no correlative in Excel?
                 # Or just rely on RUT + Law + Hours as before?
                 # User requested: "match by RUT and Correlative Contract".
                 
                 # If correlative is missing in Excel, we can't match by it.
                 # But if it IS present, we use it.
                 pass

            existing = existing_query.first()
            
            if existing:
                # Update
                existing.name = name
                existing.contract_correlative = contract_correlative # Update/Set correlative

                existing.title = title
                existing.law_code = law_code
                existing.specialty_sis = specialty_sis
                existing.hours_per_week = hours
                existing.observations = observations
                existing.holiday_days = holiday_days
                existing.administrative_days = administrative_days
                existing.congress_days = congress_days
                existing.breastfeeding_time = breastfeeding_time
                existing.lunch_time_minutes = lunch_time_minutes
                existing.is_active_roster = True # Reactivate if was inactive
                existing.raw_data = raw_data_json # Update raw data
                
                updated_count += 1
            else:
                # Create
                new_func = models.Funcionario(
                    name=name,
                    rut=rut,
                    dv=dv,
                    title=title,
                    law_code=law_code,
                    specialty_sis=specialty_sis,
                    hours_per_week=hours,
                    contract_correlative=contract_correlative, # Set correlative
                    period_id=period_id,
                    is_active_roster=True,
                    observations=observations,
                    holiday_days=holiday_days,
                    administrative_days=administrative_days,
                    congress_days=congress_days,
                    breastfeeding_time=breastfeeding_time,
                    lunch_time_minutes=lunch_time_minutes,
                    raw_data=raw_data_json # Save raw data
                )
                db.add(new_func)
                created_count += 1
        
        db.commit()
        
        msg = "File processed successfully"
        if created_count == 0 and updated_count == 0:
            msg = "Warning: No records were processed. Please check column names (RUT, Name, etc)."

        return {
            "message": msg,
            "registros_creados": created_count,
            "registros_actualizados": updated_count
        }

    except Exception:
        logger.exception("Error procesando carga de funcionarios")
        raise HTTPException(status_code=500, detail="Error processing file")

def format_hours_list(hours_list):
    # hours_list is a list of strings or numbers
    # Filter out 0 or None
    valid_hours = [str(h) for h in hours_list if h and str(h) != "0"]
    if not valid_hours:
        return "0 hrs"
    return " y ".join([f"{h} hrs" for h in valid_hours])

def format_laws_list(laws_list):
    # Format law codes: "19.664, 15.076" -> "15076 y 19664"
    unique_laws = sorted(list(set(filter(None, laws_list))))
    
    if not unique_laws:
        return ""
    
    if len(unique_laws) == 1:
        return unique_laws[0]
        
    if len(unique_laws) == 2:
        return f"{unique_laws[0]} y {unique_laws[1]}"
        
    # 3 or more: "A, B y C"
    return f"{', '.join(unique_laws[:-1])} y {unique_laws[-1]}"

def get_latest_inactive_reasons_by_rut(
    db: Session,
    period_id: Optional[int],
    ruts: Optional[list[str]] = None,
) -> dict[str, str]:
    if period_id is None:
        return {}

    latest_dismiss_subquery = db.query(
        models.OfficialAudit.rut.label("rut"),
        func.max(models.OfficialAudit.created_at).label("max_created_at"),
    ).filter(
        models.OfficialAudit.action == "Dismiss",
        models.OfficialAudit.period_id == period_id,
        models.OfficialAudit.rut.isnot(None),
    )

    if ruts:
        latest_dismiss_subquery = latest_dismiss_subquery.filter(models.OfficialAudit.rut.in_(ruts))

    latest_dismiss_subquery = latest_dismiss_subquery.group_by(models.OfficialAudit.rut).subquery()

    rows = db.query(
        models.OfficialAudit.rut,
        models.OfficialAudit.reason,
    ).join(
        latest_dismiss_subquery,
        and_(
            models.OfficialAudit.rut == latest_dismiss_subquery.c.rut,
            models.OfficialAudit.created_at == latest_dismiss_subquery.c.max_created_at,
        ),
    ).all()

    return {rut: reason for rut, reason in rows if rut and reason}


def consolidate_contracts(contracts, programmed_details=None, inactive_reasons=None):
    grouped_people = {}
    if programmed_details is None:
        programmed_details = {}
    if inactive_reasons is None:
        inactive_reasons = {}
    
    for item in contracts:
        # Determine if item is Funcionario or tuple (Funcionario, group_id)
        if isinstance(item, models.Funcionario):
            contract = item
            group_id = None
        elif hasattr(item, '__getitem__') and not isinstance(item, str): # Handle Row/Tuple
            # Verify if first element is Funcionario
            if isinstance(item[0], models.Funcionario):
                contract = item[0]
                try:
                    group_id = item[1]
                except IndexError:
                    group_id = None
            else:
                 # Fallback if structure is unexpected
                 contract = item
                 group_id = None
        else:
            contract = item
            group_id = None

        # Key by RUT. If RUT is missing, use ID (shouldn't happen for valid employees but safety first)

        key = contract.rut if contract.rut else f"no-rut-{contract.id}"
        
        if key not in grouped_people:
            grouped_people[key] = {
                "id": contract.id, # Use the ID of the first contract found
                "name": contract.name,
                "rut": contract.rut,
                "dv": contract.dv,
                "title": contract.title,
                "specialty_sis": contract.specialty_sis,
                "created_at": contract.created_at,
                "law_codes": [],
                "hours": [],
                "observations_list": [],
                "contracts": [],
                "lunch_minutes": 0,
                # New fields
                "holiday_days": contract.holiday_days or 0,
                "administrative_days": contract.administrative_days or 0,
                "congress_days": contract.congress_days or 0,
                "breastfeeding_time": contract.breastfeeding_time or 0,
                "status": contract.status, # Added status
                "inactive_reason": inactive_reasons.get(contract.rut),
                "active_status_label": None,
                
                "is_active_roster": contract.is_active_roster, # Take from first contract
                "is_scheduled": False,
                "programming_id": None,
                "programming_updated_at": None,
                "total_scheduled_hours": 0.0,
                "group_id": group_id # Take from first contract found with group
            }
        
        # Check if this contract is programmed
        if contract.id in programmed_details:
             details = programmed_details[contract.id]
             grouped_people[key]["id"] = contract.id
             grouped_people[key]["is_scheduled"] = True
             grouped_people[key]["programming_id"] = details["id"]
             grouped_people[key]["programming_updated_at"] = details["updated_at"]
             grouped_people[key]["total_scheduled_hours"] = details["scheduled_hours"]
             if details.get("dismiss_partial_hours") is not None and details.get("assigned_status"):
                 grouped_people[key]["active_status_label"] = details["assigned_status"]

        # Accumulate values
        grouped_people[key]["law_codes"].append(contract.law_code)
        grouped_people[key]["hours"].append(contract.hours_per_week)
        if contract.observations:
            grouped_people[key]["observations_list"].append(contract.observations)
        
        # Use max for days if multiple contracts exist (or sum? usually these are per person, so max/first is safer)
        grouped_people[key]["holiday_days"] = max(grouped_people[key]["holiday_days"], contract.holiday_days or 0)
        grouped_people[key]["administrative_days"] = max(grouped_people[key]["administrative_days"], contract.administrative_days or 0)
        grouped_people[key]["congress_days"] = max(grouped_people[key]["congress_days"], contract.congress_days or 0)
        grouped_people[key]["breastfeeding_time"] = max(grouped_people[key]["breastfeeding_time"], contract.breastfeeding_time or 0)
        
        grouped_people[key]["lunch_minutes"] = max(grouped_people[key]["lunch_minutes"], contract.lunch_time_minutes or 0)
        
        grouped_people[key]["contracts"].append({
            "id": contract.id,
            "law_code": contract.law_code,
            "hours": contract.hours_per_week,
            "contract_correlative": contract.contract_correlative,
            "observations": contract.observations
        })
    
    # Format response
    response_data = []
    for key, person in grouped_people.items():
        # Format law codes
        law_str = format_laws_list(person["law_codes"])
        
        # Format hours: "22 hrs y 11 hrs"
        hours_str = " y ".join([f"{h} hrs" for h in person["hours"] if h > 0])
        if not hours_str:
            hours_str = "0 hrs"
            
        # Format observations (unique values)
        obs_set = set(person.get("observations_list", []))
        obs_str = " | ".join([o for o in obs_set if o])
            
        response_data.append({
            "id": person["id"],
            "name": person["name"],
            "rut": person["rut"],
            "dv": person["dv"],
            "title": person["title"],
            "specialty_sis": person["specialty_sis"],
            "law_code": law_str,
            "hours_per_week": hours_str,
            "lunch_time_minutes": person["lunch_minutes"],
            "status": person["status"], # Added status
            "inactive_reason": person["inactive_reason"],
            "active_status_label": person["active_status_label"],
            "observations": obs_str, # Added observations
            
            "holiday_days": person["holiday_days"],
            "administrative_days": person["administrative_days"],
            "congress_days": person["congress_days"],
            "breastfeeding_time": person["breastfeeding_time"],
            
            "created_at": person["created_at"],
            "is_scheduled": person["is_scheduled"],
            "programming_id": person["programming_id"],
            "programming_updated_at": person["programming_updated_at"],
            "total_scheduled_hours": person["total_scheduled_hours"],
            "group_id": person["group_id"],
            "contracts": person["contracts"]
        })
        
    return response_data

def get_programmed_details(db: Session, period_id: int):
    details = {}
    if not period_id:
        return details

    programmed_rows = db.query(
        models.Programming.funcionario_id,
        models.Programming.id,
        models.Programming.updated_at,
        models.Programming.time_unit,
        models.Programming.assigned_status,
        models.Programming.dismiss_partial_hours,
        func.coalesce(func.sum(models.ProgrammingItem.assigned_hours), 0.0).label("scheduled_total")
    ).outerjoin(
        models.ProgrammingItem,
        models.ProgrammingItem.programming_id == models.Programming.id
    ).filter(
        models.Programming.period_id == period_id
    ).group_by(
        models.Programming.funcionario_id,
        models.Programming.id,
        models.Programming.updated_at,
        models.Programming.time_unit,
        models.Programming.assigned_status,
        models.Programming.dismiss_partial_hours,
    ).all()

    for row in programmed_rows:
        total = row.scheduled_total or 0.0
        # Normalize to hours if needed
        if row.time_unit == 'minutes':
            total = float(total) / 60.0
        else:
            total = float(total)
        
        details[row.funcionario_id] = {
            "id": row.id,
            "updated_at": row.updated_at,
            "scheduled_hours": total,
            "assigned_status": row.assigned_status,
            "dismiss_partial_hours": row.dismiss_partial_hours,
        }
    return details

@router.get("", response_model=List[schemas.FuncionarioConsolidated])
def read_funcionarios(
    skip: int = 0, 
    limit: int = DEFAULT_FUNCIONARIOS_LIMIT, 
    active_only: bool = False, # Changed default to False to handle filtering in UI 
    status: Optional[str] = None, # New status filter
    user_id: Optional[int] = None,
    period_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    normalized_skip = normalize_skip(skip)
    normalized_limit = normalize_limit(
        limit,
        default=DEFAULT_FUNCIONARIOS_LIMIT,
        max_value=MAX_FUNCIONARIOS_LIMIT,
    )
    effective_user_id = PermissionChecker.resolve_user_scope(current_user, user_id)

    # Determine base query and filtering based on user role
    user = None
    if True:
        user = db.query(models.User).filter(models.User.id == effective_user_id).first()

    # If period_id not provided, try to default to active period
    if period_id is None:
        active_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).first()
        if active_period:
            period_id = active_period.id

    # Fetch programmed details for this period
    programmed_details = get_programmed_details(db, period_id)

    # Determine User Role for Filtering
    user_role = 'user'
    if effective_user_id is not None:
        user_obj = db.query(models.User).filter(models.User.id == effective_user_id).first()
        if user_obj:
            user_role = user_obj.role

    if effective_user_id is not None:
        # If user is admin, show all (unless filtered otherwise? usually admin sees all)
        # But if specific user_id is requested (e.g. "My Officials"), we filter.
        
        # FIX: Instead of just joining, we find all RUTs linked to the user,
        # then fetch ALL contracts for those RUTs. This ensures multi-contract officials
        # show all their hours, not just the specific contract row linked in UserOfficial.
        
        # 1. Get linked RUTs and their Group IDs
        linked_officials = get_period_group_assignments(db, period_id, effective_user_id)
            
        linked_ruts = [r[0] for r in linked_officials]
        # Map RUT to Group ID (Note: If a person is in multiple groups, this simplistic map takes the last one.
        # Ideally, group assignment should be consistent per person.)
        rut_to_group = {r[0]: r[1] for r in linked_officials}
        
        # Filter hidden officials
        linked_ruts = get_user_scoped_ruts(db, effective_user_id, period_id=period_id)
        
        if not linked_ruts:
             return []

        # 2. Query all contracts for these RUTs
        query = db.query(models.Funcionario).filter(
            models.Funcionario.rut.in_(linked_ruts)
        )
            
        if active_only:
            query = query.filter(models.Funcionario.is_active_roster == True)
        
        if status:
            if status == "todos":
                pass
            else:
                query = query.filter(models.Funcionario.status == status)
            
        if period_id:
             query = query.filter(models.Funcionario.period_id == period_id)
             
        # Apply Role Filtering
        if user_role == 'medical_coordinator':
             query = query.filter(models.Funcionario.title == 'Médico(a) Cirujano(a)')
        elif user_role == 'non_medical_coordinator':
             query = query.filter(models.Funcionario.title != 'Médico(a) Cirujano(a)')

        all_contracts = query.order_by(models.Funcionario.rut).all()
        
        # 3. Attach group_id to each contract based on RUT
        contracts_with_groups = []
        for contract in all_contracts:
            group_id = rut_to_group.get(contract.rut)
            contracts_with_groups.append((contract, group_id))
        
        inactive_reasons = get_latest_inactive_reasons_by_rut(db, period_id, linked_ruts)
        consolidated = consolidate_contracts(contracts_with_groups, programmed_details, inactive_reasons)
        
        # Apply pagination manually on the aggregated list
        start = normalized_skip
        end = normalized_skip + normalized_limit
        
        # Logging for audit
        if len(consolidated) > 0:
            scheduled_count = sum(1 for c in consolidated if c['is_scheduled'])
            logger.info(
                "read_funcionarios user_filtered total=%s scheduled=%s unscheduled=%s period_id=%s user_id=%s",
                len(consolidated),
                scheduled_count,
                len(consolidated) - scheduled_count,
                period_id,
                effective_user_id,
            )
        
        return consolidated[start:end]
    
    query = db.query(models.Funcionario)

    if active_only:
        query = query.filter(models.Funcionario.is_active_roster == True)

    if status and status != "todos":
        query = query.filter(models.Funcionario.status == status)

    if period_id:
        query = query.filter(models.Funcionario.period_id == period_id)

    query = apply_role_based_funcionario_filter(query, user_role)

    all_contracts = query.order_by(models.Funcionario.rut).all()
    rut_to_group = build_rut_to_group(get_period_group_assignments(db, period_id))
    contracts_with_groups = [(contract, rut_to_group.get(contract.rut)) for contract in all_contracts]
    inactive_reasons = get_latest_inactive_reasons_by_rut(db, period_id, [contract.rut for contract in all_contracts if contract.rut])
    consolidated = consolidate_contracts(contracts_with_groups, programmed_details, inactive_reasons)

    start = normalized_skip
    end = normalized_skip + normalized_limit
    return consolidated[start:end]

@router.get("/search", response_model=List[schemas.FuncionarioConsolidated])
def search_funcionarios(
    q: str, 
    user_id: Optional[int] = None, 
    period_id: Optional[int] = None, 
    search_mode: str = 'local', # local (linked officials) or global (all officials)
    limit: int = DEFAULT_SEARCH_RESULTS_LIMIT,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    normalized_limit = normalize_limit(
        limit,
        default=DEFAULT_SEARCH_RESULTS_LIMIT,
        max_value=MAX_SEARCH_RESULTS_LIMIT,
    )
    effective_user_id = PermissionChecker.resolve_user_scope(current_user, user_id)
    search_term = f"%{q}%"

    # RUT Handling Logic
    clean_q = q.replace(".", "").strip()
    is_rut_search = False
    rut_body = ""
    rut_dv = ""
    implicit_dv_search = False
    potential_body = ""
    potential_dv = ""
    
    if "-" in clean_q:
        parts = clean_q.split("-")
        if len(parts) == 2:
            rut_body = parts[0]
            rut_dv = parts[1].upper()
            # Allow for RUTs that might have non-digits if dirty, but usually digits
            if rut_body.isdigit():
                 is_rut_search = True
    elif len(clean_q) > 1 and (clean_q.isdigit() or (clean_q[:-1].isdigit() and clean_q[-1].upper() == 'K')):
          # Case: No hyphen. Could be Body or Body+DV.
          rut_body = clean_q
          is_rut_search = True
          implicit_dv_search = True
          potential_body = clean_q[:-1]
          potential_dv = clean_q[-1].upper()

     # Construct search condition
    base_search = models.Funcionario.name.ilike(search_term)
    rut_search = None
     
    if is_rut_search:
        if rut_dv:
            # If DV provided (Explicit Hyphen), we want exact match on RUT and DV
            rut_search = (models.Funcionario.rut == rut_body) & (models.Funcionario.dv == rut_dv)
        elif implicit_dv_search:
             # Implicit Hyphen: Match as Body OR Match as Body+DV
             cond1 = models.Funcionario.rut.ilike(f"%{rut_body}%")
             cond2 = (models.Funcionario.rut == potential_body) & (models.Funcionario.dv == potential_dv)
             rut_search = or_(cond1, cond2)
        else:
            # If no DV, partial match on RUT body
            rut_search = models.Funcionario.rut.ilike(f"%{rut_body}%")
    else:
        # Fallback to standard search if not clearly a RUT
        rut_search = models.Funcionario.rut.ilike(search_term)
         
    final_search_condition = or_(base_search, rut_search)

     # If period_id not provided, try to default to active period
    if period_id is None:
        active_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).first()
        if active_period:
            period_id = active_period.id
            
    # Fetch programmed details for this period
    programmed_details = get_programmed_details(db, period_id)
    
    # Determine User Role for Filtering
    user_role = 'user'
    if effective_user_id is not None:
        user = db.query(models.User).filter(models.User.id == effective_user_id).first()
        if user:
            user_role = user.role

    # Audit Log for Access (Implicit via request logging, but explicitly logging search context here)
    if effective_user_id is not None:
        logger.info(
            "search_funcionarios access user_id=%s role=%s mode=%s query=%r",
            effective_user_id,
            user_role,
            search_mode,
            q,
        )

    # Case 1: Search within Linked Officials (Local Scope)
    if effective_user_id is not None and search_mode == 'local':
        # 1. Get linked RUTs and their Group IDs
        linked_officials = get_period_group_assignments(db, period_id, effective_user_id)

        linked_ruts = get_user_scoped_ruts(db, effective_user_id, period_id=period_id)
        rut_to_group = build_rut_to_group(linked_officials)
        
        if not linked_ruts:
             return []

        # 2. Query all contracts for these RUTs AND matching search
        query = db.query(models.Funcionario).filter(
            models.Funcionario.rut.in_(linked_ruts)
        ).filter(final_search_condition)
        
        if period_id:
            query = query.filter(models.Funcionario.period_id == period_id)
            
        # Apply Role Filtering
        query = apply_role_based_funcionario_filter(query, user_role)
            
        all_contracts = query.order_by(models.Funcionario.rut).all()
        
        # 3. Attach group_id
        contracts_with_groups = []
        for contract in all_contracts:
            group_id = rut_to_group.get(contract.rut)
            contracts_with_groups.append((contract, group_id))
            
        inactive_reasons = get_latest_inactive_reasons_by_rut(db, period_id, linked_ruts)
        consolidated = consolidate_contracts(contracts_with_groups, programmed_details, inactive_reasons)
        return consolidated[:normalized_limit]

    # Case 2: Global Search (RRHH Database)
    # This is used by "Nuevo Funcionario" modal
    
    query = db.query(models.Funcionario).filter(final_search_condition)

    if user_role not in {'admin', 'medical_coordinator', 'non_medical_coordinator'} and effective_user_id is not None:
        scoped_ruts = get_user_scoped_ruts(db, effective_user_id, period_id=period_id, include_hidden=True)
        if not scoped_ruts:
            return []
        query = query.filter(models.Funcionario.rut.in_(scoped_ruts))
    
    if period_id:
        query = query.filter(models.Funcionario.period_id == period_id)
        
    # Apply Role Filtering (CRITICAL for "Nuevo Funcionario")
    query = apply_role_based_funcionario_filter(query, user_role)
    # admin sees all
        
    all_contracts = query.order_by(models.Funcionario.rut).all()
    
    inactive_reasons = get_latest_inactive_reasons_by_rut(db, period_id, [contract.rut for contract in all_contracts if contract.rut])
    consolidated = consolidate_contracts(all_contracts, programmed_details, inactive_reasons)
    return consolidated[:normalized_limit]

@router.post("/{funcionario_id}/bind")
def bind_funcionario_to_user(
    funcionario_id: int, 
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    payload = payload or {}
    PermissionChecker.require_read_only_access(current_user)
    user_id = PermissionChecker.resolve_user_scope(current_user, payload.get("user_id"))
    PermissionChecker.check_can_bind_funcionario(current_user, funcionario_id, db)
        
    # Check if already bound
    exists = db.query(models.UserOfficial).filter(
        models.UserOfficial.user_id == user_id,
        models.UserOfficial.funcionario_id == funcionario_id
    ).first()
    
    if exists:
        return {"message": "Already bound"}
        
    # Check if hidden and unhide
    funcionario = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()
    if funcionario and funcionario.rut:
        hidden = db.query(models.UserHiddenOfficial).filter(
            models.UserHiddenOfficial.user_id == user_id,
            models.UserHiddenOfficial.funcionario_rut == funcionario.rut,
            models.UserHiddenOfficial.period_id == funcionario.period_id,
        ).first()
        if hidden:
            db.delete(hidden)
        
    new_bind = models.UserOfficial(user_id=user_id, funcionario_id=funcionario_id)
    db.add(new_bind)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"message": "Already bound"}
    return {"message": "Bound successfully"}

@router.delete("/{funcionario_id}/bind")
def unbind_funcionario_from_user(
    funcionario_id: int, 
    user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.require_read_only_access(current_user)
    user_id = PermissionChecker.resolve_user_scope(current_user, user_id)
    bind = db.query(models.UserOfficial).filter(
        models.UserOfficial.user_id == user_id,
        models.UserOfficial.funcionario_id == funcionario_id
    ).first()
    
    if not bind:
        raise HTTPException(status_code=404, detail="Binding not found")
        
    db.delete(bind)
    db.commit()
    return {"message": "Unbound successfully"}

@router.put("/{funcionario_id}/group")
def assign_funcionario_group(
    funcionario_id: int, 
    payload: dict = Body(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    PermissionChecker.require_read_only_access(current_user)
    user_id = PermissionChecker.resolve_user_scope(current_user, payload.get("user_id"))
    group_id = payload.get("group_id") # Can be None
    
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
        
    bind = db.query(models.UserOfficial).filter(
        models.UserOfficial.user_id == user_id,
        models.UserOfficial.funcionario_id == funcionario_id
    ).first()
    
    if not bind:
        raise HTTPException(status_code=404, detail="Binding not found")

    if group_id is not None:
        PermissionChecker.check_can_manage_group(current_user, group_id, db)
        group = db.query(models.Group).filter(models.Group.id == group_id).first()
        funcionario = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()

        if not group or not funcionario:
            raise HTTPException(status_code=404, detail="Group or funcionario not found")

        if group.period_id is not None and funcionario.period_id != group.period_id:
            raise HTTPException(
                status_code=400,
                detail="No se puede asignar un funcionario a un grupo de otro período"
            )
        
    bind.group_id = group_id
    db.commit()
    return {"message": "Group assigned successfully"}

@router.post("/{funcionario_id}/dismiss")
def dismiss_funcionario(
    funcionario_id: int,
    payload: schemas.DismissSelectionRequest = Body(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    payload_dict = payload.model_dump(exclude_none=True) if hasattr(payload, "model_dump") else dict(payload)
    PermissionChecker.require_read_only_access(current_user)
    user_id = PermissionChecker.resolve_user_scope(current_user, payload_dict.get("user_id")) # Who performed the action
    selection = resolve_dismiss_selection(db, payload_dict)
    partial_hours = ensure_partial_commission_hours(selection.reason, selection.suboption, payload_dict.get("partial_hours"))
    keeps_official_active = is_partial_commission_selection(selection.reason, selection.suboption)
    reason_label = selection.display_label
    reason_category = resolve_reason_category(selection.reason.reason_category, reason_label)
        
    funcionario = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()
    if not funcionario:
        raise HTTPException(status_code=404, detail="Funcionario not found")

    PermissionChecker.check_can_access_funcionario(current_user, funcionario_id, db)
        
    # Determine Action
    if selection.reason.action_type != HIDE_ACTION:
        if not keeps_official_active:
            # Soft Delete / Deactivate
            # Update all contracts with same RUT? 
            # Usually dismiss applies to the person, so all contracts with that RUT should be updated.
            if funcionario.rut:
                contracts = db.query(models.Funcionario).filter(
                    models.Funcionario.rut == funcionario.rut,
                    models.Funcionario.period_id == funcionario.period_id,
                ).all()
                for c in contracts:
                    c.status = "inactivo"
            else:
                funcionario.status = "inactivo"
            
        action = "Dismiss"
        
    else:
        # Logical Delete (Hide from User)
        if not user_id:
             raise HTTPException(status_code=400, detail="User ID required for logical delete")

        # Check if already hidden
        if funcionario.rut:
            existing_hide = db.query(models.UserHiddenOfficial).filter(
                models.UserHiddenOfficial.user_id == user_id,
                models.UserHiddenOfficial.funcionario_rut == funcionario.rut,
                models.UserHiddenOfficial.period_id == funcionario.period_id,
            ).first()

            if not existing_hide:
                hidden = models.UserHiddenOfficial(
                    user_id=user_id,
                    funcionario_rut=funcionario.rut,
                    period_id=funcionario.period_id,
                    reason=reason_label,
                    suboption=selection.suboption.name if selection.suboption else None,
                    dismiss_reason_id=selection.reason.id,
                    dismiss_suboption_id=selection.suboption.id if selection.suboption else None,
                    dismiss_partial_hours=partial_hours,
                )
                db.add(hidden)
        
        # We DO NOT delete the record anymore.
        # But we might want to remove the UserOfficial binding if it exists for this user?
        # If I hide it, I shouldn't be bound to it.
        # Let's remove binding for THIS user.
        
        # Remove binding for this user (for all contracts with this RUT? Or just this one?)
        # If I hide the PERSON, I should probably unbind all contracts for that person.
        
        if funcionario.rut:
             contracts = db.query(models.Funcionario).filter(
                 models.Funcionario.rut == funcionario.rut,
                 models.Funcionario.period_id == funcionario.period_id,
             ).all()
             contract_ids = [c.id for c in contracts]
             db.query(models.UserOfficial).filter(
                  models.UserOfficial.user_id == user_id, 
                 models.UserOfficial.funcionario_id.in_(contract_ids)
             ).delete(synchronize_session=False)
        else:
             db.query(models.UserOfficial).filter(
                 models.UserOfficial.user_id == user_id, 
                 models.UserOfficial.funcionario_id == funcionario.id
              ).delete()
              
        action = "Hide"

    # Audit Log
    audit = models.OfficialAudit(
        funcionario_id=funcionario_id if action == "Dismiss" else None,
        funcionario_name=funcionario.name,
        rut=funcionario.rut,
        period_id=funcionario.period_id,
        user_id=user_id,
        action=action,
        reason=reason_label,
        suboption=selection.suboption.name if selection.suboption else None,
        dismiss_reason_id=selection.reason.id,
        dismiss_suboption_id=selection.suboption.id if selection.suboption else None,
        reason_category=reason_category,
        dismiss_partial_hours=partial_hours,
    )
    db.add(audit)

    if partial_hours is not None and selection.suboption is not None:
        existing_programming = db.query(models.Programming).filter(
            models.Programming.funcionario_id == funcionario.id,
            models.Programming.period_id == funcionario.period_id,
        ).first()
        ensure_partial_commission_base_programming(existing_programming, funcionario)
        apply_partial_commission_programming(
            db,
            funcionario=funcionario,
            user_id=user_id,
            reason=selection.reason,
            suboption=selection.suboption,
            partial_hours=partial_hours,
        )
    
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ya existe un ocultamiento registrado para ese usuario y funcionario.",
        )
    
    return {
        "message": f"Funcionario processed: {action}",
        "action": action,
        "status": funcionario.status,
        "reason": reason_label,
        "reason_id": selection.reason.id,
        "suboption_id": selection.suboption.id if selection.suboption else None,
        "partial_hours": partial_hours,
        "active_status_label": reason_label if keeps_official_active else None,
    }

@router.post("/{funcionario_id}/activate")
def activate_funcionario(
    funcionario_id: int,
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    payload = payload or {}
    clear_partial_commission = bool(payload.get("clear_partial_commission"))
    PermissionChecker.require_read_only_access(current_user)
    user_id = PermissionChecker.resolve_user_scope(current_user, payload.get("user_id")) # Who performed the action
    
    funcionario = db.query(models.Funcionario).filter(models.Funcionario.id == funcionario_id).first()
    if not funcionario:
        raise HTTPException(status_code=404, detail="Funcionario not found")

    PermissionChecker.check_can_access_funcionario(current_user, funcionario_id, db)
    
    # Activate
    # Update all contracts with same RUT unless we are only clearing a partial commission
    if clear_partial_commission:
        funcionario.status = "activo"
    elif funcionario.rut:
        contracts = db.query(models.Funcionario).filter(
            models.Funcionario.rut == funcionario.rut,
            models.Funcionario.period_id == funcionario.period_id,
        ).all()
        for c in contracts:
            c.status = "activo"
    else:
        funcionario.status = "activo"

    programming = db.query(models.Programming).filter(
        models.Programming.funcionario_id == funcionario_id,
        models.Programming.period_id == funcionario.period_id,
    ).first()
    had_partial_commission = programming is not None and programming.dismiss_partial_hours is not None
    clear_partial_commission_programming(programming)
    if programming is not None:
        programming.updated_by_id = user_id
        if had_partial_commission:
            programming.version = (programming.version or 0) + 1
        
    # Audit Log
    audit = models.OfficialAudit(
        funcionario_id=funcionario_id,
        funcionario_name=funcionario.name,
        rut=funcionario.rut,
        period_id=funcionario.period_id,
        user_id=user_id,
        action="Clear Partial Commission" if clear_partial_commission else "Activate",
        reason="Sin comisión" if clear_partial_commission else "Manual Activation"
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "Funcionario activated"}
