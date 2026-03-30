import { Plus, Search } from "lucide-react";

interface UsersToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onAddUser: () => void;
}

export function UsersToolbar({
  searchQuery,
  onSearchQueryChange,
  onAddUser,
}: UsersToolbarProps) {
  return (
    <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, correo o RUT..."
          aria-label="Buscar usuarios"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
        />
      </div>
      <button
        onClick={onAddUser}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
        title="Crear nuevo usuario"
      >
        <Plus className="w-4 h-4" />
        Nuevo Usuario
      </button>
    </div>
  );
}
