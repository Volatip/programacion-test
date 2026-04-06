import type { Funcionario } from "../context/OfficialsContextDefs";

export const PARTIAL_COMMISSION_BASE_MESSAGE = "Primero debe registrar una programación base válida del funcionario antes de asignar Comisión de Servicio Parcial.";

export function validatePartialCommissionBaseForOfficial(
  funcionario: Pick<Funcionario, "programmingId"> | null | undefined,
): string | null {
  if (funcionario?.programmingId) {
    return null;
  }

  return PARTIAL_COMMISSION_BASE_MESSAGE;
}
