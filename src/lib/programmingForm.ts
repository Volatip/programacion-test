import type { ProgrammingItemData } from "../context/ProgrammingCacheContextDefs";

export interface ProgrammingActivityEntry {
  id: number;
  activity: string;
  specialty: string;
  assignedHours: string;
  performance: string;
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
    assignedHours: item.assigned_hours.toString(),
    performance: item.performance.toString(),
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
