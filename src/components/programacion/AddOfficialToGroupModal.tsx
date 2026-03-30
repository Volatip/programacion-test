
import { Search, Check, Users } from "lucide-react";
import { useOfficials } from "../../context/OfficialsContext";
import { useAddOfficialToGroupModal } from "../../hooks/useAddOfficialToGroupModal";
import { Modal } from "../ui/Modal";
import { OfficialGroupCandidateItem } from "./OfficialGroupCandidateItem";

interface AddOfficialToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: number;
  groupName: string;
}

export function AddOfficialToGroupModal({ isOpen, onClose, groupId, groupName }: AddOfficialToGroupModalProps) {
  const { officials, assignToGroup, groups } = useOfficials();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    recentAddedId,
    addedCount,
    handleAdd,
    getCurrentGroupName,
  } = useAddOfficialToGroupModal({
    isOpen,
    officials,
    groups,
    groupId,
    assignToGroup,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full pr-8">
          <span>Añadir Funcionario a {groupName}</span>
          {addedCount > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 font-normal">
              <Check className="w-3 h-3" />
              {addedCount} añadido{addedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      }
      className="max-w-2xl"
    >
      <div className="flex flex-col h-[600px]"> {/* Fixed height for consistency */}
        
        {/* Search Header */}
        <div className="p-6 pb-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar funcionario por nombre o RUT..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:placeholder-gray-500"
              autoFocus
            />
          </div>
          
          {/* Quick stats or info */}
          <div className="flex justify-between items-center mt-3 px-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Mostrando {searchResults.length} funcionarios disponibles
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Haga clic para añadir
            </span>
          </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30 dark:bg-gray-900/30">
          {searchResults.length > 0 ? (
            <div className="space-y-2">
              {searchResults.map((func) => (
                <OfficialGroupCandidateItem
                  key={func.id}
                  official={func}
                  onAdd={handleAdd}
                  getCurrentGroupName={getCurrentGroupName}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-lg font-medium text-gray-500 dark:text-gray-400">No se encontraron resultados</p>
              <p className="text-sm mt-1">Intente con otro término de búsqueda</p>
            </div>
          )}
        </div>

        {/* Footer with Finish button */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {recentAddedId && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2">
                <Check className="w-4 h-4" />
                Funcionario añadido correctamente
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors font-medium shadow-sm active:scale-95"
          >
            {addedCount > 0 ? 'Finalizar y Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
