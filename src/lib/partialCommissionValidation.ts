import type { Funcionario } from "../context/OfficialsContextDefs";

export const PARTIAL_COMMISSION_BASE_MESSAGE = "Primero debe registrar la programación base del funcionario con Especialidad Principal y Unidad de Desempeño.";

export function validatePartialCommissionBaseForOfficial(
  funcionario: Pick<Funcionario, "programmingId"> | null | undefined,
): string | null {
  if (funcionario?.programmingId) {
    return null;
  }

  return PARTIAL_COMMISSION_BASE_MESSAGE;
}
