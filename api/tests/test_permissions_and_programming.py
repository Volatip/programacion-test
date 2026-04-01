import asyncio
import io
from datetime import datetime

import pandas as pd
import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers, UploadFile

from api import auth, main, models, runtime_config
from api.routers import config as config_router
from api.routers import funcionarios as funcionarios_router
from api.routers import programming as programming_router
from api.routers import stats as stats_router
from api.permissions import PermissionChecker
from api.routers.periods import delete_related_period_data
from api.routers.programming import validate_programming_version


def make_user(*, user_id: int, role: str) -> models.User:
    return models.User(
        id=user_id,
        email=f"user-{user_id}@example.com",
        password_hash="hash",
        name=f"User {user_id}",
        rut=f"{user_id}-K",
        role=role,
        status="activo",
    )


def make_excel_upload_file(
    *,
    filename: str,
    rows: list[dict[str, object]] | None = None,
    content: bytes | None = None,
    content_type: str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
) -> UploadFile:
    if content is None:
        output = io.BytesIO()
        pd.DataFrame(rows or [{"name": "Cardiología"}]).to_excel(output, index=False)
        content = output.getvalue()

    return UploadFile(
        filename=filename,
        file=io.BytesIO(content),
        headers=Headers({"content-type": content_type}),
    )


def make_period(*, name: str, month: int, status: str = "ANTIGUO", is_active: bool = False) -> models.ProgrammingPeriod:
    return models.ProgrammingPeriod(
        name=name,
        start_date=datetime(2026, month, 1),
        end_date=datetime(2026, month, 28),
        status=status,
        is_active=is_active,
    )


