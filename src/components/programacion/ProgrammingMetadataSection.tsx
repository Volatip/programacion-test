import { AlignLeft } from "lucide-react";
import type { Group } from "../../context/OfficialsContextDefs";

interface ProgrammingMetadataSectionProps {
  assignedGroupId: number | "none" | "";
  handleGroupChange: (newGroupId: number | "none" | "") => void;
  groups: Group[];
  formErrors: Record<string, boolean>;
  pendingStatus: string;
  currentOfficialStatus: string;
  handleStatusChange: (newValue: string) => void;
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
  observations,
  setObservations,
  isReadOnly,
}: ProgrammingMetadataSectionProps) {
  const statusOptions = currentOfficialStatus === "activo"
    ? ["Activo", "Renuncia", "Cambio de servicio", "Comisión de Servicio", "Permiso sin Goce", "Comisión de Estudio"]
    : ["Inactivo", "Activo"];

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
              value={pendingStatus === "activo" ? "Activo" : pendingStatus === "inactivo" ? "Inactivo" : pendingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white"
            >
              <option value="" disabled>
                Seleccionar Estado
              </option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
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
