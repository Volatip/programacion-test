import asyncio
from email.message import EmailMessage
import io
from datetime import date, datetime

import pandas as pd
import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.datastructures import Headers, UploadFile

from api import auth, main, models, runtime_config, schemas
from api.dismiss_reasons import ensure_default_dismiss_reasons
from api.routers import config as config_router
from api.routers import funcionarios as funcionarios_router
from api.routers import general as general_router
from api.routers import groups as groups_router
from api.routers import programming as programming_router
from api.routers import stats as stats_router
from api.routers import users as users_router
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


def make_rrhh_upload_file(*, lunch_header: str, lunch_value: int) -> UploadFile:
    return make_excel_upload_file(
        filename="funcionarios.xlsx",
        rows=[
            {
                "RUT": "12345678-9",
                "Nombre": "Ana Pérez",
                lunch_header: lunch_value,
            }
        ],
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


def test_home_timeline_public_config_key_remains_readable_without_auth(db_session) -> None:
    db_session.add(models.Config(key="home_timeline", value='[{"title":"Carga","date":"Abr 2026"}]', description="Timeline"))
    db_session.commit()

    response = config_router.read_config("home_timeline", db_session, None)

    assert response.value == '[{"title":"Carga","date":"Abr 2026"}]'


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


@pytest.mark.parametrize(
    ("lunch_header", "expected_minutes"),
    [
        ("Tiempo de colación semanal (min)", 90),
        ("Tiempo de colacion semanal (min)", 75),
        ("Almuerzo", 60),
    ],
)
def test_upload_funcionarios_maps_lunch_time_from_supported_rrhh_headers(
    db_session,
    lunch_header: str,
    expected_minutes: int,
) -> None:
    period = make_period(name=f"2026-04-{expected_minutes}", month=4, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.commit()

    upload = make_rrhh_upload_file(lunch_header=lunch_header, lunch_value=expected_minutes)

    payload = asyncio.run(
        funcionarios_router.upload_funcionarios(
            file=upload,
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=31 + expected_minutes, role="admin"),
        )
    )

    funcionario = db_session.query(models.Funcionario).filter(models.Funcionario.period_id == period.id).one()

    assert payload["registros_creados"] == 1
    assert payload["registros_actualizados"] == 0
    assert funcionario.lunch_time_minutes == expected_minutes


def test_upload_funcionarios_updates_existing_rows_when_rut_programable_arrives_as_float(db_session) -> None:
    period = make_period(name="2026-04-rut-float", month=4, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.commit()

    first_upload = make_excel_upload_file(
        filename="rrhh-base.xlsx",
        rows=[
            {
                "RUT Programable": "15759391",
                "DV": "9",
                "Nombre": "MEDRANO DIAZ JORGE RAFAEL",
                "Correlativo Contrato": 1,
                "LEY": "19664",
                "Días de Permisos Administrativos": 12,
            },
            {
                "RUT Programable": "15759391",
                "DV": "9",
                "Nombre": "MEDRANO DIAZ JORGE RAFAEL",
                "Correlativo Contrato": 2,
                "LEY": "15076",
                "Días de Permisos Administrativos": 12,
            },
        ],
    )

    second_upload = make_excel_upload_file(
        filename="rrhh-reprogramacion.xlsx",
        rows=[
            {
                "RUT Programable": 15759391.0,
                "DV": 9.0,
                "Nombre": "MEDRANO DIAZ JORGE RAFAEL",
                "Correlativo Contrato": 1.0,
                "LEY": "19664",
                "Días de Permisos Administrativos": 6,
            },
            {
                "RUT Programable": 15759391.0,
                "DV": 9.0,
                "Nombre": "MEDRANO DIAZ JORGE RAFAEL",
                "Correlativo Contrato": 2.0,
                "LEY": "15076",
                "Días de Permisos Administrativos": 3,
            },
        ],
    )

    first_payload = asyncio.run(
        funcionarios_router.upload_funcionarios(
            file=first_upload,
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=500, role="admin"),
        )
    )
    second_payload = asyncio.run(
        funcionarios_router.upload_funcionarios(
            file=second_upload,
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=501, role="admin"),
        )
    )

    funcionarios = db_session.query(models.Funcionario).filter(models.Funcionario.period_id == period.id).order_by(models.Funcionario.contract_correlative.asc()).all()

    assert first_payload["registros_creados"] == 2
    assert first_payload["registros_actualizados"] == 0
    assert second_payload["registros_creados"] == 0
    assert second_payload["registros_actualizados"] == 2
    assert len(funcionarios) == 2
    assert [funcionario.rut for funcionario in funcionarios] == ["15759391", "15759391"]
    assert [funcionario.dv for funcionario in funcionarios] == ["9", "9"]
    assert [funcionario.administrative_days for funcionario in funcionarios] == [6, 3]


def test_delete_latest_rrhh_import_removes_only_last_created_batch(db_session) -> None:
    period = make_period(name="2026-05-delete-last-import", month=5, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.commit()

    first_upload = make_excel_upload_file(
        filename="primer-lote.xlsx",
        rows=[
            {"RUT Programable": "11111111", "DV": "1", "Nombre": "Ana Uno", "Correlativo Contrato": 1},
        ],
    )
    second_upload = make_excel_upload_file(
        filename="segundo-lote.xlsx",
        rows=[
            {"RUT Programable": "22222222", "DV": "2", "Nombre": "Beto Dos", "Correlativo Contrato": 1},
            {"RUT Programable": "33333333", "DV": "3", "Nombre": "Carla Tres", "Correlativo Contrato": 1},
        ],
    )

    asyncio.run(
        funcionarios_router.upload_funcionarios(
            file=first_upload,
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=510, role="admin"),
        )
    )
    asyncio.run(
        funcionarios_router.upload_funcionarios(
            file=second_upload,
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=511, role="admin"),
        )
    )

    payload = funcionarios_router.delete_latest_rrhh_import(
        period_id=period.id,
        db=db_session,
        current_user=make_user(user_id=512, role="admin"),
    )

    remaining_ruts = {
        funcionario.rut
        for funcionario in db_session.query(models.Funcionario).filter(models.Funcionario.period_id == period.id).all()
    }
    latest_activity = db_session.query(models.Activity).filter(models.Activity.type == "rrhh_import_batch").order_by(models.Activity.id.desc()).first()

    assert payload["deleted_count"] == 2
    assert remaining_ruts == {"11111111"}
    assert latest_activity is not None
    assert "revertida" in latest_activity.description.lower()
    assert '"deleted_count": 2' in (latest_activity.details or "")


def test_delete_latest_rrhh_import_blocks_when_created_rows_have_dependencies(db_session) -> None:
    period = make_period(name="2026-06-delete-blocked", month=6, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.commit()

    upload = make_excel_upload_file(
        filename="dependencias.xlsx",
        rows=[
            {"RUT Programable": "44444444", "DV": "4", "Nombre": "Dependencia Uno", "Correlativo Contrato": 1},
        ],
    )

    asyncio.run(
        funcionarios_router.upload_funcionarios(
            file=upload,
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=520, role="admin"),
        )
    )

    funcionario = db_session.query(models.Funcionario).filter(models.Funcionario.period_id == period.id).one()
    db_session.add(models.UserOfficial(user_id=900, funcionario_id=funcionario.id))
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.delete_latest_rrhh_import(
            period_id=period.id,
            db=db_session,
            current_user=make_user(user_id=521, role="admin"),
        )

    assert exc_info.value.status_code == 409
    assert "dependencias" in exc_info.value.detail.lower()
    assert db_session.query(models.Funcionario).filter(models.Funcionario.id == funcionario.id).count() == 1


