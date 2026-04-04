from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, not_, or_
from typing import Dict, Optional
from ..database import get_db
from ..dismiss_reasons import REASON_CATEGORY_MOBILITY, REASON_CATEGORY_RESIGNATION, resolve_reason_category
from ..models import (
    Funcionario,
    Group,
    OfficialAudit,
    Programming,
    ProgrammingPeriod,
    User,
    UserOfficial,
)
from .. import auth
from ..permissions import PermissionChecker
from ..query_bounds import normalize_limit

router = APIRouter()

DEFAULT_DASHBOARD_HISTORY_LIMIT = 24
MAX_DASHBOARD_HISTORY_LIMIT = 60


def get_official_identity_key(funcionario: Funcionario) -> str:
    if funcionario.rut:
        return funcionario.rut.strip()
    return f"no-rut-{funcionario.id}"


def get_target_period(db: Session, period_id: Optional[int]) -> Optional[ProgrammingPeriod]:
    target_period = None

    if period_id:
        target_period = db.query(ProgrammingPeriod).filter(ProgrammingPeriod.id == period_id).first()

    if not target_period:
        target_period = db.query(ProgrammingPeriod).filter(ProgrammingPeriod.status == "ACTIVO").first()

    if not target_period:
        target_period = db.query(ProgrammingPeriod).order_by(ProgrammingPeriod.start_date.desc()).first()

    return target_period


def get_assigned_ruts(db: Session, user_id: int, period_id: Optional[int] = None) -> list[str]:
    query = db.query(Funcionario.rut).join(
        UserOfficial, UserOfficial.funcionario_id == Funcionario.id
    ).filter(
        UserOfficial.user_id == user_id,
        Funcionario.rut.isnot(None),
    )

    if period_id is not None:
        query = query.filter(Funcionario.period_id == period_id)

    return [rut for (rut,) in query.distinct().all() if rut]


def is_shift_contract_record(law_code: Optional[str], observations: Optional[str]) -> bool:
    if not law_code or "15076" not in law_code:
        return False
    return not (observations and "liberado de guardia" in observations.lower())


