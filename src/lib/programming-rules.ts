import { Funcionario } from "../context/OfficialsContextDefs";

/**
 * Determines if the programming section (activities table) should be hidden for a given official.
 * 
 * Rules:
 * 1. Official must have exactly one active contract.
 * 2. That unique contract must be under Law 15076.
 * 3. The observations of that contract must NOT contain "Liberado de Guardia".
 */
export function shouldHideProgrammingSection(funcionario: Funcionario | null): boolean {
  if (!funcionario) return false;

  const contracts = funcionario.contracts || [];

  // Condition 1: Unique active contract
  // If contracts array is empty, we check if root fields imply a contract.
  // However, given the requirement "únicamente un contrato activo", 
  // and assuming `contracts` array is the source of truth for multiplicity:
  if (contracts.length !== 1) {
    return false;
  }

  const contract = contracts[0];

  // Condition 2: Law 15076
  const lawCode = contract.law_code || "";
  if (!lawCode.includes("15076")) {
    return false;
  }

  // Condition 3: Observations NOT contain "Liberado de Guardia"
  const observations = (contract.observations || "").toLowerCase();
  if (observations.includes("liberado de guardia")) {
    return false;
  }

  return true;
}
