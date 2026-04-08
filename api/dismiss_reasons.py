from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from . import models

DISMISS_ACTION = "dismiss"
HIDE_ACTION = "hide"

REASON_SYSTEM_KEY_COMMISSION_SERVICE = "comision-servicio"
SUBOPTION_SYSTEM_KEY_TOTAL = "total"
SUBOPTION_SYSTEM_KEY_PARTIAL = "parcial"

REASON_CATEGORY_RESIGNATION = "resignation"
REASON_CATEGORY_MOBILITY = "mobility"
REASON_CATEGORY_OTHER = "other"

DEFAULT_DISMISS_REASONS: list[dict[str, object]] = [
    {
        "system_key": "renuncia",
        "name": "Renuncia",
        "description": "El funcionario renuncia voluntariamente",
        "action_type": DISMISS_ACTION,
        "reason_category": REASON_CATEGORY_RESIGNATION,
        "sort_order": 10,
        "requires_start_date": True,
        "suboptions": [],
    },
    {
        "system_key": "cambio-servicio",
        "name": "Cambio de servicio",
        "description": "Traslado a otro establecimiento o unidad",
        "action_type": DISMISS_ACTION,
        "reason_category": REASON_CATEGORY_MOBILITY,
        "sort_order": 20,
        "requires_start_date": True,
        "suboptions": [],
    },
    {
        "system_key": REASON_SYSTEM_KEY_COMMISSION_SERVICE,
        "name": "Comisión de Servicio",
        "description": "Asignación temporal a otra unidad o servicio",
        "action_type": DISMISS_ACTION,
        "reason_category": REASON_CATEGORY_MOBILITY,
        "sort_order": 30,
        "requires_start_date": True,
        "suboptions": [
            {"system_key": SUBOPTION_SYSTEM_KEY_TOTAL, "name": "Total", "description": "Comisión completa", "sort_order": 10},
            {"system_key": SUBOPTION_SYSTEM_KEY_PARTIAL, "name": "Parcial", "description": "Comisión parcial", "sort_order": 20},
        ],
    },
    {
        "system_key": "permiso-sin-goce",
        "name": "Permiso sin Goce",
        "description": "Ausencia temporal sin remuneración",
        "action_type": DISMISS_ACTION,
        "reason_category": REASON_CATEGORY_MOBILITY,
        "sort_order": 40,
        "requires_start_date": True,
        "suboptions": [],
    },
    {
        "system_key": "comision-estudio",
        "name": "Comisión de Estudio",
        "description": "Ausencia autorizada por motivos académicos",
        "action_type": DISMISS_ACTION,
        "reason_category": REASON_CATEGORY_MOBILITY,
        "sort_order": 50,
        "requires_start_date": True,
        "suboptions": [],
    },
    {
        "system_key": "agregado-error",
        "name": "Agregado por Error",
        "description": "Oculta el registro del ámbito del usuario por tratarse de una carga incorrecta",
        "action_type": HIDE_ACTION,
        "reason_category": REASON_CATEGORY_OTHER,
        "sort_order": 60,
        "requires_start_date": False,
        "suboptions": [],
    },
]


@dataclass
class ResolvedDismissSelection:
    reason: models.DismissReason
    suboption: models.DismissReasonSuboption | None
    display_label: str


def format_dismiss_reason_label(reason_name: str, suboption_name: str | None = None) -> str:
    normalized_reason = reason_name.strip()
    normalized_suboption = (suboption_name or "").strip()
    if not normalized_suboption:
        return normalized_reason
    return f"{normalized_reason} - {normalized_suboption}"


def infer_legacy_reason_category(reason_label: str | None) -> str:
    normalized = (reason_label or "").strip().lower()
    if normalized == "renuncia":
        return REASON_CATEGORY_RESIGNATION
    if normalized.startswith("cambio de servicio") or normalized.startswith("comisión de servicio") or normalized.startswith("comision de servicio") or normalized.startswith("permiso sin goce") or normalized.startswith("comisión de estudio") or normalized.startswith("comision de estudio"):
        return REASON_CATEGORY_MOBILITY
    return REASON_CATEGORY_OTHER


def resolve_reason_category(reason_category: str | None, reason_label: str | None) -> str:
    if reason_category in {REASON_CATEGORY_RESIGNATION, REASON_CATEGORY_MOBILITY, REASON_CATEGORY_OTHER}:
        return reason_category
    return infer_legacy_reason_category(reason_label)


