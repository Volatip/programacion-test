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
    assert [suboption.name for suboption in commission.suboptions] == ["Total", "Parcial"]


def test_admin_can_create_reason_and_suboption(db_session) -> None:
    admin = make_user(user_id=2)
    db_session.add(admin)
    db_session.commit()

    created = bajas_router.create_dismiss_reason(
        payload=schemas.DismissReasonCreate(
            name="Licencia prolongada",
            description="Ausencia extendida",
            action_type="dismiss",
            reason_category="mobility",
            sort_order=70,
            is_active=True,
            suboptions=[],
        ),
        db=db_session,
        current_user=admin,
    )

    updated = bajas_router.create_dismiss_suboption(
        reason_id=created.id,
        payload=schemas.DismissReasonSuboptionCreate(name="Con reemplazo", description="Cobertura temporal", sort_order=10),
        db=db_session,
        current_user=admin,
    )

    assert created.name == "Licencia prolongada"
    assert [suboption.name for suboption in updated.suboptions] == ["Con reemplazo"]
