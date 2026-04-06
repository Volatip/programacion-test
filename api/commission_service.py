from __future__ import annotations

import re

from fastapi import HTTPException
from sqlalchemy.orm import Session

from . import models
from .dismiss_reasons import format_dismiss_reason_label

AUTO_ACTIVITY_NAME = "Otras Actividades No Clínicas"
AUTO_ITEM_DESCRIPTION = "Comisión de Servicio Parcial"
AUTO_OBSERVATION_PREFIX = "Funcionario con comision de servicio parcial"
PARTIAL_COMMISSION_BASE_PROGRAMMING_MESSAGE = (
    "No se puede asignar Comisión de Servicio Parcial porque el funcionario no tiene una programación base válida. "
)


def _normalize_text(value: str | None) -> str:
    return (value or "").strip().lower()


def requires_performance_unit(funcionario: models.Funcionario | None) -> bool:
    law_code = funcionario.law_code if funcionario else None
    observations = funcionario.observations if funcionario else None
    is_law_15076 = "15076" in (law_code or "")
    is_liberado_guardia = "liberado de guardia" in _normalize_text(observations)
    return is_law_15076 and not is_liberado_guardia


def _format_missing_base_fields_message(missing_fields: list[str]) -> str:
    if not missing_fields:
        return PARTIAL_COMMISSION_BASE_PROGRAMMING_MESSAGE + "Primero debe registrar la programación base del funcionario."

    if len(missing_fields) == 1:
        fields_text = missing_fields[0]
    elif len(missing_fields) == 2:
        fields_text = f"{missing_fields[0]} y {missing_fields[1]}"
    else:
        fields_text = ", ".join(missing_fields[:-1]) + f" y {missing_fields[-1]}"

    return (
        PARTIAL_COMMISSION_BASE_PROGRAMMING_MESSAGE
        + f"Primero debe registrar la programación base del funcionario con {fields_text}."
    )


def is_partial_commission_selection(
    reason: models.DismissReason | None,
    suboption: models.DismissReasonSuboption | None,
) -> bool:
    reason_key = _normalize_text(reason.system_key if reason else None)
    reason_name = _normalize_text(reason.name if reason else None)
    suboption_key = _normalize_text(suboption.system_key if suboption else None)
    suboption_name = _normalize_text(suboption.name if suboption else None)
    return reason_key == "comision-servicio" and (suboption_key == "parcial" or suboption_name == "parcial") or (
        reason_name in {"comisión de servicio", "comision de servicio"} and suboption_name == "parcial"
    )


def ensure_partial_commission_hours(
    reason: models.DismissReason | None,
    suboption: models.DismissReasonSuboption | None,
    partial_hours: int | None,
) -> int | None:
    if not is_partial_commission_selection(reason, suboption):
        return None

    if partial_hours is None or partial_hours <= 0:
        raise HTTPException(
            status_code=400,
            detail="La Comisión de Servicio Parcial requiere una cantidad de horas mayor a 0.",
        )

    return int(partial_hours)


def ensure_partial_commission_base_fields(
    global_specialty: str | None,
    selected_performance_unit: str | None,
    *,
    requires_performance_unit_field: bool,
) -> None:
    missing_fields: list[str] = []

    if not (global_specialty or "").strip():
        missing_fields.append("Especialidad Principal")

    if requires_performance_unit_field and not (selected_performance_unit or "").strip():
        missing_fields.append("Unidad de Desempeño")

    if not missing_fields:
        return

    raise HTTPException(
        status_code=400,
        detail=_format_missing_base_fields_message(missing_fields),
    )


def ensure_partial_commission_base_programming(
    programming: models.Programming | None,
    funcionario: models.Funcionario | None,
) -> None:
    if programming is None:
        raise HTTPException(
            status_code=400,
            detail=_format_missing_base_fields_message([]),
        )

    ensure_partial_commission_base_fields(
        programming.global_specialty,
        programming.selected_performance_unit,
        requires_performance_unit_field=requires_performance_unit(funcionario),
    )


def _format_partial_observation(hours: int) -> str:
    return f"{AUTO_OBSERVATION_PREFIX} {hours} horas"


