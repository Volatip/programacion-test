import { Filter, Search, X } from "lucide-react";

interface GeneralToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  titleFilter: string;
  onTitleFilterChange: (value: string) => void;
  lawFilter: string;
  onLawFilterChange: (value: string) => void;
  specialtyFilter: string;
  onSpecialtyFilterChange: (value: string) => void;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  programmedFilter: string;
  onProgrammedFilterChange: (value: string) => void;
  reviewFilter: string;
  onReviewFilterChange: (value: string) => void;
  filteredCount: number;
  onClearFilters: () => void;
}

const statusOptions = [
  { value: "todos", label: "Todos los estados" },
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
];

const programmedOptions = [
  { value: "todos", label: "Todos" },
  { value: "programado", label: "Programado" },
  { value: "no-programado", label: "No Programado" },
];

const reviewOptions = [
  { value: "todos", label: "Todas las revisiones" },
  { value: "sin_revision", label: "Sin revisión" },
  { value: "pending", label: "Pendiente" },
  { value: "validated", label: "Validado" },
  { value: "fix_required", label: "Arreglar" },
];

export function GeneralToolbar({
  searchQuery,
  onSearchQueryChange,
  showFilters,
  onToggleFilters,
  hasActiveFilters,
  titleFilter,
  onTitleFilterChange,
  lawFilter,
  onLawFilterChange,
  specialtyFilter,
  onSpecialtyFilterChange,
  userFilter,
  onUserFilterChange,
  statusFilter,
  onStatusFilterChange,
  programmedFilter,
  onProgrammedFilterChange,
  reviewFilter,
  onReviewFilterChange,
  filteredCount,
  onClearFilters,
}: GeneralToolbarProps) {
  return (
    <>
      <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Buscar funcionario o RUT..."
            aria-label="Buscar en General"
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            type="button"
            onClick={onToggleFilters}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              hasActiveFilters
                ? "border-primary text-primary bg-primary/5 dark:bg-primary/10"
                : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
            aria-label="Mostrar filtros avanzados"
            title="Mostrar filtros avanzados"
          >
            <Filter className="w-4 h-4" />
            Filtros avanzados
          </button>

          <div className="rounded-full bg-gray-100 dark:bg-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
            {filteredCount} registros
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 border-b border-gray-100 dark:border-gray-700 space-y-4 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Filtrar título..."
              value={titleFilter}
              onChange={(event) => onTitleFilterChange(event.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
            />

            <input
              type="text"
              placeholder="Filtrar ley..."
              value={lawFilter}
              onChange={(event) => onLawFilterChange(event.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
            />

            <input
              type="text"
              placeholder="Filtrar especialidad..."
              value={specialtyFilter}
              onChange={(event) => onSpecialtyFilterChange(event.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
            />

            <input
              type="text"
              placeholder="Filtrar usuario..."
              value={userFilter}
              onChange={(event) => onUserFilterChange(event.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none focus:border-primary transition-colors"
            />

            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value)}
              aria-label="Filtrar por estado"
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-primary transition-colors"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={programmedFilter}
              onChange={(event) => onProgrammedFilterChange(event.target.value)}
              aria-label="Filtrar por programación"
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-primary transition-colors"
            >
              {programmedOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={reviewFilter}
              onChange={(event) => onReviewFilterChange(event.target.value)}
              aria-label="Filtrar por revisión"
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-primary transition-colors"
            >
              {reviewOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
