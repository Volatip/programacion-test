import { Info } from "lucide-react";
import type React from "react";

interface ProgrammingModalHeaderProps {
  otherProgrammers: string[];
  contractHoursDisplayText: React.ReactNode;
  totalScheduledHours: number;
  availableColorClass: string;
  availableHoursFormatted: number;
}

export function ProgrammingModalHeader({
  otherProgrammers,
  contractHoursDisplayText,
  totalScheduledHours,
  availableColorClass,
  availableHoursFormatted,
}: ProgrammingModalHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full pr-8">
      <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">Programación de Funcionario</span>

      <div className="flex items-center gap-4">
        {otherProgrammers.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800 text-sm animate-in fade-in zoom-in duration-300 shadow-sm">
            <Info className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium text-xs">Este funcionario también lo programó {otherProgrammers.join(", ")}</span>
          </div>
        )}

        <div className="flex items-center gap-0 text-sm font-medium border dark:border-gray-700 rounded-lg overflow-hidden shadow-sm h-[52px]">
          <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 border-r border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center min-w-[80px] h-full">
            <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold mb-0.5">Contrato</span>
            <div className="font-semibold text-gray-900 dark:text-white">{contractHoursDisplayText}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 border-r border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center min-w-[80px] h-full">
            <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-bold mb-0.5">Programadas</span>
            <span className="font-semibold">{Math.round(totalScheduledHours * 100) / 100} hrs</span>
          </div>
          <div className={`${availableColorClass} px-4 py-1.5 flex flex-col items-center justify-center min-w-[100px] h-full transition-colors duration-300`}>
            <span className="text-[10px] uppercase opacity-80 font-bold mb-0.5">Disponibles</span>
            <span className="text-base font-bold">{availableHoursFormatted} hrs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
