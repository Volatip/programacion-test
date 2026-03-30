import type React from "react";
import type { Group } from "../../context/OfficialsContextDefs";
import { Modal } from "../ui/Modal";
import { AddOfficialToGroupModal } from "./AddOfficialToGroupModal";

interface ProgrammingGroupModalsProps {
  isCreateGroupModalOpen: boolean;
  isEditGroupModalOpen: boolean;
  isDeleteGroupModalOpen: boolean;
  newGroupName: string;
  setNewGroupName: (value: string) => void;
  groupToDelete: Group | null;
  addingToGroup: Group | null;
  setIsCreateGroupModalOpen: (value: boolean) => void;
  setIsEditGroupModalOpen: (value: boolean) => void;
  setIsDeleteGroupModalOpen: (value: boolean) => void;
  setAddingToGroup: (group: Group | null) => void;
  confirmCreateGroup: (event: React.FormEvent) => void;
  confirmEditGroup: (event: React.FormEvent) => void;
  confirmDeleteGroup: () => void;
}

export function ProgrammingGroupModals({
  isCreateGroupModalOpen,
  isEditGroupModalOpen,
  isDeleteGroupModalOpen,
  newGroupName,
  setNewGroupName,
  groupToDelete,
  addingToGroup,
  setIsCreateGroupModalOpen,
  setIsEditGroupModalOpen,
  setIsDeleteGroupModalOpen,
  setAddingToGroup,
  confirmCreateGroup,
  confirmEditGroup,
  confirmDeleteGroup,
}: ProgrammingGroupModalsProps) {
  return (
    <>
      <Modal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        title="Crear Nuevo Grupo"
        className="max-w-md"
      >
        <form onSubmit={confirmCreateGroup} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Grupo</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ej: UCI Pediátrica"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsCreateGroupModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Aceptar
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isEditGroupModalOpen}
        onClose={() => setIsEditGroupModalOpen(false)}
        title="Editar Grupo"
        className="max-w-md"
      >
        <form onSubmit={confirmEditGroup} className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Grupo</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ej: UCI Pediátrica"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsEditGroupModalOpen(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteGroupModalOpen}
        onClose={() => setIsDeleteGroupModalOpen(false)}
        title="Eliminar Grupo"
        className="max-w-md"
      >
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            ¿Estás seguro que deseas eliminar el grupo <span className="font-semibold text-gray-900 dark:text-white">"{groupToDelete?.name}"</span>?
            <br />
            <br />
            Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setIsDeleteGroupModalOpen(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDeleteGroup}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </Modal>

      <AddOfficialToGroupModal
        isOpen={!!addingToGroup}
        onClose={() => setAddingToGroup(null)}
        groupId={addingToGroup?.id || 0}
        groupName={addingToGroup?.name || ""}
      />
    </>
  );
}
