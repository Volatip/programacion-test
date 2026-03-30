import type { Funcionario } from "../context/OfficialsContext";
import { shouldHideProgrammingSection } from "./programming-rules";
import type { ProgrammingActivityEntry } from "./programmingForm";

const AVAILABLE_NEGATIVE_CLASS = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-200 dark:border-red-800";
const AVAILABLE_ZERO_CLASS = "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-200 dark:border-green-800";
const AVAILABLE_REMAINING_CLASS = "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800";

export interface ProgrammingAvailabilityState {
  availableHoursFormatted: number;
  isAvailableNegative: boolean;
  isAvailableZero: boolean;
  availableColorClass: string;
}

export interface ProgrammingVisualState {
  showPerformanceUnit: boolean;
  hideActivitiesTable: boolean;
  isExempt: boolean;
}

export function createDefaultProgrammingEntries(
  minimumRows: number,
  defaultSpecialty: string,
): ProgrammingActivityEntry[] {
  return Array.from({ length: minimumRows }, (_, index) => ({
    id: index + 1,
    activity: "",
    specialty: defaultSpecialty,
    assignedHours: "",
    performance: "",
  }));
}

export function formatProgrammingLunchTime(
  lunchStr: string | number | null | undefined,
  timeUnit: "hours" | "minutes",
): string {
  const minutes = parseInt(String(lunchStr ?? ""), 10);

  if (Number.isNaN(minutes)) {
    return String(lunchStr ?? "");
  }

  if (timeUnit === "hours") {
    const hrs = minutes / 60;
    return `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs.`;
  }

  return `${minutes} min`;
}

export function calculateProgrammingCupos(
  assignedHours: string,
  performance: string,
  timeUnit: "hours" | "minutes",
): { agenda: string | number; annual: string | number } {
  const hours = parseFloat(assignedHours.replace(',', '.')) || 0;
  const perf = parseFloat(performance.replace(',', '.')) || 0;
  const effectiveHours = timeUnit === "minutes" ? hours / 60 : hours;

  const agenda = effectiveHours * perf;
  const annual = agenda * 4 * 12;

  return {
    agenda: Number.isInteger(agenda) ? agenda : agenda.toFixed(1),
    annual: Number.isInteger(annual) ? annual : annual.toFixed(0),
  };
}

export function parseProgrammingContractHours(funcionario: Funcionario): number {
  if (funcionario.contracts && funcionario.contracts.length > 0) {
    return funcionario.contracts.reduce((acc, contract) => {
      const isLaw15076 = contract.law_code && contract.law_code.includes("15076");
      const observations = (contract.observations || "").toLowerCase();
      const isLiberadoGuardia = observations.includes("liberado de guardia");

      if (isLaw15076 && !isLiberadoGuardia) {
        return acc;
      }

      return acc + contract.hours;
    }, 0);
  }

  if (typeof funcionario.hours === "number") {
    return funcionario.hours;
  }

  return funcionario.hours.split(" y ").reduce((total, part) => {
    const value = parseFloat(part.replace(" hrs", "").trim());
    return Number.isNaN(value) ? total : total + value;
  }, 0);
}

export function getProgrammingContractHoursString(funcionario: Funcionario): string {
  if (funcionario.contracts && funcionario.contracts.length > 0) {
    const hasExcludedContracts = funcionario.contracts.some((contract) => {
      const isLaw15076 = contract.law_code && contract.law_code.includes("15076");
      const observations = (contract.observations || "").toLowerCase();
      const isLiberadoGuardia = observations.includes("liberado de guardia");

      return isLaw15076 && !isLiberadoGuardia;
    });

    if (hasExcludedContracts || funcionario.contracts.length > 1) {
      const contractStrings = funcionario.contracts.map((contract) => `${contract.hours} hrs`);

      if (contractStrings.length === 1) {
        return contractStrings[0];
      }

      const lastContract = contractStrings.pop();
      return `${contractStrings.join(", ")} y ${lastContract}`;
    }
  }

  return `${parseProgrammingContractHours(funcionario)} hrs.`;
}

export function getProgrammingAvailabilityState({
  totalContractHours,
  totalScheduledHours,
  lunchMinutes,
}: {
  totalContractHours: number;
  totalScheduledHours: number;
  lunchMinutes: number;
}): ProgrammingAvailabilityState {
  const lunchHours = Number.isNaN(lunchMinutes) ? 0 : lunchMinutes / 60;
  const availableHours = totalContractHours - totalScheduledHours - lunchHours;
  const availableHoursFormatted = Math.round(availableHours * 100) / 100;
  const isAvailableNegative = availableHoursFormatted < 0;
  const isAvailableZero = Math.abs(availableHoursFormatted) < 0.01;

  return {
    availableHoursFormatted,
    isAvailableNegative,
    isAvailableZero,
    availableColorClass: isAvailableNegative
      ? AVAILABLE_NEGATIVE_CLASS
      : isAvailableZero
        ? AVAILABLE_ZERO_CLASS
        : AVAILABLE_REMAINING_CLASS,
  };
}

export function getProgrammingVisualState(
  funcionario: Funcionario,
  pendingStatus: string,
): ProgrammingVisualState {
  const isLey15076 = funcionario.law?.includes("15076") || false;
  const isLiberadoGuardia = funcionario.observations?.toLowerCase().includes("liberado de guardia") || false;

  return {
    showPerformanceUnit: isLey15076 && !isLiberadoGuardia,
    hideActivitiesTable: shouldHideProgrammingSection(funcionario),
    isExempt: ["Renuncia", "Cambio de servicio"].includes(pendingStatus),
  };
}
