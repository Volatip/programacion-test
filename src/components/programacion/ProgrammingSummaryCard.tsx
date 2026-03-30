import type React from "react";
import type { Funcionario } from "../../context/OfficialsContext";

interface ProgrammingSummaryCardProps {
  funcionario: Funcionario;
  contractHoursDisplayText: React.ReactNode;
  formatLunchTime: (lunchTime: string | number | null | undefined) => string;
  lastUpdatedDate: string | null;
  prais: "Si" | "No" | "";
  setPrais: React.Dispatch<React.SetStateAction<"Si" | "No" | "">>;
  clearError: (field: string) => void;
  formErrors: Record<string, boolean>;
  isReadOnly: boolean;
  isExempt: boolean;
}

export function ProgrammingSummaryCard({
  funcionario,
  contractHoursDisplayText,
  formatLunchTime,
  lastUpdatedDate,
  prais,
  setPrais,
  clearError,
  formErrors,
  isReadOnly,
  isExempt,
}: ProgrammingSummaryCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <div className="flex flex-col items-center gap-3 min-w-[100px]">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold ${funcionario.color} shadow-sm`}>
            {funcionario.initial}
          </div>
          <div className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
            {funcionario.rut}
          </div>
          {funcionario.observations && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight max-w-[120px]">
              {funcionario.observations}
            </p>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Nombre Completo</label>
            <div className="text-sm font-semibold text-gray-900 dark:text-white break-words">{funcionario.name}</div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Ley</label>
            <div className="flex items-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                {funcionario.law}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Horas Contrato</label>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{contractHoursDisplayText}</div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">TÍTULO</label>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{funcionario.title}</div>
          </div>

          {funcionario.title === "Médico(a) Cirujano(a)" && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                Especialidad SIS
              </label>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{funcionario.sisSpecialty}</div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
              Colación
            </label>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{formatLunchTime(funcionario.lunchTime)}</div>
          </div>

          {funcionario.breastfeedingTime > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                Lactancia
              </label>
              <div className="text-sm font-medium text-gray-900 dark:text-white">{funcionario.breastfeedingTime} min</div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
              Última Actualización
            </label>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {lastUpdatedDate
                ? new Date(lastUpdatedDate).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "No registrada"}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
              Atención PRAIS
              {!isExempt && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            <div className="flex items-center">
              <select
                value={prais}
                onChange={(e) => {
                  setPrais(e.target.value as "Si" | "No" | "");
                  clearError("prais");
                }}
                disabled={isReadOnly}
                className={`w-1/2 px-2 py-1 bg-white dark:bg-gray-800 border rounded text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white dark:border-gray-600 ${
                  formErrors.prais ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200"
                }`}
              >
                <option value="" disabled>
                  Seleccionar
                </option>
                <option value="No">No</option>
                <option value="Si">Si</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
