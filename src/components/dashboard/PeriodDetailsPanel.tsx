import { Activity, Clock, Stethoscope, Users } from "lucide-react";

interface SelectedPeriodLike {
  status?: string;
}

interface ChartItem {
  period: string;
  hours: number;
}

interface SummaryLike {
  period_name: string;
  shift_hours?: number;
  shift_officials_count?: number;
}

interface PeriodDetailsPanelProps {
  selectedPeriod: SelectedPeriodLike | null;
  summary: SummaryLike;
  chartData: ChartItem[];
}

export function PeriodDetailsPanel({
  selectedPeriod,
  summary,
  chartData,
}: PeriodDetailsPanelProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors dark:border-gray-700 dark:bg-gray-800 xl:p-6">
      <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-white xl:text-lg">Detalles del Período</h3>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 xl:text-sm">Estado del Período</span>
          </div>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              selectedPeriod?.status === "ACTIVO"
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }`}
          >
            {selectedPeriod?.status === "ACTIVO" ? "Activo" : "Histórico"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 xl:text-sm">Horas Contrato</span>
          </div>
          <span className="text-xs font-bold text-gray-900 dark:text-white xl:text-sm">
            {chartData.find((d) => d.period === summary.period_name)?.hours.toFixed(0) || 0} hrs
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <Stethoscope className="w-5 h-5 text-teal-500 dark:text-teal-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 xl:text-sm">Horas Turno</span>
          </div>
          <span className="text-xs font-bold text-gray-900 dark:text-white xl:text-sm">
            {summary.shift_hours?.toFixed(0) || 0} hrs
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 xl:text-sm">Funcionarios con Turno</span>
          </div>
          <span className="text-xs font-bold text-gray-900 dark:text-white xl:text-sm">
            {summary.shift_officials_count || 0}
          </span>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700 transition-colors">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            * Los datos excluyen contratos Ley 15076 (salvo Liberados de Guardia).
            <br />
            * La información se actualiza en tiempo real según la programación ingresada.
          </p>
        </div>
      </div>
    </div>
  );
}
