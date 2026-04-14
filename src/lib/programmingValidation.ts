import type { ProgrammingActivityEntry } from "./programmingForm";

interface ValidateProgrammingFormParams {
  pendingStatus: string;
  isAvailableNegative: boolean;
  showSpecialty: boolean;
  globalSpecialty: string;
  hideActivitiesTable: boolean;
  showPerformanceUnit: boolean;
  selectedPerformanceUnit: string;
  prais: "Si" | "No" | "";
  activityEntries: ProgrammingActivityEntry[];
  selectedProcess: string;
  showCopyAndProcess: boolean;
  shouldShowPerformanceFields: (activityName: string) => boolean;
}

interface ValidateProgrammingFormResult {
  errors: Record<string, boolean>;
  missingFields: string[];
}

const EXEMPT_STATUSES = [
  "Renuncia",
  "Cambio de servicio",
  "Comisión de Servicio",
  "Permiso sin Goce",
  "Comisión de Estudio",
];

const normalizeDecimalValue = (value: string) => value.replace(",", ".");

export function validateProgrammingForm({
  pendingStatus,
  isAvailableNegative,
  showSpecialty,
  globalSpecialty,
  hideActivitiesTable,
  showPerformanceUnit,
  selectedPerformanceUnit,
  prais,
  activityEntries,
  selectedProcess,
  showCopyAndProcess,
  shouldShowPerformanceFields,
}: ValidateProgrammingFormParams): ValidateProgrammingFormResult {
  const errors: Record<string, boolean> = {};
  const missingFields: string[] = [];
  const isExempt = EXEMPT_STATUSES.includes(pendingStatus);

  if (isAvailableNegative) {
    missingFields.push("No se puede guardar la programación con horas disponibles negativas");
  }

  if (showSpecialty && !globalSpecialty && !hideActivitiesTable && !isExempt) {
    errors.globalSpecialty = true;
    missingFields.push("Especialidad Principal");
  }

  if (showPerformanceUnit && !selectedPerformanceUnit && !isExempt) {
    errors.selectedPerformanceUnit = true;
    missingFields.push("Unidad de Desempeño");
  }

  if (prais === "" && !isExempt) {
    errors.prais = true;
    missingFields.push("Atención PRAIS");
  }

  const entriesToValidate = activityEntries.filter(
    (entry) => entry.activity !== "" || (entry.assignedHours && parseFloat(normalizeDecimalValue(entry.assignedHours)) > 0),
  );

  if (!hideActivitiesTable && !isExempt) {
    let hasActivityError = false;

    entriesToValidate.forEach((entry) => {
      let entryError = false;

      if (!entry.activity.trim()) {
        errors[`activity_${entry.id}_activity`] = true;
        entryError = true;
      }

      if (showSpecialty && !entry.specialty) {
        errors[`activity_${entry.id}_specialty`] = true;
        entryError = true;
      }

      const hours = parseFloat(normalizeDecimalValue(entry.assignedHours));
      if (isNaN(hours) || hours <= 0) {
        errors[`activity_${entry.id}_assignedHours`] = true;
        entryError = true;
      }

      if (shouldShowPerformanceFields(entry.activity)) {
        const performance = parseFloat(normalizeDecimalValue(entry.performance));
        if (isNaN(performance) || entry.performance.trim() === "" || performance < 0) {
          errors[`activity_${entry.id}_performance`] = true;
          entryError = true;
        }
      }

      if (entryError) {
        hasActivityError = true;
      }
    });

    if (hasActivityError) {
      missingFields.push("Las filas con datos deben estar completas (Actividad, Especialidad, Horas, Rendimiento)");
    }
  }

  if (showCopyAndProcess && !selectedProcess && !isExempt) {
    errors.selectedProcess = true;
    missingFields.push("Proceso");
  }

  return {
    errors,
    missingFields,
  };
}