def read_dismiss_reasons(db: Session, *, active_only: bool) -> list[models.DismissReason]:
    query = db.query(models.DismissReason).options(selectinload(models.DismissReason.suboptions)).order_by(
        models.DismissReason.sort_order.asc(),
        models.DismissReason.name.asc(),
    )
    if active_only:
        query = query.filter(models.DismissReason.is_active.is_(True))
    return query.all()


def ensure_default_dismiss_reasons(db: Session) -> int:
    created_count = 0

    for reason_data in DEFAULT_DISMISS_REASONS:
        reason = db.query(models.DismissReason).filter(
            (models.DismissReason.system_key == reason_data["system_key"]) | (models.DismissReason.name == reason_data["name"])
        ).first()

        if reason is None:
            reason = models.DismissReason(
                system_key=str(reason_data["system_key"]),
                name=str(reason_data["name"]),
                description=str(reason_data.get("description") or ""),
                action_type=str(reason_data.get("action_type") or DISMISS_ACTION),
                reason_category=str(reason_data.get("reason_category") or REASON_CATEGORY_OTHER),
                sort_order=int(reason_data.get("sort_order") or 0),
                is_active=True,
                requires_start_date=bool(reason_data.get("requires_start_date", False)),
            )
            db.add(reason)
            db.flush()
            created_count += 1
        else:
            reason.requires_start_date = bool(reason_data.get("requires_start_date", False))

        existing_suboptions = {
            suboption.system_key or suboption.name: suboption
            for suboption in reason.suboptions
        }
        for suboption_data in reason_data.get("suboptions", []):
            lookup_key = str(suboption_data.get("system_key") or suboption_data["name"])
            if lookup_key in existing_suboptions:
                continue
            reason.suboptions.append(
                models.DismissReasonSuboption(
                    system_key=str(suboption_data.get("system_key") or "") or None,
                    name=str(suboption_data["name"]),
                    description=str(suboption_data.get("description") or ""),
                    sort_order=int(suboption_data.get("sort_order") or 0),
                )
            )

    if created_count:
        db.commit()
    else:
        db.flush()

    return created_count


def resolve_dismiss_selection(db: Session, payload: dict, *, require_active: bool = True) -> ResolvedDismissSelection:
    reason_id = payload.get("reason_id")
    reason_name = (payload.get("reason") or "").strip()
    suboption_id = payload.get("suboption_id")
    suboption_name = (payload.get("suboption") or "").strip()

    if not reason_id and not reason_name:
        raise HTTPException(status_code=400, detail="Reason is required")

    if not reason_id and reason_name and " - " in reason_name and not suboption_name:
        base_reason, parsed_suboption = [part.strip() for part in reason_name.split(" - ", 1)]
        reason_name = base_reason
        suboption_name = parsed_suboption

    reason_query = db.query(models.DismissReason).options(selectinload(models.DismissReason.suboptions))
    if reason_id:
        reason = reason_query.filter(models.DismissReason.id == reason_id).first()
    else:
        reason = reason_query.filter(models.DismissReason.name == reason_name).first()

    if reason is None:
        raise HTTPException(status_code=400, detail="Invalid reason")

    if require_active and not reason.is_active:
        raise HTTPException(status_code=400, detail="The selected reason is inactive")

    selected_suboption: models.DismissReasonSuboption | None = None
    if suboption_id:
        selected_suboption = next((item for item in reason.suboptions if item.id == suboption_id), None)
    elif suboption_name:
        selected_suboption = next((item for item in reason.suboptions if item.name == suboption_name), None)

    if reason.suboptions and selected_suboption is None:
        raise HTTPException(status_code=400, detail="Suboption is required for the selected reason")

    if not reason.suboptions and (suboption_id or suboption_name):
        raise HTTPException(status_code=400, detail="The selected reason does not support suboptions")

    return ResolvedDismissSelection(
        reason=reason,
        suboption=selected_suboption,
        display_label=format_dismiss_reason_label(reason.name, selected_suboption.name if selected_suboption else None),
    )


def validate_dismiss_start_date_requirement(reason: models.DismissReason, start_date: date | None) -> None:
    if reason.requires_start_date and start_date is None:
        raise HTTPException(status_code=400, detail="La fecha de inicio de la baja es obligatoria para el motivo seleccionado.")


def normalize_dismiss_start_datetime(start_date: date | None) -> datetime | None:
    if start_date is None:
        return None
    return datetime.combine(start_date, time.min)
