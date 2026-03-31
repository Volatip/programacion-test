from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from api import models


def test_programming_unique_constraint_blocks_duplicate_funcionario_period(db_session) -> None:
    period = models.ProgrammingPeriod(
        name="2026-09",
        start_date=datetime(2026, 9, 1),
        end_date=datetime(2026, 9, 30),
        status="ACTIVO",
        is_active=True,
    )
    funcionario = models.Funcionario(
        name="Funcionario Único",
        title="Enfermero",
        rut="91000001",
        dv="K",
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([period, funcionario])
    db_session.flush()

    db_session.add(models.Programming(funcionario_id=funcionario.id, period_id=period.id, version=1))
    db_session.commit()

    db_session.add(models.Programming(funcionario_id=funcionario.id, period_id=period.id, version=1))
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_user_official_unique_constraint_blocks_duplicate_binding(db_session) -> None:
    user = models.User(
        email="constraint@example.com",
        password_hash="hash",
        name="Constraint User",
        rut="92000001-1",
        role="user",
        status="activo",
    )
    funcionario = models.Funcionario(
        name="Funcionario Vinculado",
        title="Enfermero",
        rut="92000002",
        dv="K",
        status="activo",
        is_active_roster=True,
    )
    db_session.add_all([user, funcionario])
    db_session.flush()

    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    db_session.commit()

    db_session.add(models.UserOfficial(user_id=user.id, funcionario_id=funcionario.id))
    with pytest.raises(IntegrityError):
        db_session.commit()
