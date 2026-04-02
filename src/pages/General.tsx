import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, TableProperties } from "lucide-react";

import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { GeneralToolbar } from "../components/general/GeneralToolbar";
import { ProgrammingModal } from "../components/programacion/ProgrammingModal";
import { SupervisorScopePanel } from "../components/supervisor/SupervisorScopePanel";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import type { Funcionario } from "../context/OfficialsContextDefs";
import { usePeriods } from "../context/PeriodsContext";
import { useSupervisorScope } from "../context/SupervisorScopeContext";
import { fetchWithAuth, parseErrorDetail } from "../lib/api";

interface GeneralRow {
  funcionario_id: number;
  funcionario: string;
  rut: string;
  title: string;
  law_code: string;
  specialty_sis: string;
  hours_per_week: string;
  status: string;
  user_id: number | null;
  user_ids: number[];
  user_name: string;
  is_scheduled: boolean;
  programmed_label: string;
  contracts: {
    id: number;
    law_code: string;
    hours: number;
    observations: string;
  }[];
}

function getStatusBadgeClass(status: string) {
  return status.toLowerCase() === "activo"
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
    : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
}

function getProgrammedBadgeClass(programmed: boolean) {
  return programmed
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
}

function formatStatusLabel(status: string) {
  if (!status) return "-";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getAvatarColor(seed: string) {
  const colors = [
    "bg-blue-600",
    "bg-emerald-500",
    "bg-indigo-500",
    "bg-cyan-500",
    "bg-violet-500",
    "bg-teal-500",
  ];

  const index = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function General() {
  const { user } = useAuth();
  const { selectedPeriod } = usePeriods();
  const { isSupervisor, selectedUser, selectedUserId } = useSupervisorScope();
  const [rows, setRows] = useState<GeneralRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [titleFilter, setTitleFilter] = useState("");
  const [lawFilter, setLawFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [programmedFilter, setProgrammedFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfficial, setSelectedOfficial] = useState<Funcionario | null>(null);

  const fetchRows = async () => {
    if (!user || !selectedPeriod) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        period_id: selectedPeriod.id.toString(),
      });

      if (isSupervisor && selectedUserId) {
        queryParams.append("user_id", selectedUserId.toString());
      }

      const response = await fetchWithAuth(`/general?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, "No se pudo cargar la vista General."));
      }

      const data: GeneralRow[] = await response.json();
      setRows(data);
    } catch (fetchError) {
      console.error("Error fetching General rows:", fetchError);
      setRows([]);
      setError(fetchError instanceof Error ? fetchError.message : "No se pudo cargar la vista General.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();
  }, [user, selectedPeriod, isSupervisor, selectedUserId]);

  const hasAdvancedFilters = Boolean(
    titleFilter.trim() ||
      lawFilter.trim() ||
      specialtyFilter.trim() ||
      userFilter.trim() ||
      statusFilter !== "todos" ||
      programmedFilter !== "todos"
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const normalizedTitle = titleFilter.trim().toLowerCase();
    const normalizedLaw = lawFilter.trim().toLowerCase();
    const normalizedSpecialty = specialtyFilter.trim().toLowerCase();
    const normalizedUser = userFilter.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesSearch =
        !normalizedQuery ||
        [
          row.funcionario,
          row.title,
          row.law_code,
          row.specialty_sis,
          row.status,
          row.user_name,
          row.programmed_label,
        ].some((value) => value.toLowerCase().includes(normalizedQuery));

      const matchesTitle = !normalizedTitle || row.title.toLowerCase().includes(normalizedTitle);
      const matchesLaw = !normalizedLaw || row.law_code.toLowerCase().includes(normalizedLaw);
      const matchesSpecialty = !normalizedSpecialty || row.specialty_sis.toLowerCase().includes(normalizedSpecialty);
      const matchesUser = !normalizedUser || row.user_name.toLowerCase().includes(normalizedUser);
      const matchesStatus = statusFilter === "todos" || row.status.toLowerCase() === statusFilter;
      const matchesProgrammed =
        programmedFilter === "todos" ||
        (programmedFilter === "programado" && row.is_scheduled) ||
        (programmedFilter === "no-programado" && !row.is_scheduled);

      return matchesSearch && matchesTitle && matchesLaw && matchesSpecialty && matchesUser && matchesStatus && matchesProgrammed;
    });
  }, [rows, searchQuery, titleFilter, lawFilter, specialtyFilter, userFilter, statusFilter, programmedFilter]);

  const clearAdvancedFilters = () => {
    setTitleFilter("");
    setLawFilter("");
    setSpecialtyFilter("");
    setUserFilter("");
    setStatusFilter("todos");
    setProgrammedFilter("todos");
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, titleFilter, lawFilter, specialtyFilter, userFilter, statusFilter, programmedFilter, rows.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = filteredRows.slice(startIndex, endIndex);
  const visibleStart = filteredRows.length === 0 ? 0 : startIndex + 1;
  const visibleEnd = filteredRows.length === 0 ? 0 : Math.min(endIndex, filteredRows.length);

  const buildOfficialFromRow = (row: GeneralRow): Funcionario => ({
    id: row.funcionario_id,
    name: row.funcionario,
    title: row.title,
    rut: row.rut,
    law: row.law_code,
    hours: row.hours_per_week,
    initial: getInitials(row.funcionario),
    color: getAvatarColor(`${row.user_ids.join("-")}-${row.funcionario}`),
    isScheduled: row.is_scheduled,
    groupId: 0,
    sisSpecialty: row.specialty_sis,
    lunchTime: "0 min",
    status: row.status,
    holidayDays: 0,
    administrativeDays: 0,
    congressDays: 0,
    breastfeedingTime: 0,
    lastUpdated: "-",
    observations: "",
    contracts: row.contracts ?? [],
  });

  const handleNextOfficial = () => {
    if (!selectedOfficial) return;

    const currentIndex = filteredRows.findIndex((row) => row.funcionario_id === selectedOfficial.id);
    if (currentIndex === -1) {
      setSelectedOfficial(null);
      return;
    }

    const nextRow = filteredRows[currentIndex + 1];
    if (!nextRow) {
      setSelectedOfficial(null);
      return;
    }

    setSelectedOfficial(buildOfficialFromRow(nextRow));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="General"
        subtitle={isSupervisor && selectedUser ? `${selectedPeriod?.name ?? "Período actual"} · ${selectedUser.name}` : `${selectedPeriod?.name ?? "Período actual"} · Vista consolidada por usuario`}
      >
        <ContextualHelpButton slug="general" />
        <button
          type="button"
          onClick={() => void fetchRows()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </button>
      </PageHeader>

      <SupervisorScopePanel />

      <>
          {error ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
            <GeneralToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              showFilters={showFilters}
              onToggleFilters={() => setShowFilters((current) => !current)}
              hasActiveFilters={showFilters || hasAdvancedFilters}
              titleFilter={titleFilter}
              onTitleFilterChange={setTitleFilter}
              lawFilter={lawFilter}
              onLawFilterChange={setLawFilter}
              specialtyFilter={specialtyFilter}
              onSpecialtyFilterChange={setSpecialtyFilter}
              userFilter={userFilter}
              onUserFilterChange={setUserFilter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              programmedFilter={programmedFilter}
              onProgrammedFilterChange={setProgrammedFilter}
              filteredCount={filteredRows.length}
              onClearFilters={clearAdvancedFilters}
            />

            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left table-fixed">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium transition-colors">
                  <tr>
                    <th className="px-4 py-3 w-[24%]">Funcionario</th>
                    <th className="px-4 py-3 w-[16%]">Título</th>
                    <th className="px-4 py-3 w-[8%]">Ley</th>
                    <th className="px-4 py-3 w-[14%]">Especialidad SIS</th>
                    <th className="px-4 py-3 w-[11%]">Hrs/Sem</th>
                    <th className="px-4 py-3 w-[8%]">Estado</th>
                    <th className="px-4 py-3 w-[13%]">Usuario</th>
                    <th className="px-4 py-3 w-[10%]">Programado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        Cargando consolidado general...
                      </td>
                    </tr>
                  ) : currentRows.length > 0 ? (
                    currentRows.map((row) => (
                      <tr key={`${row.user_id}-${row.funcionario}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${getAvatarColor(`${row.user_id}-${row.funcionario}`)}`}>
                              {getInitials(row.funcionario)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => setSelectedOfficial(buildOfficialFromRow(row))}
                                className="font-medium text-gray-900 dark:text-white truncate text-left hover:text-primary dark:hover:text-blue-400 transition-colors"
                                title={`Ver programación de ${row.funcionario}`}
                              >
                                {row.funcionario}
                              </button>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={row.user_name}>
                                {row.user_name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium block w-fit max-w-full truncate bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" title={row.title}>
                            {row.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-medium truncate" title={row.law_code || "-"}>{row.law_code || "-"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate" title={row.specialty_sis || "Sin especialidad"}>{row.specialty_sis || "Sin especialidad"}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 truncate" title={row.hours_per_week}>{row.hours_per_week}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row.status)}`}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 truncate" title={row.user_name}>{row.user_name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getProgrammedBadgeClass(row.is_scheduled)}`}>
                            {row.programmed_label}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <TableProperties className="h-5 w-5" />
                          <span>{hasAdvancedFilters || searchQuery.trim() ? "No hay registros que coincidan con la búsqueda y filtros aplicados." : "No hay registros para mostrar en General."}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando {visibleStart} a {visibleEnd} de {filteredRows.length} registros
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={itemsPerPage}
                  onChange={(event) => {
                    setItemsPerPage(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                  aria-label="Registros por página"
                >
                  <option value={100}>100 por pág.</option>
                  <option value={250}>250 por pág.</option>
                  <option value={500}>500 por pág.</option>
                </select>

                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={safeCurrentPage === 1}
                  className={`p-2 rounded-lg border ${
                    safeCurrentPage === 1
                      ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  } transition-colors`}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">
                  Página {safeCurrentPage} de {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className={`p-2 rounded-lg border ${
                    safeCurrentPage === totalPages
                      ? "border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                      : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  } transition-colors`}
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
      </>

      {selectedOfficial && (
        <ProgrammingModal
          funcionario={selectedOfficial}
          onClose={() => setSelectedOfficial(null)}
          onNext={handleNextOfficial}
        />
      )}
    </div>
  );
}

export default General;
