
from pathlib import Path
import logging

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Body
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import pandas as pd
import io
import urllib.parse

from .. import models, schemas, database, auth
from ..permissions import PermissionChecker

router = APIRouter()
logger = logging.getLogger(__name__)

PUBLIC_CONFIG_KEYS = {"header_info_text"}
DEFAULT_CONFIG_LIST_LIMIT = 100
MAX_CONFIG_LIST_LIMIT = 100
MAX_EXCEL_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024
MAX_EXCEL_UPLOAD_SIZE_MB = MAX_EXCEL_UPLOAD_SIZE_BYTES // (1024 * 1024)
ALLOWED_EXCEL_EXTENSIONS = {".xlsx", ".xls"}
ALLOWED_EXCEL_CONTENT_TYPES = {
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}
optional_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/users/login", auto_error=False)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def normalize_skip(value: int) -> int:
    return max(value, 0)


def normalize_limit(value: int, *, default: int = DEFAULT_CONFIG_LIST_LIMIT, max_value: int = MAX_CONFIG_LIST_LIMIT) -> int:
    if value <= 0:
        return default
    return min(value, max_value)


def is_public_config_key(key: str) -> bool:
    return key in PUBLIC_CONFIG_KEYS


def get_upload_file_size(file: UploadFile) -> Optional[int]:
    stream = getattr(file, "file", None)
    if stream is None or not hasattr(stream, "seek") or not hasattr(stream, "tell"):
        return None

    current_position = stream.tell()
    stream.seek(0, io.SEEK_END)
    size = stream.tell()
    stream.seek(current_position)
    return size


async def read_validated_excel_upload(file: UploadFile) -> bytes:
    filename = (file.filename or "").strip()
    if not filename:
        raise HTTPException(status_code=400, detail="Missing file name")

    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXCEL_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an Excel file (.xlsx or .xls).")

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_EXCEL_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file content type. Please upload an Excel file.")

    file_size = get_upload_file_size(file)
    if file_size is not None and file_size > MAX_EXCEL_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum allowed size is {MAX_EXCEL_UPLOAD_SIZE_MB} MB.")

    contents = await file.read(MAX_EXCEL_UPLOAD_SIZE_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(contents) > MAX_EXCEL_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Maximum allowed size is {MAX_EXCEL_UPLOAD_SIZE_MB} MB.")

    return contents


async def read_excel_dataframe(file: UploadFile, *, upload_name: str) -> pd.DataFrame:
    contents = await read_validated_excel_upload(file)
    try:
        return pd.read_excel(io.BytesIO(contents))
    except Exception:
        logger.warning("Archivo Excel inválido para %s", upload_name, exc_info=True)
        raise HTTPException(status_code=400, detail="Invalid file format")


def get_optional_active_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(optional_oauth2_scheme),
) -> Optional[models.User]:
    if not token:
        return None

    user = auth.get_user_from_token(token, db, expected_type="access")
    return auth.require_active_user(user)


def require_admin_config_access(current_user: models.User = Depends(auth.get_current_active_user)) -> models.User:
    PermissionChecker.require_admin(current_user)
    return current_user

# Global Config
@router.get("/configs", response_model=List[schemas.ConfigResponse])
def read_configs(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin_config_access)
):
    normalized_skip = normalize_skip(skip)
    normalized_limit = normalize_limit(limit)
    configs = db.query(models.Config).offset(normalized_skip).limit(normalized_limit).all()
    return configs

@router.get("/configs/{key}", response_model=schemas.ConfigResponse)
def read_config(
    key: str, 
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_active_user)
):
    if not is_public_config_key(key):
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )
        PermissionChecker.require_admin(current_user)

    config = db.query(models.Config).filter(models.Config.key == key).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@router.post("/configs", response_model=schemas.ConfigResponse)
