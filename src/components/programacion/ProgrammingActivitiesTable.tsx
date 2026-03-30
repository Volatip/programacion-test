import { BarChart, Calendar, Calculator, Clock, Plus, Trash2 } from "lucide-react";
import type { ActivityConfig } from "../../hooks/useProgrammingConfig";
import { normalizeText } from "../../lib/normalizeText";
import type { ProgrammingActivityEntry } from "../../lib/programmingForm";
import { SearchableSelect } from "../ui/SearchableSelect";

interface ProgrammingActivitiesTableProps {
  activityEntries: ProgrammingActivityEntry[];
  activitiesList: ActivityConfig[];
  specialtiesList: string[];
  funcionarioTitle?: string;
  isMedicalOfficial: boolean;
  globalSpecialty: string;
  selectedProcess: string;
  showSpecialty: boolean;
  isExempt: boolean;
  isReadOnly: boolean;
  timeUnit: "hours" | "minutes";
  handleTimeUnitChange: (value: "hours" | "minutes") => void;
  updateEntry: (id: number, field: keyof ProgrammingActivityEntry, value: string) => void;
  addEntry: () => void;
  removeEntry: (id: number) => void;
  shouldShowPerformanceFields: (activityName: string) => boolean;
  calculateCupos: (assignedHours: string, performance: string) => { agenda: string | number; annual: string | number };
  formErrors: Record<string, boolean>;
}

