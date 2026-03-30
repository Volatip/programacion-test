import { useCallback } from "react";
import type React from "react";
import type { Funcionario } from "../context/OfficialsContext";
import type { ActivityConfig } from "./useProgrammingConfig";
import type { ProgrammingActivityEntry } from "../lib/programmingForm";
import type { ProgrammingData } from "../context/ProgrammingCacheContextDefs";
import { fetchWithAuth } from "../lib/api";
import { buildProgrammingPayload, ProgrammingSaveError, readProgrammingSaveError } from "../lib/programmingPersistence";
import type { ToastType } from "../components/ui/Toast";

interface ProgrammingToastConfig {
  isOpen: boolean;
  message: React.ReactNode;
  type: ToastType;
  duration?: number;
}

interface UseProgrammingSaveParams {
  funcionario: Funcionario | null;
  selectedPeriodId?: number;
  programmingId: number | null;
  programmingVersion: number | null;
  observations: string;
  assignedGroupId: number | "none" | "";
  pendingStatus: string;
  currentOfficialStatus: string;
  prais: "Si" | "No" | "";
  globalSpecialty: string;
  selectedProcess: string;
  selectedPerformanceUnit: string;
  timeUnit: "hours" | "minutes";
  activityEntries: ProgrammingActivityEntry[];
  activitiesList: ActivityConfig[];
  totalScheduledHours: number;
  copySourceId: number | null;
  isSubmitting: boolean;
  onNext?: () => void;
  onClose: () => void;
  validateForm: () => string[];
  activateOfficial: (id: number) => Promise<void>;
  removeOfficial: (id: number, reason?: string) => Promise<void>;
  assignToGroup: (officialId: number, groupId: number) => Promise<void>;
  refreshOfficials: () => Promise<void>;
  reloadLatestProgramming: () => Promise<void>;
  updateCache: (funcionarioId: number, data: ProgrammingData) => void;
  updateOfficialLocally: (id: number, patch: Partial<Funcionario>) => void;
  setCopySourceId: React.Dispatch<React.SetStateAction<number | null>>;
  setProgrammingId: React.Dispatch<React.SetStateAction<number | null>>;
  setProgrammingVersion: React.Dispatch<React.SetStateAction<number | null>>;
  setLastUpdatedDate: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setToastConfig: React.Dispatch<React.SetStateAction<ProgrammingToastConfig>>;
}

const INACTIVE_REASONS = [
  "Renuncia",
  "Cambio de servicio",
  "Comisión de Servicio",
  "Permiso sin Goce",
  "Comisión de Estudio",
];

