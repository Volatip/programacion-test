from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.inspection import inspect
from sqlalchemy.orm import Session

from . import models


COPY_EXCLUDED_COLUMNS = {"id", "created_at", "updated_at"}
PROGRAMMING_REVIEW_SNAPSHOT_EXCLUDED_COLUMNS = {
    "review_status",
    "reviewed_at",
    "reviewed_by_id",
    "review_comment",
}


@dataclass
class PeriodBaseDuplicationResult:
    source_period_id: int
    destination_period_id: int
    funcionarios: int = 0
    groups: int = 0
    user_officials: int = 0
    programmings: int = 0
    programming_items: int = 0
    specialties: int = 0
    specialty_stats: int = 0
    processes: int = 0
    activity_types: int = 0
    performance_units: int = 0


def _clone_model(instance, model_cls, *, overrides=None, exclude=None):
    data = {}
    blocked = COPY_EXCLUDED_COLUMNS | set(exclude or set())
    for column in inspect(model_cls).columns:
        if column.key in blocked:
            continue
        data[column.key] = getattr(instance, column.key)

    if overrides:
        data.update(overrides)

    return model_cls(**data)


def _require_mapping(mapping: dict[int, int], source_id: int | None, relation_name: str) -> int | None:
    if source_id is None:
        return None

    target_id = mapping.get(source_id)
    if target_id is None:
        raise HTTPException(
            status_code=409,
            detail=f"No se pudo duplicar porque la relación '{relation_name}' del período origen está incompleta.",
        )
    return target_id


def destination_period_has_base_data(db: Session, destination_period_id: int) -> bool:
    destination_funcionario_ids = db.query(models.Funcionario.id).filter(
        models.Funcionario.period_id == destination_period_id
    )
    destination_group_ids = db.query(models.Group.id).filter(models.Group.period_id == destination_period_id)
    destination_programming_ids = db.query(models.Programming.id).filter(
        models.Programming.period_id == destination_period_id
    )
    destination_specialty_ids = db.query(models.Specialty.id).filter(
        models.Specialty.period_id == destination_period_id
    )

    checks = (
        db.query(models.Funcionario.id).filter(models.Funcionario.period_id == destination_period_id).first(),
        db.query(models.Group.id).filter(models.Group.period_id == destination_period_id).first(),
        db.query(models.Specialty.id).filter(models.Specialty.period_id == destination_period_id).first(),
        db.query(models.Process.id).filter(models.Process.period_id == destination_period_id).first(),
        db.query(models.ActivityType.id).filter(models.ActivityType.period_id == destination_period_id).first(),
        db.query(models.PerformanceUnit.id).filter(models.PerformanceUnit.period_id == destination_period_id).first(),
        db.query(models.Programming.id).filter(models.Programming.period_id == destination_period_id).first(),
        db.query(models.ProgrammingItem.id).filter(
            models.ProgrammingItem.programming_id.in_(destination_programming_ids)
        ).first(),
        db.query(models.SpecialtyStat.id).filter(models.SpecialtyStat.specialty_id.in_(destination_specialty_ids)).first(),
        db.query(models.UserOfficial.id).filter(
            models.UserOfficial.funcionario_id.in_(destination_funcionario_ids)
        ).first(),
        db.query(models.UserOfficial.id).filter(models.UserOfficial.group_id.in_(destination_group_ids)).first(),
    )

    return any(check is not None for check in checks)


