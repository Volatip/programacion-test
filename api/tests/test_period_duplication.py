from datetime import datetime

import pytest
from fastapi import HTTPException

from api import models
from api.period_duplication import duplicate_period_base


def make_user(*, user_id: int, role: str = "admin") -> models.User:
    return models.User(
        id=user_id,
        email=f"user-{user_id}@example.com",
        password_hash="hash",
        name=f"User {user_id}",
        rut=f"{user_id}-K",
        role=role,
        status="activo",
    )


def make_period(*, name: str, month: int, status: str = "ANTIGUO", is_active: bool = False) -> models.ProgrammingPeriod:
    return models.ProgrammingPeriod(
        name=name,
        start_date=datetime(2026, month, 1),
        end_date=datetime(2026, month, 28),
        status=status,
        is_active=is_active,
    )


def test_duplicate_period_base_copies_allowed_data_and_skips_audits_hidden_and_legacy_schedules(db_session) -> None:
    user = make_user(user_id=1)
    source_period = make_period(name="2026-03", month=3, status="ACTIVO", is_active=True)
    destination_period = make_period(name="2026-04", month=4, status="OCULTO")
    db_session.add_all([user, source_period, destination_period])
    db_session.flush()

    source_group = models.Group(name="Grupo A", user_id=user.id, period_id=source_period.id)
    source_process = models.Process(name="Proceso 1", period_id=source_period.id)
    source_activity_type = models.ActivityType(
        process="Proceso 1",
        profession="Médico",
        specialty="Cardiología",
        name="Consulta",
        visible="SI",
        prais="NO",
        req_rendimiento="SI",
        order_index=10,
        period_id=source_period.id,
    )
    source_specialty = models.Specialty(name="Cardiología", visible="SI", period_id=source_period.id)
    source_performance_unit = models.PerformanceUnit(name="Unidad 1", period_id=source_period.id)
    db_session.add_all([source_group, source_process, source_activity_type, source_specialty, source_performance_unit])
    db_session.flush()

    source_specialty_stat = models.SpecialtyStat(
        specialty_id=source_specialty.id,
        new_consult_percentage=35,
        yield_new=4,
        yield_control=6,
    )
    source_funcionario = models.Funcionario(
        name="Ana Pérez",
        title="Enfermera",
        law_code="18834",
        specialty_sis="Cardiología",
        hours_per_week=44,
        rut="12345678",
        dv="9",
        contract_id="C-1",
        contract_correlative=7,
        establishment_id=11,
        effective_hours=39.5,
        shift_system="Diurno",
        observations="Contrato base",
        holiday_days=2,
        administrative_days=1,
        congress_days=0,
        breastfeeding_time=0,
        lunch_time_minutes=60,
        contract_start_date=datetime(2026, 3, 1),
        contract_end_date=datetime(2026, 12, 31),
        status="activo",
        is_active_roster=True,
        latency_hours=8,
        break_minutes=45,
        unscheduled_count=3,
        rrhh_date=datetime(2026, 3, 2),
        raw_data='{"fuente": "rrhh"}',
        period_id=source_period.id,
    )
    db_session.add_all([source_specialty_stat, source_funcionario])
    db_session.flush()

    source_user_official = models.UserOfficial(
        user_id=user.id,
        funcionario_id=source_funcionario.id,
        group_id=source_group.id,
    )
    source_programming = models.Programming(
        funcionario_id=source_funcionario.id,
        period_id=source_period.id,
        version=3,
        status="revision",
        observation="Observación origen",
        assigned_group_id=source_group.id,
        assigned_status="asignado",
        prais=True,
        global_specialty="Cardiología",
        selected_process="Proceso 1",
        selected_performance_unit="Unidad 1",
        time_unit="minutes",
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    db_session.add_all([source_user_official, source_programming])
    db_session.flush()

    source_programming_item = models.ProgrammingItem(
        programming_id=source_programming.id,
        activity_type_id=source_activity_type.id,
        activity_name="Consulta",
        description="Atención de control",
        subtitle="Policlínico",
        specialty="Cardiología",
        day_of_week=2,
        start_time="08:00",
        end_time="12:00",
        assigned_hours=4,
        performance=12,
    )
    source_schedule = models.Schedule(
        funcionario_id=source_funcionario.id,
        start_time=datetime(2026, 3, 3, 8, 0),
        end_time=datetime(2026, 3, 3, 12, 0),
        activity_type="LEGACY",
        assigned_hours=4,
        performance=10,
    )
    source_hidden = models.UserHiddenOfficial(
        user_id=user.id,
        funcionario_rut=source_funcionario.rut,
        period_id=source_period.id,
        reason="Oculto en origen",
    )
    source_audit = models.OfficialAudit(
        funcionario_id=source_funcionario.id,
        funcionario_name=source_funcionario.name,
        rut=source_funcionario.rut,
        period_id=source_period.id,
        user_id=user.id,
        action="Dismiss",
        reason="Prueba",
    )
    db_session.add_all([source_programming_item, source_schedule, source_hidden, source_audit])
    db_session.commit()

    result = duplicate_period_base(db_session, source_period.id, destination_period.id)

    assert result.funcionarios == 1
    assert result.groups == 1
    assert result.user_officials == 1
    assert result.programmings == 1
    assert result.programming_items == 1
    assert result.specialties == 1
    assert result.specialty_stats == 1
    assert result.processes == 1
    assert result.activity_types == 1
    assert result.performance_units == 1

    duplicated_funcionario = db_session.query(models.Funcionario).filter(
        models.Funcionario.period_id == destination_period.id
    ).one()
    duplicated_group = db_session.query(models.Group).filter(models.Group.period_id == destination_period.id).one()
    duplicated_specialty = db_session.query(models.Specialty).filter(
        models.Specialty.period_id == destination_period.id
    ).one()
    duplicated_programming = db_session.query(models.Programming).filter(
        models.Programming.period_id == destination_period.id
    ).one()
    duplicated_item = db_session.query(models.ProgrammingItem).join(models.Programming).filter(
        models.Programming.period_id == destination_period.id
    ).one()
    duplicated_binding = db_session.query(models.UserOfficial).filter(
        models.UserOfficial.funcionario_id == duplicated_funcionario.id
    ).one()
    duplicated_stats = db_session.query(models.SpecialtyStat).filter(
        models.SpecialtyStat.specialty_id == duplicated_specialty.id
    ).one()

    assert duplicated_funcionario.id != source_funcionario.id
    assert duplicated_funcionario.name == source_funcionario.name
    assert duplicated_funcionario.period_id == destination_period.id
    assert duplicated_group.id != source_group.id
    assert duplicated_binding.group_id == duplicated_group.id
    assert duplicated_programming.funcionario_id == duplicated_funcionario.id
    assert duplicated_programming.assigned_group_id == duplicated_group.id
    assert duplicated_item.programming_id == duplicated_programming.id
    assert duplicated_item.activity_type_id != source_activity_type.id
    assert duplicated_stats.new_consult_percentage == 35
    assert db_session.query(models.OfficialAudit).filter(models.OfficialAudit.period_id == destination_period.id).count() == 0
    assert db_session.query(models.UserHiddenOfficial).filter(
        models.UserHiddenOfficial.period_id == destination_period.id
    ).count() == 0
    assert db_session.query(models.Schedule).filter(models.Schedule.funcionario_id == duplicated_funcionario.id).count() == 0


def test_duplicate_period_base_rejects_non_empty_destination(db_session) -> None:
    source_period = make_period(name="2026-05", month=5)
    destination_period = make_period(name="2026-06", month=6)
    db_session.add_all([source_period, destination_period])
    db_session.flush()

    db_session.add(
        models.Funcionario(
            name="Destino ocupado",
            title="Médico",
            rut="99887766",
            dv="K",
            period_id=destination_period.id,
            status="activo",
            is_active_roster=True,
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        duplicate_period_base(db_session, source_period.id, destination_period.id)

    assert exc_info.value.status_code == 409
    assert "destino ya tiene datos base" in exc_info.value.detail