def test_require_admin_blocks_rrhh_upload_for_non_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        PermissionChecker.require_admin(
            make_user(user_id=10, role="user"),
            "Solo los administradores pueden subir archivos de RRHH.",
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Solo los administradores pueden subir archivos de RRHH."


def test_configs_list_requires_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        config_router.require_admin_config_access(make_user(user_id=10, role="user"))

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Acceso denegado. Se requieren privilegios de administrador."


def test_configs_list_normalizes_skip_and_limit_for_admin(db_session) -> None:
    db_session.add_all([
        models.Config(key=f"config_{index:03d}", value=str(index), description="test")
        for index in range(150)
    ])
    db_session.commit()

    payload = config_router.read_configs(skip=-50, limit=999, db=db_session, current_user=make_user(user_id=1, role="admin"))

    assert len(payload) == config_router.MAX_CONFIG_LIST_LIMIT
    assert payload[0].key == "config_000"
    assert payload[-1].key == "config_099"


def test_public_config_key_remains_readable_without_auth(db_session) -> None:
    db_session.add(models.Config(key="header_info_text", value="Bienvenidos", description="Header"))
    db_session.commit()

    response = config_router.read_config("header_info_text", db_session, None)

    assert response.value == "Bienvenidos"


def test_non_public_config_key_requires_admin(db_session) -> None:
    db_session.add(models.Config(key="smtp_password", value="secret", description="Sensitive"))
    db_session.commit()

    with pytest.raises(HTTPException) as anonymous_exc:
        config_router.read_config("smtp_password", db_session, None)

    assert anonymous_exc.value.status_code == 401
    assert anonymous_exc.value.detail == "Not authenticated"

    with pytest.raises(HTTPException) as user_exc:
        config_router.read_config("smtp_password", db_session, make_user(user_id=20, role="user"))

    assert user_exc.value.status_code == 403
    assert user_exc.value.detail == "Acceso denegado. Se requieren privilegios de administrador."

    admin_response = config_router.read_config("smtp_password", db_session, make_user(user_id=21, role="admin"))
    assert admin_response.key == "smtp_password"


def test_read_validated_excel_upload_rejects_invalid_extension() -> None:
    upload = make_excel_upload_file(filename="specialties.csv")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(config_router.read_validated_excel_upload(upload))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file format. Please upload an Excel file (.xlsx or .xls)."


def test_read_validated_excel_upload_rejects_invalid_content_type() -> None:
    upload = make_excel_upload_file(filename="specialties.xlsx", content_type="text/plain")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(config_router.read_validated_excel_upload(upload))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file content type. Please upload an Excel file."


def test_read_validated_excel_upload_rejects_oversized_file() -> None:
    oversized_content = b"x" * (config_router.MAX_EXCEL_UPLOAD_SIZE_BYTES + 1)
    upload = make_excel_upload_file(filename="specialties.xlsx", content=oversized_content)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(config_router.read_validated_excel_upload(upload))

    assert exc_info.value.status_code == 413
    assert exc_info.value.detail == "File too large. Maximum allowed size is 5 MB."


def test_read_excel_dataframe_rejects_malformed_excel_bytes() -> None:
    upload = make_excel_upload_file(filename="specialties.xlsx", content=b"not-an-excel-file")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(config_router.read_excel_dataframe(upload, upload_name="specialties"))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid file format"


def test_upload_specialties_keeps_valid_excel_flow(db_session) -> None:
    upload = make_excel_upload_file(
        filename="specialties.xlsx",
        rows=[
            {
                "name": "Cardiología",
                "visible": "SI",
                "new_consult_percentage": 25,
                "yield_new": 3,
                "yield_control": 5,
            }
        ],
    )

    payload = asyncio.run(
        config_router.upload_specialties(
            period_id=1,
            file=upload,
            db=db_session,
            current_user=make_user(user_id=30, role="admin"),
        )
    )

    created = db_session.query(models.Specialty).filter(models.Specialty.period_id == 1).one()

    assert payload == {"message": "Processed successfully. Created: 1, Updated: 0"}
    assert created.name == "Cardiología"
    assert created.visible == "SI"


def test_resolve_user_scope_defaults_admin_to_own_scope_and_allows_explicit_override() -> None:
    admin = make_user(user_id=1, role="admin")

    assert PermissionChecker.resolve_user_scope(admin) == 1
    assert PermissionChecker.resolve_user_scope(admin, 44) == 44


def test_resolve_user_scope_rejects_cross_user_requests_for_non_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        PermissionChecker.resolve_user_scope(make_user(user_id=5, role="user"), 7)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "No tiene permiso para operar sobre otro usuario."


def test_read_funcionarios_normalizes_bounds_and_caps_results(db_session) -> None:
    user = make_user(user_id=40, role="user")
    period = make_period(name="2026-03", month=3, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    funcionarios = []
    bindings = []
    for index in range(funcionarios_router.MAX_FUNCIONARIOS_LIMIT + 50):
        funcionario = models.Funcionario(
            name=f"Funcionario {index:04d}",
            title="Enfermero",
            rut=f"{10000000 + index}",
            dv="K",
            period_id=period.id,
            status="activo",
            is_active_roster=True,
        )
        funcionarios.append(funcionario)
    db_session.add_all(funcionarios)
    db_session.flush()

    for funcionario in funcionarios:
        bindings.append(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.add_all(bindings)
    db_session.commit()

    payload = funcionarios_router.read_funcionarios(
        skip=-100,
        limit=999999,
        period_id=period.id,
        db=db_session,
        current_user=user,
    )

    assert len(payload) == funcionarios_router.MAX_FUNCIONARIOS_LIMIT
    assert payload[0]["rut"] == "10000000"
    assert payload[-1]["rut"] == str(10000000 + funcionarios_router.MAX_FUNCIONARIOS_LIMIT - 1)


def test_search_funcionarios_caps_results_without_breaking_default_flow(db_session) -> None:
    user = make_user(user_id=41, role="user")
    period = make_period(name="2026-04", month=4, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    funcionarios = []
    for index in range(funcionarios_router.MAX_SEARCH_RESULTS_LIMIT + 20):
        funcionarios.append(models.Funcionario(
            name=f"Ana {index:03d}",
            title="Enfermero",
            rut=f"{20000000 + index}",
            dv="K",
            period_id=period.id,
            status="activo",
            is_active_roster=True,
        ))
    db_session.add_all(funcionarios)
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id)
        for funcionario in funcionarios
    ])
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="Ana",
        period_id=period.id,
        limit=999999,
        db=db_session,
        current_user=user,
    )

    assert len(payload) == funcionarios_router.MAX_SEARCH_RESULTS_LIMIT


def test_search_funcionarios_global_scope_excludes_unassigned_officials_for_non_admin(db_session) -> None:
    user = make_user(user_id=44, role="user")
    period = make_period(name="2026-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    scoped = models.Funcionario(
        name="Ana Alcance",
        title="Enfermero",
        rut="50000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    foreign = models.Funcionario(
        name="Ana Externa",
        title="Enfermero",
        rut="50000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([scoped, foreign])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=scoped.id))
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="Ana",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=user,
    )

    assert [item["rut"] for item in payload] == ["50000001"]