def duplicate_period_base(db: Session, source_period_id: int, destination_period_id: int) -> PeriodBaseDuplicationResult:
    if source_period_id == destination_period_id:
        raise HTTPException(status_code=400, detail="El período origen y destino deben ser distintos.")

    source_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id == source_period_id).first()
    if not source_period:
        raise HTTPException(status_code=404, detail="Período origen no encontrado")

    destination_period = db.query(models.ProgrammingPeriod).filter(models.ProgrammingPeriod.id == destination_period_id).first()
    if not destination_period:
        raise HTTPException(status_code=404, detail="Período destino no encontrado")

    if destination_period_has_base_data(db, destination_period_id):
        raise HTTPException(
            status_code=409,
            detail="El período destino ya tiene datos base. La duplicación fue rechazada para proteger la consistencia.",
        )

    result = PeriodBaseDuplicationResult(
        source_period_id=source_period_id,
        destination_period_id=destination_period_id,
    )

    funcionario_map: dict[int, int] = {}
    group_map: dict[int, int] = {}
    specialty_map: dict[int, int] = {}
    activity_type_map: dict[int, int] = {}
    programming_map: dict[int, int] = {}

    try:
        source_funcionarios = db.query(models.Funcionario).filter(models.Funcionario.period_id == source_period_id).all()
        for source_funcionario in source_funcionarios:
            cloned_funcionario = _clone_model(
                source_funcionario,
                models.Funcionario,
                overrides={"period_id": destination_period_id},
            )
            db.add(cloned_funcionario)
            db.flush()
            funcionario_map[source_funcionario.id] = cloned_funcionario.id
            result.funcionarios += 1

        source_groups = db.query(models.Group).filter(models.Group.period_id == source_period_id).all()
        for source_group in source_groups:
            cloned_group = _clone_model(
                source_group,
                models.Group,
                overrides={"period_id": destination_period_id},
            )
            db.add(cloned_group)
            db.flush()
            group_map[source_group.id] = cloned_group.id
            result.groups += 1

        source_specialties = db.query(models.Specialty).filter(models.Specialty.period_id == source_period_id).all()
        for source_specialty in source_specialties:
            cloned_specialty = _clone_model(
                source_specialty,
                models.Specialty,
                overrides={"period_id": destination_period_id},
            )
            db.add(cloned_specialty)
            db.flush()
            specialty_map[source_specialty.id] = cloned_specialty.id
            result.specialties += 1

            if source_specialty.stats:
                cloned_stats = _clone_model(
                    source_specialty.stats,
                    models.SpecialtyStat,
                    overrides={"specialty_id": cloned_specialty.id},
                )
                db.add(cloned_stats)
                db.flush()
                result.specialty_stats += 1

        source_processes = db.query(models.Process).filter(models.Process.period_id == source_period_id).all()
        for source_process in source_processes:
            db.add(_clone_model(source_process, models.Process, overrides={"period_id": destination_period_id}))
            db.flush()
            result.processes += 1

        source_activity_types = db.query(models.ActivityType).filter(models.ActivityType.period_id == source_period_id).all()
        for source_activity_type in source_activity_types:
            cloned_activity_type = _clone_model(
                source_activity_type,
                models.ActivityType,
                overrides={"period_id": destination_period_id},
            )
            db.add(cloned_activity_type)
            db.flush()
            activity_type_map[source_activity_type.id] = cloned_activity_type.id
            result.activity_types += 1

        source_performance_units = db.query(models.PerformanceUnit).filter(
            models.PerformanceUnit.period_id == source_period_id
        ).all()
        for source_unit in source_performance_units:
            db.add(_clone_model(source_unit, models.PerformanceUnit, overrides={"period_id": destination_period_id}))
            db.flush()
            result.performance_units += 1

        source_user_officials = db.query(models.UserOfficial).filter(
            models.UserOfficial.funcionario_id.in_(funcionario_map.keys())
        ).all()
        for source_user_official in source_user_officials:
            cloned_binding = _clone_model(
                source_user_official,
                models.UserOfficial,
                overrides={
                    "funcionario_id": _require_mapping(funcionario_map, source_user_official.funcionario_id, "funcionario"),
                    "group_id": _require_mapping(group_map, source_user_official.group_id, "grupo"),
                },
            )
            db.add(cloned_binding)
            db.flush()
            result.user_officials += 1

        source_programmings = db.query(models.Programming).filter(models.Programming.period_id == source_period_id).all()
        for source_programming in source_programmings:
            cloned_programming = _clone_model(
                source_programming,
                models.Programming,
                overrides={
                    "funcionario_id": _require_mapping(funcionario_map, source_programming.funcionario_id, "funcionario"),
                    "period_id": destination_period_id,
                    "assigned_group_id": _require_mapping(group_map, source_programming.assigned_group_id, "grupo asignado"),
                },
                exclude=PROGRAMMING_REVIEW_SNAPSHOT_EXCLUDED_COLUMNS,
            )
            db.add(cloned_programming)
            db.flush()
            programming_map[source_programming.id] = cloned_programming.id
            result.programmings += 1

            for source_item in source_programming.items:
                cloned_item = _clone_model(
                    source_item,
                    models.ProgrammingItem,
                    overrides={
                        "programming_id": cloned_programming.id,
                        "activity_type_id": _require_mapping(
                            activity_type_map,
                            source_item.activity_type_id,
                            "tipo de actividad",
                        ),
                    },
                )
                db.add(cloned_item)
                db.flush()
                result.programming_items += 1

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    return result
