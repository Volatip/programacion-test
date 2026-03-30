import { Bell, Edit2, X } from "lucide-react";

interface HeaderInfoBarProps {
  infoText: string;
  isAdmin: boolean;
  isInfoVisible: boolean;
  openEditModal: () => void;
  toggleInfoVisibility: () => void;
}

export function HeaderInfoBar({
  infoText,
  isAdmin,
  isInfoVisible,
  openEditModal,
  toggleInfoVisibility,
}: HeaderInfoBarProps) {
  return (
    <div className="flex-1 mr-8 relative group">
      {isInfoVisible ? (
        <div className="inline-flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-lg border border-blue-100 dark:border-blue-800 transition-all duration-300">
          <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-200 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-xl">
            {infoText}
          </p>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2 border-l border-blue-200 dark:border-blue-700 pl-2">
            {isAdmin && (
              <button
                onClick={openEditModal}
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400"
                title="Editar mensaje"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={toggleInfoVisibility}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded text-blue-600 dark:text-blue-400"
              title="Ocultar mensaje"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        isAdmin && (
          <button
            onClick={toggleInfoVisibility}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-1 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 rounded-md"
          >
            <Bell className="w-3 h-3" />
            Mostrar barra informativa
          </button>
        )
      )}
    </div>
  );
}
