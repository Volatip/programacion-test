import { useEffect, useState, type MouseEvent } from "react";
import { ArrowLeft, ArrowRight, MessageSquareWarning, Printer, RefreshCw, Save, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";

import { Modal } from "../ui/Modal";
import type { ProgrammingReviewEvent } from "../../lib/api";

interface ProgrammingActionBarProps {
  onPrint: () => void;
  onClose: () => void;
  onDelete: () => void;
  onSaveAndNext: (e: MouseEvent<HTMLButtonElement>) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  isReadOnly: boolean;
  programmingId: number | null;
  isSubmitting: boolean;
  isAvailableNegative: boolean;
  isSaved: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  reviewMode?: boolean;
  reviewComment?: string;
  onReviewCommentChange?: (value: string) => void;
  onSubmitReview?: (action: "validated" | "fix_required", comment?: string) => void;
  canSubmitReview?: boolean;
  latestReviewLabel?: string | null;
  correctionHistory?: ProgrammingReviewEvent[];
}

export function ProgrammingActionBar({
  onPrint,
  onClose,
  onDelete,
  onSaveAndNext,
  onPrevious,
  onNext,
  isReadOnly,
  programmingId,
  isSubmitting,
  isAvailableNegative,
  isSaved,
  hasPrevious,
  hasNext,
  reviewMode = false,
  reviewComment = "",
  onReviewCommentChange,
  onSubmitReview,
  canSubmitReview = true,
  latestReviewLabel,
  correctionHistory = [],
}: ProgrammingActionBarProps) {
  const [pendingReviewAction, setPendingReviewAction] = useState<"validated" | "fix_required" | null>(null);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);
  const [isCorrectionHistoryOpen, setIsCorrectionHistoryOpen] = useState(false);
  const correctionCount = correctionHistory.length;
  const correctionLabel = `${correctionCount} Correcciones`;

  useEffect(() => {
    if (!isSubmitting) {
      setPendingReviewAction(null);
    }
  }, [isSubmitting]);

  const reviewActionDisabled = isSubmitting || !canSubmitReview || pendingReviewAction !== null;
  const showReviewActions = reviewMode && canSubmitReview;

  const handleReviewAction = (action: "validated") => {
    if (reviewActionDisabled) {
      return;
    }
    setPendingReviewAction(action);
    onSubmitReview?.(action);
  };

  const handleOpenFixModal = () => {
    if (reviewActionDisabled) {
      return;
    }

    setIsFixModalOpen(true);
  };

  const handleCloseFixModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsFixModalOpen(false);
  };

  const handleConfirmFixRequired = () => {
    const trimmedComment = reviewComment.trim();

    if (reviewActionDisabled || !trimmedComment) {
      return;
    }

    setPendingReviewAction("fix_required");
    setIsFixModalOpen(false);
    onSubmitReview?.("fix_required", trimmedComment);
  };

  return (
    <>
      <div className="flex flex-col gap-4 border-t border-gray-50 pt-4 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 min-w-0">
        {reviewMode || correctionCount > 0 ? (
          <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
            <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">{reviewMode ? "Modo revisión" : "Correcciones de revisión"}</div>
            <div className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              {reviewMode
                ? (latestReviewLabel ? `Última revisión: ${latestReviewLabel}` : "Revise la programación y seleccione una acción del panel inferior.")
                : "Revise el historial antes de guardar una nueva corrección."}
            </div>
            {correctionCount > 0 ? (
              <button
                type="button"
                onClick={() => setIsCorrectionHistoryOpen(true)}
                className="mt-2 inline-flex text-xs font-medium text-amber-800 underline underline-offset-2 transition-colors hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
              >
                {correctionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 lg:flex-nowrap">
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
        {showReviewActions && (
          <>
                <button
                 type="button"
                onClick={() => handleReviewAction("validated")}
                disabled={reviewActionDisabled}
                className={`flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-emerald-700 ${reviewActionDisabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
               <ShieldCheck className="h-4 w-4" />
               Validado
             </button>
               <button
                 type="button"
                onClick={handleOpenFixModal}
                disabled={reviewActionDisabled}
                className={`flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-rose-700 ${reviewActionDisabled ? "cursor-not-allowed opacity-50" : ""}`}
              >
               <ShieldAlert className="h-4 w-4" />
               Arreglar
            </button>
          </>
        )}
        {hasPrevious && onPrevious && (
          <button
            type="button"
            onClick={onPrevious}
            className="flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-white rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Anterior
          </button>
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

      <Modal
        isOpen={isCorrectionHistoryOpen}
        onClose={() => setIsCorrectionHistoryOpen(false)}
        title="Historial de correcciones"
        className="max-w-3xl"
      >
        <div className="space-y-4 p-6">
          {correctionCount > 0 ? (
            correctionHistory.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {event.reviewed_by_name ?? "Sin revisor"} · {new Date(event.reviewed_at).toLocaleString("es-CL")}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">
                  {event.comment?.trim() || "Sin observación"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">No hay correcciones registradas.</p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isFixModalOpen}
        onClose={handleCloseFixModal}
        title="Solicitar corrección"
        className="max-w-2xl"
      >
        <div className="space-y-6 p-6 md:p-8">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-rose-100 p-2 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300">
                <MessageSquareWarning className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Explique qué debe corregirse antes de devolver la programación.</p>
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  El motivo se enviará junto con la acción <span className="font-semibold text-rose-700 dark:text-rose-300">Arreglar</span> y servirá como contexto para quien deba ajustar la programación.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="review-comment-modal">
              Motivo de la observación
            </label>
            <textarea
              id="review-comment-modal"
              value={reviewComment}
              onChange={(event) => onReviewCommentChange?.(event.target.value)}
              className="min-h-[160px] w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:border-rose-500 dark:focus:ring-rose-900/40"
              placeholder="Describa claramente el ajuste requerido para que la corrección sea accionable."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">Este motivo es obligatorio para enviar la devolución.</p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleCloseFixModal}
              disabled={isSubmitting}
              className={`rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 ${isSubmitting ? "cursor-not-allowed opacity-50" : ""}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmFixRequired}
              disabled={reviewActionDisabled || !reviewComment.trim()}
              className={`flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-rose-700 ${reviewActionDisabled || !reviewComment.trim() ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <ShieldAlert className="h-4 w-4" />
              Confirmar Arreglar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