def merge_partial_observation(observation: str | None, hours: int) -> str:
    current_lines = [line.strip() for line in (observation or "").splitlines()]
    filtered_lines = [
        line for line in current_lines if line and not re.fullmatch(rf"{AUTO_OBSERVATION_PREFIX} \d+ horas", line, flags=re.IGNORECASE)
    ]
    filtered_lines.append(_format_partial_observation(hours))
    return "\n".join(filtered_lines)


def _resolve_auto_activity_type_id(db: Session, period_id: int | None) -> int | None:
    if period_id is not None:
        scoped = db.query(models.ActivityType).filter(
            models.ActivityType.period_id == period_id,
            models.ActivityType.name == AUTO_ACTIVITY_NAME,
        ).first()
        if scoped:
            return scoped.id

    shared = db.query(models.ActivityType).filter(
        models.ActivityType.period_id.is_(None),
        models.ActivityType.name == AUTO_ACTIVITY_NAME,
    ).first()
    return shared.id if shared else None


def upsert_partial_commission_item(
    db: Session,
    *,
    programming: models.Programming,
    hours: int,
) -> None:
    activity_type_id = _resolve_auto_activity_type_id(db, programming.period_id)
    specialty = (programming.global_specialty or "").strip() or None
    auto_item = next(
        (
            item for item in programming.items
            if item.activity_name == AUTO_ACTIVITY_NAME and item.description == AUTO_ITEM_DESCRIPTION
        ),
        None,
    )

    if auto_item is None:
        programming.items.append(
            models.ProgrammingItem(
                activity_name=AUTO_ACTIVITY_NAME,
                activity_type_id=activity_type_id,
                description=AUTO_ITEM_DESCRIPTION,
                specialty=specialty,
                assigned_hours=float(hours),
                performance=0.0,
            )
        )
        return

    auto_item.activity_type_id = activity_type_id
    auto_item.specialty = specialty
    auto_item.assigned_hours = float(hours)
    auto_item.performance = 0.0


def remove_partial_commission_item(programming: models.Programming) -> None:
    programming.items = [
        item
        for item in programming.items
        if not (item.activity_name == AUTO_ACTIVITY_NAME and item.description == AUTO_ITEM_DESCRIPTION)
    ]


def apply_partial_commission_programming(
    db: Session,
    *,
    funcionario: models.Funcionario,
    user_id: int | None,
    reason: models.DismissReason,
    suboption: models.DismissReasonSuboption,
    partial_hours: int,
) -> models.Programming:
    reason_label = format_dismiss_reason_label(reason.name, suboption.name)
    programming = db.query(models.Programming).filter(
        models.Programming.funcionario_id == funcionario.id,
        models.Programming.period_id == funcionario.period_id,
    ).first()

    if programming is None:
        programming = models.Programming(
            funcionario_id=funcionario.id,
            period_id=funcionario.period_id,
            version=1,
            status="borrador",
            observation=merge_partial_observation(None, partial_hours),
            assigned_status=reason_label,
            prais=False,
            dismiss_reason_id=reason.id,
            dismiss_suboption_id=suboption.id,
            dismiss_partial_hours=partial_hours,
            created_by_id=user_id,
            updated_by_id=user_id,
        )
        db.add(programming)
        db.flush()
        db.refresh(programming, attribute_names=["items"])
    else:
        programming.assigned_status = reason_label
        programming.observation = merge_partial_observation(programming.observation, partial_hours)
        programming.dismiss_reason_id = reason.id
        programming.dismiss_suboption_id = suboption.id
        programming.dismiss_partial_hours = partial_hours
        programming.updated_by_id = user_id
        programming.version = (programming.version or 0) + 1

    upsert_partial_commission_item(db, programming=programming, hours=partial_hours)
    return programming


def clear_partial_commission_programming(programming: models.Programming | None) -> None:
    if programming is None:
        return

    if programming.dismiss_partial_hours is None:
        return

    programming.dismiss_partial_hours = None
    programming.dismiss_reason_id = None
    programming.dismiss_suboption_id = None
    programming.assigned_status = "Activo"
    programming.observation = "\n".join(
        line.strip()
        for line in (programming.observation or "").splitlines()
        if line.strip() and not re.fullmatch(rf"{AUTO_OBSERVATION_PREFIX} \d+ horas", line.strip(), flags=re.IGNORECASE)
    ) or None
    remove_partial_commission_item(programming)
