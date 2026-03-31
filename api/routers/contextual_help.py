from __future__ import annotations

import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from .. import auth, database, models, schemas
from ..contextual_help_defaults import ensure_default_contextual_help
from ..permissions import PermissionChecker


router = APIRouter()

HELP_SLUG_PATTERN = re.compile(r"^[a-z0-9-]+$")


def normalize_help_slug(slug: str) -> str:
    normalized_slug = slug.strip().lower()
    if not normalized_slug or not HELP_SLUG_PATTERN.fullmatch(normalized_slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El slug de ayuda debe usar solo letras minúsculas, números y guiones.",
        )
    return normalized_slug


def validate_help_payload(payload: schemas.ContextualHelpPageUpsert) -> None:
    if not payload.page_name.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El nombre de la página es obligatorio.")

    if not payload.sections:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Debes registrar al menos una sección de ayuda.",
        )

    for section in payload.sections:
        if not section.title.strip() or not section.content.strip():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cada sección debe incluir un título y contenido no vacío.",
            )


def get_contextual_help_page_or_404(db: Session, slug: str) -> models.ContextualHelpPage:
    page = (
        db.query(models.ContextualHelpPage)
        .options(selectinload(models.ContextualHelpPage.sections), selectinload(models.ContextualHelpPage.updated_by))
        .filter(models.ContextualHelpPage.slug == slug)
        .first()
    )
    if not page:
        raise HTTPException(status_code=404, detail="Ayuda contextual no encontrada")
    return page


@router.get("", response_model=List[schemas.ContextualHelpPageResponse])
def list_contextual_help_pages(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_contextual_help(current_user)
    ensure_default_contextual_help(db)
    pages = (
        db.query(models.ContextualHelpPage)
        .options(selectinload(models.ContextualHelpPage.sections), selectinload(models.ContextualHelpPage.updated_by))
        .order_by(models.ContextualHelpPage.page_name.asc())
        .all()
    )
    return pages


@router.get("/{slug}", response_model=schemas.ContextualHelpPageResponse)
def read_contextual_help_page(
    slug: str,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    auth.require_active_user(current_user)
    ensure_default_contextual_help(db)
    normalized_slug = normalize_help_slug(slug)
    return get_contextual_help_page_or_404(db, normalized_slug)


@router.put("/{slug}", response_model=schemas.ContextualHelpPageResponse)
def upsert_contextual_help_page(
    slug: str,
    payload: schemas.ContextualHelpPageUpsert,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    PermissionChecker.check_can_manage_contextual_help(current_user)
    normalized_slug = normalize_help_slug(slug)
    validate_help_payload(payload)

    page = (
        db.query(models.ContextualHelpPage)
        .options(selectinload(models.ContextualHelpPage.sections))
        .filter(models.ContextualHelpPage.slug == normalized_slug)
        .first()
    )

    if page is None:
        page = models.ContextualHelpPage(slug=normalized_slug)
        db.add(page)

    page.page_name = payload.page_name.strip()
    page.description = payload.description.strip() if payload.description else ""
    page.updated_by_id = current_user.id
    page.sections.clear()
    db.flush()

    for index, section in enumerate(payload.sections, start=1):
        page.sections.append(
            models.ContextualHelpSection(
                position=index,
                title=section.title.strip(),
                content=section.content.strip(),
            )
        )

    db.commit()
    db.refresh(page)
    return get_contextual_help_page_or_404(db, normalized_slug)
