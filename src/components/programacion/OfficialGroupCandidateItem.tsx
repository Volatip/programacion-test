import { AlertCircle, UserPlus } from "lucide-react";
import type { Funcionario } from "../../context/OfficialsContextDefs";

interface OfficialGroupCandidateItemProps {
  official: Funcionario;
  onAdd: (official: Funcionario) => void;
  getCurrentGroupName: (groupId: number) => string;
}

export function OfficialGroupCandidateItem({
  official,
  onAdd,
  getCurrentGroupName,
}: OfficialGroupCandidateItemProps) {
  return (
    <button
      onClick={() => onAdd(official)}
      className="w-full p-3 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 rounded-xl flex items-center justify-between group transition-all shadow-sm hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 text-left overflow-hidden">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${official.color} shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
          {official.initial}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
            {official.name}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
              {official.rut}
            </span>
            <span className="truncate">• {official.title}</span>
          </div>
        </div>
      </div>

      <div className="text-right pl-2 shrink-0">
        {official.groupId ? (
          <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-800 px-2 py-1 rounded-full flex items-center gap-1 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
            <AlertCircle className="w-3 h-3" />
            Mover de {getCurrentGroupName(official.groupId)}
          </span>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
            <UserPlus className="w-4 h-4" />
          </div>
        )}
      </div>
    </button>
  );
}
