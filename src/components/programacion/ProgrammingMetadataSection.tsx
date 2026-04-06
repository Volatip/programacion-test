import { AlignLeft } from "lucide-react";
import type { Group } from "../../context/OfficialsContextDefs";
import { isPartialCommissionSelection, type DismissReason } from "../../lib/dismissReasons";

interface ProgrammingMetadataSectionProps {
  assignedGroupId: number | "none" | "";
  handleGroupChange: (newGroupId: number | "none" | "") => void;
  groups: Group[];
  formErrors: Record<string, boolean>;
  pendingStatus: string;
  currentOfficialStatus: string;
  handleStatusChange: (newValue: string) => void;
  dismissReasons: DismissReason[];
  selectedDismissReasonId: number | null;
  selectedDismissSuboptionId: number | null;
  handleDismissSuboptionChange: (suboptionId: number | null) => void;
  showClearPartialCommissionAction: boolean;
  dismissPartialHours: string;
  setDismissPartialHours: (value: string) => void;
  observations: string;
  setObservations: (value: string) => void;
  isReadOnly: boolean;
}

export function ProgrammingMetadataSection({
  assignedGroupId,
  handleGroupChange,
  groups,
  formErrors,
  pendingStatus,
  currentOfficialStatus,
  handleStatusChange,
  dismissReasons,
  selectedDismissReasonId,
  selectedDismissSuboptionId,
  handleDismissSuboptionChange,
  showClearPartialCommissionAction,
  dismissPartialHours,
  setDismissPartialHours,
  observations,
  setObservations,
  isReadOnly,
}: ProgrammingMetadataSectionProps) {
  const statusOptions = currentOfficialStatus === "activo"
    ? [{ label: "Activo", value: "Activo" }, ...dismissReasons.map((reason) => ({ label: reason.name, value: reason.name }))]
    : [{ label: "Inactivo", value: "Inactivo" }, { label: "Activo", value: "Activo" }];

  const selectedDismissReason = dismissReasons.find((reason) => reason.id === selectedDismissReasonId) ?? null;
  const requiresPartialHours = isPartialCommissionSelection(selectedDismissReason, selectedDismissSuboptionId);

  return (
    <div className="pt-4 border-t border-gray-50 dark:border-gray-700 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span>
                Asignar Grupo
                <span className="text-gray-500 italic opacity-60 ml-2 font-normal text-xs">(Opcional)</span>
              </span>
            </label>
            <select
              value={assignedGroupId === "none" ? "none" : assignedGroupId || ""}
              onChange={(e) => {
                const value = e.target.value;
                const nextValue = value === "none" ? "none" : value === "" ? "" : Number(value);
                handleGroupChange(nextValue);
              }}
              disabled={isReadOnly}
              className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white dark:border-gray-600 ${
                formErrors.assignedGroupId ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200"
              }`}
            >
              <option value="" disabled>
                Seleccionar Grupo
              </option>
              <option value="none">Ninguno</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <span>
                Asignar Estado
                <span className="text-red-500 text-xs ml-0.5">*</span>
              </span>
            </label>
            <select
              value={pendingStatus === "activo" ? "Activo" : pendingStatus === "inactivo" ? "Inactivo" : selectedDismissReason?.name ?? pendingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white"
            >
              <option value="" disabled>
                Seleccionar Estado
              </option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {currentOfficialStatus === "activo" && selectedDismissReason && selectedDismissReason.suboptions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span>
                  Subopción de baja
                  <span className="text-red-500 text-xs ml-0.5">*</span>
                </span>
              </label>
              <select
                value={selectedDismissSuboptionId ?? ""}
                onChange={(e) => handleDismissSuboptionChange(e.target.value ? Number(e.target.value) : null)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white"
              >
                <option value="" disabled>
                  Seleccionar subopción
                </option>
                {selectedDismissReason.suboptions.map((suboption) => (
                  <option key={suboption.id} value={suboption.id}>
                    {suboption.name}
                  </option>
                ))}
              </select>
              {showClearPartialCommissionAction && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("Activo")}
                  disabled={isReadOnly}
                  className="mt-2 inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-300"
                >
                  Sin comisión
                </button>
              )}
            </div>
          )}

          {currentOfficialStatus === "activo" && requiresPartialHours && (
            <div>
              <label htmlFor="programming-dismiss-partial-hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <span>
                  Horas de comisión parcial
                  <span className="text-red-500 text-xs ml-0.5">*</span>
                </span>
              </label>
              <input
                id="programming-dismiss-partial-hours"
                value={dismissPartialHours}
                onChange={(e) => setDismissPartialHours(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ingrese horas"
                disabled={isReadOnly}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Solo se permiten números enteros mayores a 0.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <AlignLeft className="w-4 h-4 text-gray-400" />
          <span>
            Observaciones
            <span className="text-gray-500 italic opacity-60 ml-2 font-normal text-xs">(Opcional)</span>
          </span>
        </label>
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          placeholder="Ingrese observaciones o comentarios adicionales..."
          rows={6}
          disabled={isReadOnly}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-500 dark:text-white dark:placeholder-gray-400"
        />
      </div>
    </div>
  );
}
