import { describe, expect, it } from 'vitest';

import { ensureMinimumProgrammingEntries, mapProgrammingItemsToEntries } from './programmingForm';

describe('programmingForm helpers', () => {
  it('maps items sorted by id and preserves the default specialty fallback', () => {
    const entries = mapProgrammingItemsToEntries(
      [
        { id: 9, activity_name: 'Visita', specialty: '', assigned_hours: 2, performance: 4 },
        { id: 3, activity_name: 'Policlínico', specialty: 'Cardiología', assigned_hours: 5.5, performance: 0.35 },
      ],
      'General',
    );

    expect(entries).toEqual([
      {
        id: 1,
        activity: 'Policlínico',
        specialty: 'Cardiología',
        assignedHours: '5,5',
        performance: '0,35',
      },
      {
        id: 2,
        activity: 'Visita',
        specialty: 'General',
        assignedHours: '2',
        performance: '4',
      },
    ]);
  });

  it('pads entries up to the requested minimum rows', () => {
    const entries = ensureMinimumProgrammingEntries(
      [
        {
          id: 1,
          activity: 'Policlínico',
          specialty: 'Cardiología',
          assignedHours: '5',
          performance: '10',
        },
      ],
      3,
      'General',
    );

    expect(entries).toHaveLength(3);
    expect(entries[1]).toMatchObject({
      id: 2,
      activity: '',
      specialty: 'General',
      assignedHours: '',
      performance: '',
    });
    expect(entries[2]).toMatchObject({ id: 3, specialty: 'General' });
  });
});
