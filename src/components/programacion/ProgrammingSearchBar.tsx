import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Funcionario } from "../../context/OfficialsContextDefs";
import { APP_ROUTES } from "../../lib/appPaths";

interface ProgrammingSearchBarProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filteredFuncionarios: Funcionario[];
}

interface ProgrammingSearchNavigationState {
  selectedOfficialId: number;
}

export function ProgrammingSearchBar({
  searchQuery,
  setSearchQuery,
  filteredFuncionarios,
}: ProgrammingSearchBarProps) {
  const navigate = useNavigate();
  const hasSearch = searchQuery.trim().length > 0;

  return (
    <div className="relative w-full md:w-96 group">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
        <Search className="w-5 h-5" />
      </div>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Buscar por nombre o RUT..."
        aria-label="Buscar funcionario en programación"
        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-base text-gray-900 dark:text-white dark:placeholder-gray-500"
      />
      {hasSearch && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredFuncionarios.length > 0 ? (
            <div className="max-h-[300px] overflow-y-auto">
              {filteredFuncionarios.map((funcionario) => (
                <button
                  key={funcionario.id}
                    onClick={() => {
                      const navigationState: ProgrammingSearchNavigationState = {
                        selectedOfficialId: funcionario.id,
                      };

                      if (funcionario.groupId) {
                        navigate(APP_ROUTES.programmingGroup(funcionario.groupId), { state: navigationState });
                      } else {
                        navigate(APP_ROUTES.programmingUnscheduled, { state: navigationState });
                      }
                    }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-none"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${funcionario.color} shadow-sm`}>
                    {funcionario.initial}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{funcionario.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{funcionario.rut}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
              No encontramos funcionarios con esa búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
