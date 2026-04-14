import { describe, expect, it } from 'vitest';

import { validateProgrammingForm } from './programmingValidation';

describe('validateProgrammingForm', () => {
  it('skips mandatory-field validation for exempt statuses', () => {
    const result = validateProgrammingForm({
      pendingStatus: 'Renuncia',
      isAvailableNegative: false,
      showSpecialty: true,
      globalSpecialty: '',
      hideActivitiesTable: false,
      showPerformanceUnit: true,
      selectedPerformanceUnit: '',
      prais: '',
      activityEntries: [
        { id: 1, activity: '', specialty: '', assignedHours: '', performance: '' },
      ],
      selectedProcess: '',
      showCopyAndProcess: true,
      shouldShowPerformanceFields: () => true,
    });

    expect(result.errors).toEqual({});
    expect(result.missingFields).toEqual([]);
  });

  it('marks incomplete activity rows and required selectors for active programming', () => {
    const result = validateProgrammingForm({
      pendingStatus: '',
      isAvailableNegative: true,
      showSpecialty: true,
      globalSpecialty: '',
      hideActivitiesTable: false,
      showPerformanceUnit: true,
      selectedPerformanceUnit: '',
      prais: '',
      activityEntries: [
        { id: 1, activity: 'Consulta', specialty: '', assignedHours: '2', performance: '' },
      ],
      selectedProcess: '',
      showCopyAndProcess: true,
      shouldShowPerformanceFields: () => true,
    });

    expect(result.errors).toMatchObject({
      globalSpecialty: true,
      selectedPerformanceUnit: true,
      prais: true,
      selectedProcess: true,
      activity_1_specialty: true,
      activity_1_performance: true,
    });
    expect(result.missingFields).toContain('Especialidad Principal');
    expect(result.missingFields).toContain('Unidad de Desempeño');
    expect(result.missingFields).toContain('Atención PRAIS');
    expect(result.missingFields).toContain('Proceso');
    expect(result.missingFields).toContain('Las filas con datos deben estar completas (Actividad, Especialidad, Horas, Rendimiento)');
    expect(result.missingFields).toContain('No se puede guardar la programación con horas disponibles negativas');
  });

  it('permite rendimiento decimal con coma', () => {
    const result = validateProgrammingForm({
      pendingStatus: '',
      isAvailableNegative: false,
      showSpecialty: false,
      globalSpecialty: '',
      hideActivitiesTable: false,
      showPerformanceUnit: false,
      selectedPerformanceUnit: '',
      prais: 'Si',
      activityEntries: [
        { id: 1, activity: 'Consulta', specialty: '', assignedHours: '2', performance: '0,35' },
      ],
      selectedProcess: '',
      showCopyAndProcess: false,
      shouldShowPerformanceFields: () => true,
    });

    expect(result.errors.activity_1_performance).toBeUndefined();
  });

  it('permite rendimiento decimal con punto al validar', () => {
    const result = validateProgrammingForm({
      pendingStatus: '',
      isAvailableNegative: false,
      showSpecialty: false,
      globalSpecialty: '',
      hideActivitiesTable: false,
      showPerformanceUnit: false,
      selectedPerformanceUnit: '',
      prais: 'Si',
      activityEntries: [
        { id: 1, activity: 'Consulta', specialty: '', assignedHours: '2', performance: '0.35' },
      ],
      selectedProcess: '',
      showCopyAndProcess: false,
      shouldShowPerformanceFields: () => true,
    });

    expect(result.errors.activity_1_performance).toBeUndefined();
  });
});