def test_bind_funcionario_rejects_arbitrary_self_assignment_for_non_admin(db_session) -> None:
    user = make_user(user_id=45, role="user")
    period = make_period(name="2026-07", month=7, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    foreign = models.Funcionario(
        name="Funcionario Externo",
        title="Enfermero",
        rut="60000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(foreign)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.bind_funcionario_to_user(
            funcionario_id=foreign.id,
            payload=None,
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "No tiene permiso para vincular este funcionario fuera de su ámbito autorizado."


def test_bind_funcionario_allows_admin_to_assign_any_official(db_session) -> None:
    admin = make_user(user_id=46, role="admin")
    user = make_user(user_id=47, role="user")
    period = make_period(name="2026-08", month=8, status="ACTIVO", is_active=True)
    db_session.add_all([admin, user, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="Funcionario Libre",
        title="Enfermero",
        rut="70000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.commit()

    payload = funcionarios_router.bind_funcionario_to_user(
        funcionario_id=funcionario.id,
        payload={"user_id": user.id},
        db=db_session,
        current_user=admin,
    )

    binding = db_session.query(models.UserOfficial).filter_by(user_id=user.id, funcionario_id=funcionario.id).one()

    assert payload == {"message": "Bound successfully"}
    assert binding.user_id == user.id


def test_bind_funcionario_hidden_scope_is_isolated_by_period(db_session) -> None:
    user = make_user(user_id=48, role="user")
    old_period = make_period(name="2026-09", month=9)
    current_period = make_period(name="2026-10", month=10, status="ACTIVO", is_active=True)
    db_session.add_all([user, old_period, current_period])
    db_session.flush()

    old_funcionario = models.Funcionario(
        name="Ana Histórico",
        title="Enfermero",
        rut="71000001",
        dv="K",
        period_id=old_period.id,
        status="activo",
        is_active_roster=True,
    )
    current_funcionario = models.Funcionario(
        name="Ana Actual",
        title="Enfermero",
        rut="71000001",
        dv="K",
        period_id=current_period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([old_funcionario, current_funcionario])
    db_session.flush()
    db_session.add(
        models.UserHiddenOfficial(
            user_id=user.id,
            funcionario_rut="71000001",
            period_id=old_period.id,
            reason="Agregado por Error",
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.bind_funcionario_to_user(
            funcionario_id=current_funcionario.id,
            payload=None,
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 403


def test_dismiss_funcionario_only_updates_same_period_contracts_and_hidden_records(db_session) -> None:
    user = make_user(user_id=49, role="user")
    target_period = make_period(name="2026-11", month=11, status="ACTIVO", is_active=True)
    keep_period = make_period(name="2026-12", month=12)
    db_session.add_all([user, target_period, keep_period])
    db_session.flush()

    target_a = models.Funcionario(name="Ana Uno", title="Enfermero", rut="72000001", dv="K", period_id=target_period.id, status="activo", is_active_roster=True)
    target_b = models.Funcionario(name="Ana Dos", title="Enfermero", rut="72000001", dv="K", period_id=target_period.id, status="activo", is_active_roster=True)
    keep_other_period = models.Funcionario(name="Ana Tres", title="Enfermero", rut="72000001", dv="K", period_id=keep_period.id, status="activo", is_active_roster=True)
    db_session.add_all([target_a, target_b, keep_other_period])
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=target_a.id),
        models.UserOfficial(user_id=user.id, funcionario_id=target_b.id),
        models.UserOfficial(user_id=user.id, funcionario_id=keep_other_period.id),
    ])
    db_session.commit()

    funcionarios_router.dismiss_funcionario(
        funcionario_id=target_a.id,
        payload={"reason": "Agregado por Error"},
        db=db_session,
        current_user=user,
    )

    hidden_rows = db_session.query(models.UserHiddenOfficial).filter_by(user_id=user.id, funcionario_rut="72000001").all()
    remaining_bindings = db_session.query(models.UserOfficial).filter_by(user_id=user.id).all()
    audit = db_session.query(models.OfficialAudit).filter_by(action="Hide", rut="72000001").one()

    assert [(row.period_id, row.reason) for row in hidden_rows] == [(target_period.id, "Agregado por Error")]
    assert {binding.funcionario_id for binding in remaining_bindings} == {keep_other_period.id}
    assert audit.period_id == target_period.id


def test_activate_funcionario_only_reactivates_same_period_contracts(db_session) -> None:
    user = make_user(user_id=50, role="user")
    target_period = make_period(name="2027-01", month=1, status="ACTIVO", is_active=True)
    keep_period = make_period(name="2027-02", month=2)
    db_session.add_all([user, target_period, keep_period])
    db_session.flush()

    target_a = models.Funcionario(name="Luis Uno", title="Enfermero", rut="73000001", dv="K", period_id=target_period.id, status="inactivo", is_active_roster=True)
    target_b = models.Funcionario(name="Luis Dos", title="Enfermero", rut="73000001", dv="K", period_id=target_period.id, status="inactivo", is_active_roster=True)
    keep_other_period = models.Funcionario(name="Luis Tres", title="Enfermero", rut="73000001", dv="K", period_id=keep_period.id, status="inactivo", is_active_roster=True)
    db_session.add_all([target_a, target_b, keep_other_period])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=target_a.id))
    db_session.commit()

    funcionarios_router.activate_funcionario(
        funcionario_id=target_a.id,
        payload=None,
        db=db_session,
        current_user=user,
    )

    db_session.refresh(target_a)
    db_session.refresh(target_b)
    db_session.refresh(keep_other_period)
    audit = db_session.query(models.OfficialAudit).filter_by(action="Activate", rut="73000001").one()

    assert target_a.status == "activo"
    assert target_b.status == "activo"
    assert keep_other_period.status == "inactivo"
    assert audit.period_id == target_period.id


def test_dashboard_stats_ignore_audits_from_other_periods_with_same_rut(db_session) -> None:
    user = make_user(user_id=51, role="user")
    target_period = make_period(name="2027-03", month=3, status="ACTIVO", is_active=True)
    other_period = make_period(name="2027-04", month=4)
    db_session.add_all([user, target_period, other_period])
    db_session.flush()

    current_funcionario = models.Funcionario(
        name="Carlos Actual",
        title="Enfermero",
        rut="74000001",
        dv="K",
        period_id=target_period.id,
        status="inactivo",
        is_active_roster=True,
    )
    other_funcionario = models.Funcionario(
        name="Carlos Futuro",
        title="Enfermero",
        rut="74000001",
        dv="K",
        period_id=other_period.id,
        status="inactivo",
        is_active_roster=True,
    )
    db_session.add_all([current_funcionario, other_funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=current_funcionario.id))
    db_session.add_all([
        models.OfficialAudit(
            funcionario_id=current_funcionario.id,
            funcionario_name=current_funcionario.name,
            rut=current_funcionario.rut,
            period_id=target_period.id,
            user_id=user.id,
            action="Dismiss",
            reason="Renuncia",
        ),
        models.OfficialAudit(
            funcionario_id=other_funcionario.id,
            funcionario_name=other_funcionario.name,
            rut=other_funcionario.rut,
            period_id=other_period.id,
            user_id=user.id,
            action="Dismiss",
            reason="Cambio de servicio",
        ),
    ])
    db_session.commit()

    payload = stats_router.get_dashboard_stats(
        period_id=target_period.id,
        user_id=user.id,
        history_limit=stats_router.DEFAULT_DASHBOARD_HISTORY_LIMIT,
        db=db_session,
        current_user=user,
    )

    assert payload["summary"]["inactive_total"] == 1
    assert payload["summary"]["inactive_resignation"] == 1
    assert payload["summary"]["inactive_mobility"] == 0


def test_dashboard_stats_count_people_not_raw_contracts_or_inactive_programmings(db_session) -> None:
    user = make_user(user_id=52, role="user")
    target_period = make_period(name="2027-05", month=5, status="ACTIVO", is_active=True)
    db_session.add_all([user, target_period])
    db_session.flush()

    active_contract_a = models.Funcionario(
        name="Patricia Uno",
        title="Médico",
        rut="75000001",
        dv="K",
        period_id=target_period.id,
        status="activo",
        is_active_roster=True,
    )
    active_contract_b = models.Funcionario(
        name="Patricia Uno",
        title="Médico",
        rut="75000001",
        dv="K",
        period_id=target_period.id,
        status="activo",
        is_active_roster=True,
    )
    active_other = models.Funcionario(
        name="Marco Dos",
        title="Médico",
        rut="75000002",
        dv="K",
        period_id=target_period.id,
        status="activo",
        is_active_roster=True,
    )
    inactive_programmed = models.Funcionario(
        name="Paula Renuncia",
        title="Médico",
        rut="75000003",
        dv="K",
        period_id=target_period.id,
        status="inactivo",
        is_active_roster=True,
    )
    db_session.add_all([active_contract_a, active_contract_b, active_other, inactive_programmed])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=active_contract_a.id),
        models.UserOfficial(user_id=user.id, funcionario_id=active_contract_b.id),
        models.UserOfficial(user_id=user.id, funcionario_id=active_other.id),
        models.UserOfficial(user_id=user.id, funcionario_id=inactive_programmed.id),
        models.Programming(funcionario_id=active_contract_a.id, period_id=target_period.id),
        models.Programming(funcionario_id=active_contract_b.id, period_id=target_period.id),
        models.Programming(funcionario_id=active_other.id, period_id=target_period.id),
        models.Programming(funcionario_id=inactive_programmed.id, period_id=target_period.id),
        models.OfficialAudit(
            funcionario_id=inactive_programmed.id,
            funcionario_name=inactive_programmed.name,
            rut=inactive_programmed.rut,
            period_id=target_period.id,
            user_id=user.id,
            action="Dismiss",
            reason="Renuncia",
        ),
    ])
    db_session.commit()

    payload = stats_router.get_dashboard_stats(
        period_id=target_period.id,
        user_id=user.id,
        history_limit=stats_router.DEFAULT_DASHBOARD_HISTORY_LIMIT,
        db=db_session,
        current_user=user,
    )

    assert payload["summary"]["active_officials"] == 2
    assert payload["summary"]["programmed"] == 2
    assert payload["summary"]["unprogrammed"] == 0
    assert payload["summary"]["inactive_total"] == 1