def test_list_rrhh_deletion_batches_returns_only_dependency_free_created_at_groups(db_session) -> None:
    period = make_period(name="2026-07-delete-batches", month=7, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.commit()

    reversible_created_at = datetime(2026, 7, 10, 9, 0, 0)
    blocked_created_at = datetime(2026, 7, 11, 10, 30, 0)

    reversible_one = models.Funcionario(name="Reversible Uno", title="Médico", rut="70000001", period_id=period.id, created_at=reversible_created_at)
    reversible_two = models.Funcionario(name="Reversible Dos", title="Médico", rut="70000002", period_id=period.id, created_at=reversible_created_at)
    blocked = models.Funcionario(name="Bloqueado", title="Médico", rut="70000003", period_id=period.id, created_at=blocked_created_at)
    db_session.add_all([reversible_one, reversible_two, blocked])
    db_session.flush()

    db_session.add(models.UserOfficial(user_id=777, funcionario_id=blocked.id))
    db_session.add(
        models.Activity(
            user_id=1,
            type="rrhh_import_batch",
            description="Carga de RRHH",
            details='{"period_id": %d, "created_ids": [%d, %d], "file_name": "lote-historico.xlsx"}' % (period.id, reversible_one.id, reversible_two.id),
        )
    )
    db_session.commit()

    payload = funcionarios_router.list_rrhh_deletion_batches(
        period_id=period.id,
        db=db_session,
        current_user=make_user(user_id=530, role="admin"),
    )

    assert len(payload["batches"]) == 1
    assert payload["batches"][0]["created_at"] == reversible_created_at.replace(tzinfo=funcionarios_router.UTC)
    assert payload["batches"][0]["funcionario_count"] == 2
    assert payload["batches"][0]["tracked_activity_count"] == 1
    assert payload["batches"][0]["file_names"] == ["lote-historico.xlsx"]


def test_delete_rrhh_import_by_created_at_removes_selected_batch_and_marks_activity_reverted(db_session) -> None:
    period = make_period(name="2026-08-delete-by-created-at", month=8, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.commit()

    target_created_at = datetime(2026, 8, 15, 8, 45, 0)
    remaining_created_at = datetime(2026, 8, 16, 8, 45, 0)

    removable_one = models.Funcionario(name="Eliminar Uno", title="Médico", rut="80000001", period_id=period.id, created_at=target_created_at)
    removable_two = models.Funcionario(name="Eliminar Dos", title="Médico", rut="80000002", period_id=period.id, created_at=target_created_at)
    remaining = models.Funcionario(name="Permanece", title="Médico", rut="80000003", period_id=period.id, created_at=remaining_created_at)
    db_session.add_all([removable_one, removable_two, remaining])
    db_session.flush()

    activity = models.Activity(
        user_id=1,
        type="rrhh_import_batch",
        description="Carga de RRHH",
        details='{"period_id": %d, "created_ids": [%d, %d], "file_name": "rrhh-antiguo.xlsx"}' % (period.id, removable_one.id, removable_two.id),
    )
    db_session.add(activity)
    db_session.commit()

    payload = funcionarios_router.delete_rrhh_import_by_created_at(
        created_at=target_created_at.isoformat(),
        period_id=period.id,
        db=db_session,
        current_user=make_user(user_id=531, role="admin"),
    )

    remaining_ruts = {
        funcionario.rut
        for funcionario in db_session.query(models.Funcionario).filter(models.Funcionario.period_id == period.id).all()
    }
    refreshed_activity = db_session.query(models.Activity).filter(models.Activity.id == activity.id).one()

    assert payload["deleted_count"] == 2
    assert remaining_ruts == {"80000003"}
    assert "revertida" in refreshed_activity.description.lower()
    assert '"deleted_count": 2' in (refreshed_activity.details or "")


def test_resolve_user_scope_defaults_admin_to_own_scope_and_allows_explicit_override() -> None:
    admin = make_user(user_id=1, role="admin")

    assert PermissionChecker.resolve_user_scope(admin) == 1
    assert PermissionChecker.resolve_user_scope(admin, 44) == 44


def test_resolve_user_scope_rejects_cross_user_requests_for_non_admin() -> None:
    with pytest.raises(HTTPException) as exc_info:
        PermissionChecker.resolve_user_scope(make_user(user_id=5, role="user"), 7)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "No tiene permiso para operar sobre otro usuario."


def test_resolve_user_scope_defaults_supervisor_to_global_scope_and_allows_explicit_override() -> None:
    supervisor = make_user(user_id=9, role="supervisor")

    assert PermissionChecker.resolve_user_scope(supervisor) is None
    assert PermissionChecker.resolve_user_scope(supervisor, 44) == 44


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


def test_read_funcionarios_allows_supervisor_global_read_scope(db_session) -> None:
    supervisor = make_user(user_id=401, role="supervisor")
    owner = make_user(user_id=402, role="user")
    period = make_period(name="2026-07", month=7, status="ACTIVO", is_active=True)
    db_session.add_all([supervisor, owner, period])
    db_session.flush()

    funcionario_a = models.Funcionario(
        name="Funcionario Uno",
        title="Enfermero",
        rut="71000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    funcionario_b = models.Funcionario(
        name="Funcionario Dos",
        title="Médico(a) Cirujano(a)",
        rut="71000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([funcionario_a, funcionario_b])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=owner.id, funcionario_id=funcionario_a.id))
    db_session.commit()

    payload = funcionarios_router.read_funcionarios(
        period_id=period.id,
        db=db_session,
        current_user=supervisor,
    )

    assert {item["rut"] for item in payload} == {"71000001", "71000002"}


def test_read_funcionarios_excludes_law_15076_lunch_minutes_without_guard_release(db_session) -> None:
    user = make_user(user_id=403, role="user")
    period = make_period(name="2026-08", month=8, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    excluded_contract = models.Funcionario(
        name="Andrea Colación",
        title="Enfermera",
        rut="71000003",
        dv="K",
        period_id=period.id,
        law_code="15076",
        hours_per_week=11,
        lunch_time_minutes=60,
        observations="",
        status="activo",
        is_active_roster=True,
    )
    included_contract = models.Funcionario(
        name="Andrea Colación",
        title="Enfermera",
        rut="71000003",
        dv="K",
        period_id=period.id,
        law_code="19664",
        hours_per_week=22,
        lunch_time_minutes=30,
        observations="",
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([excluded_contract, included_contract])
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=excluded_contract.id),
        models.UserOfficial(user_id=user.id, funcionario_id=included_contract.id),
    ])
    db_session.commit()

    payload = funcionarios_router.read_funcionarios(period_id=period.id, db=db_session, current_user=user)

    assert len(payload) == 1
    assert payload[0]["lunch_time_minutes"] == 30


def test_read_funcionarios_keeps_law_15076_lunch_minutes_with_guard_release(db_session) -> None:
    user = make_user(user_id=404, role="user")
    period = make_period(name="2026-09", month=9, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    released_contract = models.Funcionario(
        name="Bruno Colación",
        title="Enfermero",
        rut="71000004",
        dv="K",
        period_id=period.id,
        law_code="15076",
        hours_per_week=11,
        lunch_time_minutes=60,
        observations="Liberado de guardia",
        status="activo",
        is_active_roster=True,
    )
    regular_contract = models.Funcionario(
        name="Bruno Colación",
        title="Enfermero",
        rut="71000004",
        dv="K",
        period_id=period.id,
        law_code="19664",
        hours_per_week=22,
        lunch_time_minutes=30,
        observations="",
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([released_contract, regular_contract])
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=released_contract.id),
        models.UserOfficial(user_id=user.id, funcionario_id=regular_contract.id),
    ])
    db_session.commit()

    payload = funcionarios_router.read_funcionarios(period_id=period.id, db=db_session, current_user=user)

    assert len(payload) == 1
    assert payload[0]["lunch_time_minutes"] == 60


def test_permission_checker_identifies_reviewer_role() -> None:
    reviewer = make_user(user_id=900, role="revisor")

    assert PermissionChecker.is_reviewer(reviewer) is True
    assert PermissionChecker.is_read_only_role(reviewer) is True


def test_check_can_edit_programming_blocks_reviewer(db_session) -> None:
    reviewer = make_user(user_id=901, role="revisor")
    period = make_period(name="2026-10", month=10, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Reviewer Target",
        title="Enfermero",
        rut="90000001",
        period=period,
        status="activo",
    )
    db_session.add_all([reviewer, period, funcionario])
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        PermissionChecker.check_can_edit_programming(reviewer, funcionario.id, db_session)

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "El rol revisor solo puede acceder en modo lectura operacional."


def test_review_programming_persists_snapshot_and_notifications_without_rollback_on_email_failure(db_session, monkeypatch) -> None:
    reviewer = make_user(user_id=902, role="revisor")
    assigned_user = make_user(user_id=903, role="user")
    period = make_period(name="2026-11", month=11, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Ana Revisada",
        title="Enfermera",
        rut="90000002",
        period=period,
        status="activo",
    )
    db_session.add_all([reviewer, assigned_user, period, funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))

    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        created_by_id=assigned_user.id,
        updated_by_id=assigned_user.id,
    )
    db_session.add(programming)
    db_session.commit()

    def fake_send(*args, **kwargs):
        return True, "failed", "smtp offline"

    monkeypatch.setattr(programming_router, "send_fix_required_email", fake_send)

    response = programming_router.review_programming(
        programming.id,
        schemas.ProgrammingReviewRequest(action="fix_required", comment="Falta detalle"),
        db_session,
        reviewer,
    )

    db_session.refresh(programming)
    review_event = db_session.query(models.ProgrammingReviewEvent).one()
    notification = db_session.query(models.UserNotification).one()

    assert response.review_status == "fix_required"
    assert response.notifications_created == 1
    assert response.email.status == "failed"
    assert programming.review_status == "fix_required"
    assert programming.review_comment == "Falta detalle"
    assert review_event.email_status == "failed"
    assert review_event.email_error == "smtp offline"
    assert notification.user_id == assigned_user.id


def test_review_programming_validated_persists_snapshot_and_audit_event(db_session) -> None:
    reviewer = make_user(user_id=906, role="revisor")
    assigned_user = make_user(user_id=907, role="user")
    period = make_period(name="2027-01", month=1, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Valentina Validada",
        title="Enfermera",
        rut="90000004",
        period=period,
        status="activo",
    )
    db_session.add_all([reviewer, assigned_user, period, funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))

    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        created_by_id=assigned_user.id,
        updated_by_id=assigned_user.id,
    )
    db_session.add(programming)
    db_session.commit()

    response = programming_router.review_programming(
        programming.id,
        schemas.ProgrammingReviewRequest(action="validated"),
        db_session,
        reviewer,
    )

    db_session.refresh(programming)
    review_event = db_session.query(models.ProgrammingReviewEvent).one()

    assert response.review_status == "validated"
    assert response.notifications_created == 0
    assert response.email.attempted is False
    assert response.email.status == "skipped"
    assert programming.review_status == "validated"
    assert programming.reviewed_by_id == reviewer.id
    assert review_event.action == "validated"
    assert review_event.reviewed_by_id == reviewer.id
    assert review_event.email_status == "skipped"
    assert db_session.query(models.UserNotification).count() == 0


def test_update_programming_resets_fix_required_to_pending_for_re_review(db_session) -> None:
    reviewer = make_user(user_id=918, role="revisor")
    assigned_user = make_user(user_id=919, role="user")
    period = make_period(name="2027-06", month=6, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Paula Pendiente",
        title="Enfermera",
        rut="90000009",
        period=period,
        status="activo",
    )
    db_session.add_all([reviewer, assigned_user, period, funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))

    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=3,
        created_by_id=assigned_user.id,
        updated_by_id=assigned_user.id,
        review_status="fix_required",
        reviewed_at=datetime(2027, 6, 10, 9, 30, 0),
        reviewed_by_id=reviewer.id,
        review_comment="Ajustar observación",
    )
    db_session.add(programming)
    db_session.flush()
    db_session.add(models.ProgrammingReviewEvent(
        programming_id=programming.id,
        action="fix_required",
        comment="Ajustar observación",
        reviewed_by_id=reviewer.id,
        reviewed_at=datetime(2027, 6, 10, 9, 30, 0),
        email_status="sent",
    ))
    db_session.commit()

    response = programming_router.update_programming(
        programming.id,
        schemas.ProgrammingUpdate(version=3, observation="Corregido por usuario"),
        db_session,
        assigned_user,
    )

    db_session.refresh(programming)

    assert response.review_status == "pending"
    assert programming.review_status == "pending"
    assert programming.reviewed_at is None
    assert programming.reviewed_by_id is None
    assert programming.review_comment is None
    assert programming.observation == "Corregido por usuario"
    assert db_session.query(models.ProgrammingReviewEvent).count() == 1


def test_update_programming_keeps_validated_snapshot_when_not_returning_from_fix(db_session) -> None:
    reviewer = make_user(user_id=920, role="revisor")
    assigned_user = make_user(user_id=921, role="user")
    period = make_period(name="2027-07", month=7, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Valeria Validada",
        title="Enfermera",
        rut="90000010",
        period=period,
        status="activo",
    )
    db_session.add_all([reviewer, assigned_user, period, funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))

    reviewed_at = datetime(2027, 7, 4, 11, 0, 0)
    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=2,
        created_by_id=assigned_user.id,
        updated_by_id=assigned_user.id,
        review_status="validated",
        reviewed_at=reviewed_at,
        reviewed_by_id=reviewer.id,
        review_comment=None,
    )
    db_session.add(programming)
    db_session.commit()

    response = programming_router.update_programming(
        programming.id,
        schemas.ProgrammingUpdate(version=2, observation="Ajuste administrativo"),
        db_session,
        assigned_user,
    )

    db_session.refresh(programming)

    assert response.review_status == "validated"
    assert programming.review_status == "validated"
    assert programming.reviewed_at == reviewed_at
    assert programming.reviewed_by_id == reviewer.id


