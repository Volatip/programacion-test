export const PROGRAMMING_EXEMPT_STATUSES = [
  "Renuncia",
  "Cambio de servicio",
  "ComisiÃ³n de Servicio",
  "Permiso sin Goce",
  "ComisiÃ³n de Estudio",
] as const;

export const PROGRAMMING_ACTIVE_STATUS_OPTIONS = [
  "Activo",
  ...PROGRAMMING_EXEMPT_STATUSES,
] as const;

export const PROGRAMMING_INACTIVE_STATUS_OPTIONS = [
  "Inactivo",
  "Activo",
] as const;

export function isProgrammingExemptStatus(status: string): boolean {
  return PROGRAMMING_EXEMPT_STATUSES.includes(status as (typeof PROGRAMMING_EXEMPT_STATUSES)[number]);
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
