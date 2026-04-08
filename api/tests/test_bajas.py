from api import models, schemas
from api.dismiss_reasons import ensure_default_dismiss_reasons
from api.routers import bajas as bajas_router


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


def test_list_dismiss_reasons_returns_seeded_defaults(db_session) -> None:
    admin = make_user(user_id=1)
    db_session.add(admin)
    db_session.commit()

    ensure_default_dismiss_reasons(db_session)

    payload = bajas_router.list_dismiss_reasons(active_only=True, db=db_session, current_user=admin)

    assert len(payload) == 6
    commission = next(reason for reason in payload if reason.name == "Comisión de Servicio")
    assert commission.system_key == "comision-servicio"
    assert commission.requires_start_date is True
    assert [suboption.system_key for suboption in commission.suboptions] == ["total", "parcial"]
    assert [suboption.name for suboption in commission.suboptions] == ["Total", "Parcial"]
    agregado_error = next(reason for reason in payload if reason.name == "Agregado por Error")
    assert agregado_error.requires_start_date is False


def test_admin_can_create_reason_and_suboption(db_session) -> None:
    admin = make_user(user_id=2)
    db_session.add(admin)
    db_session.commit()

    created = bajas_router.create_dismiss_reason(
        payload=schemas.DismissReasonCreate(
            system_key="comision-servicio",
            name="Licencia prolongada",
            description="Ausencia extendida",
            action_type="dismiss",
            reason_category="mobility",
            sort_order=70,
            is_active=True,
            requires_start_date=True,
            suboptions=[],
        ),
        db=db_session,
        current_user=admin,
    )

    updated = bajas_router.create_dismiss_suboption(
        reason_id=created.id,
        payload=schemas.DismissReasonSuboptionCreate(
            system_key="parcial",
            name="Con reemplazo",
            description="Cobertura temporal",
            sort_order=10,
        ),
        db=db_session,
        current_user=admin,
    )

    assert created.name == "Licencia prolongada"
    assert created.system_key == "comision-servicio"
    assert created.requires_start_date is True
    assert updated.suboptions[0].system_key == "parcial"
    assert [suboption.name for suboption in updated.suboptions] == ["Con reemplazo"]


def test_admin_can_update_reason_and_suboption_system_keys(db_session) -> None:
    admin = make_user(user_id=3)
    db_session.add(admin)
    db_session.commit()

    created = bajas_router.create_dismiss_reason(
        payload=schemas.DismissReasonCreate(
            system_key=None,
            name="Permiso temporal",
            description="Inicial",
            action_type="dismiss",
            reason_category="mobility",
            sort_order=10,
            is_active=True,
            requires_start_date=False,
            suboptions=[schemas.DismissReasonSuboptionCreate(system_key=None, name="Sin clave", description="", sort_order=5)],
        ),
        db=db_session,
        current_user=admin,
    )

    updated_reason = bajas_router.update_dismiss_reason(
        reason_id=created.id,
        payload=schemas.DismissReasonUpdate(system_key="comision-servicio", requires_start_date=True),
        db=db_session,
        current_user=admin,
    )

    updated_reason = bajas_router.update_dismiss_suboption(
        suboption_id=updated_reason.suboptions[0].id,
        payload=schemas.DismissReasonSuboptionUpdate(system_key="total"),
        db=db_session,
        current_user=admin,
    )

    assert updated_reason.system_key == "comision-servicio"
    assert updated_reason.requires_start_date is True
    assert updated_reason.suboptions[0].system_key == "total"


def test_updating_seeded_reason_without_system_key_keeps_existing_key(db_session) -> None:
    admin = make_user(user_id=4)
    db_session.add(admin)
    db_session.commit()

    ensure_default_dismiss_reasons(db_session)
    renuncia = db_session.query(models.DismissReason).filter_by(system_key="renuncia").one()

    updated = bajas_router.update_dismiss_reason(
        reason_id=renuncia.id,
        payload=schemas.DismissReasonUpdate(description="Texto actualizado"),
        db=db_session,
        current_user=admin,
    )

    assert updated.system_key == "renuncia"
    assert updated.description == "Texto actualizado"