def test_review_programming_rejects_historical_periods(db_session) -> None:
    reviewer = make_user(user_id=916, role="revisor")
    assigned_user = make_user(user_id=917, role="user")
    historical_period = make_period(name="2027-05", month=5, status="ANTIGUO", is_active=False)
    funcionario = models.Funcionario(
        name="Hugo Histórico",
        title="Enfermero",
        rut="90000008",
        period=historical_period,
        status="activo",
    )
    db_session.add_all([reviewer, assigned_user, historical_period, funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))

    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=historical_period.id,
        created_by_id=assigned_user.id,
        updated_by_id=assigned_user.id,
    )
    db_session.add(programming)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        programming_router.review_programming(
            programming.id,
            schemas.ProgrammingReviewRequest(action="validated"),
            db_session,
            reviewer,
        )

    db_session.refresh(programming)

    assert exc_info.value.status_code == 409
    assert "no está activo" in exc_info.value.detail
    assert programming.review_status is None
    assert programming.reviewed_at is None
    assert programming.reviewed_by_id is None
    assert db_session.query(models.ProgrammingReviewEvent).count() == 0


def test_programming_review_request_rejects_multiple_terminal_actions() -> None:
    with pytest.raises(ValidationError):
        schemas.ProgrammingReviewRequest(action="validated,fix_required")


def test_resolve_review_notification_recipients_fans_out_by_rut_and_period_only(db_session) -> None:
    period = make_period(name="2027-02", month=2, status="ACTIVO", is_active=True)
    target_user_a = make_user(user_id=908, role="user")
    target_user_b = make_user(user_id=909, role="user")
    unrelated_user = make_user(user_id=910, role="user")
    db_session.add_all([period, target_user_a, target_user_b, unrelated_user])
    db_session.flush()

    target_contract = models.Funcionario(
        name="Ana Alcance",
        title="Enfermera",
        rut="90000005",
        period_id=period.id,
        status="activo",
    )
    related_contract = models.Funcionario(
        name="Ana Alcance",
        title="Enfermera",
        rut="90000005",
        period_id=period.id,
        status="activo",
    )
    unrelated_contract = models.Funcionario(
        name="Bruno Fuera Alcance",
        title="Enfermero",
        rut="90000006",
        period_id=period.id,
        status="activo",
    )
    db_session.add_all([target_contract, related_contract, unrelated_contract])
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=target_user_a.id, funcionario_id=target_contract.id),
        models.UserOfficial(user_id=target_user_a.id, funcionario_id=related_contract.id),
        models.UserOfficial(user_id=target_user_b.id, funcionario_id=related_contract.id),
        models.UserOfficial(user_id=unrelated_user.id, funcionario_id=unrelated_contract.id),
    ])

    programming = models.Programming(
        funcionario_id=target_contract.id,
        period_id=period.id,
        created_by_id=target_user_a.id,
        updated_by_id=target_user_a.id,
    )
    db_session.add(programming)
    db_session.commit()

    recipients = programming_router.resolve_review_notification_recipients(db_session, programming)

    assert [recipient.id for recipient in recipients] == [target_user_a.id, target_user_b.id]


def test_send_fix_required_email_targets_all_assigned_recipients(db_session, monkeypatch) -> None:
    reviewer = make_user(user_id=911, role="revisor")
    recipient_a = make_user(user_id=912, role="user")
    recipient_a.email = "ana@example.com"
    recipient_b = make_user(user_id=913, role="user")
    recipient_b.email = "bruno@example.com"
    period = make_period(name="2027-03", month=3, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Correo Revisión",
        title="Enfermera",
        rut="90000007",
        period=period,
        status="activo",
    )
    programming = models.Programming(
        funcionario=funcionario,
        period=period,
        created_by_id=reviewer.id,
        updated_by_id=reviewer.id,
    )
    db_session.add_all([
        reviewer,
        recipient_a,
        recipient_b,
        period,
        funcionario,
        programming,
        models.Config(key="smtp_host", value="smtp.example.com", description=""),
        models.Config(key="smtp_port", value="587", description=""),
        models.Config(key="smtp_username", value="mailer", description=""),
        models.Config(key="smtp_password", value="secret", description=""),
        models.Config(key="smtp_from_email", value="noreply@example.com", description=""),
        models.Config(key="smtp_from_name", value="Programación", description=""),
        models.Config(key="smtp_use_tls", value="true", description=""),
        models.Config(key="smtp_use_ssl", value="false", description=""),
        models.Config(key="smtp_review_fix_required_subject", value="Acción requerida: {{funcionario_nombre}}", description=""),
        models.Config(key="smtp_review_fix_required_body", value="Comentario: {{comentario}}\nPeriodo: {{periodo_nombre}}\nID: {{programming_id}}", description=""),
    ])
    db_session.commit()

    sent_messages: list[EmailMessage] = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            assert host == "smtp.example.com"
            assert port == 587
            assert timeout == 10

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def starttls(self):
            return None

        def login(self, username, password):
            assert username == "mailer"
            assert password == "secret"

        def send_message(self, message):
            sent_messages.append(message)

    monkeypatch.setattr(programming_router.smtplib, "SMTP", FakeSMTP)

    attempted, email_status, email_detail = programming_router.send_fix_required_email(
        db_session,
        recipients=[recipient_a, recipient_b],
        programming=programming,
        comment="Corregir turno",
    )

    assert attempted is True
    assert email_status == "sent"
    assert email_detail is None
    assert len(sent_messages) == 1
    assert sent_messages[0]["Subject"] == "Acción requerida: Correo Revisión"
    assert sent_messages[0]["To"] == "ana@example.com, bruno@example.com"
    assert "Corregir turno" in sent_messages[0].get_content()
    assert "Periodo: 2027-03" in sent_messages[0].get_content()


def test_send_fix_required_email_supports_ssl_transport(db_session, monkeypatch) -> None:
    reviewer = make_user(user_id=950, role="revisor")
    recipient = make_user(user_id=951, role="user")
    recipient.email = "ssl@example.com"
    period = make_period(name="2027-05", month=5, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Correo SSL",
        title="Matrona",
        rut="90000010",
        period=period,
        status="activo",
    )
    programming = models.Programming(
        funcionario=funcionario,
        period=period,
        created_by_id=reviewer.id,
        updated_by_id=reviewer.id,
    )
    db_session.add_all([
        reviewer,
        recipient,
        period,
        funcionario,
        programming,
        models.Config(key="smtp_host", value="smtp.secure.example.com", description=""),
        models.Config(key="smtp_port", value="465", description=""),
        models.Config(key="smtp_username", value="mailer", description=""),
        models.Config(key="smtp_password", value="secret", description=""),
        models.Config(key="smtp_from_email", value="noreply@example.com", description=""),
        models.Config(key="smtp_from_name", value="Programación", description=""),
        models.Config(key="smtp_use_tls", value="false", description=""),
        models.Config(key="smtp_use_ssl", value="true", description=""),
    ])
    db_session.commit()

    sent_messages: list[EmailMessage] = []

    class FakeSMTPSSL:
        def __init__(self, host, port, timeout):
            assert host == "smtp.secure.example.com"
            assert port == 465
            assert timeout == 10

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def login(self, username, password):
            assert username == "mailer"
            assert password == "secret"

        def send_message(self, message):
            sent_messages.append(message)

    monkeypatch.setattr(programming_router.smtplib, "SMTP_SSL", FakeSMTPSSL)

    attempted, email_status, email_detail = programming_router.send_fix_required_email(
        db_session,
        recipients=[recipient],
        programming=programming,
        comment=None,
    )

    assert attempted is True
    assert email_status == "sent"
    assert email_detail is None
    assert len(sent_messages) == 1
    assert sent_messages[0]["Subject"] == "Arreglar programación: Correo SSL"


def test_general_rows_include_review_snapshot_for_reviewer(db_session) -> None:
    reviewer = make_user(user_id=904, role="revisor")
    assigned_user = make_user(user_id=905, role="user")
    period = make_period(name="2026-12", month=12, status="ACTIVO", is_active=True)
    db_session.add_all([reviewer, assigned_user, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="General Review",
        title="Enfermera",
        rut="90000003",
        period_id=period.id,
        status="activo",
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))
    db_session.add(models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        review_status="validated",
        reviewed_at=datetime(2026, 12, 10, 9, 0, 0),
        reviewed_by_id=reviewer.id,
    ))
    db_session.commit()

    rows = general_router.read_general_rows(period_id=period.id, db=db_session, current_user=reviewer)

    assert len(rows) == 1
    assert rows[0]["review_status"] == "validated"
    assert rows[0]["reviewed_by_name"] == reviewer.name


def test_general_rows_show_neutral_review_state_without_history(db_session) -> None:
    reviewer = make_user(user_id=914, role="revisor")
    assigned_user = make_user(user_id=915, role="user")
    period = make_period(name="2027-04", month=4, status="ACTIVO", is_active=True)
    db_session.add_all([reviewer, assigned_user, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="General Neutral",
        title="Enfermera",
        rut="90000008",
        period_id=period.id,
        status="activo",
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=assigned_user.id, funcionario_id=funcionario.id))
    db_session.commit()

    rows = general_router.read_general_rows(period_id=period.id, db=db_session, current_user=reviewer)

    assert len(rows) == 1
    assert rows[0]["review_status"] is None
    assert rows[0]["reviewed_at"] is None
    assert rows[0]["reviewed_by_name"] is None


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