export function useProgrammingSave({
  funcionario,
  selectedPeriodId,
  programmingId,
  programmingVersion,
  observations,
  assignedGroupId,
  pendingStatus,
  currentOfficialStatus,
  prais,
  globalSpecialty,
  selectedProcess,
  selectedPerformanceUnit,
  timeUnit,
  activityEntries,
  activitiesList,
  totalScheduledHours,
  copySourceId,
  isSubmitting,
  onNext,
  onClose,
  validateForm,
  activateOfficial,
  removeOfficial,
  assignToGroup,
  refreshOfficials,
  reloadLatestProgramming,
  updateCache,
  updateOfficialLocally,
  setCopySourceId,
  setProgrammingId,
  setProgrammingVersion,
  setLastUpdatedDate,
  setIsSaved,
  setIsSubmitting,
  setToastConfig,
}: UseProgrammingSaveParams) {
  const handleSave = useCallback(async (event: Pick<React.SyntheticEvent, "preventDefault">, andNext = false) => {
    event.preventDefault();

    if (!funcionario || isSubmitting) {
      return;
    }

    const missingFields = validateForm();

    if (missingFields.length > 0) {
      setToastConfig({
        isOpen: true,
        type: "error",
        message: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Para guardar la Programación de Funcionario, debe completar los siguientes campos obligatorios:</span>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-xs">
              {missingFields.map((field, index) => (
                <li key={index}>{field}</li>
              ))}
            </ul>
          </div>
        ),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const statusChanged = pendingStatus !== currentOfficialStatus;
      const nextGroupId = assignedGroupId === "none" || assignedGroupId === "" ? 0 : Number(assignedGroupId);
      const nextOfficialStatus =
        pendingStatus === "Activo"
          ? "activo"
          : pendingStatus === "Inactivo" || INACTIVE_REASONS.includes(pendingStatus)
            ? "inactivo"
            : currentOfficialStatus;

      if (statusChanged) {
        if (pendingStatus === "Activo" && currentOfficialStatus === "inactivo") {
          await activateOfficial(funcionario.id);
        } else if (INACTIVE_REASONS.includes(pendingStatus)) {
          await removeOfficial(funcionario.id, pendingStatus);
        }
      }

      const payload = buildProgrammingPayload({
        funcionarioId: funcionario.id,
        periodId: selectedPeriodId,
        version: programmingVersion ?? 1,
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
      });

      const url = programmingId ? `/programming/${programmingId}` : "/programming";
      const method = programmingId ? "PUT" : "POST";

      const response = await fetchWithAuth(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await readProgrammingSaveError(response);
      }

      const savedData: ProgrammingData = await response.json();
      setProgrammingId(savedData.id);
      setProgrammingVersion(savedData.version);
      setLastUpdatedDate(savedData.updated_at);

      if (assignedGroupId !== "" && assignedGroupId !== "none") {
        const groupIdToSave = Number(assignedGroupId);
        if (funcionario.groupId !== groupIdToSave) {
          await assignToGroup(funcionario.id, groupIdToSave);
        }
      } else if (assignedGroupId === "none" && funcionario.groupId !== 0) {
        await assignToGroup(funcionario.id, 0);
      }

      updateCache(funcionario.id, savedData);
      updateOfficialLocally(funcionario.id, {
        groupId: nextGroupId,
        status: nextOfficialStatus,
        isScheduled: true,
        programmingId: savedData.id,
        programmingUpdatedAt: savedData.updated_at,
        totalScheduledHours,
      });

      if (copySourceId) {
        try {
          await fetchWithAuth("/programming/audit-copy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_official_id: funcionario.id,
              source_official_id: copySourceId,
            }),
          });
          setCopySourceId(null);
        } catch (auditError) {
          console.error("Failed to log copy audit:", auditError);
        }
      }

      if (statusChanged && pendingStatus === "Inactivo") {
        await refreshOfficials();
      }

      setIsSaved(true);
      setToastConfig({
        isOpen: true,
        type: "success",
        message: "Programación y estado guardados exitosamente",
      });

      setTimeout(() => {
        setIsSaved(false);
        setIsSubmitting(false);
        if (andNext && onNext) {
          onNext();
        } else if (!andNext) {
          onClose();
        }
      }, 1000);
    } catch (error) {
      setIsSubmitting(false);
      console.error("Failed to save:", error);

      if (error instanceof ProgrammingSaveError && error.isVersionConflict) {
        setToastConfig({
          isOpen: true,
          type: "warning",
          duration: 0,
          message: (
            <div className="flex flex-col gap-2">
              <span className="font-semibold">Conflicto de versión detectado</span>
              <div className="text-xs">
                Otra sesión o usuario modificó esta programación antes de que guardaras tus cambios. Recargá la versión más reciente antes de volver a guardar.
              </div>
              <div>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700"
                  onClick={() => {
                    setToastConfig((prev) => ({ ...prev, isOpen: false }));
                    void reloadLatestProgramming();
                  }}
                >
                  Recargar programación
                </button>
              </div>
            </div>
          ),
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Error desconocido";
      setToastConfig({
        isOpen: true,
        type: "error",
        message: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Error al guardar:</span>
            <div className="whitespace-pre-wrap text-xs">{message}</div>
          </div>
        ),
      });
    }
  }, [
    funcionario,
    isSubmitting,
    validateForm,
    setToastConfig,
    setIsSubmitting,
    pendingStatus,
    currentOfficialStatus,
    assignedGroupId,
    activateOfficial,
    removeOfficial,
    selectedPeriodId,
    observations,
    prais,
    globalSpecialty,
    selectedProcess,
    selectedPerformanceUnit,
    timeUnit,
    activityEntries,
    activitiesList,
    programmingId,
    programmingVersion,
    setProgrammingId,
    setProgrammingVersion,
    setLastUpdatedDate,
    assignToGroup,
    updateCache,
    updateOfficialLocally,
    totalScheduledHours,
    copySourceId,
    setCopySourceId,
    refreshOfficials,
    reloadLatestProgramming,
    setIsSaved,
    onNext,
    onClose,
  ]);

  return { handleSave };
}
