export const PROGRAMMING_INACTIVE_STATUS_OPTIONS = [
  "Inactivo",
  "Activo",
] as const;

export function isProgrammingExemptStatus(status: string): boolean {
  const normalized = status.trim();
  return normalized !== "" && normalized !== "Activo" && normalized !== "Inactivo";
}

export function deriveOfficialStatus(pendingStatus: string, currentOfficialStatus: string): string {
  if (pendingStatus === "Activo") {
    return "activo";
  }

  if (pendingStatus === "Inactivo" || isProgrammingExemptStatus(pendingStatus)) {
    return "inactivo";
  }

  return currentOfficialStatus;
}
