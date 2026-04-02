from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from api import auth, database, models, schemas
from api.permissions import PermissionChecker
from api.query_bounds import normalize_limit, normalize_skip
from api.routers.funcionarios import format_laws_list, get_programmed_details

router = APIRouter()

DEFAULT_GENERAL_LIMIT = 1000
MAX_GENERAL_LIMIT = 5000

@router.get("", response_model=list[schemas.GeneralOfficialRow])
def read_general_rows(
    skip: int = 0,
    limit: int = DEFAULT_GENERAL_LIMIT,
    period_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if not (PermissionChecker.is_admin(current_user) or PermissionChecker.is_supervisor(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Solo admin y supervisor pueden consultar General.",
        )

    normalized_skip = normalize_skip(skip)
    normalized_limit = normalize_limit(
        limit,
        default=DEFAULT_GENERAL_LIMIT,
        max_value=MAX_GENERAL_LIMIT,
    )

    if period_id is None:
        active_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.is_active == True).first()
        if active_period:
            period_id = active_period.id

    if period_id is None:
        return []

    assignments_query = db.query(
        models.UserOfficial,
        models.Funcionario,
        models.User,
    ).join(
        models.Funcionario,
        models.Funcionario.id == models.UserOfficial.funcionario_id,
    ).join(
        models.User,
        models.User.id == models.UserOfficial.user_id,
    ).filter(
        models.Funcionario.period_id == period_id,
        models.User.status == "activo",
    )

    if user_id is not None:
        assignments_query = assignments_query.filter(models.UserOfficial.user_id == user_id)

    assignments = assignments_query.all()
    if not assignments:
        return []

    scheduled_details = get_programmed_details(db, period_id)

    grouped_entries: dict[str, dict] = {}
    rut_to_keys: dict[str, set[str]] = defaultdict(set)
    contract_id_to_keys: dict[int, set[str]] = defaultdict(set)
    requested_ruts: set[str] = set()
    no_rut_contract_ids: set[int] = set()

    for _, contract, user in assignments:
        contract_key = (contract.rut or "").strip() or f"no-rut-{contract.id}"
        entry_key = contract_key
        if entry_key not in grouped_entries:
            grouped_entries[entry_key] = {
                "funcionario_id": contract.id,
                "funcionario": contract.name,
                "title": contract.title,
                "rut": contract.rut or "",
                "specialty_sis": contract.specialty_sis or "Sin Especialidad",
                "status": contract.status or "activo",
                "laws": [],
                "hours": [],
                "contracts": [],
                "is_scheduled": False,
                "user_ids": [],
                "user_names": [],
            }

        if user.id not in grouped_entries[entry_key]["user_ids"]:
            grouped_entries[entry_key]["user_ids"].append(user.id)
        if user.name not in grouped_entries[entry_key]["user_names"]:
            grouped_entries[entry_key]["user_names"].append(user.name)

        if contract.rut:
            requested_ruts.add(contract.rut)
            rut_to_keys[contract.rut].add(entry_key)
        else:
            no_rut_contract_ids.add(contract.id)
            contract_id_to_keys[contract.id].add(entry_key)

    contracts_query = db.query(models.Funcionario).filter(models.Funcionario.period_id == period_id)
    if requested_ruts and no_rut_contract_ids:
        contracts_query = contracts_query.filter(
            or_(
                models.Funcionario.rut.in_(requested_ruts),
                models.Funcionario.id.in_(no_rut_contract_ids),
            )
        )
    elif requested_ruts:
        contracts_query = contracts_query.filter(models.Funcionario.rut.in_(requested_ruts))
    else:
        contracts_query = contracts_query.filter(models.Funcionario.id.in_(no_rut_contract_ids))

    contracts = contracts_query.order_by(models.Funcionario.name.asc(), models.Funcionario.id.asc()).all()

    for contract in contracts:
        target_keys = rut_to_keys.get(contract.rut or "", set())
        if not target_keys and contract.rut is None:
            target_keys = contract_id_to_keys.get(contract.id, set())

        for entry_key in target_keys:
            entry = grouped_entries[entry_key]
            entry["laws"].append(contract.law_code)
            entry["hours"].append(contract.hours_per_week)
            entry["contracts"].append(
                {
                    "id": contract.id,
                    "law_code": contract.law_code,
                    "hours": contract.hours_per_week,
                    "observations": contract.observations,
                }
            )
            if not entry["rut"] and contract.rut:
                entry["rut"] = contract.rut
            if contract.specialty_sis:
                entry["specialty_sis"] = contract.specialty_sis
            if contract.id in scheduled_details:
                entry["funcionario_id"] = contract.id
                entry["is_scheduled"] = True

    rows = [
        {
            "funcionario_id": entry["funcionario_id"],
            "funcionario": entry["funcionario"],
            "rut": entry["rut"],
            "title": entry["title"],
            "law_code": format_laws_list(entry["laws"]),
            "specialty_sis": entry["specialty_sis"],
            "hours_per_week": " y ".join([f"{hours} hrs" for hours in entry["hours"] if hours]) or "0 hrs",
            "status": entry["status"],
            "user_id": entry["user_ids"][0] if entry["user_ids"] else None,
            "user_ids": entry["user_ids"],
            "user_name": ", ".join(entry["user_names"]),
            "is_scheduled": entry["is_scheduled"],
            "programmed_label": "Programado" if entry["is_scheduled"] else "No Programado",
            "contracts": entry["contracts"],
        }
        for entry in grouped_entries.values()
    ]

    rows.sort(key=lambda item: (item["funcionario"].lower(), item["user_name"].lower()))
    return rows[normalized_skip: normalized_skip + normalized_limit]
