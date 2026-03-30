import { ChevronLeft, ChevronRight } from "lucide-react";

interface FuncionariosPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onItemsPerPageChange: (value: number) => void;
  onPageChange: (page: number) => void;
}

export function FuncionariosPagination({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  startIndex,
  endIndex,
  onItemsPerPageChange,
  onPageChange,
}: FuncionariosPaginationProps) {
  const visibleStart = totalItems === 0 ? 0 : startIndex + 1;
  const visibleEnd = totalItems === 0 ? 0 : Math.min(endIndex, totalItems);

  return (
    <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Mostrando {visibleStart} a {visibleEnd} de {totalItems} funcionarios
      </div>

      <div className="flex items-center gap-2">
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          aria-label="Funcionarios por página"
          className="px-2 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        >
          <option value={100}>100 por pág.</option>
          <option value={500}>500 por pág.</option>
          <option value={1000}>1000 por pág.</option>
          <option value={1500}>1500 por pág.</option>
          <option value={2000}>2000 por pág.</option>
        </select>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2 rounded-lg border ${
            currentPage === 1
              ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          } transition-colors`}
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
          Página {currentPage} de {totalPages || 1}
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          className={`p-2 rounded-lg border ${
            currentPage === totalPages || totalPages === 0
              ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
              : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          } transition-colors`}
          aria-label="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
