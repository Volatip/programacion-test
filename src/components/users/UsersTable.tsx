import { MoreVertical } from "lucide-react";

import { SortableHeader } from "../ui/SortableHeader";
import { ResponsiveTable } from "../ui/ResponsiveTable";
import type { SortState } from "../../lib/tableSorting";

interface User {
  id: number;
  name: string;
  rut: string;
  email: string;
  role: string;
  status: string;
  last_access?: string;
}

interface UsersTableProps {
  users: User[];
  roleLabels: Record<string, string>;
  roleColors: Record<string, string>;
  formatDate: (dateString?: string) => string;
  getInitials: (name: string) => string;
  getRandomColor: (id: number) => string;
  buttonRefs: React.MutableRefObject<{ [key: number]: HTMLButtonElement | null }>;
  onToggleMenu: (id: number) => void;
  sortState: SortState<UsersSortColumn>;
  onSortChange: (column: UsersSortColumn) => void;
}

export type UsersSortColumn = "name" | "rut" | "email" | "role" | "status" | "last_access";

export function UsersTable({
  users,
  roleLabels,
  roleColors,
  formatDate,
  getInitials,
  getRandomColor,
  buttonRefs,
  onToggleMenu,
  sortState,
  onSortChange,
}: UsersTableProps) {
  return (
    <ResponsiveTable minWidthClassName="min-w-[860px]" tableClassName="text-left text-sm table-fixed">
        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium">
          <tr>
            <SortableHeader
              label="Usuario"
              className="w-[27rem] px-4 py-3 xl:px-6"
              isActive={sortState.column === "name"}
              direction={sortState.direction}
              onClick={() => onSortChange("name")}
            />
            <SortableHeader
              label="Rol"
              className="w-[14rem] px-4 py-3 xl:px-6"
              isActive={sortState.column === "role"}
              direction={sortState.direction}
              onClick={() => onSortChange("role")}
            />
            <SortableHeader
              label="Estado"
              className="w-[9rem] px-4 py-3 xl:px-6"
              isActive={sortState.column === "status"}
              direction={sortState.direction}
              onClick={() => onSortChange("status")}
            />
            <SortableHeader
              label="Último acceso"
              className="w-[10rem] px-4 py-3 xl:px-6"
              isActive={sortState.column === "last_access"}
              direction={sortState.direction}
              onClick={() => onSortChange("last_access")}
            />
            <th className="w-[6rem] px-4 py-3 xl:px-6">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {users.length === 0 ? (
            <tr>
                <td colSpan={5} className="px-4 py-10 text-center xl:px-6">
                <div className="text-gray-500 dark:text-gray-400">
                  <p className="font-medium text-gray-700 dark:text-gray-300">No se encontraron usuarios</p>
                  <p className="mt-1 text-sm">Prueba con otra búsqueda o crea uno nuevo.</p>
                </div>
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-4 xl:px-6">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getRandomColor(user.id)}`}
                    >
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {user.name}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                          <span className="truncate">{user.rut}</span>
                        </span>
                        <span className="inline-flex max-w-full items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          <span className="truncate">{user.email}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 xl:px-6">
                  <span
                    className={`inline-flex max-w-full whitespace-normal break-words px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      roleColors[user.role] || "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td className="px-4 py-4 xl:px-6">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        user.status === "activo" ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        user.status === "activo"
                          ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {user.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-500 dark:text-gray-400 xl:px-6">
                  {formatDate(user.last_access)}
                </td>
                <td className="px-4 py-4 xl:px-6">
                  <button
                    ref={(el) => {
                      buttonRefs.current[user.id] = el;
                    }}
                    onClick={() => onToggleMenu(user.id)}
                    aria-label={`Acciones para ${user.name}`}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
    </ResponsiveTable>
  );
}