def test_read_programmings_normalizes_bounds_and_preserves_filtered_batches(db_session) -> None:
    user = make_user(user_id=42, role="user")
    period = make_period(name="2026-05", month=5, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    funcionarios = []
    programmings = []
    for index in range(3):
        funcionario = models.Funcionario(
            name=f"Programado {index}",
            title="Enfermero",
            rut=f"{30000000 + index}",
            dv="K",
            period_id=period.id,
            status="activo",
            is_active_roster=True,
        )
        funcionarios.append(funcionario)
    db_session.add_all(funcionarios)
    db_session.flush()

    for funcionario in funcionarios:
        db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
        programmings.append(models.Programming(funcionario_id=funcionario.id, period_id=period.id, version=1))
    db_session.add_all(programmings)
    db_session.commit()

    payload = programming_router.read_programmings(
        skip=-10,
        limit=0,
        period_id=period.id,
        funcionario_ids=[funcionario.id for funcionario in funcionarios],
        db=db_session,
        current_user=user,
    )

    assert len(payload) == 3
    assert {programming.funcionario_id for programming in payload} == {funcionario.id for funcionario in funcionarios}


def test_dashboard_stats_limits_history_window(db_session) -> None:
    admin = make_user(user_id=43, role="admin")
    db_session.add(admin)
    db_session.flush()

    periods = []
    funcionarios = []
    links = []
    for month in range(1, 31):
        period = models.ProgrammingPeriod(
            name=f"2024-{month:02d}",
            start_date=datetime(2024 + ((month - 1) // 12), ((month - 1) % 12) + 1, 1),
            end_date=datetime(2024 + ((month - 1) // 12), ((month - 1) % 12) + 1, 28),
            status="ACTIVO" if month == 30 else "ANTIGUO",
            is_active=month == 30,
        )
        periods.append(period)
    db_session.add_all(periods)
    db_session.flush()

    for index, period in enumerate(periods):
        funcionario = models.Funcionario(
            name=f"Histórico {index}",
            title="Enfermero",
            rut=f"{40000000 + index}",
            dv="K",
            period_id=period.id,
            status="activo",
            is_active_roster=True,
            hours_per_week=44,
        )
        funcionarios.append(funcionario)
    db_session.add_all(funcionarios)
    db_session.flush()

    for funcionario in funcionarios:
        links.append(models.UserOfficial(user_id=admin.id, funcionario_id=funcionario.id))
    db_session.add_all(links)
    db_session.commit()

    payload = stats_router.get_dashboard_stats(
        period_id=None,
        history_limit=5,
        user_id=admin.id,
        db=db_session,
        current_user=admin,
    )

    assert len(payload["chart_data"]) == 5
    assert payload["chart_data"][0]["period"] == periods[-5].name
    assert payload["chart_data"][-1]["period"] == periods[-1].name


def test_validate_programming_version_requires_current_version() -> None:
    with pytest.raises(HTTPException) as exc_info:
        validate_programming_version(current_version=3, requested_version=None)

    assert exc_info.value.status_code == 409
    assert "falta la versión actual" in exc_info.value.detail


def test_validate_programming_version_rejects_stale_updates() -> None:
    with pytest.raises(HTTPException) as exc_info:
        validate_programming_version(current_version=3, requested_version=2)

    assert exc_info.value.status_code == 409
    assert "versión actual 3" in exc_info.value.detail
    assert "versión enviada 2" in exc_info.value.detail


def test_delete_related_period_data_cleans_target_period_only(db_session) -> None:
    user = make_user(user_id=1, role="admin")
    target_period = models.ProgrammingPeriod(
        name="2026-01",
        start_date=datetime(2026, 1, 1),
        end_date=datetime(2026, 1, 31),
    )
    keep_period = models.ProgrammingPeriod(
        name="2026-02",
        start_date=datetime(2026, 2, 1),
        end_date=datetime(2026, 2, 28),
    )
    group = models.Group(name="Grupo A", user=user)

    target_func = models.Funcionario(name="Ana", title="Médico(a) Cirujano(a)", period=target_period, rut="11-1")
    keep_func = models.Funcionario(name="Beto", title="Enfermero", period=keep_period, rut="22-2")

    target_programming = models.Programming(funcionario=target_func, period=target_period, version=1)
    keep_programming = models.Programming(funcionario=keep_func, period=keep_period, version=1)

    target_specialty = models.Specialty(name="Cardiología", period=target_period)
    keep_specialty = models.Specialty(name="Pediatría", period=keep_period)

    db_session.add_all([
        user,
        target_period,
        keep_period,
        group,
        target_func,
        keep_func,
        models.Schedule(funcionario=target_func, activity_type="Consulta", assigned_hours=2),
        models.Schedule(funcionario=keep_func, activity_type="Control", assigned_hours=1),
        models.UserOfficial(user=user, funcionario=target_func, group=group),
        models.UserOfficial(user=user, funcionario=keep_func, group=group),
        target_programming,
        keep_programming,
        models.ProgrammingItem(programming=target_programming, activity_name="Consulta", assigned_hours=2),
        models.ProgrammingItem(programming=keep_programming, activity_name="Control", assigned_hours=1),
        target_specialty,
        keep_specialty,
        models.SpecialtyStat(specialty=target_specialty),
        models.SpecialtyStat(specialty=keep_specialty),
        models.Process(name="Urgencias", period=target_period),
        models.Process(name="Hospitalización", period=keep_period),
        models.ActivityType(name="Visita", period=target_period),
        models.ActivityType(name="Turno", period=keep_period),
        models.PerformanceUnit(name="Horas", period=target_period),
        models.PerformanceUnit(name="Controles", period=keep_period),
        models.UserHiddenOfficial(user=user, funcionario_rut="11-1", period=target_period, reason="Agregado por Error"),
        models.UserHiddenOfficial(user=user, funcionario_rut="22-2", period=keep_period, reason="Agregado por Error"),
        models.OfficialAudit(funcionario_id=target_func.id, funcionario_name=target_func.name, rut=target_func.rut, period=target_period, user=user, action="Dismiss", reason="Renuncia"),
        models.OfficialAudit(funcionario_id=keep_func.id, funcionario_name=keep_func.name, rut=keep_func.rut, period=keep_period, user=user, action="Dismiss", reason="Renuncia"),
    ])
    db_session.commit()

    delete_related_period_data(db_session, target_period.id)
    db_session.commit()

    assert db_session.query(models.Funcionario).filter(models.Funcionario.period_id == target_period.id).count() == 0
    assert db_session.query(models.Schedule).join(models.Funcionario).filter(models.Funcionario.period_id == target_period.id).count() == 0
    assert db_session.query(models.UserOfficial).join(models.Funcionario).filter(models.Funcionario.period_id == target_period.id).count() == 0
    assert db_session.query(models.Programming).filter(models.Programming.period_id == target_period.id).count() == 0
    assert db_session.query(models.ProgrammingItem).join(models.Programming).filter(models.Programming.period_id == target_period.id).count() == 0
    assert db_session.query(models.Specialty).filter(models.Specialty.period_id == target_period.id).count() == 0
    assert db_session.query(models.SpecialtyStat).join(models.Specialty).filter(models.Specialty.period_id == target_period.id).count() == 0
    assert db_session.query(models.Process).filter(models.Process.period_id == target_period.id).count() == 0
    assert db_session.query(models.ActivityType).filter(models.ActivityType.period_id == target_period.id).count() == 0
    assert db_session.query(models.PerformanceUnit).filter(models.PerformanceUnit.period_id == target_period.id).count() == 0
    assert db_session.query(models.UserHiddenOfficial).filter(models.UserHiddenOfficial.period_id == target_period.id).count() == 0
    assert db_session.query(models.OfficialAudit).filter(models.OfficialAudit.period_id == target_period.id).count() == 0

    assert db_session.query(models.Funcionario).filter(models.Funcionario.period_id == keep_period.id).count() == 1
    assert db_session.query(models.Programming).filter(models.Programming.period_id == keep_period.id).count() == 1
    assert db_session.query(models.Specialty).filter(models.Specialty.period_id == keep_period.id).count() == 1
    assert db_session.query(models.UserHiddenOfficial).filter(models.UserHiddenOfficial.period_id == keep_period.id).count() == 1
    assert db_session.query(models.OfficialAudit).filter(models.OfficialAudit.period_id == keep_period.id).count() == 1


def test_require_active_user_rejects_inactive_accounts() -> None:
    inactive_user = make_user(user_id=6, role="user")
    inactive_user.status = "inactivo"

    with pytest.raises(HTTPException) as exc_info:
        auth.require_active_user(inactive_user)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Inactive user"


def test_docs_are_hidden_by_default_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("EXPOSE_API_DOCS", raising=False)
    monkeypatch.setenv("APP_ENV", "production")

    assert main.should_expose_api_docs() is False
    assert main.get_docs_urls() == (None, None, None)


def test_docs_can_be_explicitly_enabled_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("EXPOSE_API_DOCS", "true")

    assert main.should_expose_api_docs() is True
    assert main.get_docs_urls() == ("/openapi.json", "/docs", "/redoc")


def test_websocket_origin_guard_allows_only_trusted_origins() -> None:
    allowed = main.get_allowed_origins()

    assert main.is_allowed_websocket_origin("http://localhost:5173", allowed) is True
    assert main.is_allowed_websocket_origin("https://evil.example", allowed) is False
    assert main.is_allowed_websocket_origin(None, allowed) is True


def test_database_url_defaults_to_sqlite_only_for_local_runtime(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    for key in ("DATABASE_URL", "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

    assert runtime_config.get_database_url() == "sqlite:///./sql_app.db"


def test_database_url_builds_from_local_postgres_parts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("POSTGRES_HOST", "127.0.0.1")
    monkeypatch.setenv("POSTGRES_PORT", "5432")
    monkeypatch.setenv("POSTGRES_DB", "programacion")
    monkeypatch.setenv("POSTGRES_USER", "postgres")
    monkeypatch.setenv("POSTGRES_PASSWORD", "postgres_local_2026")

    assert runtime_config.get_database_url() == (
        "postgresql+psycopg2://postgres:postgres_local_2026@127.0.0.1:5432/programacion?sslmode=disable"
    )


def test_database_url_requires_explicit_configuration_outside_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    for key in ("DATABASE_URL", "POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

    with pytest.raises(RuntimeError, match="DATABASE_URL or local PostgreSQL settings"):
        runtime_config.get_database_url()


def test_secret_key_requires_explicit_value_outside_local(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError, match="SECRET_KEY must be configured"):
        runtime_config.get_secret_key()


def test_sqlalchemy_connect_args_are_sqlite_only() -> None:
    assert runtime_config.get_sqlalchemy_connect_args("sqlite:///./sql_app.db") == {"check_same_thread": False}
    assert runtime_config.get_sqlalchemy_connect_args(
        "postgresql+psycopg2://postgres:postgres_local_2026@127.0.0.1:5432/programacion"
    ) == {
        "sslmode": "disable",
        "connect_timeout": 5,
        "application_name": "programacion-api",
    }
