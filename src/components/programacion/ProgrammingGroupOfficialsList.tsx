import { UserMinus } from "lucide-react";
import type { Funcionario } from "../../context/OfficialsContextDefs";

interface ProgrammingGroupOfficialsListProps {
  officials: Funcionario[];
  isReadOnly: boolean;
  canAssignOfficials: boolean;
  formatContractHours: (func: Funcionario) => string;
  onSelectOfficial: (official: Funcionario) => void;
  onRemoveFromGroup: (e: React.MouseEvent, official: Funcionario) => void;
}

export function ProgrammingGroupOfficialsList({
  officials,
  isReadOnly,
  canAssignOfficials,
  formatContractHours,
  onSelectOfficial,
  onRemoveFromGroup,
}: ProgrammingGroupOfficialsListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      {officials.length > 0 ? (
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {officials.map((func) => (
            <div
              key={func.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelectOfficial(func)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectOfficial(func);
                }
              }}
              className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-4 transition-colors text-left group"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${func.color} shrink-0`}
              >
                {func.initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {func.name}
                  </span>
                  {func.isScheduled ? (
                    <div className="flex items-center gap-2">
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                        Programado
                      </span>
                    </div>
                  ) : (
                    <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap">
                      No Programado
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {func.title} • {func.rut}
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs text-gray-400 dark:text-gray-500">Horas Contrato</div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formatContractHours(func)}
                </div>
              </div>

              {!isReadOnly && canAssignOfficials && (
                <div className="pl-4 border-l border-gray-100 dark:border-gray-700 flex items-center">
                  <button
                    onClick={(e) => onRemoveFromGroup(e, func)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors group-hover:opacity-100 opacity-0"
                    title="Quitar del grupo"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          No se encontraron funcionarios en este grupo.
        </div>
      )}
    </div>
  );
}
