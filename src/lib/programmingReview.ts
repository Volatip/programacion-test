import { compareDateValues, compareTextValues } from "./tableSorting";

export type ProgrammingReviewStatus = "pending" | "validated" | "fix_required" | null | undefined;

export interface ProgrammingReviewSnapshot {
  review_status?: ProgrammingReviewStatus;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
}

export function formatReviewStatus(status?: ProgrammingReviewStatus) {
  if (!status) return "Sin revisión";
  if (status === "pending") return "Pendiente";
  return status === "validated" ? "Validado" : "Arreglar";
}

export function getReviewBadgeClass(status?: ProgrammingReviewStatus) {
  if (status === "validated") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }

  if (status === "fix_required") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  }

  if (status === "pending") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }

  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

export function formatReviewDate(reviewedAt?: string | null) {
  if (!reviewedAt) return null;

  const date = new Date(reviewedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString("es-CL");
}

export function formatReviewMeta(reviewedByName?: string | null, reviewedAt?: string | null) {
  if (!reviewedByName || !reviewedAt) return "Pendiente";
  return `${reviewedByName} · ${formatReviewDate(reviewedAt) ?? reviewedByName}`;
}

export function getReviewFilterValue(status?: ProgrammingReviewStatus) {
  if (!status) return "sin_revision";
  return status;
}

function getReviewSortRank(status?: ProgrammingReviewStatus) {
  if (!status) return 0;
  if (status === "pending") return 1;
  if (status === "fix_required") return 2;
  return 3;
}

export function compareReviewValues(left: ProgrammingReviewSnapshot, right: ProgrammingReviewSnapshot) {
  const rankDiff = getReviewSortRank(left.review_status) - getReviewSortRank(right.review_status);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const labelDiff = compareTextValues(formatReviewStatus(left.review_status), formatReviewStatus(right.review_status));
  if (labelDiff !== 0) {
    return labelDiff;
  }

  const reviewedAtDiff = compareDateValues(left.reviewed_at, right.reviewed_at);
  if (reviewedAtDiff !== 0) {
    return reviewedAtDiff;
  }

  return compareTextValues(left.reviewed_by_name, right.reviewed_by_name);
}
