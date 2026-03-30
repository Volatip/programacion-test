import { describe, expect, it } from "vitest";

import type { Funcionario } from "../context/OfficialsContext";
import {
  calculateProgrammingCupos,
  createDefaultProgrammingEntries,
  formatProgrammingLunchTime,
  getProgrammingAvailabilityState,
  getProgrammingContractHoursString,
  getProgrammingVisualState,
  parseProgrammingContractHours,
} from "./programmingModalUtils";

function createFuncionario(overrides: Partial<Funcionario> = {}): Funcionario {
  return {
    id: 1,
    name: "Funcionario Test",
    title: "Médico(a) Cirujano(a)",
    rut: "11.111.111-1",
    law: "Ley 18834",
    hours: "22 hrs y 11 hrs",
    initial: "FT",
    color: "bg-blue-500",
    isScheduled: false,
    groupId: 0,
    sisSpecialty: "Cardiología",
    lunchTime: "60",
    status: "activo",
    holidayDays: 0,
    administrativeDays: 0,
    congressDays: 0,
    breastfeedingTime: 0,
    lastUpdated: "",
    observations: "",
    ...overrides,
  };
}

describe("programmingModalUtils", () => {
  it("creates the requested amount of empty default entries", () => {
    expect(createDefaultProgrammingEntries(2, "Cardiología")).toEqual([
      {
        id: 1,
        activity: "",
        specialty: "Cardiología",
        assignedHours: "",
        performance: "",
      },
      {
        id: 2,
        activity: "",
        specialty: "Cardiología",
        assignedHours: "",
        performance: "",
      },
    ]);
  });

  it("formats lunch time according to the selected unit", () => {
    expect(formatProgrammingLunchTime("90", "hours")).toBe("1.5 hrs.");
    expect(formatProgrammingLunchTime("90", "minutes")).toBe("90 min");
  });

  it("calculates agenda and annual slots with minute inputs", () => {
    expect(calculateProgrammingCupos("90", "4", "minutes")).toEqual({
      agenda: 6,
      annual: 288,
    });
  });

  it("parses contract hours excluding ley 15076 without guard release", () => {
    const funcionario = createFuncionario({
      contracts: [
        { id: 1, law_code: "15076", hours: 28, observations: "" },
        { id: 2, law_code: "18834", hours: 22, observations: "" },
      ],
    });

    expect(parseProgrammingContractHours(funcionario)).toBe(22);
  });

  it("returns the detailed contract string when multiple contracts exist", () => {
    const funcionario = createFuncionario({
      contracts: [
        { id: 1, law_code: "18834", hours: 22, observations: "" },
        { id: 2, law_code: "15076", hours: 11, observations: "liberado de guardia" },
      ],
    });

    expect(getProgrammingContractHoursString(funcionario)).toBe("22 hrs y 11 hrs");
  });

  it("derives rounded availability and warning style for remaining hours", () => {
    expect(
      getProgrammingAvailabilityState({
        totalContractHours: 44,
        totalScheduledHours: 40.255,
        lunchMinutes: 60,
      }),
    ).toEqual({
      availableHoursFormatted: 2.74,
      isAvailableNegative: false,
      isAvailableZero: false,
      availableColorClass:
        "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800",
    });
  });

  it("derives modal visual flags from official and pending status", () => {
    const funcionario = createFuncionario({
      law: "Ley 15076",
      observations: "Liberado de guardia",
      contracts: [{ id: 1, law_code: "15076", hours: 28, observations: "" }],
    });

    expect(getProgrammingVisualState(funcionario, "Renuncia")).toEqual({
      showPerformanceUnit: false,
      hideActivitiesTable: true,
      isExempt: true,
    });
  });
});