def test_search_funcionarios_matches_name_tokens_in_any_order(db_session) -> None:
    admin = make_user(user_id=411, role="admin")
    period = make_period(name="2026-05-token-search", month=5, status="ACTIVO", is_active=True)
    db_session.add_all([admin, period])
    db_session.flush()

    target = models.Funcionario(
        name="MERINO RIOS PABLO ANDRES",
        title="Enfermero",
        rut="61000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    distractor = models.Funcionario(
        name="PABLO HERRERA",
        title="Enfermero",
        rut="61000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([target, distractor])
    db_session.commit()

    payload_merino_pablo = funcionarios_router.search_funcionarios(
        q="merino pablo",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=admin,
    )
    payload_pablo_merino = funcionarios_router.search_funcionarios(
        q="pablo merino",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=admin,
    )

    assert [item["rut"] for item in payload_merino_pablo] == ["61000001"]
    assert [item["rut"] for item in payload_pablo_merino] == ["61000001"]


def test_search_funcionarios_keeps_rut_search_behavior(db_session) -> None:
    admin = make_user(user_id=412, role="admin")
    period = make_period(name="2026-05-rut-search", month=5, status="ACTIVO", is_active=True)
    db_session.add_all([admin, period])
    db_session.flush()

    target = models.Funcionario(
        name="MERINO RIOS PABLO ANDRES",
        title="Enfermero",
        rut="62000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(target)
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="62000001-K",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=admin,
    )

    assert [item["rut"] for item in payload] == ["62000001"]


def test_read_groups_allows_supervisor_global_read_scope(db_session) -> None:
    supervisor = make_user(user_id=403, role="supervisor")
    owner = make_user(user_id=404, role="user")
    period = make_period(name="2026-08", month=8, status="ACTIVO", is_active=True)
    db_session.add_all([supervisor, owner, period])
    db_session.flush()

    group = models.Group(name="Equipo A", user_id=owner.id, period_id=period.id)
    funcionario = models.Funcionario(
        name="Funcionario Grupo",
        title="Enfermero",
        rut="72000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([group, funcionario])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=owner.id, funcionario_id=funcionario.id, group_id=group.id))
    db_session.commit()

    payload = groups_router.read_groups(period_id=period.id, db=db_session, current_user=supervisor)

    assert len(payload) == 1
    assert payload[0]["name"] == "Equipo A"
    assert payload[0]["count"] == 1


def test_read_programmings_allows_supervisor_global_read_scope(db_session) -> None:
    supervisor = make_user(user_id=405, role="supervisor")
    owner = make_user(user_id=406, role="user")
    period = make_period(name="2026-09", month=9, status="ACTIVO", is_active=True)
    db_session.add_all([supervisor, owner, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="Funcionario Programado",
        title="Enfermero",
        rut="73000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=owner.id, funcionario_id=funcionario.id))
    db_session.add(models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        assigned_status="Activo",
        selected_process="Consulta",
        created_by_id=owner.id,
        updated_by_id=owner.id,
    ))
    db_session.commit()

    payload = programming_router.read_programmings(period_id=period.id, funcionario_ids=None, db=db_session, current_user=supervisor)

    assert len(payload) == 1
    assert payload[0].funcionario_id == funcionario.id


def test_read_programmings_filters_supervisor_by_explicit_user_scope(db_session) -> None:
    supervisor = make_user(user_id=408, role="supervisor")
    owner_a = make_user(user_id=409, role="user")
    owner_b = make_user(user_id=410, role="user")
    period = make_period(name="2026-11", month=11, status="ACTIVO", is_active=True)
    db_session.add_all([supervisor, owner_a, owner_b, period])
    db_session.flush()

    funcionario_a = models.Funcionario(
        name="Funcionario A",
        title="Enfermero",
        rut="73500001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    funcionario_b = models.Funcionario(
        name="Funcionario B",
        title="Enfermero",
        rut="73500002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([funcionario_a, funcionario_b])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user_id=owner_a.id, funcionario_id=funcionario_a.id),
        models.UserOfficial(user_id=owner_b.id, funcionario_id=funcionario_b.id),
        models.Programming(
            funcionario_id=funcionario_a.id,
            period_id=period.id,
            assigned_status="Activo",
            selected_process="Consulta",
            created_by_id=owner_a.id,
            updated_by_id=owner_a.id,
        ),
        models.Programming(
            funcionario_id=funcionario_b.id,
            period_id=period.id,
            assigned_status="Activo",
            selected_process="Procedimiento",
            created_by_id=owner_b.id,
            updated_by_id=owner_b.id,
        ),
    ])
    db_session.commit()

    payload = programming_router.read_programmings(
        period_id=period.id,
        funcionario_ids=None,
        user_id=owner_a.id,
        db=db_session,
        current_user=supervisor,
    )

    assert len(payload) == 1
    assert payload[0].funcionario_id == funcionario_a.id


def test_read_programmings_allows_user_to_fetch_sibling_contract_programming_with_same_rut_and_period(db_session) -> None:
    owner = make_user(user_id=416, role="user")
    period = make_period(name="2026-12", month=12, status="ACTIVO", is_active=True)
    db_session.add_all([owner, period])
    db_session.flush()

    bound_contract = models.Funcionario(
        name="Medrano Díaz Jorge Rafael",
        title="Enfermero",
        rut="74500001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    programmed_contract = models.Funcionario(
        name="Medrano Díaz Jorge Rafael",
        title="Enfermero",
        rut="74500001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([bound_contract, programmed_contract])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user_id=owner.id, funcionario_id=bound_contract.id),
        models.Programming(
            funcionario_id=programmed_contract.id,
            period_id=period.id,
            assigned_status="Activo",
            selected_process="Consulta",
            created_by_id=owner.id,
            updated_by_id=owner.id,
        ),
    ])
    db_session.commit()

    payload = programming_router.read_programmings(
        period_id=period.id,
        funcionario_ids=[programmed_contract.id],
        db=db_session,
        current_user=owner,
    )

    assert len(payload) == 1
    assert payload[0].funcionario_id == programmed_contract.id


def test_supervisor_can_list_supervised_user_options(db_session) -> None:
    supervisor = make_user(user_id=411, role="supervisor")
    regular_user = make_user(user_id=412, role="user")
    medical_coordinator = make_user(user_id=413, role="medical_coordinator")
    non_medical_coordinator = make_user(user_id=4165, role="non_medical_coordinator")
    admin = make_user(user_id=414, role="admin")
    inactive_user = make_user(user_id=415, role="user")
    inactive_user.status = "inactivo"

    db_session.add_all([supervisor, regular_user, medical_coordinator, non_medical_coordinator, admin, inactive_user])
    db_session.commit()

    payload = users_router.read_supervised_user_options(db=db_session, current_user=supervisor)

    assert {user.id for user in payload} == {medical_coordinator.id, non_medical_coordinator.id}


def test_reviewer_can_list_supervised_user_options(db_session) -> None:
    reviewer = make_user(user_id=4160, role="revisor")
    regular_user = make_user(user_id=4161, role="user")
    medical_coordinator = make_user(user_id=4162, role="medical_coordinator")
    non_medical_coordinator = make_user(user_id=4166, role="non_medical_coordinator")
    admin = make_user(user_id=4163, role="admin")
    supervisor = make_user(user_id=4164, role="supervisor")

    db_session.add_all([reviewer, regular_user, medical_coordinator, non_medical_coordinator, admin, supervisor])
    db_session.commit()

    payload = users_router.read_supervised_user_options(db=db_session, current_user=reviewer)

    assert {user.id for user in payload} == {medical_coordinator.id, non_medical_coordinator.id}


def test_supervisor_cannot_write_funcionarios_or_programming(db_session) -> None:
    supervisor = make_user(user_id=407, role="supervisor")
    period = make_period(name="2026-10", month=10, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Funcionario Solo Lectura",
        title="Enfermero",
        rut="74000001",
        dv="K",
        period_id=1,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([supervisor, period, funcionario])
    db_session.flush()
    funcionario.period_id = period.id
    db_session.commit()

    with pytest.raises(HTTPException) as bind_exc:
        funcionarios_router.bind_funcionario_to_user(
            funcionario_id=funcionario.id,
            payload={},
            db=db_session,
            current_user=supervisor,
        )

    assert bind_exc.value.status_code == 403
    assert bind_exc.value.detail == "El rol supervisor solo puede acceder en modo lectura."

    with pytest.raises(HTTPException) as programming_exc:
        programming_router.create_programming(
            programming=schemas.ProgrammingCreate(
                funcionario_id=funcionario.id,
                period_id=period.id,
                assigned_status="Activo",
                prais=False,
                selected_process="Consulta",
                items=[],
            ),
            db=db_session,
            current_user=supervisor,
        )

    assert programming_exc.value.status_code == 403
    assert programming_exc.value.detail == "El rol supervisor solo puede acceder en modo lectura."


def test_admin_must_bind_funcionario_before_saving_programming(db_session) -> None:
    admin = make_user(user_id=530, role="admin")
    period = make_period(name="2027-02", month=2, status="ACTIVO", is_active=True)
    funcionario = models.Funcionario(
        name="Funcionario Externo",
        title="Enfermero",
        rut="77000001",
        dv="K",
        period_id=1,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([admin, period, funcionario])
    db_session.flush()
    funcionario.period_id = period.id
    db_session.commit()

    with pytest.raises(HTTPException) as programming_exc:
        programming_router.create_programming(
            programming=schemas.ProgrammingCreate(
                funcionario_id=funcionario.id,
                period_id=period.id,
                assigned_status="Activo",
                prais=False,
                selected_process="Consulta",
                items=[],
            ),
            db=db_session,
            current_user=admin,
        )

    assert programming_exc.value.status_code == 403
    assert programming_exc.value.detail == "No se pudo guardar la programación porque el funcionario no está agregado en Funcionarios para este perfil."


def test_delete_programming_blocks_when_funcionario_is_linked_to_two_users(db_session) -> None:
    owner = make_user(user_id=531, role="user")
    collaborator = make_user(user_id=532, role="user")
    period = make_period(name="2027-03", month=3, status="ACTIVO", is_active=True)
    db_session.add_all([owner, collaborator, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="Funcionario Compartido",
        title="Enfermero",
        rut="77000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=owner.id, funcionario_id=funcionario.id),
        models.UserOfficial(user_id=collaborator.id, funcionario_id=funcionario.id),
    ])
    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        assigned_status="Activo",
        selected_process="Consulta",
        created_by_id=owner.id,
        updated_by_id=owner.id,
    )
    db_session.add(programming)
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        programming_router.delete_programming(
            programming_id=programming.id,
            db=db_session,
            current_user=owner,
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == (
        "No es posible eliminar la programación; solo se puede modificar porque hay dos o más usuarios asociados a este funcionario."
    )
    assert db_session.query(models.Programming).filter(models.Programming.id == programming.id).one().id == programming.id
    assert db_session.query(models.OfficialAudit).filter(models.OfficialAudit.action == "Delete Programming").count() == 0


def test_delete_programming_keeps_current_flow_with_single_linked_user(db_session) -> None:
    owner = make_user(user_id=533, role="user")
    period = make_period(name="2027-04", month=4, status="ACTIVO", is_active=True)
    db_session.add_all([owner, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="Funcionario Individual",
        title="Enfermero",
        rut="77000003",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=owner.id, funcionario_id=funcionario.id))
    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        assigned_status="Activo",
        selected_process="Consulta",
        created_by_id=owner.id,
        updated_by_id=owner.id,
    )
    db_session.add(programming)
    db_session.commit()

    response = programming_router.delete_programming(
        programming_id=programming.id,
        db=db_session,
        current_user=owner,
    )

    assert response == {"message": "Programming deleted"}
    assert db_session.query(models.Programming).filter(models.Programming.id == programming.id).count() == 0
    audit = db_session.query(models.OfficialAudit).filter(models.OfficialAudit.action == "Delete Programming").one()
    assert audit.funcionario_id == funcionario.id
    assert audit.user_id == owner.id


def test_read_general_rows_returns_all_user_assignments_for_admin(db_session) -> None:
    admin = make_user(user_id=500, role="admin")
    owner_a = make_user(user_id=501, role="user")
    owner_b = make_user(user_id=502, role="medical_coordinator")
    period = make_period(name="2026-12", month=12, status="ACTIVO", is_active=True)
    db_session.add_all([admin, owner_a, owner_b, period])
    db_session.flush()

    funcionario_a_contract_1 = models.Funcionario(
        name="Andrea Pérez",
        title="Enfermero",
        rut="76000001",
        dv="K",
        period_id=period.id,
        law_code="19664",
        hours_per_week=22,
        specialty_sis="Urgencia",
        status="activo",
        is_active_roster=True,
    )
    funcionario_a_contract_2 = models.Funcionario(
        name="Andrea Pérez",
        title="Enfermero",
        rut="76000001",
        dv="K",
        period_id=period.id,
        law_code="15076",
        hours_per_week=11,
        specialty_sis="Urgencia",
        status="activo",
        is_active_roster=True,
    )
    funcionario_b = models.Funcionario(
        name="Bruno Soto",
        title="Médico(a) Cirujano(a)",
        rut="76000002",
        dv="K",
        period_id=period.id,
        law_code="15076",
        hours_per_week=44,
        specialty_sis="Cardiología",
        status="inactivo",
        is_active_roster=False,
    )
    db_session.add_all([funcionario_a_contract_1, funcionario_a_contract_2, funcionario_b])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user_id=owner_a.id, funcionario_id=funcionario_a_contract_1.id),
        models.UserOfficial(user_id=owner_b.id, funcionario_id=funcionario_a_contract_2.id),
        models.UserOfficial(user_id=owner_b.id, funcionario_id=funcionario_b.id),
        models.Programming(
            funcionario_id=funcionario_a_contract_2.id,
            period_id=period.id,
            assigned_status="Activo",
            selected_process="Consulta",
            created_by_id=owner_a.id,
            updated_by_id=owner_a.id,
        ),
    ])
    db_session.commit()

    payload = general_router.read_general_rows(period_id=period.id, db=db_session, current_user=admin)

    assert len(payload) == 2
    andrea = next(item for item in payload if item["funcionario"] == "Andrea Pérez")
    bruno = next(item for item in payload if item["funcionario"] == "Bruno Soto")

    assert andrea["law_code"] == "15076 y 19664"
    assert andrea["hours_per_week"] == "22 hrs y 11 hrs"
    assert andrea["lunch_time_minutes"] == 0
    assert andrea["user_name"] == "User 501, User 502"
    assert andrea["user_ids"] == [owner_a.id, owner_b.id]
    assert andrea["programmed_label"] == "Programado"
    assert bruno["user_name"] == "User 502"
    assert bruno["programmed_label"] == "No Programado"


