export interface PeriodLike {
  status?: string | null;
  is_active?: boolean | null;
}

export function isActivePeriodForReview(period: PeriodLike | null | undefined): boolean {
  if (!period) {
    return false;
  }

  return period.status === "ACTIVO" || period.is_active === true;
}
