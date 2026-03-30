import { LogOut } from "lucide-react";
import type { User } from "../../context/AuthContext";
import { getRoleLabel } from "../../lib/userRoles";

interface HeaderUserMenuProps {
  logout: () => void;
  setShowProfileMenu: React.Dispatch<React.SetStateAction<boolean>>;
  showProfileMenu: boolean;
  user: User | null;
}

export function HeaderUserMenu({
  logout,
  setShowProfileMenu,
  showProfileMenu,
  user,
}: HeaderUserMenuProps) {
  return (
    <div className="relative">
      <button
        className="flex items-center gap-3 pl-6 border-l border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors group"
        onClick={() => setShowProfileMenu(!showProfileMenu)}
      >
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{user?.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{getRoleLabel(user?.role)}</p>
        </div>
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-medium shadow-sm group-hover:shadow-md transition-all ring-2 ring-transparent group-hover:ring-indigo-100 dark:group-hover:ring-indigo-900">
          {user?.initials}
        </div>
      </button>

      {showProfileMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowProfileMenu(false)}
          />
          <div className="absolute right-0 top-14 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-2 bg-gray-50/50 dark:bg-gray-700/30">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mi Cuenta</p>
            </div>

            <button
              onClick={() => {
                logout();
                setShowProfileMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar SesiÃ³n
            </button>
          </div>
        </>
      )}
    </div>
  );
}
