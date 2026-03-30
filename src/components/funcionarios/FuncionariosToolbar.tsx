import { Filter, Plus, Search } from "lucide-react";

interface FuncionariosToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  titleFilter: string;
  onTitleFilterChange: (value: string) => void;
  lawFilter: string;
  onLawFilterChange: (value: string) => void;
  specialtyFilter: string;
  onSpecialtyFilterChange: (value: string) => void;
  hoursFilter: string;
  onHoursFilterChange: (value: string) => void;
  onAddOfficial: () => void;
  canManageOfficials: boolean;
  isReadOnly: boolean;
}

const statusOptions = [
  { value: "activo", label: "Activos" },
  { value: "inactivo", label: "Inactivos" },
  { value: "todos", label: "Todos" },
];

export function FuncionariosToolbar({
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  titleFilter,
  onTitleFilterChange,
  lawFilter,
  onLawFilterChange,
  specialtyFilter,
  onSpecialtyFilterChange,
  hoursFilter,
  onHoursFilterChange,
  onAddOfficial,
  canManageOfficials,
  isReadOnly,
}: FuncionariosToolbarProps) {
  return (
    <>
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            aria-label="Buscar funcionarios"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mr-2 transition-colors">
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onStatusFilterChange(option.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  statusFilter === option.value
                    ? "bg-white dark:bg-gray-600 text-primary dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={onToggleFilters}
            className={`p-2 rounded-lg border transition-colors ${
              hasActiveFilters
                ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
            title="Mostrar filtros avanzados"
            aria-label="Mostrar filtros avanzados"
          >
            <Filter className="w-5 h-5" />
          </button>

          {canManageOfficials && (
            <button
              onClick={onAddOfficial}
              disabled={isReadOnly}
              className={`flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium transition-colors ${
                isReadOnly ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90"
              }`}
              title={isReadOnly ? "No disponible en período histórico" : "Agregar nuevo funcionario"}
            >
              <Plus className="w-4 h-4" />
              Nuevo Funcionario
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 grid grid-cols-5 gap-4 transition-colors">
          <input
            type="text"
            placeholder="Filtrar título..."
            value={titleFilter}
            onChange={(e) => onTitleFilterChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
          />
          <input
            type="text"
            placeholder="Filtrar ley..."
            value={lawFilter}
            onChange={(e) => onLawFilterChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
          />
          <input
            type="text"
            placeholder="Filtrar especialidad..."
            value={specialtyFilter}
            onChange={(e) => onSpecialtyFilterChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
          />
          <input
            type="text"
            placeholder="Filtrar horas..."
            value={hoursFilter}
            onChange={(e) => onHoursFilterChange(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
          />
        </div>
      )}
    </>
  );
}
