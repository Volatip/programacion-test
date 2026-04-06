import { AlertTriangle, ArrowRightLeft, Briefcase, CalendarOff, CheckCircle2, GraduationCap, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react";
import type React from "react";
import type { Funcionario } from "../../context/OfficialsContextDefs";
import { isPartialCommissionSelection, type DismissReason } from "../../lib/dismissReasons";
import { Modal } from "../ui/Modal";
import { Toast, type ToastType } from "../ui/Toast";

interface FuncionariosModalsProps {
  isActivateModalOpen: boolean;
  setIsActivateModalOpen: (value: boolean) => void;
  isProcessingActivation: boolean;
  handleConfirmActivate: () => Promise<void>;
  isDismissModalOpen: boolean;
  setIsDismissModalOpen: (value: boolean) => void;
  isProcessingDismiss: boolean;
  dismissReasons: DismissReason[];
  isLoadingDismissReasons: boolean;
  dismissReasonId: number | null;
  setDismissReasonId: (value: number | null) => void;
  dismissSuboptionId: number | null;
  setDismissSuboptionId: (value: number | null) => void;
  dismissPartialHours: string;
  setDismissPartialHours: (value: string) => void;
  setShowConfirmHardDelete: (value: boolean) => void;
  setDismissError: (value: string) => void;
  dismissError: string;
  showConfirmHardDelete: boolean;
  selectedDismissReason: DismissReason | null;
  handleConfirmDismiss: () => Promise<void>;
  isAddOfficialModalOpen: boolean;
  setIsAddOfficialModalOpen: (value: boolean) => void;
  addOfficialSearchQuery: string;
  setAddOfficialSearchQuery: (value: string) => void;
  isSearching: boolean;
  searchResults: Funcionario[];
  handleAddOfficial: (official: Funcionario) => void;
  normalizeRutInput: (value: string) => string;
  toastOpen: boolean;
  toastMessage: string;
  toastType: ToastType;
  setToastOpen: (value: boolean) => void;
}

export function FuncionariosModals({
  isActivateModalOpen,
  setIsActivateModalOpen,
  isProcessingActivation,
  handleConfirmActivate,
  isDismissModalOpen,
  setIsDismissModalOpen,
  isProcessingDismiss,
  dismissReasons,
  isLoadingDismissReasons,
  dismissReasonId,
  setDismissReasonId,
  dismissSuboptionId,
  setDismissSuboptionId,
  dismissPartialHours,
  setDismissPartialHours,
  setShowConfirmHardDelete,
  setDismissError,
  dismissError,
  showConfirmHardDelete,
  selectedDismissReason,
  handleConfirmDismiss,
  isAddOfficialModalOpen,
  setIsAddOfficialModalOpen,
  addOfficialSearchQuery,
  setAddOfficialSearchQuery,
  isSearching,
  searchResults,
  handleAddOfficial,
  normalizeRutInput,
  toastOpen,
  toastMessage,
  toastType,
  setToastOpen,
}: FuncionariosModalsProps) {
  const selectedDismissSuboption = selectedDismissReason?.suboptions.find((suboption) => suboption.id === dismissSuboptionId) ?? null;
  const requiresPartialHours = isPartialCommissionSelection(selectedDismissReason, dismissSuboptionId);

  const getReasonIcon = (reason: DismissReason) => {
    if (reason.action_type === "hide") return Trash2;

    switch (reason.name) {
      case "Renuncia":
        return UserMinus;
      case "Cambio de servicio":
        return ArrowRightLeft;
      case "Comisión de Servicio":
        return Briefcase;
      case "Permiso sin Goce":
        return CalendarOff;
      case "Comisión de Estudio":
        return GraduationCap;
      default:
        return UserMinus;
    }
  };

  return (
    <>
      <Modal
        isOpen={isActivateModalOpen}
        onClose={() => !isProcessingActivation && setIsActivateModalOpen(false)}
        title="Activar Funcionario"
        className="max-w-md"
      >
        <div className="p-6 pt-2 space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex gap-3 transition-colors">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
              ¿Está seguro que desea reactivar a este funcionario? Podrá volver a ser programado y asignado a grupos.
            </p>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setIsActivateModalOpen(false)}
              disabled={isProcessingActivation}
              className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmActivate}
              disabled={isProcessingActivation}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
            >
              {isProcessingActivation ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar Activación"
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isDismissModalOpen}
        onClose={() => !isProcessingDismiss && setIsDismissModalOpen(false)}
        title="Confirmar Baja de Funcionario"
        className="max-w-3xl"
      >
        <div className="p-6 pt-2 space-y-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex gap-3 transition-colors">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              Está a punto de dar de baja a un funcionario. Por favor seleccione el motivo para continuar.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900 dark:text-white">Motivo de la baja</label>
            <div className="grid grid-cols-2 gap-3">
              {isLoadingDismissReasons ? (
                <div className="col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Cargando motivos disponibles...</div>
              ) : dismissReasons.map((item) => {
                const Icon = getReasonIcon(item);
                return (
                <div
                  key={item.id}
                    onClick={() => {
                      setDismissReasonId(item.id);
                      setDismissSuboptionId(null);
                      setDismissPartialHours("");
                      setShowConfirmHardDelete(false);
                      setDismissError("");
                    }}
                  className={`
                    relative flex flex-col items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 group h-full
                    ${dismissReasonId === item.id
                      ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-sm"
                      : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"}
                  `}
                >
                  <div className="flex w-full items-start justify-between">
                    <div
                      className={`
                        p-2 rounded-lg shrink-0 transition-colors
                        ${dismissReasonId === item.id ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600"}
                      `}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {dismissReasonId === item.id && <CheckCircle2 className="w-5 h-5 text-primary animate-in zoom-in duration-200" />}
                  </div>

                  <div className="flex-1">
                    <span className={`font-medium block mb-1 ${dismissReasonId === item.id ? "text-primary dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                      {item.name}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{item.description || "Sin descripción configurada"}</p>
                  </div>

                  <input
                    type="radio"
                    name="dismissReason"
                    value={item.id}
                    checked={dismissReasonId === item.id}
                    onChange={() => {}}
                    className="sr-only"
                  />
                </div>
              )})}
            </div>
          </div>

          {selectedDismissReason && selectedDismissReason.suboptions.length > 0 && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">Subopción obligatoria</label>
              <div className="grid grid-cols-2 gap-3">
                {selectedDismissReason.suboptions.map((suboption) => (
                  <button
                    key={suboption.id}
                    type="button"
                    onClick={() => {
                      setDismissSuboptionId(suboption.id);
                      if (suboption.name.trim().toLowerCase() !== "parcial") {
                        setDismissPartialHours("");
                      }
                      setDismissError("");
                      setShowConfirmHardDelete(false);
                    }}
                    className={`rounded-xl border-2 px-4 py-3 text-left transition ${dismissSuboptionId === suboption.id ? "border-primary bg-primary/5 text-primary" : "border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200"}`}
                  >
                    <div className="font-semibold">{suboption.name}</div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{suboption.description || "Sin descripción"}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {requiresPartialHours && (
            <div className="space-y-2">
              <label htmlFor="dismiss-partial-hours" className="block text-sm font-semibold text-gray-900 dark:text-white">
                Horas de comisión parcial <span className="text-red-500">*</span>
              </label>
              <input
                id="dismiss-partial-hours"
                value={dismissPartialHours}
                onChange={(e) => {
                  setDismissPartialHours(e.target.value.replace(/\D/g, ""));
                  setDismissError("");
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ingrese horas"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/30 px-4 py-3 text-sm text-gray-900 dark:text-white outline-none transition focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">Solo se permiten números enteros mayores a 0.</p>
            </div>
          )}

          {dismissError && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 transition-colors">
              <AlertTriangle className="w-4 h-4" />
              {dismissError}
            </div>
          )}

          {showConfirmHardDelete && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-800 dark:text-red-300 animate-in fade-in slide-in-from-top-2 shadow-inner transition-colors">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <div className="space-y-2">
                  <p className="font-bold text-red-900 dark:text-red-200">Advertencia Crítica</p>
                  <p className="leading-relaxed">
                    La opción <span className="font-bold">"{selectedDismissReason?.name}"</span>{selectedDismissSuboption ? ` con subopción "${selectedDismissSuboption.name}"` : ""} ocultará al funcionario del ámbito del usuario actual.
                  </p>
                  <p className="font-medium bg-red-100/50 dark:bg-red-900/40 p-2 rounded text-center border border-red-200/50 dark:border-red-700/50">
                    Revise cuidadosamente antes de confirmar.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-6 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setIsDismissModalOpen(false)}
              disabled={isProcessingDismiss}
              className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmDismiss}
              disabled={isProcessingDismiss || !dismissReasonId || (Boolean(selectedDismissReason?.suboptions.length) && !dismissSuboptionId) || (requiresPartialHours && !dismissPartialHours.trim())}
              className={`
                px-6 py-2.5 text-white rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-2 transform active:scale-95
                ${!dismissReasonId || (Boolean(selectedDismissReason?.suboptions.length) && !dismissSuboptionId) || (requiresPartialHours && !dismissPartialHours.trim())
                  ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                  : showConfirmHardDelete
                    ? "bg-red-600 hover:bg-red-700 hover:shadow-red-200"
                    : "bg-primary hover:bg-primary/90 hover:shadow-primary/20"}
              `}
            >
              {isProcessingDismiss ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Procesando...
                </>
              ) : showConfirmHardDelete ? (
                "Confirmar Eliminación"
              ) : (
                "Confirmar Baja"
              )}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isAddOfficialModalOpen}
        onClose={() => setIsAddOfficialModalOpen(false)}
        title="Agregar Funcionario"
        className="max-w-2xl max-h-[80vh]"
        showCloseButton={false}
      >
        <div className="flex flex-col h-full">
          <div className="px-4 pb-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-800 flex-shrink-0 transition-colors">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Buscar en base de datos de RRHH</p>
              </div>
            </div>
            <button
              onClick={() => setIsAddOfficialModalOpen(false)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={addOfficialSearchQuery}
                onChange={(e) => setAddOfficialSearchQuery(normalizeRutInput(e.target.value))}
                placeholder="Buscar por nombre o RUT..."
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                autoFocus
              />
            </div>
          </div>

          <div className="p-2 overflow-y-auto flex-1">
            {addOfficialSearchQuery ? (
              <div className="space-y-1">
                {isSearching ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">Buscando...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((funcionario) => (
                    <div
                      key={funcionario.id}
                      className="w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg flex items-center justify-between group transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${funcionario.color} shrink-0`}>
                          {funcionario.initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{funcionario.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{funcionario.title} • {funcionario.rut}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{funcionario.sisSpecialty}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddOfficial(funcionario)}
                        className="px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-colors shadow-sm"
                      >
                        Agregar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No se encontraron funcionarios que coincidan con la búsqueda.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-400 dark:text-gray-500 flex flex-col items-center gap-3">
                <Search className="w-12 h-12 text-gray-200 dark:text-gray-700" />
                <p>Ingrese un nombre o RUT para buscar en la base de datos de RRHH.</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Toast isOpen={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} />
    </>
  );
}
