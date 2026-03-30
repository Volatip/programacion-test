import { Calendar, ChevronRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Funcionario } from "../../context/OfficialsContextDefs";

interface ProgrammingStatusSummaryProps {
  scheduledFuncionarios: Funcionario[];
  unscheduledFuncionarios: Funcionario[];
}

export function ProgrammingStatusSummary({
  scheduledFuncionarios,
  unscheduledFuncionarios,
}: ProgrammingStatusSummaryProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white px-1">Estado General</h3>

      <div
        onClick={() => navigate("/programacion/programados")}
        className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 cursor-pointer group hover:shadow-lg hover:border-green-200 dark:hover:border-green-800 transition-all duration-300 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
          <Calendar className="w-24 h-24 text-green-600 dark:text-green-400" />
        </div>

        <div className="relative z-10">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="flex justify-between items-end">
            <div>
              <h4 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{scheduledFuncionarios.length}</h4>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-green-700 dark:group-hover:text-green-400 transition-colors">
                Funcionarios Programados
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <div
        onClick={() => navigate("/programacion/no-programados")}
        className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm p-6 cursor-pointer group hover:shadow-lg hover:border-red-200 dark:hover:border-red-800 transition-all duration-300 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
          <Clock className="w-24 h-24 text-red-600 dark:text-red-400" />
        </div>

        <div className="relative z-10">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
            <Clock className="w-6 h-6" />
          </div>
          <div className="flex justify-between items-end">
            <div>
              <h4 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{unscheduledFuncionarios.length}</h4>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-red-700 dark:group-hover:text-red-400 transition-colors">
                Pendientes de Programación
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-3xl p-6 border border-blue-100 dark:border-blue-800/30">
        <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-2 text-sm uppercase tracking-wider">Tip de Productividad</h4>
        <p className="text-sm text-blue-800/80 dark:text-blue-200/80 leading-relaxed">
          Organiza a tus funcionarios en grupos para asignar sus programaciones de forma más eficiente.
        </p>
      </div>
    </div>
  );
}
