import { useCallback } from "react";
import type React from "react";
import type { ToastType } from "../components/ui/Toast";
import type { Funcionario } from "../context/OfficialsContext";
import { fetchWithAuth, parseErrorDetail } from "../lib/api";
import { normalizeText } from "../lib/normalizeText";
import {
  ensureMinimumProgrammingEntries,
  mapProgrammingItemsToEntries,
  type ProgrammingActivityEntry,
} from "../lib/programmingForm";
import type { ProgrammingData } from "../context/ProgrammingCacheContextDefs";

interface ProgrammingToastConfig {
  isOpen: boolean;
  message: React.ReactNode;
  type: ToastType;
}

interface UseProgrammingModalActionsParams {
  funcionario: Funcionario | null;
  selectedPeriodId?: number;
  selectedCopyFuncionario: Funcionario | null;
  isMedicalOfficial: boolean;
  programmingId: number | null;
  fetchProgramming: (funcionarioId: number, periodId: number) => Promise<ProgrammingData | null>;
  removeCachedProgramming: (funcionarioId: number) => void;
  updateOfficialLocally: (id: number, patch: Partial<Funcionario>) => void;
  onClose: () => void;
  setToastConfig: React.Dispatch<React.SetStateAction<ProgrammingToastConfig>>;
  setTimeUnit: React.Dispatch<React.SetStateAction<"hours" | "minutes">>;
  setGlobalSpecialty: React.Dispatch<React.SetStateAction<string>>;
  setSelectedProcess: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPerformanceUnit: React.Dispatch<React.SetStateAction<string>>;
  setAssignedGroupId: React.Dispatch<React.SetStateAction<number | "none" | "">>;
  setActivityEntries: React.Dispatch<React.SetStateAction<ProgrammingActivityEntry[]>>;
  setCopySourceId: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useProgrammingModalActions({
  funcionario,
  selectedPeriodId,
  selectedCopyFuncionario,
  isMedicalOfficial,
  programmingId,
  fetchProgramming,
  removeCachedProgramming,
  updateOfficialLocally,
  onClose,
  setToastConfig,
  setTimeUnit,
  setGlobalSpecialty,
  setSelectedProcess,
  setSelectedPerformanceUnit,
  setAssignedGroupId,
  setActivityEntries,
  setCopySourceId,
}: UseProgrammingModalActionsParams) {
  const handleCopyProgramming = useCallback(async () => {
    if (!funcionario || !selectedCopyFuncionario || !selectedPeriodId) {
      return;
    }

    if (normalizeText(selectedCopyFuncionario.title) !== normalizeText(funcionario.title)) {
      setToastConfig({
        isOpen: true,
        type: "error",
        message: `No se puede copiar: Los títulos no coinciden (${selectedCopyFuncionario.title} vs ${funcionario.title})`,
      });
      return;
    }

    if (!confirm(`¿Está seguro que desea copiar la programación de ${selectedCopyFuncionario.name}? Esto reemplazará los datos actuales en el formulario.`)) {
      return;
    }

    try {
      const sourceData = await fetchProgramming(selectedCopyFuncionario.id, selectedPeriodId);

      if (!sourceData) {
        setToastConfig({
          isOpen: true,
          type: "warning",
          message: "El funcionario seleccionado no tiene programación en este periodo.",
        });
        return;
      }

      if (sourceData.time_unit) {
        setTimeUnit(sourceData.time_unit as "hours" | "minutes");
      }
      if (sourceData.global_specialty && isMedicalOfficial) {
        setGlobalSpecialty(sourceData.global_specialty);
      }
      if (sourceData.selected_process && !isMedicalOfficial) {
        setSelectedProcess(sourceData.selected_process);
      }
      if (sourceData.selected_performance_unit) {
        setSelectedPerformanceUnit(sourceData.selected_performance_unit);
      }
      if (sourceData.assigned_group_id) {
        setAssignedGroupId(sourceData.assigned_group_id);
      }

      if (sourceData.items && sourceData.items.length > 0) {
        const defaultSpecialty = isMedicalOfficial ? sourceData.global_specialty || "" : "";
        const mappedItems = mapProgrammingItemsToEntries(sourceData.items, defaultSpecialty);
        setActivityEntries(ensureMinimumProgrammingEntries(mappedItems, 4, defaultSpecialty));
      }

      setCopySourceId(selectedCopyFuncionario.id);
      setToastConfig({
        isOpen: true,
        type: "info",
        message: "Programación copiada. Revise los datos y guarde para confirmar.",
      });
    } catch (error) {
      console.error("Error copying programming:", error);
      setToastConfig({
        isOpen: true,
        type: "error",
        message: "Error al copiar la programación.",
      });
    }
  }, [
    funcionario,
    selectedCopyFuncionario,
    selectedPeriodId,
    fetchProgramming,
    setToastConfig,
    setTimeUnit,
    isMedicalOfficial,
    setGlobalSpecialty,
    setSelectedProcess,
    setSelectedPerformanceUnit,
    setAssignedGroupId,
    setActivityEntries,
    setCopySourceId,
  ]);

  const handleDeleteProgramming = useCallback(async () => {
    if (!funcionario || !programmingId) {
      return;
    }

    if (!confirm("¿Está seguro que desea eliminar esta programación? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/programming/${programmingId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "Error al eliminar la programación"));
      }

      removeCachedProgramming(funcionario.id);
      updateOfficialLocally(funcionario.id, {
        isScheduled: false,
        programmingId: undefined,
        programmingUpdatedAt: undefined,
        totalScheduledHours: 0,
      });
      onClose();
    } catch (error) {
      console.error("Failed to delete:", error);
      setToastConfig({
        isOpen: true,
        type: "error",
        message: error instanceof Error ? error.message : "Error al eliminar la programación",
      });
    }
  }, [funcionario, programmingId, removeCachedProgramming, updateOfficialLocally, onClose, setToastConfig]);

  return {
    handleCopyProgramming,
    handleDeleteProgramming,
  };
}
