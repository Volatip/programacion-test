import type { ActivityConfig } from "../hooks/useProgrammingConfig";
import type { ProgrammingActivityEntry } from "./programmingForm";

export interface ApiErrorDetail {
  msg?: string;
  loc?: Array<string | number>;
}

export class ProgrammingSaveError extends Error {
  status: number;
  isVersionConflict: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProgrammingSaveError";
    this.status = status;
    this.isVersionConflict = status === 409;
  }
}

interface BuildProgrammingPayloadParams {
  funcionarioId: number;
  periodId?: number;
  version?: number;
  observations: string;
  assignedGroupId: number | "none" | "";
  pendingStatus: string;
  prais: "Si" | "No" | "";
  globalSpecialty: string;
  selectedProcess: string;
  selectedPerformanceUnit: string;
  timeUnit: "hours" | "minutes";
  activityEntries: ProgrammingActivityEntry[];
  activitiesList: ActivityConfig[];
}

export function buildProgrammingPayload({
  funcionarioId,
  periodId,
  version,
  observations,
  assignedGroupId,
  pendingStatus,
  prais,
  globalSpecialty,
  selectedProcess,
  selectedPerformanceUnit,
  timeUnit,
  activityEntries,
  activitiesList,
}: BuildProgrammingPayloadParams) {
  const validEntries = activityEntries.filter((entry) => entry.assignedHours && parseFloat(entry.assignedHours) > 0);

  return {
    programming: {
      funcionario_id: funcionarioId,
      period_id: periodId,
      version: version ?? 1,
      status: "borrador",
      observation: observations,
      assigned_group_id: assignedGroupId === "none" || assignedGroupId === "" ? null : Number(assignedGroupId),
      assigned_status: pendingStatus,
      prais: prais === "Si",
      global_specialty: globalSpecialty,
      selected_process: selectedProcess,
      selected_performance_unit: selectedPerformanceUnit,
      time_unit: timeUnit,
      items: validEntries.map((entry) => {
        const activity = activitiesList.find((item) => item.name === entry.activity);
        return {
          activity_name: entry.activity,
          activity_type_id: activity ? activity.id : null,
          specialty: entry.specialty,
          assigned_hours: parseFloat(entry.assignedHours.replace(",", ".")),
          performance: parseFloat(entry.performance.replace(",", ".")) || 0,
        };
      }),
    },
  };
}

export function getProgrammingSaveErrorMessage(errorData: unknown): string {
  if (!errorData || typeof errorData !== "object" || !("detail" in errorData)) {
    return "Error al guardar la programación";
  }

  const detail = (errorData as { detail?: unknown }).detail;
  if (!detail) {
    return "Error al guardar la programación";
  }

  if (Array.isArray(detail)) {
    return detail
      .map((error: string | ApiErrorDetail) => {
        if (typeof error === "string") {
          return error;
        }

        if (error.msg) {
          const field = error.loc && Array.isArray(error.loc) ? error.loc[error.loc.length - 1] : "";
          return field ? `${field}: ${error.msg}` : error.msg;
        }

        return JSON.stringify(error);
      })
      .join("\n");
  }

  if (typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return String(detail);
}

export async function readProgrammingSaveError(response: Response): Promise<ProgrammingSaveError> {
  let errorData: unknown = null;

  try {
    errorData = await response.json();
  } catch {
    try {
      errorData = await response.text();
    } catch {
      errorData = null;
    }
  }

  if (response.status === 409) {
    return new ProgrammingSaveError(
      "La programación cambió mientras la estabas editando. Otra sesión o usuario guardó una versión más reciente.",
      response.status
    );
  }

  return new ProgrammingSaveError(getProgrammingSaveErrorMessage(errorData), response.status);
}
