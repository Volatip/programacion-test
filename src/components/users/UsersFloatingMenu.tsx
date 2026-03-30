import { Edit2, Trash2 } from "lucide-react";

interface User {
  id: number;
  name: string;
  rut: string;
  email: string;
  role: string;
  status: string;
  last_access?: string;
}

interface UsersFloatingMenuProps {
  openMenuId: number | null;
  menuPosition: { top: number; left: number };
  users: User[];
  onClose: () => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (id: number) => void;
}

export function UsersFloatingMenu({
  openMenuId,
  menuPosition,
  users,
  onClose,
  onEditUser,
  onDeleteUser,
}: UsersFloatingMenuProps) {
  if (openMenuId === null) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div
        className="absolute z-20 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 transition-colors"
        style={{ top: menuPosition.top, left: menuPosition.left }}
      >
        <button
          onClick={() => {
            const user = users.find((u) => u.id === openMenuId);
            if (user) {
              onEditUser(user);
            }
          }}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
          Editar
        </button>
        <button
          onClick={() => onDeleteUser(openMenuId)}
          className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar
        </button>
      </div>
    </>
  );
}
