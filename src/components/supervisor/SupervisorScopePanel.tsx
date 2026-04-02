import { RefreshCw, ShieldCheck, UserRoundX } from "lucide-react";

import { useSupervisorScope } from "../../context/SupervisorScopeContext";
import { SearchableSelect } from "../ui/SearchableSelect";

export function SupervisorScopePanel({ blocking = false }: { blocking?: boolean }) {
  const {
    isSupervisor,
    loadingUsers,
    refreshUsers,
    selectedUser,
    selectedUserId,
    setSelectedUserId,
    users,
    usersError,
  } = useSupervisorScope();

  if (!isSupervisor) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-base font-semibold">Supervisión por usuario</h2>
          </div>
          <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
            {blocking
              ? "Selecciona el usuario supervisado para acotar Funcionarios, Programación, Programados, No Programados y Grupos."
              : "Puedes seleccionar un usuario supervisado para acotar la vista. Si no seleccionas ninguno, verás el consolidado general completo."}
          </p>
          {selectedUser ? (
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Contexto activo: {selectedUser.name} · {selectedUser.email}
            </p>
          ) : (
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {blocking ? "No hay un usuario supervisado seleccionado." : "Vista general sin filtro por usuario."}
            </p>
          )}
        </div>

        <div className="flex w-full max-w-xl flex-col gap-3 lg:items-end">
          <div className="flex w-full gap-3">
            <SearchableSelect
              options={users}
              value={selectedUserId}
              onChange={(value) => setSelectedUserId(Number(value))}
              getLabel={(item) => `${item.name} · ${item.email}`}
              getValue={(item) => item.id}
              placeholder={loadingUsers ? "Cargando usuarios..." : "Seleccionar usuario supervisado"}
              searchPlaceholder="Buscar usuario supervisado..."
              notFoundText="No hay usuarios disponibles"
              disabled={loadingUsers}
              className="flex-1"
            />

            <button
              type="button"
              onClick={() => void refreshUsers()}
              className="inline-flex items-center justify-center rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-2 text-amber-700 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 transition-colors"
              aria-label="Recargar usuarios supervisados"
            >
              <RefreshCw className={`h-4 w-4 ${loadingUsers ? "animate-spin" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              disabled={selectedUserId === null}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              Limpiar
            </button>
          </div>

          {usersError && <p className="text-sm text-red-700 dark:text-red-300">{usersError}</p>}
        </div>
      </div>

      {blocking && !selectedUser && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-white/70 dark:bg-gray-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          <UserRoundX className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Antes de consultar datos, selecciona un usuario supervisado. Esta vista permanece en SOLO LECTURA.</p>
        </div>
      )}
    </section>
  );
}