@router.get("/dashboard")
def get_dashboard_stats(
    period_id: Optional[int] = Query(None),
    user_id: Optional[int] = Query(None),
    history_limit: int = Query(DEFAULT_DASHBOARD_HISTORY_LIMIT),
    db: Session = Depends(get_db),
    current_user: User = Depends(auth.get_current_active_user),
) -> Dict:
    normalized_history_limit = normalize_limit(
        history_limit,
        default=DEFAULT_DASHBOARD_HISTORY_LIMIT,
        max_value=MAX_DASHBOARD_HISTORY_LIMIT,
    )
    effective_user_id = PermissionChecker.resolve_user_scope(current_user, user_id)
    target_period = get_target_period(db, period_id)
    current_period_id = target_period.id if target_period is not None else None

    assigned_ruts_all_periods: Optional[list[str]] = None
    assigned_ruts_current_period: Optional[list[str]] = None
    if effective_user_id is not None:
        assigned_ruts_all_periods = get_assigned_ruts(db, effective_user_id)
        assigned_ruts_current_period = (
            get_assigned_ruts(db, effective_user_id, current_period_id)
            if current_period_id is not None
            else []
        )

    total_active_officials = 0
    programmed_count = 0
    unprogrammed_count = 0

    if current_period_id is not None:
        active_query = db.query(Funcionario).filter(
            Funcionario.status == "activo",
            Funcionario.period_id == current_period_id,
        )
        if effective_user_id is not None:
            active_query = active_query.join(
                UserOfficial, UserOfficial.funcionario_id == Funcionario.id
            ).filter(UserOfficial.user_id == effective_user_id)

        active_officials = active_query.all()
        active_official_keys = {get_official_identity_key(funcionario) for funcionario in active_officials}
        total_active_officials = len(active_official_keys)

        programmed_query = db.query(Funcionario).join(
            Programming,
            and_(
                Programming.funcionario_id == Funcionario.id,
                Programming.period_id == current_period_id,
            ),
        ).filter(
            Funcionario.status == "activo",
            Funcionario.period_id == current_period_id,
        )
        if effective_user_id is not None:
            programmed_query = programmed_query.join(
                UserOfficial, UserOfficial.funcionario_id == Funcionario.id
            ).filter(UserOfficial.user_id == effective_user_id)

        programmed_officials = programmed_query.all()
        programmed_official_keys = {get_official_identity_key(funcionario) for funcionario in programmed_officials}
        programmed_count = len(programmed_official_keys)
        unprogrammed_count = len(active_official_keys - programmed_official_keys)

    latest_audit_subquery = db.query(
        OfficialAudit.funcionario_id,
        func.max(OfficialAudit.created_at).label("max_created_at"),
    ).filter(
        OfficialAudit.action == "Dismiss",
        OfficialAudit.period_id == current_period_id,
    ).group_by(
        OfficialAudit.funcionario_id
    ).subquery()

    inactive_query = db.query(
        OfficialAudit.reason,
        OfficialAudit.reason_category,
        func.count(OfficialAudit.funcionario_id),
    ).join(
        latest_audit_subquery,
        and_(
            OfficialAudit.funcionario_id == latest_audit_subquery.c.funcionario_id,
            OfficialAudit.created_at == latest_audit_subquery.c.max_created_at,
        ),
    ).join(
        Funcionario, Funcionario.id == OfficialAudit.funcionario_id
    ).filter(
        Funcionario.status == "inactivo",
        Funcionario.period_id == current_period_id,
        OfficialAudit.period_id == current_period_id,
    )

    if effective_user_id is not None:
        inactive_query = inactive_query.join(
            UserOfficial, UserOfficial.funcionario_id == Funcionario.id
        ).filter(UserOfficial.user_id == effective_user_id)

    inactive_counts_by_reason = inactive_query.group_by(OfficialAudit.reason, OfficialAudit.reason_category).all()

    inactive_renuncia = 0
    inactive_mobility = 0

    for reason, reason_category, count in inactive_counts_by_reason:
        resolved_category = resolve_reason_category(reason_category, reason)
        if resolved_category == REASON_CATEGORY_RESIGNATION:
            inactive_renuncia += count
        elif resolved_category == REASON_CATEGORY_MOBILITY:
            inactive_mobility += count

    total_inactive_query = db.query(Funcionario.id).filter(
        Funcionario.status == "inactivo",
        Funcionario.period_id == current_period_id,
    )
    if effective_user_id is not None:
        total_inactive_query = total_inactive_query.join(
            UserOfficial, UserOfficial.funcionario_id == Funcionario.id
        ).filter(UserOfficial.user_id == effective_user_id)

    real_total_inactive = total_inactive_query.count()

    chart_periods_subquery = db.query(ProgrammingPeriod.id).order_by(
        ProgrammingPeriod.start_date.desc()
    ).limit(normalized_history_limit).subquery()

    chart_query = db.query(
        ProgrammingPeriod.name,
        func.sum(
            case(
                (
                    or_(
                        or_(Funcionario.law_code.is_(None), not_(Funcionario.law_code.ilike("%15076%"))),
                        and_(
                            Funcionario.law_code.ilike("%15076%"),
                            Funcionario.observations.ilike("%liberado de guardia%"),
                        ),
                    ),
                    Funcionario.hours_per_week,
                ),
                else_=0,
            )
        ).label("contract_hours"),
        func.sum(
            case(
                (
                    and_(
                        Funcionario.law_code.ilike("%15076%"),
                        or_(
                            Funcionario.observations.is_(None),
                            not_(Funcionario.observations.ilike("%liberado de guardia%")),
                        ),
                    ),
                    Funcionario.hours_per_week,
                ),
                else_=0,
            )
        ).label("shift_hours"),
    ).join(
        ProgrammingPeriod, ProgrammingPeriod.id == Funcionario.period_id
    ).filter(
        Funcionario.status == "activo",
        Funcionario.period_id.in_(chart_periods_subquery.select()),
    )

    if assigned_ruts_all_periods is not None:
        chart_query = chart_query.filter(Funcionario.rut.in_(assigned_ruts_all_periods))

    chart_results = chart_query.group_by(
        ProgrammingPeriod.name,
        ProgrammingPeriod.start_date,
    ).order_by(
        ProgrammingPeriod.start_date
    ).all()

    hours_data = [
        {
            "period": period_name,
            "hours": float(contract_hours or 0),
            "shift_hours": float(shift_hours or 0),
        }
        for period_name, contract_hours, shift_hours in chart_results
    ]

    group_hours_data = []
    if current_period_id is not None:
        assigned_query = db.query(
            Group.name,
            Funcionario,
        ).join(
            UserOfficial, UserOfficial.group_id == Group.id
        ).join(
            Funcionario, Funcionario.id == UserOfficial.funcionario_id
        ).filter(
            Funcionario.period_id == current_period_id,
            Funcionario.status == "activo",
        )

        if effective_user_id is not None:
            assigned_query = assigned_query.filter(UserOfficial.user_id == effective_user_id)

        assigned_results = assigned_query.all()

        assigned_ids = set()
        group_map: dict[str, dict[str, object]] = {}
        rut_groups: dict[str, set[str]] = {}

        for group_name, funcionario in assigned_results:
            if group_name not in group_map:
                group_map[group_name] = {
                    "contract": 0.0,
                    "shift": 0.0,
                    "count": 0,
                    "shift_ruts": set(),
                }

            assigned_ids.add(funcionario.id)

            is_shift = is_shift_contract_record(funcionario.law_code, funcionario.observations)
            if is_shift:
                group_map[group_name]["shift"] += funcionario.hours_per_week
                group_map[group_name]["shift_ruts"].add(funcionario.rut)
            else:
                group_map[group_name]["contract"] += funcionario.hours_per_week

            group_map[group_name]["count"] += 1

            if funcionario.rut:
                rut_groups.setdefault(funcionario.rut, set()).add(group_name)

        all_ruts = list(rut_groups.keys())
        if all_ruts:
            extra_contracts = db.query(Funcionario).filter(
                Funcionario.period_id == current_period_id,
                Funcionario.status == "activo",
                Funcionario.rut.in_(all_ruts),
            ).all()

            for extra in extra_contracts:
                if extra.id in assigned_ids or not extra.rut:
                    continue

                is_shift = is_shift_contract_record(extra.law_code, extra.observations)
                for group_name in rut_groups.get(extra.rut, set()):
                    if is_shift:
                        group_map[group_name]["shift"] += extra.hours_per_week
                        group_map[group_name]["shift_ruts"].add(extra.rut)
                    else:
                        group_map[group_name]["contract"] += extra.hours_per_week

        group_hours_data = [
            {
                "name": group_name,
                "hours": data["contract"],
                "shift_hours": data["shift"],
                "count": data["count"],
                "shift_count": len(data["shift_ruts"]),
            }
            for group_name, data in group_map.items()
        ]

    shift_hours = 0.0
    shift_officials_count = 0
    if current_period_id is not None:
        shift_query = db.query(
            func.sum(Funcionario.hours_per_week).label("total_hours"),
            func.count(Funcionario.id).label("count"),
        ).filter(
            Funcionario.period_id == current_period_id,
            Funcionario.status == "activo",
            and_(
                Funcionario.law_code.ilike("%15076%"),
                or_(
                    Funcionario.observations.is_(None),
                    not_(Funcionario.observations.ilike("%liberado de guardia%")),
                ),
            ),
        )

        if assigned_ruts_current_period is not None:
            shift_query = shift_query.filter(Funcionario.rut.in_(assigned_ruts_current_period))

        shift_result = shift_query.first()
        if shift_result:
            shift_hours = float(shift_result[0] or 0)
            shift_officials_count = shift_result[1] or 0

    return {
        "summary": {
            "active_officials": total_active_officials,
            "programmed": programmed_count,
            "unprogrammed": unprogrammed_count,
            "period_name": target_period.name if target_period else "N/A",
            "inactive_total": real_total_inactive,
            "inactive_resignation": inactive_renuncia,
            "inactive_mobility": inactive_mobility,
            "shift_hours": shift_hours,
            "shift_officials_count": shift_officials_count,
        },
        "chart_data": hours_data,
        "group_chart_data": group_hours_data,
    }
