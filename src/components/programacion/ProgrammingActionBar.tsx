import type React from "react";
import { ArrowRight, Printer, RefreshCw, Save, Trash2 } from "lucide-react";

interface ProgrammingActionBarProps {
  onPrint: () => void;
  onClose: () => void;
  onDelete: () => void;
  onSaveAndNext: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onNext?: () => void;
  isReadOnly: boolean;
  programmingId: number | null;
  isSubmitting: boolean;
  isAvailableNegative: boolean;
  isSaved: boolean;
  hasNext: boolean;
}

export function ProgrammingActionBar({
  onPrint,
  onClose,
  onDelete,
  onSaveAndNext,
  onNext,
  isReadOnly,
  programmingId,
  isSubmitting,
  isAvailableNegative,
  isSaved,
  hasNext,
}: ProgrammingActionBarProps) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-700">
      <div />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onPrint}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
        >
          Cancelar
        </button>
        {!isReadOnly && programmingId && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        )}
        {!isReadOnly && (
          <>
            <button
              type="submit"
              disabled={isSubmitting || isAvailableNegative}
              className={`flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm ${isSubmitting || isAvailableNegative ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSubmitting && !isSaved ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSubmitting && !isSaved ? "Guardando..." : "Guardar"}
            </button>
            {hasNext && (
              <button
                type="button"
                onClick={onSaveAndNext}
                disabled={isSubmitting || isAvailableNegative}
                className={`flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow active:scale-95 ${isSubmitting || isAvailableNegative ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSubmitting && !isSaved ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaved ? "Guardado!" : isSubmitting ? "Guardando..." : "Guardar y Siguiente"}
              </button>
            )}
          </>
        )}
        {hasNext && onNext && (
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow active:scale-95"
          >
            <ArrowRight className="w-4 h-4" />
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}
