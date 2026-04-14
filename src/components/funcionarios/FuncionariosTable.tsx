import type { Funcionario } from "../../context/OfficialsContextDefs";
import { SortableHeader } from "../ui/SortableHeader";
import { ResponsiveTable } from "../ui/ResponsiveTable";
import type { SortState } from "../../lib/tableSorting";

export type FuncionariosSortColumn =
  | "name"
  | "title"
  | "law"
  | "sisSpecialty"
  | "hours"
  | "status"
  | "inactiveReason"
  | "terminationDate"
  | "lunchTime"
  | "lastUpdated";

interface FuncionariosTableProps {
  officials: Funcionario[];
  statusFilter: string;
  isReadOnly: boolean;
  canManageOfficials: boolean;
  getContractHoursDisplay: (func: Funcionario) => string;
  sortState: SortState<FuncionariosSortColumn>;
  onSortChange: (column: FuncionariosSortColumn) => void;
  onActivate: (id: number) => void;
  onClearFutureDismiss: (id: number) => void;
  onClearPartialCommission: (id: number) => void;
  onDelete: (id: number) => void;
}

export function FuncionariosTable({
  officials,
  statusFilter,
  isReadOnly,
  canManageOfficials,
  getContractHoursDisplay,
  sortState,
  onSortChange,
  onActivate,
  onClearFutureDismiss,
  onClearPartialCommission,
  onDelete,
}: FuncionariosTableProps) {
  const showReasonColumn = statusFilter !== "activo";
  const showTerminationDateColumn = statusFilter !== "activo";
  const showHrDateColumn = statusFilter !== "inactivo";

  const getInactiveReasonStyles = (reason?: string) => {
    if (reason === "Renuncia") {
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800";
    }

    if (
      reason === "Cambio de servicio" ||
      reason === "Comisión de Servicio" ||
      reason === "Permiso sin Goce" ||
      reason === "Comisión de Estudio"
    ) {
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800";
    }

    return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700";
  };

  const isPartialCommissionActive = (func: Funcionario) => func.status === "activo" && func.activeStatusLabel === "Comisión de Servicio - Parcial";
  const hasFutureDismissScheduled = (func: Funcionario) => func.status === "activo" && func.hasFutureDismissScheduled === true;

  if (officials.length === 0) {
    return (
      <div className="px-6 py-16 text-center border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          No hay funcionarios para mostrar
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Ajusta la búsqueda o los filtros para ver resultados.
        </p>
      </div>
    );
  }

  return (
    <ResponsiveTable
      minWidthClassName={showReasonColumn && showHrDateColumn ? "min-w-[1160px]" : showReasonColumn ? "min-w-[1080px]" : "min-w-[1020px]"}
      tableClassName={`text-left text-sm ${showReasonColumn ? "table-fixed" : "table-auto"}`}
    >
        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium transition-colors">
          <tr>
            <SortableHeader
              label="Funcionario"
              className={`px-3 py-3 xl:px-4 ${showReasonColumn ? "w-[26rem]" : "w-[27rem]"}`}
              isActive={sortState.column === "name"}
              direction={sortState.direction}
              onClick={() => onSortChange("name")}
            />
            <SortableHeader
              label="Especialidad SIS"
              className={`px-3 py-3 xl:px-4 ${showReasonColumn ? "w-[11rem]" : "w-[12rem]"}`}
              isActive={sortState.column === "sisSpecialty"}
              direction={sortState.direction}
              onClick={() => onSortChange("sisSpecialty")}
            />
            <SortableHeader
              label="Hrs/Sem"
              className="w-[7rem] px-3 py-3 xl:px-4"
              isActive={sortState.column === "hours"}
              direction={sortState.direction}
              onClick={() => onSortChange("hours")}
            />
            <SortableHeader
              label="Estado"
              className="w-[7rem] px-3 py-3 xl:px-4"
              isActive={sortState.column === "status"}
              direction={sortState.direction}
              onClick={() => onSortChange("status")}
            />
            {showReasonColumn && (
              <SortableHeader
                label="Motivo"
                className="w-[11rem] px-3 py-3 xl:px-4"
                isActive={sortState.column === "inactiveReason"}
                direction={sortState.direction}
                onClick={() => onSortChange("inactiveReason")}
              />
            )}
            <SortableHeader
              label="Colación"
              className="w-[6.5rem] whitespace-nowrap px-3 py-3 xl:px-4"
              isActive={sortState.column === "lunchTime"}
              direction={sortState.direction}
              onClick={() => onSortChange("lunchTime")}
            />
            {showHrDateColumn && (
              <SortableHeader
                label="Fecha RRHH"
                className="w-[7.5rem] whitespace-nowrap px-3 py-3 xl:px-4"
                isActive={sortState.column === "lastUpdated"}
                direction={sortState.direction}
                onClick={() => onSortChange("lastUpdated")}
              />
            )}
            {showTerminationDateColumn && (
              <SortableHeader
                label="Fecha Término"
                className="w-[8.5rem] whitespace-nowrap px-3 py-3 xl:px-4"
                isActive={sortState.column === "terminationDate"}
                direction={sortState.direction}
                onClick={() => onSortChange("terminationDate")}
              />
            )}
            <th className="w-[12rem] px-3 py-3 text-center xl:px-4">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
          {officials.map((func) => (
            <tr key={func.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-3 py-3 xl:px-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${func.color} shrink-0`}>
                    {func.initial}
                  </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white" title={func.name}>
                        {func.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                          <span className="truncate">{func.rut}</span>
                        </span>
                        <span
                          className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            func.title === "Médico"
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                              : func.title === "Enfermera"
                                ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                                : func.title === "Matrona"
                                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                          title={func.title}
                        >
                          <span className="truncate">{func.title}</span>
                        </span>
                        <span
                          className="inline-flex max-w-full items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300"
                          title={func.law}
                        >
                          <span className="truncate">{func.law}</span>
                        </span>
                      </div>
                     </div>
                   </div>
                 </td>
              <td className="px-3 py-3 text-gray-600 dark:text-gray-300 xl:px-4" title={func.sisSpecialty}>
                <div className={`truncate ${showReasonColumn ? "max-w-[180px]" : "max-w-[160px]"}`}>
                  {func.sisSpecialty}
                </div>
              </td>
              <td
                className="px-3 py-3 text-gray-600 dark:text-gray-300 truncate xl:px-4"
                title={String(getContractHoursDisplay(func))}
              >
                {getContractHoursDisplay(func)}
              </td>
              <td className="px-3 py-3 xl:px-4">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border block w-fit ${
                    func.status === "inactivo"
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                      : isPartialCommissionActive(func)
                        ? "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800"
                      : func.status === "Comisión de Servicio" ||
                          func.status === "Permiso sin Goce" ||
                          func.status === "Comisión de Estudio"
                        ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                        : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                  }`}
                  title={isPartialCommissionActive(func) ? func.activeStatusLabel : undefined}
                >
                  {func.status === "inactivo" ? "Inactivo" : func.status === "activo" ? "Activo" : func.status}
                </span>
              </td>
              {showReasonColumn && (
                <td className="px-3 py-3 xl:px-4">
                  {func.status === "inactivo" && func.inactiveReason ? (
                    <span
                      className={`inline-flex max-w-full items-center rounded-full border px-3 py-1 text-xs font-medium ${getInactiveReasonStyles(func.inactiveReason)}`}
                      title={`Motivo de inactividad: ${func.inactiveReason}`}
                    >
                      <span className="truncate">{func.inactiveReason}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
              )}
              <td className="px-3 py-3 text-gray-500 dark:text-gray-400 truncate xl:px-4" title={func.lunchTime}>
                {func.lunchTime}
              </td>
              {showHrDateColumn && (
                <td className="px-3 py-3 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400 xl:px-4">
                  {func.lastUpdated}
                </td>
              )}
              {showTerminationDateColumn && (
                <td className="px-3 py-3 text-xs whitespace-nowrap text-gray-500 dark:text-gray-400 xl:px-4">
                  {func.terminationDate ?? "—"}
                </td>
              )}
              <td className="relative px-3 py-3 text-center xl:px-4">
                {!isReadOnly && canManageOfficials && (
                  <div className="flex items-center justify-center gap-2">
                    {func.status === "inactivo" ? (
                      <button
                        onClick={() => onActivate(func.id)}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors shadow-sm whitespace-nowrap"
                        title="Reactivar funcionario"
                      >
                        Reactivar
                      </button>
                    ) : (
                      <>
                        {isPartialCommissionActive(func) && (
                          <button
                            onClick={() => onClearPartialCommission(func.id)}
                            className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-md hover:bg-sky-700 transition-colors shadow-sm whitespace-nowrap"
                            title="Quitar comisión parcial"
                          >
                            Sin comisión
                          </button>
                        )}
                        {hasFutureDismissScheduled(func) && (
                          <button
                            onClick={() => onClearFutureDismiss(func.id)}
                            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-md hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
                            title="Quitar baja futura"
                          >
                            Quitar baja futura
                          </button>
                        )}
                        <button
                          onClick={() => onDelete(func.id)}
                          className="px-4 py-2 bg-[#dc3545] text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
                          title="Eliminar funcionario"
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
    </ResponsiveTable>
  );
}
