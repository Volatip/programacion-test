import type { Funcionario, Group } from "../context/OfficialsContextDefs";

export const AUTO_INACTIVES_GROUP_ID = -1;
export const AUTO_INACTIVES_GROUP_NAME = "Inactivos";

export function isAutomaticProgrammingGroup(groupId: number): boolean {
  return groupId === AUTO_INACTIVES_GROUP_ID;
}

export function buildProgrammingGroups(groups: Group[], officials: Funcionario[]): Group[] {
  const activeCountsByGroupId = officials.reduce<Record<number, number>>((acc, official) => {
    if (official.groupId > 0 && official.status === "activo") {
      acc[official.groupId] = (acc[official.groupId] || 0) + 1;
    }
    return acc;
  }, {});

  const baseGroups = groups.map((group) => ({
    ...group,
    count: activeCountsByGroupId[group.id] || 0,
  }));

  const inactiveOfficials = officials.filter((official) => official.status === "inactivo");
  if (inactiveOfficials.length === 0) {
    return baseGroups;
  }

  return [
    ...baseGroups,
    {
      id: AUTO_INACTIVES_GROUP_ID,
      name: AUTO_INACTIVES_GROUP_NAME,
      count: inactiveOfficials.length,
      isAutomatic: true,
    },
  ];
}

export function getOfficialsForProgrammingGroup(officials: Funcionario[], groupId: number): Funcionario[] {
  if (isAutomaticProgrammingGroup(groupId)) {
    return officials
      .filter((official) => official.status === "inactivo")
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return officials
    .filter((official) => official.groupId === groupId && official.status === "activo")
    .sort((a, b) => a.name.localeCompare(b.name));
}
