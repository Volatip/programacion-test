import type { ProgrammingItemData } from "../context/ProgrammingCacheContextDefs";

export interface ProgrammingActivityEntry {
  id: number;
  activity: string;
  specialty: string;
  assignedHours: string;
  performance: string;
}

function formatDecimalForInput(value: number): string {
  return value.toString().replace(".", ",");
}

export function mapProgrammingItemsToEntries(
  items: ProgrammingItemData[],
  defaultSpecialty: string,
): ProgrammingActivityEntry[] {
  const sortedItems = [...items].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  return sortedItems.map((item, idx) => ({
    id: idx + 1,
    activity: item.activity_name,
    specialty: item.specialty || defaultSpecialty,
    assignedHours: formatDecimalForInput(item.assigned_hours),
    performance: formatDecimalForInput(item.performance),
  }));
}

export function ensureMinimumProgrammingEntries(
  entries: ProgrammingActivityEntry[],
  minimumRows: number,
  defaultSpecialty: string,
): ProgrammingActivityEntry[] {
  const nextEntries = [...entries];

  while (nextEntries.length < minimumRows) {
    nextEntries.push({
      id: nextEntries.length + 1,
      activity: "",
      specialty: defaultSpecialty,
      assignedHours: "",
      performance: "",
    });
  }

  return nextEntries;
}
