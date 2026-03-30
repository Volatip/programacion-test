import type React from "react";
import { AlertTriangle, History, Trash } from "lucide-react";
import { Modal } from "../ui/Modal";

interface PeriodFormData {
  name: string;
  start_date: string;
  end_date: string;
  status: "ANTIGUO" | "ACTIVO" | "OCULTO";
  is_active: boolean;
}

interface DeleteState {
  isOpen: boolean;
  step: 1 | 2;
  periodId: number | null;
}

interface PeriodsModalsProps {
  isModalOpen: boolean;
  handleCloseModal: () => void;
  editingId: number | null;
  formData: PeriodFormData;
  setFormData: React.Dispatch<React.SetStateAction<PeriodFormData>>;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  statusConfirmOpen: boolean;
  setStatusConfirmOpen: (value: boolean) => void;
  executeSubmit: () => Promise<void>;
  deleteState: DeleteState;
  cancelDelete: () => void;
  confirmDeleteStep1: () => void;
  finalizeDelete: () => Promise<void>;
}

export function PeriodsModals({
  isModalOpen,
  handleCloseModal,
  editingId,
  formData,
  setFormData,
  handleSubmit,
  statusConfirmOpen,
  setStatusConfirmOpen,
  executeSubmit,
  deleteState,
  cancelDelete,
  confirmDeleteStep1,
  finalizeDelete,
}: PeriodsModalsProps) {
  return (
    <>
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingId ? "Editar Período Académico" : "Nuevo Período Académico"}
        className="max-w-md"
      >
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nombre del período</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
              placeholder="Ej: Abril - Junio 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fecha de inicio</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fecha de fin</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-600">
            <label className="block text-sm font-medium text-gray-900 dark:text-white">Estado del período</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: "ANTIGUO" })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.status === "ANTIGUO"
                    ? "bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-800 dark:text-white"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Antiguo
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: "ACTIVO" })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.status === "ACTIVO"
                    ? "bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Activo
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, status: "OCULTO" })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  formData.status === "OCULTO"
                    ? "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                Oculto
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formData.status === "ACTIVO" && "Este período será visible y activo para todos."}
              {formData.status === "ANTIGUO" && "Este período quedará visible como histórico."}
              {formData.status === "OCULTO" && "Este período solo será visible para administradores."}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors"
            >
              {editingId ? "Guardar cambios" : "Crear período"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={statusConfirmOpen}
        onClose={() => setStatusConfirmOpen(false)}
        title="Confirmar cambio a histórico"
        className="max-w-md"
      >
        <div className="p-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="text-blue-600 dark:text-blue-400 w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">¿Establecer como histórico?</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Al marcar este período como <strong>Antiguo</strong>, quedará como un registro histórico y <strong>no podrá ser editado</strong> en RRHH, Carga, Funcionarios y Programación.
              <br />
              <br />
              ¿Estás seguro de continuar?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setStatusConfirmOpen(false)}
                className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={executeSubmit}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Confirmar y guardar
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={deleteState.isOpen}
        onClose={cancelDelete}
        title={deleteState.step === 1 ? "Confirmar eliminación" : "¡Advertencia final!"}
        className="max-w-md"
        showCloseButton={true}
      >
        <div className="p-6">
          {deleteState.step === 1 ? (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash className="text-red-600 dark:text-red-400 w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">¿Estás seguro?</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                ¿Deseas eliminar este período? Esta acción podría afectar a los datos asociados.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteStep1}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <AlertTriangle className="text-red-600 dark:text-red-400 w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">¡Acción irreversible!</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-6 text-sm">
                Se eliminará permanentemente el período y todos los registros vinculados.
                <br />
                <span className="font-bold mt-2 block">¿Confirmas la eliminación total?</span>
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-5 py-2.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizeDelete}
                  className="px-5 py-2.5 bg-red-700 text-white rounded-lg hover:bg-red-800 font-bold shadow-md"
                >
                  Eliminar definitivamente
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