def test_read_general_rows_includes_consolidated_lunch_minutes(db_session) -> None:
    admin = make_user(user_id=520, role="admin")
    owner = make_user(user_id=521, role="user")
    period = make_period(name="2027-02", month=2, status="ACTIVO", is_active=True)
    db_session.add_all([admin, owner, period])
    db_session.flush()

    contract = models.Funcionario(
        name="Valeria Almuerzo",
        title="Enfermera",
        rut="76500003",
        dv="K",
        period_id=period.id,
        law_code="19664",
        hours_per_week=44,
        lunch_time_minutes=150,
        specialty_sis="Urgencia",
        status="activo",
        is_active_roster=True,
    )
    db_session.add(contract)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=owner.id, funcionario_id=contract.id))
    db_session.commit()

    payload = general_router.read_general_rows(period_id=period.id, db=db_session, current_user=admin)

    assert len(payload) == 1
    assert payload[0]["funcionario"] == "Valeria Almuerzo"
    assert payload[0]["lunch_time_minutes"] == 150


def test_read_general_rows_allows_supervisor_explicit_user_scope(db_session) -> None:
    supervisor = make_user(user_id=510, role="supervisor")
    owner_a = make_user(user_id=511, role="user")
    owner_b = make_user(user_id=512, role="user")
    period = make_period(name="2027-01", month=1, status="ACTIVO", is_active=True)
    db_session.add_all([supervisor, owner_a, owner_b, period])
    db_session.flush()

    funcionario_a = models.Funcionario(
        name="Funcionario A",
        title="Enfermero",
        rut="76500001",
        dv="K",
        period_id=period.id,
        law_code="19664",
        hours_per_week=44,
        specialty_sis="UPC",
        status="activo",
        is_active_roster=True,
    )
    funcionario_b = models.Funcionario(
        name="Funcionario B",
        title="Enfermero",
        rut="76500002",
        dv="K",
        period_id=period.id,
        law_code="19664",
        hours_per_week=33,
        specialty_sis="Urgencia",
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([funcionario_a, funcionario_b])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user_id=owner_a.id, funcionario_id=funcionario_a.id),
        models.UserOfficial(user_id=owner_b.id, funcionario_id=funcionario_b.id),
    ])
    db_session.commit()

    payload = general_router.read_general_rows(
        period_id=period.id,
        user_id=owner_a.id,
        db=db_session,
        current_user=supervisor,
    )

    assert len(payload) == 1
    assert payload[0]["funcionario"] == "Funcionario A"
    assert payload[0]["user_id"] == owner_a.id


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


