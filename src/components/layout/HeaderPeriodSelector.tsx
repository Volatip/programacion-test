import { Calendar, ChevronDown } from "lucide-react";
import type { User } from "../../context/AuthContext";
import type { Period } from "../../context/PeriodsContext";

interface HeaderPeriodSelectorProps {
  periods: Period[];
  selectedPeriod: Period | null;
  setSelectedPeriod: (period: Period | null) => void;
  showPeriodMenu: boolean;
  setShowPeriodMenu: React.Dispatch<React.SetStateAction<boolean>>;
  user: User | null;
}

export function HeaderPeriodSelector({
  periods,
  selectedPeriod,
  setSelectedPeriod,
  showPeriodMenu,
  setShowPeriodMenu,
  user,
}: HeaderPeriodSelectorProps) {
  const getPeriodStatusLabel = (period: Period) => {
    if (period.status === "ACTIVO") {
      return <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-0.5 rounded-full">Activo</span>;
    }

    if (period.status === "OCULTO") {
      return <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">Oculto</span>;
    }

    return <span className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-full">Histórico</span>;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPeriodMenu(!showPeriodMenu)}
        className="flex min-w-0 items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 sm:min-w-[13rem] lg:min-w-[16rem] xl:px-3 xl:text-sm"
      >
        <Calendar size={16} className="shrink-0 text-gray-500 dark:text-gray-400" />
        <span className="min-w-0 flex-1 truncate text-left">{selectedPeriod ? selectedPeriod.name : "Cargando..."}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      {showPeriodMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowPeriodMenu(false)} />
          <div className="absolute right-0 top-12 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-20 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
            {periods
              .filter((period) => {
                if (period.status === "OCULTO") {
                  return user?.role === "admin";
                }
                return true;
              })
              .map((period) => (
                <button
                  key={period.id}
                  onClick={() => {
                    setSelectedPeriod(period);
                    setShowPeriodMenu(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedPeriod?.id === period.id ? "text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20" : "text-gray-700 dark:text-gray-300"}`}
                >
                  <span>{period.name}</span>
                  {getPeriodStatusLabel(period)}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
