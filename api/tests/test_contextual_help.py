import pytest

from api import models
from api.contextual_help_defaults import ensure_default_contextual_help
from api.routers import contextual_help as contextual_help_router


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


def test_read_contextual_help_page_returns_seeded_content_for_authenticated_user(db_session) -> None:
    ensure_default_contextual_help(db_session)

    payload = contextual_help_router.read_contextual_help_page(
        "home",
        db=db_session,
        current_user=make_user(user_id=1, role="user"),
    )

    assert payload.slug == "home"
    assert payload.page_name == "Resumen de Programación"
    assert len(payload.sections) >= 1
    assert payload.sections[0].position == 1


def test_read_contextual_help_page_returns_seeded_general_content(db_session) -> None:
    ensure_default_contextual_help(db_session)

    payload = contextual_help_router.read_contextual_help_page(
        "general",
        db=db_session,
        current_user=make_user(user_id=10, role="supervisor"),
    )

    assert payload.slug == "general"
    assert payload.page_name == "General"
    assert len(payload.sections) == 3
    assert any(section.title == "Usuario y Programado" for section in payload.sections)


def test_ensure_default_contextual_help_creates_new_page_slugs(db_session) -> None:
    created = ensure_default_contextual_help(db_session)

    assert created >= 1
    slugs = {
        slug
        for slug, in db_session.query(models.ContextualHelpPage.slug).all()
    }
    assert {"bajas", "admin-correo", "estadisticas"}.issubset(slugs)


def test_ensure_default_contextual_help_refreshes_unedited_seeded_pages(db_session) -> None:
    page = models.ContextualHelpPage(
        slug="home",
        page_name="Home viejo",
        description="Texto anterior",
    )
    page.sections.append(models.ContextualHelpSection(position=1, title="Viejo", content="Contenido viejo"))
    db_session.add(page)
    db_session.commit()

    updated = ensure_default_contextual_help(db_session)

    assert updated >= 1
    persisted = db_session.query(models.ContextualHelpPage).filter(models.ContextualHelpPage.slug == "home").one()
    assert persisted.page_name == "Resumen de Programación"
    assert persisted.description.startswith("Resume el estado operativo")
    assert [section.title for section in persisted.sections] == [
        "Línea de tiempo",
        "Estado operativo",
        "Inactividad y movimientos",
    ]


def test_ensure_default_contextual_help_keeps_admin_customizations(db_session) -> None:
    admin = make_user(user_id=99, role="admin")
    db_session.add(admin)
    db_session.commit()

    page = models.ContextualHelpPage(
        slug="home",
        page_name="Ayuda personalizada",
        description="Contenido definido por administración",
        updated_by_id=admin.id,
    )
    page.sections.append(models.ContextualHelpSection(position=1, title="Bloque propio", content="No sobrescribir"))
    db_session.add(page)
    db_session.commit()

    ensure_default_contextual_help(db_session)

    persisted = db_session.query(models.ContextualHelpPage).filter(models.ContextualHelpPage.slug == "home").one()
    assert persisted.page_name == "Ayuda personalizada"
    assert persisted.description == "Contenido definido por administración"
    assert [section.title for section in persisted.sections] == ["Bloque propio"]


def test_list_contextual_help_pages_requires_admin(db_session) -> None:
    with pytest.raises(Exception) as exc_info:
        contextual_help_router.list_contextual_help_pages(
            db=db_session,
            current_user=make_user(user_id=2, role="user"),
        )

    assert getattr(exc_info.value, "status_code", None) == 403
    assert exc_info.value.detail == "Solo los administradores pueden gestionar las ayudas contextuales."


def test_upsert_contextual_help_page_replaces_sections_and_tracks_admin(db_session) -> None:
    admin = make_user(user_id=3, role="admin")
    db_session.add(admin)
    db_session.commit()

    first_payload = contextual_help_router.schemas.ContextualHelpPageUpsert(
        page_name="Ayuda Demo",
        description="Resumen inicial",
        sections=[
            contextual_help_router.schemas.ContextualHelpSectionCreate(title="Bloque A", content="Explicación A"),
            contextual_help_router.schemas.ContextualHelpSectionCreate(title="Bloque B", content="Explicación B"),
        ],
    )
    contextual_help_router.upsert_contextual_help_page("demo-help", first_payload, db_session, admin)

    update_payload = contextual_help_router.schemas.ContextualHelpPageUpsert(
        page_name="Ayuda Demo Actualizada",
        description="Resumen final",
        sections=[
            contextual_help_router.schemas.ContextualHelpSectionCreate(title="Bloque Único", content="Explicación final"),
        ],
    )
    payload = contextual_help_router.upsert_contextual_help_page("demo-help", update_payload, db_session, admin)

    assert payload.page_name == "Ayuda Demo Actualizada"
    assert payload.updated_by_id == admin.id
    assert payload.updated_by_name == admin.name
    assert [section.title for section in payload.sections] == ["Bloque Único"]

    persisted = db_session.query(models.ContextualHelpPage).filter(models.ContextualHelpPage.slug == "demo-help").one()
    assert len(persisted.sections) == 1
    assert persisted.sections[0].content == "Explicación final"