def test_medical_coordinator_can_search_medical_globally_without_prior_scope(db_session) -> None:
    coordinator = make_user(user_id=441, role="medical_coordinator")
    period = make_period(name="2026-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([coordinator, period])
    db_session.flush()

    medico = models.Funcionario(
        name="Dra. Ana",
        title="Médico(a) Cirujano(a)",
        rut="55000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    no_medico = models.Funcionario(
        name="Ana Enfermera",
        title="Enfermero",
        rut="55000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([medico, no_medico])
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="Ana",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=coordinator,
    )

    assert [item["rut"] for item in payload] == ["55000001"]


def test_medical_coordinator_can_bind_medical_without_prior_scope_and_cannot_bind_non_medical(db_session) -> None:
    coordinator = make_user(user_id=442, role="medical_coordinator")
    period = make_period(name="2026-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([coordinator, period])
    db_session.flush()

    medico = models.Funcionario(
        name="Dr. Bruno",
        title="Médico(a) Cirujano(a)",
        rut="56000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    no_medico = models.Funcionario(
        name="Bruno TENS",
        title="TENS",
        rut="56000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([medico, no_medico])
    db_session.commit()

    payload = funcionarios_router.bind_funcionario_to_user(
        funcionario_id=medico.id,
        payload=None,
        db=db_session,
        current_user=coordinator,
    )

    assert payload == {"message": "Bound successfully"}
    assert db_session.query(models.UserOfficial).filter_by(user_id=coordinator.id, funcionario_id=medico.id).count() == 1

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.bind_funcionario_to_user(
            funcionario_id=no_medico.id,
            payload=None,
            db=db_session,
            current_user=coordinator,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "No tiene permiso para vincular este funcionario según su rol."


def test_non_medical_coordinator_can_search_and_bind_non_medical_without_prior_scope(db_session) -> None:
    coordinator = make_user(user_id=443, role="non_medical_coordinator")
    period = make_period(name="2026-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([coordinator, period])
    db_session.flush()

    no_medico = models.Funcionario(
        name="Carla Enfermera",
        title="Enfermero",
        rut="57000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    medico = models.Funcionario(
        name="Carla Médica",
        title="Médico(a) Cirujano(a)",
        rut="57000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([no_medico, medico])
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="Carla",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=coordinator,
    )

    assert [item["rut"] for item in payload] == ["57000001"]

    bind_payload = funcionarios_router.bind_funcionario_to_user(
        funcionario_id=no_medico.id,
        payload=None,
        db=db_session,
        current_user=coordinator,
    )

    assert bind_payload == {"message": "Bound successfully"}

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.bind_funcionario_to_user(
            funcionario_id=medico.id,
            payload=None,
            db=db_session,
            current_user=coordinator,
        )

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "No tiene permiso para vincular este funcionario según su rol."


def test_admin_keeps_full_global_search_and_bind_access(db_session) -> None:
    admin = make_user(user_id=444, role="admin")
    target_user = make_user(user_id=445, role="medical_coordinator")
    period = make_period(name="2026-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([admin, target_user, period])
    db_session.flush()

    medico = models.Funcionario(
        name="Daniel Médico",
        title="Médico(a) Cirujano(a)",
        rut="58000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    no_medico = models.Funcionario(
        name="Daniel Enfermero",
        title="Enfermero",
        rut="58000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([medico, no_medico])
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="Daniel",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=admin,
    )

    assert {item["rut"] for item in payload} == {"58000001", "58000002"}

    bind_payload = funcionarios_router.bind_funcionario_to_user(
        funcionario_id=no_medico.id,
        payload={"user_id": target_user.id},
        db=db_session,
        current_user=admin,
    )

    assert bind_payload == {"message": "Bound successfully"}
    assert db_session.query(models.UserOfficial).filter_by(user_id=target_user.id, funcionario_id=no_medico.id).count() == 1


def test_medical_coordinator_global_search_stays_role_filtered_after_existing_scope(db_session) -> None:
    coordinator = make_user(user_id=446, role="medical_coordinator")
    period = make_period(name="2026-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([coordinator, period])
    db_session.flush()

    scoped_medico = models.Funcionario(
        name="Elena Médica Scope",
        title="Médico(a) Cirujano(a)",
        rut="59000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    unscoped_medico = models.Funcionario(
        name="Elena Médica Global",
        title="Médico(a) Cirujano(a)",
        rut="59000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    no_medico = models.Funcionario(
        name="Elena Enfermera",
        title="Enfermero",
        rut="59000003",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([scoped_medico, unscoped_medico, no_medico])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=coordinator.id, funcionario_id=scoped_medico.id))
    db_session.commit()

    payload = funcionarios_router.search_funcionarios(
        q="Elena",
        period_id=period.id,
        search_mode="global",
        db=db_session,
        current_user=coordinator,
    )

    assert {item["rut"] for item in payload} == {"59000001", "59000002"}


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


def test_assign_funcionario_group_allows_sibling_contract_within_same_rut_scope(db_session) -> None:
    user = make_user(user_id=470, role="user")
    period = make_period(name="2026-08", month=8, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    bound_contract = models.Funcionario(
        name="Jorge Medrano",
        title="Enfermero",
        rut="70000010",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
        law_code="18834",
    )
    sibling_contract = models.Funcionario(
        name="Jorge Medrano",
        title="Enfermero",
        rut="70000010",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
        law_code="19664",
    )
    group = models.Group(name="Grupo A", user_id=user.id, period_id=period.id)
    db_session.add_all([bound_contract, sibling_contract, group])
    db_session.flush()

    binding = models.UserOfficial(user_id=user.id, funcionario_id=bound_contract.id)
    db_session.add(binding)
    db_session.commit()

    payload = funcionarios_router.assign_funcionario_group(
        funcionario_id=sibling_contract.id,
        payload={"group_id": group.id},
        db=db_session,
        current_user=user,
    )

    refreshed_binding = db_session.query(models.UserOfficial).filter_by(user_id=user.id, funcionario_id=bound_contract.id).one()

    assert payload == {"message": "Group assigned successfully"}
    assert refreshed_binding.group_id == group.id


def test_assign_funcionario_group_rejects_out_of_scope_person_even_with_same_period(db_session) -> None:
    user = make_user(user_id=471, role="user")
    owner = make_user(user_id=472, role="user")
    period = make_period(name="2026-09", month=9, status="ACTIVO", is_active=True)
    db_session.add_all([user, owner, period])
    db_session.flush()

    scoped_funcionario = models.Funcionario(
        name="Funcionario Scoped",
        title="Enfermero",
        rut="70000020",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    foreign_funcionario = models.Funcionario(
        name="Funcionario Externo",
        title="Enfermero",
        rut="70000021",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    group = models.Group(name="Grupo Scoped", user_id=user.id, period_id=period.id)
    db_session.add_all([scoped_funcionario, foreign_funcionario, group])
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=scoped_funcionario.id),
        models.UserOfficial(user_id=owner.id, funcionario_id=foreign_funcionario.id),
    ])
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.assign_funcionario_group(
            funcionario_id=foreign_funcionario.id,
            payload={"group_id": group.id},
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Binding not found"


def test_assign_funcionario_group_keeps_admin_explicit_scope_working_for_sibling_contracts(db_session) -> None:
    admin = make_user(user_id=473, role="admin")
    owner = make_user(user_id=474, role="user")
    period = make_period(name="2026-10", month=10, status="ACTIVO", is_active=True)
    db_session.add_all([admin, owner, period])
    db_session.flush()

    bound_contract = models.Funcionario(
        name="Ana Admin",
        title="Enfermero",
        rut="70000030",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    sibling_contract = models.Funcionario(
        name="Ana Admin",
        title="Enfermero",
        rut="70000030",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    group = models.Group(name="Grupo Admin", user_id=owner.id, period_id=period.id)
    db_session.add_all([bound_contract, sibling_contract, group])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=owner.id, funcionario_id=bound_contract.id))
    db_session.commit()

    payload = funcionarios_router.assign_funcionario_group(
        funcionario_id=sibling_contract.id,
        payload={"user_id": owner.id, "group_id": group.id},
        db=db_session,
        current_user=admin,
    )

    refreshed_binding = db_session.query(models.UserOfficial).filter_by(user_id=owner.id, funcionario_id=bound_contract.id).one()

    assert payload == {"message": "Group assigned successfully"}
    assert refreshed_binding.group_id == group.id


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
    ensure_default_dismiss_reasons(db_session)

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


def test_dismiss_funcionario_requires_suboption_and_records_configured_reason(db_session) -> None:
    user = make_user(user_id=60, role="user")
    period = make_period(name="2027-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Marta Comisión",
        title="Enfermero",
        rut="76000001",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.add(models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=1,
        status="borrador",
        assigned_status="Activo",
        prais=False,
        global_specialty="Urgencia",
        selected_performance_unit="Unidad 1",
        created_by_id=user.id,
        updated_by_id=user.id,
    ))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    total_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="total").one()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.dismiss_funcionario(
            funcionario_id=funcionario.id,
            payload=schemas.DismissSelectionRequest(reason_id=commission_reason.id),
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert "Suboption" in str(exc_info.value.detail)

    response = funcionarios_router.dismiss_funcionario(
        funcionario_id=funcionario.id,
        payload=schemas.DismissSelectionRequest(reason_id=commission_reason.id, suboption_id=total_suboption.id, start_date=date(2026, 6, 1)),
        db=db_session,
        current_user=user,
    )

    db_session.refresh(funcionario)
    audit = db_session.query(models.OfficialAudit).filter_by(funcionario_id=funcionario.id, action="Dismiss").order_by(models.OfficialAudit.id.desc()).first()

    assert funcionario.status == "inactivo"
    assert response["reason"] == "Comisión de Servicio - Total"
    assert audit is not None
    assert audit.reason == "Comisión de Servicio - Total"
    assert audit.suboption == "Total"
    assert audit.reason_category == "mobility"


def test_dismiss_funcionario_requires_start_date_when_reason_configuration_demands_it(db_session) -> None:
    user = make_user(user_id=61, role="user")
    period = make_period(name="2027-07", month=7, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Paula Fecha",
        title="Enfermero",
        rut="76000010",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    renuncia = db_session.query(models.DismissReason).filter_by(system_key="renuncia").one()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.dismiss_funcionario(
            funcionario_id=funcionario.id,
            payload=schemas.DismissSelectionRequest(reason_id=renuncia.id),
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert "fecha de inicio" in str(exc_info.value.detail).lower()


def test_dismiss_funcionario_allows_missing_start_date_when_reason_does_not_require_it(db_session) -> None:
    user = make_user(user_id=62, role="user")
    period = make_period(name="2027-08", month=8, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Paula Error",
        title="Enfermero",
        rut="76000011",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    agregado_error = db_session.query(models.DismissReason).filter_by(system_key="agregado-error").one()
    response = funcionarios_router.dismiss_funcionario(
        funcionario_id=funcionario.id,
        payload=schemas.DismissSelectionRequest(reason_id=agregado_error.id, user_id=user.id),
        db=db_session,
        current_user=user,
    )

    hidden = db_session.query(models.UserHiddenOfficial).filter_by(user_id=user.id, funcionario_rut=funcionario.rut).one()

    assert response["action"] == "Hide"
    assert hidden.dismiss_start_date is None


def test_dismiss_funcionario_sets_inactive_when_start_date_is_before_or_within_period(db_session) -> None:
    user = make_user(user_id=63, role="user")
    period = make_period(name="2027-09", month=9, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Paula Dentro",
        title="Enfermero",
        rut="76000012",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    renuncia = db_session.query(models.DismissReason).filter_by(system_key="renuncia").one()
    response = funcionarios_router.dismiss_funcionario(
        funcionario_id=funcionario.id,
        payload=schemas.DismissSelectionRequest(reason_id=renuncia.id, start_date=date(2026, 9, 1)),
        db=db_session,
        current_user=user,
    )

    db_session.refresh(funcionario)
    audit = db_session.query(models.OfficialAudit).filter_by(funcionario_id=funcionario.id, action="Dismiss").order_by(models.OfficialAudit.id.desc()).first()

    assert response["status"] == "inactivo"
    assert funcionario.status == "inactivo"
    assert funcionario.dismiss_start_date == datetime(2026, 9, 1)
    assert audit is not None
    assert audit.dismiss_start_date == datetime(2026, 9, 1)


def test_dismiss_funcionario_keeps_active_when_start_date_is_after_period_end(db_session) -> None:
    user = make_user(user_id=64, role="user")
    period = make_period(name="2027-10", month=10, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Paula Futuro",
        title="Enfermero",
        rut="76000013",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    renuncia = db_session.query(models.DismissReason).filter_by(system_key="renuncia").one()
    response = funcionarios_router.dismiss_funcionario(
        funcionario_id=funcionario.id,
        payload=schemas.DismissSelectionRequest(reason_id=renuncia.id, start_date=date(2026, 11, 1)),
        db=db_session,
        current_user=user,
    )

    db_session.refresh(funcionario)

    assert response["status"] == "activo"
    assert funcionario.status == "activo"
    assert funcionario.dismiss_start_date == datetime(2026, 11, 1)


def test_clear_future_dismiss_removes_future_programming_metadata_and_keeps_official_active(db_session) -> None:
    user = make_user(user_id=65, role="user")
    period = make_period(name="2027-11", month=11, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Paula Reversa",
        title="Enfermero",
        rut="76000014",
        dv="K",
        period_id=period.id,
        status="activo",
        dismiss_start_date=datetime(2026, 12, 1),
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))

    renuncia = db_session.query(models.DismissReason).filter_by(system_key="renuncia").one()
    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=2,
        status="borrador",
        assigned_status="Renuncia",
        dismiss_reason_id=renuncia.id,
        dismiss_start_date=datetime(2026, 12, 1),
        prais=False,
        created_by_id=user.id,
        updated_by_id=user.id,
    )
    db_session.add(programming)
    db_session.add(models.OfficialAudit(
        funcionario_id=funcionario.id,
        funcionario_name=funcionario.name,
        rut=funcionario.rut,
        period_id=period.id,
        user_id=user.id,
        action="Dismiss",
        reason="Renuncia",
        dismiss_reason_id=renuncia.id,
        dismiss_start_date=datetime(2026, 12, 1),
    ))
    db_session.commit()

    response = funcionarios_router.clear_future_dismiss(
        funcionario_id=funcionario.id,
        payload=None,
        db=db_session,
        current_user=user,
    )

    db_session.refresh(funcionario)
    db_session.refresh(programming)
    audit = db_session.query(models.OfficialAudit).filter_by(funcionario_id=funcionario.id, action="Clear Future Dismiss").order_by(models.OfficialAudit.id.desc()).first()

    assert response["status"] == "activo"
    assert response["has_future_dismiss_scheduled"] is False
    assert funcionario.status == "activo"
    assert funcionario.dismiss_start_date is None
    assert programming.dismiss_reason_id is None
    assert programming.dismiss_suboption_id is None
    assert programming.dismiss_start_date is None
    assert programming.assigned_status == "Activo"
    assert programming.version == 3
    assert audit is not None
    assert audit.reason == "Renuncia"


def test_clear_future_dismiss_rejects_effective_dismisses(db_session) -> None:
    user = make_user(user_id=66, role="user")
    period = make_period(name="2027-12", month=12, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()

    funcionario = models.Funcionario(
        name="Paula Efectiva",
        title="Enfermero",
        rut="76000015",
        dv="K",
        period_id=period.id,
        status="inactivo",
        dismiss_start_date=datetime(2026, 12, 1),
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.clear_future_dismiss(
            funcionario_id=funcionario.id,
            payload=None,
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "El funcionario no tiene una baja futura programada para quitar."


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


def test_dismiss_funcionario_partial_commission_creates_programming_activity_and_observation(db_session) -> None:
    user = make_user(user_id=52, role="user")
    period = make_period(name="2027-05", month=5, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    db_session.add(models.ActivityType(name="Otras Actividades No Clínicas", period_id=period.id, visible="SI", req_rendimiento="NO"))

    funcionario = models.Funcionario(
        name="Andrea Parcial",
        title="Enfermera",
        rut="76000002",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.add(models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=1,
        status="borrador",
        assigned_status="Activo",
        prais=False,
        global_specialty="Urgencia",
        selected_performance_unit="Unidad 1",
        created_by_id=user.id,
        updated_by_id=user.id,
    ))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    response = funcionarios_router.dismiss_funcionario(
        funcionario_id=funcionario.id,
        payload=schemas.DismissSelectionRequest(
            reason_id=commission_reason.id,
            suboption_id=partial_suboption.id,
            partial_hours=6,
            start_date=date(2026, 5, 1),
        ),
        db=db_session,
        current_user=user,
    )

    programming = db_session.query(models.Programming).filter_by(funcionario_id=funcionario.id, period_id=period.id).one()
    auto_item = db_session.query(models.ProgrammingItem).filter_by(programming_id=programming.id, description="Comisión de Servicio Parcial").one()
    audit = db_session.query(models.OfficialAudit).filter_by(funcionario_id=funcionario.id, action="Dismiss").order_by(models.OfficialAudit.id.desc()).first()

    db_session.refresh(funcionario)

    assert response["partial_hours"] == 6
    assert response["status"] == "activo"
    assert response["active_status_label"] == "Comisión de Servicio - Parcial"
    assert funcionario.status == "activo"
    assert programming.dismiss_partial_hours == 6
    assert programming.assigned_status == "Comisión de Servicio - Parcial"
    assert programming.observation == "Funcionario con comision de servicio parcial 6 horas"
    assert auto_item.activity_name == "Otras Actividades No Clínicas"
    assert auto_item.specialty == "Urgencia"
    assert auto_item.assigned_hours == 6.0
    assert audit is not None
    assert audit.dismiss_partial_hours == 6


def test_create_programming_updates_partial_commission_item_specialty_when_existing_programming_is_upserted(db_session) -> None:
    user = make_user(user_id=59, role="user")
    period = make_period(name="2027-12", month=12, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    db_session.add(models.ActivityType(name="Otras Actividades No Clínicas", period_id=period.id, visible="SI", req_rendimiento="NO"))

    funcionario = models.Funcionario(
        name="Lorena Ajuste",
        title="Enfermera",
        rut="76000009",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=1,
        status="borrador",
        assigned_status="Comisión de Servicio - Parcial",
        global_specialty="Urgencia",
        dismiss_reason_id=commission_reason.id,
        dismiss_suboption_id=partial_suboption.id,
        dismiss_partial_hours=4,
        prais=False,
        created_by_id=user.id,
        updated_by_id=user.id,
        items=[
            models.ProgrammingItem(
                activity_name="Otras Actividades No Clínicas",
                description="Comisión de Servicio Parcial",
                specialty=None,
                assigned_hours=4.0,
                performance=0.0,
            )
        ],
    )
    db_session.add(programming)
    db_session.commit()

    response = programming_router.create_programming(
        programming=schemas.ProgrammingCreate(
            funcionario_id=funcionario.id,
            period_id=period.id,
            assigned_status="Comisión de Servicio - Parcial",
            prais=False,
            global_specialty="Cardiología",
            dismiss_reason_id=commission_reason.id,
            dismiss_suboption_id=partial_suboption.id,
            dismiss_partial_hours=6,
            items=[],
        ),
        db=db_session,
        current_user=user,
    )

    auto_item = db_session.query(models.ProgrammingItem).filter_by(programming_id=response.id, description="Comisión de Servicio Parcial").one()

    assert response.global_specialty == "Cardiología"
    assert response.dismiss_partial_hours == 6
    assert auto_item.specialty == "Cardiología"
    assert auto_item.assigned_hours == 6.0


def test_dismiss_funcionario_partial_commission_requires_valid_base_programming(db_session) -> None:
    user = make_user(user_id=55, role="user")
    period = make_period(name="2027-08", month=8, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Patricia Base",
        title="Enfermera",
        rut="76000005",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    with pytest.raises(HTTPException) as exc_info:
        funcionarios_router.dismiss_funcionario(
            funcionario_id=funcionario.id,
            payload=schemas.DismissSelectionRequest(
                reason_id=commission_reason.id,
                suboption_id=partial_suboption.id,
                partial_hours=6,
                start_date=date(2026, 8, 1),
            ),
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "No se puede asignar Comisión de Servicio Parcial porque el funcionario no tiene una programación base válida. "
        "Primero debe registrar la programación base del funcionario."
    )


def test_clear_partial_commission_keeps_official_active_and_removes_automatic_residue(db_session) -> None:
    user = make_user(user_id=54, role="user")
    period = make_period(name="2027-07", month=7, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    db_session.add(models.ActivityType(name="Otras Actividades No Clínicas", period_id=period.id, visible="SI", req_rendimiento="NO"))

    funcionario = models.Funcionario(
        name="Elena Limpia",
        title="Enfermera",
        rut="76000004",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    programming = models.Programming(
        funcionario_id=funcionario.id,
        period_id=period.id,
        version=1,
        status="borrador",
        observation="Observación manual\nFuncionario con comision de servicio parcial 6 horas",
        assigned_status="Comisión de Servicio - Parcial",
        prais=False,
        dismiss_reason_id=commission_reason.id,
        dismiss_suboption_id=partial_suboption.id,
        dismiss_partial_hours=6,
        created_by_id=user.id,
        updated_by_id=user.id,
        items=[
            models.ProgrammingItem(
                activity_name="Otras Actividades No Clínicas",
                description="Comisión de Servicio Parcial",
                assigned_hours=6.0,
                performance=0.0,
            ),
            models.ProgrammingItem(
                activity_name="Consulta",
                description="Mantener",
                assigned_hours=10.0,
                performance=5.0,
            ),
        ],
    )
    db_session.add(programming)
    db_session.commit()

    funcionarios_router.activate_funcionario(
        funcionario_id=funcionario.id,
        payload={"clear_partial_commission": True},
        db=db_session,
        current_user=user,
    )

    db_session.refresh(funcionario)
    db_session.refresh(programming)
    db_session.refresh(programming, attribute_names=["items"])
    audit = db_session.query(models.OfficialAudit).filter_by(funcionario_id=funcionario.id, action="Clear Partial Commission").one()

    assert funcionario.status == "activo"
    assert programming.dismiss_partial_hours is None
    assert programming.dismiss_reason_id is None
    assert programming.dismiss_suboption_id is None
    assert programming.assigned_status == "Activo"
    assert programming.observation == "Observación manual"
    assert len(programming.items) == 1
    assert programming.items[0].description == "Mantener"
    assert audit.reason == "Sin comisión"


def test_create_programming_partial_commission_requires_positive_hours(db_session) -> None:
    user = make_user(user_id=53, role="user")
    period = make_period(name="2027-06", month=6, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Carlos Validación",
        title="Enfermero",
        rut="76000003",
        dv="K",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    with pytest.raises(HTTPException) as exc_info:
        programming_router.create_programming(
            programming=schemas.ProgrammingCreate(
                funcionario_id=funcionario.id,
                period_id=period.id,
                assigned_status="Comisión de Servicio - Parcial",
                prais=False,
                dismiss_reason_id=commission_reason.id,
                dismiss_suboption_id=partial_suboption.id,
                items=[],
            ),
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "La Comisión de Servicio Parcial requiere una cantidad de horas mayor a 0."


def test_create_programming_partial_commission_requires_base_fields(db_session) -> None:
    user = make_user(user_id=56, role="user")
    period = make_period(name="2027-09", month=9, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Bruno Incompleto",
        title="Enfermero",
        rut="76000006",
        dv="K",
        law_code="19664",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    with pytest.raises(HTTPException) as exc_info:
        programming_router.create_programming(
            programming=schemas.ProgrammingCreate(
                funcionario_id=funcionario.id,
                period_id=period.id,
                assigned_status="Comisión de Servicio - Parcial",
                prais=False,
                dismiss_reason_id=commission_reason.id,
                dismiss_suboption_id=partial_suboption.id,
                dismiss_partial_hours=6,
                global_specialty=None,
                selected_process="Apoyo Clínico",
                selected_performance_unit=None,
                items=[],
            ),
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "No se puede asignar Comisión de Servicio Parcial porque el funcionario no tiene una programación base válida. "
        "Primero debe registrar la programación base del funcionario con Especialidad Principal."
    )


def test_create_programming_partial_commission_requires_performance_unit_when_rule_applies(db_session) -> None:
    user = make_user(user_id=57, role="user")
    period = make_period(name="2027-10", month=10, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Paula Guardia",
        title="Enfermera",
        rut="76000007",
        dv="K",
        law_code="15076",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    with pytest.raises(HTTPException) as exc_info:
        programming_router.create_programming(
            programming=schemas.ProgrammingCreate(
                funcionario_id=funcionario.id,
                period_id=period.id,
                assigned_status="Comisión de Servicio - Parcial",
                prais=False,
                dismiss_reason_id=commission_reason.id,
                dismiss_suboption_id=partial_suboption.id,
                dismiss_partial_hours=6,
                global_specialty="Urgencia",
                selected_performance_unit=None,
                items=[],
            ),
            db=db_session,
            current_user=user,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == (
        "No se puede asignar Comisión de Servicio Parcial porque el funcionario no tiene una programación base válida. "
        "Primero debe registrar la programación base del funcionario con Unidad de Desempeño."
    )


def test_validate_hours_balance_excludes_law_15076_lunch_minutes_without_guard_release(db_session) -> None:
    period = make_period(name="2027-10-b", month=10, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.flush()

    excluded_contract = models.Funcionario(
        name="Paula Balance",
        title="Enfermera",
        rut="76000070",
        dv="K",
        law_code="15076",
        observations="",
        period_id=period.id,
        hours_per_week=11,
        lunch_time_minutes=60,
        status="activo",
        is_active_roster=True,
    )
    included_contract = models.Funcionario(
        name="Paula Balance",
        title="Enfermera",
        rut="76000070",
        dv="K",
        law_code="19664",
        observations="",
        period_id=period.id,
        hours_per_week=22,
        lunch_time_minutes=0,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([excluded_contract, included_contract])
    db_session.commit()

    programming_router.validate_hours_balance(
        db_session,
        included_contract.id,
        [{"assigned_hours": 22}],
    )


def test_validate_hours_balance_keeps_law_15076_lunch_minutes_with_guard_release(db_session) -> None:
    period = make_period(name="2027-10-c", month=10, status="ACTIVO", is_active=True)
    db_session.add(period)
    db_session.flush()

    released_contract = models.Funcionario(
        name="Paula Balance",
        title="Enfermera",
        rut="76000071",
        dv="K",
        law_code="15076",
        observations="liberado de guardia",
        period_id=period.id,
        hours_per_week=11,
        lunch_time_minutes=60,
        status="activo",
        is_active_roster=True,
    )
    included_contract = models.Funcionario(
        name="Paula Balance",
        title="Enfermera",
        rut="76000071",
        dv="K",
        law_code="19664",
        observations="",
        period_id=period.id,
        hours_per_week=22,
        lunch_time_minutes=0,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([released_contract, included_contract])
    db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        programming_router.validate_hours_balance(
            db_session,
            included_contract.id,
            [{"assigned_hours": 33}],
        )

    assert exc_info.value.status_code == 400
    assert "Las horas programadas exceden las disponibles" in exc_info.value.detail


def test_create_programming_partial_commission_allows_missing_performance_unit_when_rule_does_not_apply(db_session) -> None:
    user = make_user(user_id=58, role="user")
    period = make_period(name="2027-11", month=11, status="ACTIVO", is_active=True)
    db_session.add_all([user, period])
    db_session.flush()
    ensure_default_dismiss_reasons(db_session)

    funcionario = models.Funcionario(
        name="Raúl Flexible",
        title="Enfermero",
        rut="76000008",
        dv="K",
        law_code="19664",
        period_id=period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add(funcionario)
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    commission_reason = db_session.query(models.DismissReason).filter_by(system_key="comision-servicio").one()
    partial_suboption = db_session.query(models.DismissReasonSuboption).filter_by(reason_id=commission_reason.id, system_key="parcial").one()

    response = programming_router.create_programming(
        programming=schemas.ProgrammingCreate(
            funcionario_id=funcionario.id,
            period_id=period.id,
            assigned_status="Comisión de Servicio - Parcial",
            prais=False,
            dismiss_reason_id=commission_reason.id,
            dismiss_suboption_id=partial_suboption.id,
            dismiss_partial_hours=6,
            global_specialty="Urgencia",
            selected_process="Apoyo Clínico",
            selected_performance_unit=None,
            items=[],
        ),
        db=db_session,
        current_user=user,
    )

    assert response.dismiss_partial_hours == 6
    assert response.global_specialty == "Urgencia"
    assert response.selected_performance_unit is None


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


def test_dashboard_stats_counts_programmed_when_programming_lives_on_sibling_contract_same_rut(db_session) -> None:
    user = make_user(user_id=54, role="user")
    target_period = make_period(name="2027-05-b", month=5, status="ACTIVO", is_active=True)
    db_session.add_all([user, target_period])
    db_session.flush()

    bound_contract = models.Funcionario(
        name="Medrano Díaz Jorge Rafael",
        title="Enfermero",
        rut="75000010",
        dv="K",
        period_id=target_period.id,
        status="activo",
        is_active_roster=True,
    )
    programmed_contract = models.Funcionario(
        name="Medrano Díaz Jorge Rafael",
        title="Enfermero",
        rut="75000010",
        dv="K",
        period_id=target_period.id,
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([bound_contract, programmed_contract])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=bound_contract.id),
        models.Programming(funcionario_id=programmed_contract.id, period_id=target_period.id),
    ])
    db_session.commit()

    payload = stats_router.get_dashboard_stats(
        period_id=target_period.id,
        user_id=user.id,
        history_limit=stats_router.DEFAULT_DASHBOARD_HISTORY_LIMIT,
        db=db_session,
        current_user=user,
    )

    assert payload["summary"]["active_officials"] == 1
    assert payload["summary"]["programmed"] == 1
    assert payload["summary"]["unprogrammed"] == 0


def test_dashboard_stats_chart_excludes_current_period_hours_from_historical_bindings(db_session) -> None:
    user = make_user(user_id=53, role="user")
    historical_period = make_period(name="2027-06", month=6)
    current_period = make_period(name="2027-07", month=7, status="ACTIVO", is_active=True)
    db_session.add_all([user, historical_period, current_period])
    db_session.flush()

    historical_contract = models.Funcionario(
        name="Ana Histórica",
        title="Enfermero",
        rut="76000001",
        dv="K",
        period_id=historical_period.id,
        status="activo",
        is_active_roster=True,
        hours_per_week=44,
    )
    current_contract = models.Funcionario(
        name="Ana Actual",
        title="Enfermero",
        rut="76000001",
        dv="K",
        period_id=current_period.id,
        status="activo",
        is_active_roster=True,
        hours_per_week=33,
    )
    db_session.add_all([historical_contract, current_contract])
    db_session.flush()
    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=historical_contract.id))
    db_session.commit()

    payload = stats_router.get_dashboard_stats(
        period_id=current_period.id,
        user_id=user.id,
        history_limit=stats_router.DEFAULT_DASHBOARD_HISTORY_LIMIT,
        db=db_session,
        current_user=user,
    )

    chart_by_period = {item["period"]: item for item in payload["chart_data"]}

    assert payload["summary"]["active_officials"] == 0
    assert current_period.name not in chart_by_period
    assert chart_by_period[historical_period.name]["hours"] == 44.0


def test_dashboard_stats_chart_excludes_hidden_ruts_in_the_same_period(db_session) -> None:
    user = make_user(user_id=54, role="user")
    visible_period = make_period(name="2027-08", month=8)
    current_period = make_period(name="2027-09", month=9, status="ACTIVO", is_active=True)
    db_session.add_all([user, visible_period, current_period])
    db_session.flush()

    visible_contract = models.Funcionario(
        name="Bruno Visible",
        title="Médico",
        rut="76000002",
        dv="K",
        period_id=visible_period.id,
        status="activo",
        is_active_roster=True,
        hours_per_week=22,
    )
    hidden_contract = models.Funcionario(
        name="Bruno Oculto",
        title="Médico",
        rut="76000002",
        dv="K",
        period_id=current_period.id,
        status="activo",
        is_active_roster=True,
        hours_per_week=44,
    )
    db_session.add_all([visible_contract, hidden_contract])
    db_session.flush()
    db_session.add_all([
        models.UserOfficial(user_id=user.id, funcionario_id=visible_contract.id),
        models.UserOfficial(user_id=user.id, funcionario_id=hidden_contract.id),
        models.UserHiddenOfficial(
            user_id=user.id,
            funcionario_rut=hidden_contract.rut,
            period_id=current_period.id,
        ),
    ])
    db_session.commit()

    payload = stats_router.get_dashboard_stats(
        period_id=current_period.id,
        user_id=user.id,
        history_limit=stats_router.DEFAULT_DASHBOARD_HISTORY_LIMIT,
        db=db_session,
        current_user=user,
    )

    chart_by_period = {item["period"]: item for item in payload["chart_data"]}

    assert payload["summary"]["active_officials"] == 1
    assert current_period.name not in chart_by_period
    assert chart_by_period[visible_period.name]["hours"] == 22.0


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


def test_read_funcionarios_exposes_latest_inactive_reason_by_rut(db_session) -> None:
    user = make_user(user_id=1, role="user")
    period = make_period(name="2026-03", month=3, status="ACTIVO", is_active=True)
    group = models.Group(name="Grupo A", user=user, period=period)
    official_a = models.Funcionario(name="Ana Uno", title="Enfermera", rut="77", dv="K", period=period, status="inactivo")
    official_b = models.Funcionario(name="Ana Dos", title="Enfermera", rut="77", dv="K", period=period, status="inactivo")

    db_session.add_all([
        user,
        period,
        group,
        official_a,
        official_b,
    ])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user=user, funcionario=official_a, group=group),
        models.UserOfficial(user=user, funcionario=official_b, group=group),
        models.OfficialAudit(
            funcionario_id=official_a.id,
            funcionario_name=official_a.name,
            rut=official_a.rut,
            period=period,
            user=user,
            action="Dismiss",
            reason="Renuncia",
            created_at=datetime(2026, 3, 10, 9, 0, 0),
        ),
        models.OfficialAudit(
            funcionario_id=official_b.id,
            funcionario_name=official_b.name,
            rut=official_b.rut,
            period=period,
            user=user,
            action="Dismiss",
            reason="Comisión de Estudio",
            created_at=datetime(2026, 3, 11, 9, 0, 0),
        ),
    ])
    db_session.commit()

    result = funcionarios_router.read_funcionarios(
        period_id=period.id,
        db=db_session,
        current_user=user,
    )

    assert len(result) == 1
    assert result[0]["status"] == "inactivo"
    assert result[0]["inactive_reason"] == "Comisión de Estudio"


def test_read_funcionarios_exposes_partial_commission_visual_marker_without_inactive_reason(db_session) -> None:
    user = make_user(user_id=2, role="user")
    period = make_period(name="2026-04", month=4, status="ACTIVO", is_active=True)
    group = models.Group(name="Grupo B", user=user, period=period)
    official = models.Funcionario(name="Paula Activa", title="Enfermera", rut="88", dv="K", period=period, status="activo")

    db_session.add_all([user, period, group, official])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user=user, funcionario=official, group=group),
        models.Programming(
            funcionario_id=official.id,
            period_id=period.id,
            version=1,
            status="borrador",
            assigned_status="Comisión de Servicio - Parcial",
            dismiss_partial_hours=6,
            prais=False,
        ),
    ])
    db_session.commit()

    result = funcionarios_router.read_funcionarios(
        period_id=period.id,
        db=db_session,
        current_user=user,
    )

    assert len(result) == 1
    assert result[0]["status"] == "activo"
    assert result[0]["inactive_reason"] is None
    assert result[0]["active_status_label"] == "Comisión de Servicio - Parcial"


def test_read_funcionarios_exposes_termination_date_for_effective_and_future_dismisses(db_session) -> None:
    user = make_user(user_id=3, role="user")
    period = make_period(name="2026-05", month=5, status="ACTIVO", is_active=True)
    group = models.Group(name="Grupo C", user=user, period=period)
    inactive = models.Funcionario(
        name="Irene Inactiva",
        title="Enfermera",
        rut="99",
        dv="K",
        period=period,
        status="inactivo",
        dismiss_start_date=datetime(2026, 5, 10),
    )
    active_with_future_dismiss = models.Funcionario(
        name="Fabio Futuro",
        title="Médico",
        rut="100",
        dv="1",
        period=period,
        status="activo",
        dismiss_start_date=datetime(2026, 6, 1),
    )

    db_session.add_all([user, period, group, inactive, active_with_future_dismiss])
    db_session.flush()

    db_session.add_all([
        models.UserOfficial(user=user, funcionario=inactive, group=group),
        models.UserOfficial(user=user, funcionario=active_with_future_dismiss, group=group),
    ])
    db_session.commit()

    result = funcionarios_router.read_funcionarios(
        period_id=period.id,
        db=db_session,
        current_user=user,
    )

    assert len(result) == 2
    by_name = {item["name"]: item for item in result}
    assert by_name["Irene Inactiva"]["termination_date"] == datetime(2026, 5, 10)
    assert by_name["Fabio Futuro"]["termination_date"] == datetime(2026, 6, 1)


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
