import type { Funcionario } from "../../context/OfficialsContextDefs";

interface FuncionariosTableProps {
  officials: Funcionario[];
  isReadOnly: boolean;
  canManageOfficials: boolean;
  getContractHoursDisplay: (func: Funcionario) => string;
  onActivate: (id: number) => void;
  onDelete: (id: number) => void;
}

export function FuncionariosTable({
  officials,
  isReadOnly,
  canManageOfficials,
  getContractHoursDisplay,
  onActivate,
  onDelete,
}: FuncionariosTableProps) {
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
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm text-left table-fixed">
        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium transition-colors">
          <tr>
            <th className="px-4 py-3 w-[23%]">Funcionario</th>
            <th className="px-4 py-3 w-[14%]">Título</th>
            <th className="px-4 py-3 w-[8%]">Ley</th>
            <th className="px-4 py-3 w-[11%]">Especialidad SIS</th>
            <th className="px-4 py-3 w-[13%] min-w-[150px]">Hrs/Sem</th>
            <th className="px-4 py-3 w-[7%]">Estado</th>
            <th className="px-4 py-3 w-[7%]">Colación</th>
            <th className="px-4 py-3 w-[9%]">Fecha RRHH</th>
            <th className="px-4 py-3 w-[10%] text-center">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
          {officials.map((func) => (
            <tr key={func.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${func.color} shrink-0`}>
                    {func.initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 dark:text-white truncate" title={func.name}>
                      {func.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{func.rut}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium block w-fit max-w-full truncate ${
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
                  {func.title}
                </span>
              </td>
              <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-medium truncate" title={func.law}>
                {func.law}
              </td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate" title={func.sisSpecialty}>
                {func.sisSpecialty}
              </td>
              <td
                className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate"
                title={String(getContractHoursDisplay(func))}
              >
                {getContractHoursDisplay(func)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border block w-fit ${
                    func.status === "inactivo"
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600"
                      : func.status === "Comisión de Servicio" ||
                          func.status === "Permiso sin Goce" ||
                          func.status === "Comisión de Estudio"
                        ? "bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                        : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                  }`}
                >
                  {func.status === "inactivo" ? "Inactivo" : func.status === "activo" ? "Activo" : func.status}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 truncate" title={func.lunchTime}>
                {func.lunchTime}
              </td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                {func.lastUpdated}
              </td>
              <td className="px-4 py-3 text-center relative w-[10%]">
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
                      <button
                        onClick={() => onDelete(func.id)}
                        className="px-4 py-2 bg-[#dc3545] text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap"
                        title="Eliminar funcionario"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
