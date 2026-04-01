import { describe, expect, it } from "vitest";

import type { Funcionario, Group } from "../context/OfficialsContextDefs";
import { AUTO_INACTIVES_GROUP_ID, buildProgrammingGroups, getOfficialsForProgrammingGroup } from "./programmingGroups";

function createFuncionario(overrides: Partial<Funcionario> = {}): Funcionario {
  return {
    id: 1,
    name: "Funcionario Test",
    title: "Enfermero",
    rut: "11.111.111-1",
    law: "Ley 18834",
    hours: "44 hrs",
    initial: "F",
    color: "bg-blue-500",
    isScheduled: false,
    groupId: 1,
    sisSpecialty: "Sin Especialidad",
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

describe("programmingGroups", () => {
  it("counts only active officials in editable groups and appends the automatic inactive group", () => {
    const groups: Group[] = [{ id: 1, name: "Grupo A", count: 99 }];
    const officials = [
      createFuncionario({ id: 1, name: "Activa", status: "activo", groupId: 1 }),
      createFuncionario({ id: 2, name: "Inactiva", status: "inactivo", groupId: 1, inactiveReason: "Renuncia" }),
    ];

    expect(buildProgrammingGroups(groups, officials)).toEqual([
      { id: 1, name: "Grupo A", count: 1 },
      { id: AUTO_INACTIVES_GROUP_ID, name: "Inactivos", count: 1, isAutomatic: true },
    ]);
  });

  it("returns only active officials for normal groups and only inactive officials for the automatic group", () => {
    const officials = [
      createFuncionario({ id: 1, name: "Zulu", status: "activo", groupId: 1 }),
      createFuncionario({ id: 2, name: "Alpha", status: "inactivo", groupId: 1, inactiveReason: "Cambio de servicio" }),
      createFuncionario({ id: 3, name: "Beta", status: "activo", groupId: 2 }),
    ];

    expect(getOfficialsForProgrammingGroup(officials, 1).map((official) => official.name)).toEqual(["Zulu"]);
    expect(getOfficialsForProgrammingGroup(officials, AUTO_INACTIVES_GROUP_ID).map((official) => official.name)).toEqual(["Alpha"]);
  });
});
