import { BarChart, Briefcase, Info, Stethoscope } from "lucide-react";
import type { ProgrammingConfigData } from "../../hooks/useProgrammingConfig";
import { SearchableSelect } from "../ui/SearchableSelect";

interface ProgrammingConfigPanelsProps {
  showPerformanceUnit: boolean;
  selectedPerformanceUnit: string;
  setSelectedPerformanceUnit: (value: string) => void;
  performanceUnits: string[];
  showSpecialty: boolean;
  specialties: string[];
  globalSpecialty: string;
  onGlobalSpecialtyChange: (value: string) => void;
  specialtyStats: ProgrammingConfigData["specialtyStats"];
  showCopyAndProcess: boolean;
  processList: string[];
  selectedProcess: string;
  onProcessChange: (value: string) => void;
  isReadOnly: boolean;
  isExempt: boolean;
  formErrors: Record<string, boolean>;
  clearError: (field: string) => void;
}

export function ProgrammingConfigPanels({
  showPerformanceUnit,
  selectedPerformanceUnit,
  setSelectedPerformanceUnit,
  performanceUnits,
  showSpecialty,
  specialties,
  globalSpecialty,
  onGlobalSpecialtyChange,
  specialtyStats,
  showCopyAndProcess,
  processList,
  selectedProcess,
  onProcessChange,
  isReadOnly,
  isExempt,
  formErrors,
  clearError,
}: ProgrammingConfigPanelsProps) {
  return (
    <>
      {showPerformanceUnit && (
        <div className="mb-6 bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg border border-teal-100 dark:border-teal-800">
          <label className="block text-sm font-medium text-teal-900 dark:text-teal-200 mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span>
              Unidad de Desempeño
              {!isExempt && <span className="text-red-500 ml-1">*</span>}
              {isExempt && <span className="text-gray-500 italic opacity-60 ml-2 font-normal text-xs">(Opcional)</span>}
            </span>
          </label>
          <select
            value={selectedPerformanceUnit}
            onChange={(e) => {
              setSelectedPerformanceUnit(e.target.value);
              clearError("selectedPerformanceUnit");
            }}
            disabled={isReadOnly}
            className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500 dark:text-white dark:border-gray-600 ${
              formErrors.selectedPerformanceUnit ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200"
            }`}
          >
            <option value="" disabled>
              Seleccionar Unidad de Desempeño 28 hrs
            </option>
            {performanceUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>
      )}

      {showSpecialty && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />
                <span>
                  Especialidad Principal
                  {!isExempt && <span className="text-red-500 ml-1">*</span>}
                  {isExempt && <span className="text-gray-500 italic opacity-60 ml-2 font-normal text-xs">(Opcional)</span>}
                </span>
              </label>
              <SearchableSelect
                options={specialties}
                value={globalSpecialty}
                onChange={(val) => onGlobalSpecialtyChange(val as string)}
                getLabel={(item) => item}
                getValue={(item) => item}
                placeholder="Seleccionar Especialidad"
                searchPlaceholder="Buscar especialidad..."
                disabled={isReadOnly}
                error={!!formErrors.globalSpecialty}
              />
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                * Al cambiar la especialidad principal, se actualizarán todas las filas de actividades.
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-3 border border-blue-100 dark:border-blue-800 flex flex-col justify-center text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  % Consulta Nueva:
                </span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {specialtyStats[globalSpecialty]?.newConsultPercentage || 0}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <BarChart className="w-3.5 h-3.5" />
                  Rend. Minsal Nueva:
                </span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {specialtyStats[globalSpecialty]?.minsalYieldNew || 0} /hr
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <BarChart className="w-3.5 h-3.5" />
                  Rend. Minsal Control:
                </span>
                <span className="font-semibold text-blue-900 dark:text-blue-100">
                  {specialtyStats[globalSpecialty]?.minsalYieldControl || 0} /hr
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCopyAndProcess && (
        <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
          <label className="block text-sm font-medium text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            <span>
              Proceso
              {!isExempt && <span className="text-red-500 ml-1">*</span>}
              {isExempt && <span className="text-gray-500 italic opacity-60 ml-2 font-normal text-xs">(Opcional)</span>}
            </span>
          </label>
          <SearchableSelect
            options={processList}
            value={selectedProcess}
            onChange={(val) => onProcessChange(val as string)}
            getLabel={(item) => item}
            getValue={(item) => item}
            placeholder="Seleccionar Proceso"
            searchPlaceholder="Buscar proceso..."
            disabled={isReadOnly}
            error={!!formErrors.selectedProcess}
          />
        </div>
      )}
    </>
  );
}