export function ProgrammingActivitiesTable({
  activityEntries,
  activitiesList,
  specialtiesList,
  funcionarioTitle,
  isMedicalOfficial,
  globalSpecialty,
  selectedProcess,
  showSpecialty,
  isExempt,
  isReadOnly,
  timeUnit,
  handleTimeUnitChange,
  updateEntry,
  addEntry,
  removeEntry,
  shouldShowPerformanceFields,
  calculateCupos,
  formErrors,
}: ProgrammingActivitiesTableProps) {
  const getFilteredActivities = () => {
    let filtered = activitiesList.filter((act) => (act.visible || "SI").toUpperCase() === "SI");

    if (isMedicalOfficial) {
      if (!globalSpecialty) {
        return [];
      }

      const target = normalizeText(globalSpecialty).toUpperCase();
      filtered = filtered.filter((act) => normalizeText(act.specialty || "").toUpperCase() === target);
    } else {
      if (funcionarioTitle) {
        const targetProfession = normalizeText(funcionarioTitle).toUpperCase();
        filtered = filtered.filter((act) => normalizeText(act.profession || "").toUpperCase() === targetProfession);
      }

      if (!selectedProcess) {
        return [];
      }

      filtered = filtered.filter((act) => act.process === selectedProcess);
    }

    filtered.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    return filtered;
  };

  const filteredActivities = getFilteredActivities();
  const notFoundText = isMedicalOfficial && !globalSpecialty
    ? "Seleccione una Especialidad Principal primero"
    : (!isMedicalOfficial && !selectedProcess
        ? "Seleccione un Proceso primero"
        : "No se encontraron actividades");

  return (
    <div className="space-y-4">
      <div className={`hidden md:grid gap-4 mb-2 ${showSpecialty ? "md:grid-cols-[4fr_3fr_1.25fr_1fr_1.25fr_1.25fr_0.5fr]" : "md:grid-cols-[4fr_1.25fr_1fr_1.25fr_1.25fr_0.5fr]"}`}>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Actividad {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
          </label>
        </div>

        {showSpecialty && (
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Especialidad {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
            </label>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>
                {timeUnit === "hours" ? "Horas" : "Min"}
                {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
              </span>
            </label>
            <select
              value={timeUnit}
              onChange={(e) => handleTimeUnitChange(e.target.value as "hours" | "minutes")}
              disabled={isReadOnly}
              className="text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
            >
              <option value="hours">Hrs</option>
              <option value="minutes">Min</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <BarChart className="w-4 h-4 text-gray-400" />
            <span>
              Rendimiento
              {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
            </span>
          </label>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-gray-400" />
            Cupos Semana
          </label>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Cupos Anual
          </label>
        </div>

        <div />
      </div>

      {activityEntries.map((entry) => {
        const cupos = calculateCupos(entry.assignedHours, entry.performance);
        const showPerformance = shouldShowPerformanceFields(entry.activity);

        return (
          <div
            key={entry.id}
            className={`grid grid-cols-1 gap-4 items-center pb-2 border-b border-gray-50 dark:border-gray-700 last:border-0 last:pb-0 ${showSpecialty ? "md:grid-cols-[4fr_3fr_1.25fr_1fr_1.25fr_1.25fr_0.5fr]" : "md:grid-cols-[4fr_1.25fr_1fr_1.25fr_1.25fr_0.5fr]"}`}
          >
            <div className="space-y-2 relative min-w-0">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden">
                Actividad {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
              </label>

              <div className="relative w-full">
                <SearchableSelect
                  options={filteredActivities}
                  value={entry.activity}
                  onChange={(val) => {
                    const activity = activitiesList.find((item) => item.name === val);
                    const newActivityRequiresPerf = activity?.req_rendimiento === "SI";
                    updateEntry(entry.id, "activity", val as string);
                    if (!newActivityRequiresPerf) {
                      updateEntry(entry.id, "performance", "");
                    }
                  }}
                  getLabel={(item) => item.name}
                  getValue={(item) => item.name}
                  placeholder="Seleccionar actividad"
                  searchPlaceholder="Buscar actividad..."
                  disabled={isReadOnly}
                  error={!!formErrors[`activity_${entry.id}_activity`]}
                  notFoundText={notFoundText}
                />
              </div>
            </div>

            {showSpecialty && (
              <div className="space-y-2 min-w-0">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden">
                  Especialidad {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
                </label>
                <SearchableSelect
                  options={specialtiesList}
                  value={entry.specialty}
                  onChange={(val) => updateEntry(entry.id, "specialty", val as string)}
                  getLabel={(item) => item}
                  getValue={(item) => item}
                  placeholder="Seleccionar Especialidad"
                  searchPlaceholder="Buscar especialidad..."
                  disabled={isReadOnly}
                  error={!!formErrors[`activity_${entry.id}_specialty`]}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>
                  {timeUnit === "hours" ? "Horas" : "Minutos"}
                  {!isExempt && <span className="text-red-500 text-xs ml-0.5">*</span>}
                </span>
              </label>
              <input
                type="number"
                min="0"
                step={timeUnit === "hours" ? "0.01" : "1"}
                value={entry.assignedHours}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.startsWith("-")) {
                    return;
                  }
                  updateEntry(entry.id, "assignedHours", value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "-" || e.key === "e" || e.key === "E") {
                    e.preventDefault();
                  }
                }}
                placeholder={timeUnit === "hours" ? "Ej: 2" : "Ej: 120"}
                disabled={isReadOnly}
                className={`w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-500 dark:text-white dark:placeholder-gray-400 ${
                  formErrors[`activity_${entry.id}_assignedHours`] ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200 dark:border-gray-600"
                }`}
              />
            </div>

            <div className="space-y-2 transition-all duration-300 ease-in-out">
              <label className={`text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden flex items-center gap-2 ${showPerformance ? "opacity-100" : "opacity-50"}`}>
                <BarChart className="w-4 h-4 text-gray-400" />
                <span>
                  Rendimiento
                  {!isExempt && showPerformance && <span className="text-red-500 text-xs ml-0.5">*</span>}
                </span>
              </label>
              <div className={`transition-all duration-300 ease-in-out ${showPerformance ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                {showPerformance ? (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={entry.performance}
                    onChange={(e) => updateEntry(entry.id, "performance", e.target.value)}
                    placeholder="Ej: 2"
                    disabled={isReadOnly}
                    className={`w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-500 dark:text-white dark:placeholder-gray-400 ${
                      formErrors[`activity_${entry.id}_performance`] ? "border-red-500 bg-red-50 dark:bg-red-900/30" : "border-gray-200 dark:border-gray-600"
                    }`}
                  />
                ) : (
                  <div className="w-full px-3 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-400 dark:text-gray-500 h-[34px] flex items-center justify-center">
                    -
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-1 space-y-2 transition-all duration-300 ease-in-out">
              <label className={`text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden flex items-center gap-2 ${showPerformance ? "opacity-100" : "opacity-50"}`}>
                <Calculator className="w-4 h-4 text-gray-400" />
                Cupos Agenda
              </label>
              <div className={`w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium h-[34px] flex items-center transition-all duration-300 ${showPerformance ? "text-gray-700 dark:text-white opacity-100" : "text-gray-400 dark:text-gray-500 justify-center opacity-70"}`}>
                {showPerformance ? cupos.agenda : "-"}
              </div>
            </div>

            <div className="md:col-span-1 space-y-2 transition-all duration-300 ease-in-out">
              <label className={`text-sm font-medium text-gray-700 dark:text-gray-300 md:hidden flex items-center gap-2 ${showPerformance ? "opacity-100" : "opacity-50"}`}>
                <Calendar className="w-4 h-4 text-gray-400" />
                Cupos Anuales
              </label>
              <div className={`w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium h-[34px] flex items-center transition-all duration-300 ${showPerformance ? "text-gray-700 dark:text-white opacity-100" : "text-gray-400 dark:text-gray-500 justify-center opacity-70"}`}>
                {showPerformance ? cupos.annual : "-"}
              </div>
            </div>

            <div className="flex justify-end md:justify-center">
              {activityEntries.length > 1 && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors mt-2"
                  title="Eliminar fila"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addEntry}
        disabled={isReadOnly}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors w-fit ${
          isReadOnly
            ? "text-gray-400 bg-gray-100 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed"
            : "text-primary hover:bg-primary/5"
        }`}
      >
        <Plus className="w-4 h-4" />
        Agregar Actividad
      </button>
    </div>
  );
}