def create_or_update_config(
    config: schemas.ConfigCreate, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    db_config = db.query(models.Config).filter(models.Config.key == config.key).first()
    if db_config:
        db_config.value = config.value
        db_config.description = config.description
    else:
        db_config = models.Config(**config.dict())
        db.add(db_config)
    
    db.commit()
    db.refresh(db_config)
    return db_config

@router.delete("/configs/{key}")
def delete_config(
    key: str, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    config = db.query(models.Config).filter(models.Config.key == key).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    db.delete(config)
    db.commit()
    return {"message": "Config deleted"}

# Specialties
@router.get("/specialties", response_model=List[schemas.SpecialtyResponse])
def read_specialties(
    skip: int = 0, 
    limit: int = 1000, 
    period_id: Optional[int] = None,
    visible_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.Specialty)
    if period_id:
        query = query.filter(models.Specialty.period_id == period_id)
    
    if visible_only:
        # Case insensitive check for "SI"
        query = query.filter(func.upper(models.Specialty.visible) == "SI")
        
    specialties = query.offset(skip).limit(limit).all()
    return specialties

@router.delete("/specialties")
def delete_specialties(
    period_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    # Delete related stats first
    subquery = db.query(models.Specialty.id).filter(models.Specialty.period_id == period_id)
    db.query(models.SpecialtyStat).filter(models.SpecialtyStat.specialty_id.in_(subquery)).delete(synchronize_session=False)
    
    # Delete specialties
    deleted_count = db.query(models.Specialty).filter(models.Specialty.period_id == period_id).delete(synchronize_session=False)
    
    db.commit()
    return {"message": f"Deleted {deleted_count} specialties for period {period_id}"}

@router.post("/specialties/upload")
async def upload_specialties(
    period_id: int,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    df = await read_excel_dataframe(file, upload_name="specialties")
    
    created_count = 0
    updated_count = 0
    
    # Normalize column names to lowercase for easier matching
    df.columns = df.columns.str.lower()
    
    for _, row in df.iterrows():
        # Clean data - try different potential column names
        name = None
        for col in ['especialidad', 'name', 'nombre']:
            if col in df.columns:
                val = row[col]
                if pd.notna(val):
                    name = str(val).strip()
                    break
        
        if not name:
            continue
            
        # Parse 'visible' column (Default to "SI")
        visible = "SI"
        for col in ['visible', 'visible?']:
            if col in df.columns:
                val = row[col]
                if pd.notna(val):
                    visible = str(val).strip().upper()
                    # Ensure only SI/NO
                    if visible not in ["SI", "NO"]:
                        visible = "SI" # Fallback
                    break

        # Check by name AND period_id
        specialty = db.query(models.Specialty).filter(
            models.Specialty.name == name,
            models.Specialty.period_id == period_id
        ).first()
        
        if not specialty:
            specialty = models.Specialty(name=name, period_id=period_id, visible=visible)
            db.add(specialty)
            db.flush() # to get id
            created_count += 1
        else:
            if specialty.visible != visible:
                specialty.visible = visible
            updated_count += 1
        
        # Stats
        new_pct = 0.0
        yield_new = 0.0
        yield_control = 0.0
        
        # Helper to safely get float
        def get_float(row, cols):
            for c in cols:
                if c in row:
                    try:
                        val = float(row[c])
                        if pd.notna(val):
                            return val
                    except:
                        pass
            return 0.0

        new_pct = get_float(row, ['porcentajeconsultanueva', 'new_consult_percentage', '% consulta nueva', 'consulta nueva'])
        yield_new = get_float(row, ['rendimientonuevo', 'yield_new', 'rendimiento nuevo'])
        yield_control = get_float(row, ['rendimientocontrol', 'yield_control', 'rendimiento control'])

        if specialty.stats:
            specialty.stats.new_consult_percentage = new_pct
            specialty.stats.yield_new = yield_new
            specialty.stats.yield_control = yield_control
        else:
            stats = models.SpecialtyStat(
                specialty_id=specialty.id,
                new_consult_percentage=new_pct,
                yield_new=yield_new,
                yield_control=yield_control
            )
            db.add(stats)
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception("Database error uploading specialties for period_id=%s", period_id)
        raise HTTPException(status_code=500, detail="Database error")
        
    return {"message": f"Processed successfully. Created: {created_count}, Updated: {updated_count}"}

@router.get("/specialties/template")
def download_specialties_template():
    df = pd.DataFrame(columns=['name', 'visible', 'new_consult_percentage', 'yield_new', 'yield_control'])
    
    # Instructions DataFrame
    instructions_data = [
        ["Columna", "Descripción", "Valores Permitidos"],
        ["name", "Nombre de la Especialidad", "Texto libre"],
        ["visible", "Determina si la especialidad aparece en los selectores", "SI / NO (Por defecto: SI)"],
        ["new_consult_percentage", "Porcentaje de Consulta Nueva", "Número (0-100)"],
        ["yield_new", "Rendimiento Consulta Nueva", "Número"],
        ["yield_control", "Rendimiento Consulta Control", "Número"]
    ]
    df_inst = pd.DataFrame(instructions_data[1:], columns=instructions_data[0])

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Specialties')
        df_inst.to_excel(writer, index=False, sheet_name='Instrucciones')
        
        # Format Specialties Sheet
        worksheet = writer.sheets['Specialties']
        worksheet.column_dimensions['A'].width = 30
        worksheet.column_dimensions['B'].width = 10 # Visible
        worksheet.column_dimensions['C'].width = 20
        worksheet.column_dimensions['D'].width = 20
        worksheet.column_dimensions['E'].width = 20
        
        # Format Instructions Sheet
        ws_inst = writer.sheets['Instrucciones']
        ws_inst.column_dimensions['A'].width = 25
        ws_inst.column_dimensions['B'].width = 50
        ws_inst.column_dimensions['C'].width = 30
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': f'attachment; filename="{urllib.parse.quote("plantilla_especialidades.xlsx")}"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# Performance Units
@router.get("/performance-units", response_model=List[schemas.PerformanceUnitResponse])
def read_performance_units(
    skip: int = 0, 
    limit: int = 100, 
    period_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.PerformanceUnit)
    if period_id:
        query = query.filter(models.PerformanceUnit.period_id == period_id)
    units = query.offset(skip).limit(limit).all()
    return units

@router.delete("/performance-units")
def delete_performance_units(
    period_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    deleted_count = db.query(models.PerformanceUnit).filter(models.PerformanceUnit.period_id == period_id).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {deleted_count} performance units for period {period_id}"}

@router.post("/performance-units/upload")
async def upload_performance_units(
    period_id: int,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    df = await read_excel_dataframe(file, upload_name="performance units")
    
    created_count = 0
    updated_count = 0 # Initialize updated_count
    df.columns = df.columns.str.lower()
    
    for _, row in df.iterrows():
        name = None
        for col in ['unidad', 'name', 'nombre', 'unidad desempeño', 'unidad de desempeño']:
            if col in df.columns:
                val = row[col]
                if pd.notna(val):
                    name = str(val).strip()
                    break
        
        if not name:
            continue
            
        # Check if exists in DB for this period
        unit = db.query(models.PerformanceUnit).filter(
            models.PerformanceUnit.name == name,
            models.PerformanceUnit.period_id == period_id
        ).first()
        
        if not unit:
            # Check session for duplicates
            exists_in_session = False
            for obj in db.new:
                if isinstance(obj, models.PerformanceUnit) and obj.name == name and obj.period_id == period_id:
                    exists_in_session = True
                    break
            
            if not exists_in_session:
                unit = models.PerformanceUnit(name=name, period_id=period_id)
                db.add(unit)
                created_count += 1
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        if "UNIQUE constraint failed" in str(e):
             raise HTTPException(status_code=400, detail="Duplicate unit found in the uploaded file")
        logger.exception("Database error uploading performance units for period_id=%s", period_id)
        raise HTTPException(status_code=500, detail="Database error")
        
    return {"message": f"Successfully processed {created_count} new performance units"}

@router.get("/performance-units/template")
def download_performance_units_template():
    df = pd.DataFrame(columns=['name'])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='PerformanceUnits')
        worksheet = writer.sheets['PerformanceUnits']
        worksheet.column_dimensions['A'].width = 40
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="plantilla_unidades_desempeno.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# Processes
@router.get("/processes", response_model=List[schemas.ProcessResponse])
def read_processes(
    skip: int = 0, 
    limit: int = 100, 
    period_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.Process)
    if period_id:
        query = query.filter(models.Process.period_id == period_id)
    processes = query.offset(skip).limit(limit).all()
    return processes

@router.delete("/processes")
def delete_processes(
    period_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    deleted_count = db.query(models.Process).filter(models.Process.period_id == period_id).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {deleted_count} processes for period {period_id}"}

@router.post("/processes/upload")
async def upload_processes(
    period_id: int,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    df = await read_excel_dataframe(file, upload_name="processes")
    
    created_count = 0
    updated_count = 0 # Initialize updated_count
    df.columns = df.columns.str.lower()
    
    for _, row in df.iterrows():
        name = None
        for col in ['proceso', 'name', 'nombre']:
            if col in df.columns:
                val = row[col]
                if pd.notna(val):
                    name = str(val).strip()
                    break
        
        if not name:
            continue
            
        process = db.query(models.Process).filter(
            models.Process.name == name,
            models.Process.period_id == period_id
        ).first()
        
        if not process:
            process = models.Process(name=name, period_id=period_id)
            db.add(process)
            created_count += 1
            
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Database error uploading processes for period_id=%s", period_id)
        raise HTTPException(status_code=500, detail="Database error")
        
    return {"message": f"Successfully processed {created_count} new processes"}

@router.get("/processes/template")
def download_processes_template():
    df = pd.DataFrame(columns=['name'])
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Processes')
        worksheet = writer.sheets['Processes']
        worksheet.column_dimensions['A'].width = 40
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="plantilla_procesos.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

# Activity Types
@router.get("/activities", response_model=List[schemas.ActivityTypeResponse])
def read_activity_types(
    skip: int = 0, 
    limit: int = 50000, 
    period_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    query = db.query(models.ActivityType)
    if period_id:
        query = query.filter(models.ActivityType.period_id == period_id)
    activities = query.offset(skip).limit(limit).all()
    return activities

@router.delete("/activities")
def delete_activity_types(
    period_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    deleted_count = db.query(models.ActivityType).filter(models.ActivityType.period_id == period_id).delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {deleted_count} activities for period {period_id}"}

@router.post("/activities/upload")
async def upload_activity_types(
    period_id: int,
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    df = await read_excel_dataframe(file, upload_name="activities")
    
    created_count = 0
    updated_count = 0
    df.columns = df.columns.str.lower()
    
    # Required columns mapping (Lower case to DB field)
    # Proceso -> process
    # Profesión -> profession
    # Especialidad -> specialty
    # Actividad Visible -> name
    # Visible -> visible
    # PRAIS -> prais
    # REQ RENDIMIENTO -> req_rendimiento
    # ORDEN -> order_index

    for _, row in df.iterrows():
        # Get 'Actividad Visible' (name) which is mandatory
        name = None
        for col in ['actividad visible', 'actividad', 'name']:
             if col in df.columns:
                 val = row[col]
                 if pd.notna(val):
                     name = str(val).strip()
                     break
        
        if not name:
            continue
            
        # Get other fields
        process = None
        if 'proceso' in df.columns and pd.notna(row['proceso']): process = str(row['proceso']).strip()
        
        profession = None
        if 'profesión' in df.columns and pd.notna(row['profesión']): profession = str(row['profesión']).strip()
        elif 'profesion' in df.columns and pd.notna(row['profesion']): profession = str(row['profesion']).strip()
        
        specialty = None
        if 'especialidad' in df.columns and pd.notna(row['especialidad']): specialty = str(row['especialidad']).strip()

        visible = "SI"
        if 'visible' in df.columns and pd.notna(row['visible']): visible = str(row['visible']).strip().upper()

        prais = None
        if 'prais' in df.columns and pd.notna(row['prais']): prais = str(row['prais']).strip().upper()
        elif 'atención prais' in df.columns and pd.notna(row['atención prais']): prais = str(row['atención prais']).strip().upper()

        req_rendimiento = "NO"
        if 'req rendimiento' in df.columns and pd.notna(row['req rendimiento']): 
            req_rendimiento = str(row['req rendimiento']).strip().upper()
            if req_rendimiento not in ["SI", "NO"]:
                raise HTTPException(status_code=400, detail=f"Invalid value for 'REQ RENDIMIENTO' in row {name}: Must be 'SI' or 'NO'")
        
        order_index = 0
        if 'orden' in df.columns and pd.notna(row['orden']): 
            try:
                order_index = int(float(row['orden']))
            except:
                order_index = 0

        # Check if exists in DB for this period
        # We assume uniqueness by compound key now: (name, period_id, profession, specialty, process)
        # Or if we dropped the unique constraint, we can just allow duplicates if they are truly different?
        # But we probably want to update if ALL fields match?
        # Let's match on everything to be safe, or just name+period and assume we are overwriting configurations?
        # If we overwrite based on Name+Period, we lose the ability to have "Comité" for multiple specialties.
        # So we must match on the full set of differentiating columns.
        
        query = db.query(models.ActivityType).filter(
            models.ActivityType.name == name,
            models.ActivityType.period_id == period_id
        )
        
        if process: query = query.filter(models.ActivityType.process == process)
        else: query = query.filter(models.ActivityType.process.is_(None))
            
        if profession: query = query.filter(models.ActivityType.profession == profession)
        else: query = query.filter(models.ActivityType.profession.is_(None))
            
        if specialty: query = query.filter(models.ActivityType.specialty == specialty)
        else: query = query.filter(models.ActivityType.specialty.is_(None))
            
        activity = query.first()
        
        if not activity:
            activity = models.ActivityType(
                name=name, 
                period_id=period_id,
                process=process,
                profession=profession,
                specialty=specialty,
                visible=visible,
                prais=prais,
                req_rendimiento=req_rendimiento,
                order_index=order_index
            )
            db.add(activity)
            created_count += 1
        else:
            # Update existing fields
            # activity.process = process # Already matched
            # activity.profession = profession # Already matched
            # activity.specialty = specialty # Already matched
            activity.visible = visible
            activity.prais = prais
            activity.req_rendimiento = req_rendimiento
            activity.order_index = order_index
            updated_count += 1 # Track updates too
            
    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Database error uploading activities for period_id=%s", period_id)
        raise HTTPException(status_code=500, detail="Database error")
        
    return {"message": f"Successfully processed. Created {created_count} new types, updated {updated_count} existing."}

@router.get("/activities/template")
def download_activities_template():
    # New template columns
    cols = ['Proceso', 'Profesión', 'Especialidad', 'Actividad Visible', 'Visible', 'Atención PRAIS', 'REQ RENDIMIENTO', 'ORDEN']
    df = pd.DataFrame(columns=cols)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Activities')
        worksheet = writer.sheets['Activities']
        for idx, _ in enumerate(cols):
            worksheet.column_dimensions[chr(65+idx)].width = 20
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="plantilla_actividades.xlsx"'
    }
    return StreamingResponse(output, headers=headers, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
