import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, RefreshCw, TableProperties } from "lucide-react";

import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { GeneralToolbar } from "../components/general/GeneralToolbar";
import { ProgrammingModal } from "../components/programacion/ProgrammingModal";
import { SupervisorScopePanel } from "../components/supervisor/SupervisorScopePanel";
import { PageHeader } from "../components/ui/PageHeader";
import { ResponsiveTable } from "../components/ui/ResponsiveTable";
import { SortableHeader } from "../components/ui/SortableHeader";
import { useAuth } from "../context/AuthContext";
import type { Funcionario } from "../context/OfficialsContextDefs";
import { usePeriods } from "../context/PeriodsContext";
import { useSupervisorScope } from "../context/SupervisorScopeContext";
import { fetchWithAuth, parseErrorDetail } from "../lib/api";
import { matchesNameTokens, normalizeRutSearch, normalizeSearchText } from "../lib/officialSearch";
import { compareLawValues, compareSummedNumberValues, sortItems, toggleSort, type SortState } from "../lib/tableSorting";
import { compareReviewValues, formatReviewDate, formatReviewMeta, formatReviewStatus, getReviewBadgeClass, getReviewFilterValue, type ProgrammingReviewSnapshot, type ProgrammingReviewStatus } from "../lib/programmingReview";

interface GeneralRow {
  funcionario_id: number;
  funcionario: string;
  rut: string;
  dv?: string | null;
  title: string;
  law_code: string;
  specialty_sis: string;
  hours_per_week: string;
  lunch_time_minutes?: number;
  status: string;
  user_id: number | null;
  user_ids: number[];
  user_name: string;
  is_scheduled: boolean;
  programmed_label: string;
  review_status?: ProgrammingReviewStatus;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  contracts: {
    id: number;
    law_code: string;
    hours: number;
    observations: string;
  }[];
}

type GeneralSortColumn =
  | "funcionario"
  | "title"
  | "law_code"
  | "specialty_sis"
  | "hours_per_week"
  | "status"
  | "user_name"
  | "programmed_label"
  | "review_status";

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

function formatRutWithDv(rut: string, dv?: string | null) {
  if (!rut) return "Sin RUT";
  return dv ? `${rut}-${dv}` : rut;
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
  const [reviewFilter, setReviewFilter] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [sortState, setSortState] = useState<SortState<GeneralSortColumn>>({
    column: "funcionario",
    direction: "asc",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfficial, setSelectedOfficial] = useState<Funcionario | null>(null);

  const fetchRows = useCallback(async () => {
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
  }, [isSupervisor, selectedPeriod, selectedUserId, user]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const hasAdvancedFilters = Boolean(
    titleFilter.trim() ||
      lawFilter.trim() ||
      specialtyFilter.trim() ||
      userFilter.trim() ||
      statusFilter !== "todos" ||
      programmedFilter !== "todos" ||
      reviewFilter !== "todos"
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const normalizedRutQuery = normalizeRutSearch(searchQuery.trim());
    const normalizedTitle = normalizeSearchText(titleFilter);
    const normalizedLaw = normalizeSearchText(lawFilter);
    const normalizedSpecialty = normalizeSearchText(specialtyFilter);
    const normalizedUser = normalizeSearchText(userFilter);

    return rows.filter((row) => {
      const matchesRut = Boolean(normalizedRutQuery) && normalizeRutSearch(formatRutWithDv(row.rut, row.dv)).includes(normalizedRutQuery);
      const matchesName = Boolean(normalizedQuery) && matchesNameTokens(row.funcionario, normalizedQuery);
      const matchesSearch =
        !normalizedQuery ||
        matchesRut ||
        matchesName ||
        [
          row.title,
          row.law_code,
          row.specialty_sis,
          row.status,
          row.user_name,
          row.programmed_label,
        ].some((value) => normalizeSearchText(value).includes(normalizedQuery));

      const matchesTitle = !normalizedTitle || normalizeSearchText(row.title).includes(normalizedTitle);
      const matchesLaw = !normalizedLaw || normalizeSearchText(row.law_code).includes(normalizedLaw);
      const matchesSpecialty = !normalizedSpecialty || normalizeSearchText(row.specialty_sis).includes(normalizedSpecialty);
      const matchesUser = !normalizedUser || normalizeSearchText(row.user_name).includes(normalizedUser);
      const matchesStatus = statusFilter === "todos" || row.status.toLowerCase() === statusFilter;
      const matchesProgrammed =
        programmedFilter === "todos" ||
        (programmedFilter === "programado" && row.is_scheduled) ||
        (programmedFilter === "no-programado" && !row.is_scheduled);
      const matchesReview = reviewFilter === "todos" || getReviewFilterValue(row.review_status) === reviewFilter;

      return matchesSearch && matchesTitle && matchesLaw && matchesSpecialty && matchesUser && matchesStatus && matchesProgrammed && matchesReview;
    });
  }, [rows, searchQuery, titleFilter, lawFilter, specialtyFilter, userFilter, statusFilter, programmedFilter, reviewFilter]);

  const clearAdvancedFilters = () => {
    setTitleFilter("");
    setLawFilter("");
    setSpecialtyFilter("");
    setUserFilter("");
    setStatusFilter("todos");
    setProgrammedFilter("todos");
    setReviewFilter("todos");
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, titleFilter, lawFilter, specialtyFilter, userFilter, statusFilter, programmedFilter, reviewFilter, rows.length]);

  const sortedRows = useMemo(
    () =>
      sortItems(filteredRows, sortState, {
        funcionario: {
          getValue: (row) => row.funcionario,
        },
        title: {
          getValue: (row) => row.title,
        },
        law_code: {
          getValue: (row) => row.law_code,
          compare: compareLawValues,
        },
        specialty_sis: {
          getValue: (row) => row.specialty_sis,
        },
        hours_per_week: {
          getValue: (row) => row.hours_per_week,
          compare: compareSummedNumberValues,
        },
        status: {
          getValue: (row) => formatStatusLabel(row.status),
        },
        user_name: {
          getValue: (row) => row.user_name,
        },
        programmed_label: {
          getValue: (row) => row.programmed_label,
        },
        review_status: {
          getValue: (row) => ({
            review_status: row.review_status,
            reviewed_at: row.reviewed_at,
            reviewed_by_name: row.reviewed_by_name,
          }),
          compare: (left, right) => compareReviewValues(left as ProgrammingReviewSnapshot, right as ProgrammingReviewSnapshot),
        },
      }),
    [filteredRows, sortState],
  );

  const handleReviewSaved = useCallback((funcionarioId: number, review: ProgrammingReviewSnapshot) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.funcionario_id === funcionarioId
          ? {
              ...row,
              review_status: review.review_status ?? null,
              reviewed_at: review.reviewed_at ?? null,
              reviewed_by_name: review.reviewed_by_name ?? null,
            }
          : row,
      ),
    );
  }, []);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = sortedRows.slice(startIndex, endIndex);
  const visibleStart = sortedRows.length === 0 ? 0 : startIndex + 1;
  const visibleEnd = sortedRows.length === 0 ? 0 : Math.min(endIndex, sortedRows.length);

  const buildOfficialFromRow = (row: GeneralRow): Funcionario => ({
    id: row.funcionario_id,
    name: row.funcionario,
    title: row.title,
    rut: formatRutWithDv(row.rut, row.dv),
    law: row.law_code,
    hours: row.hours_per_week,
    initial: getInitials(row.funcionario),
    color: getAvatarColor(`${row.user_ids.join("-")}-${row.funcionario}`),
    isScheduled: row.is_scheduled,
    groupId: 0,
    sisSpecialty: row.specialty_sis,
    lunchTime: `${row.lunch_time_minutes ?? 0} min`,
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
    const nextRow = selectedOfficialIndex !== -1 ? sortedRows[selectedOfficialIndex + 1] : undefined;
    if (!nextRow) {
      setSelectedOfficial(null);
      return;
    }

    setSelectedOfficial(buildOfficialFromRow(nextRow));
  };

  const selectedOfficialIndex = selectedOfficial
    ? sortedRows.findIndex((row) => row.funcionario_id === selectedOfficial.id)
    : -1;

  const hasPreviousOfficial = selectedOfficialIndex > 0;
  const hasNextOfficial = selectedOfficialIndex !== -1 && selectedOfficialIndex < sortedRows.length - 1;

  const handlePreviousOfficial = () => {
    if (!hasPreviousOfficial) return;

    setSelectedOfficial(buildOfficialFromRow(sortedRows[selectedOfficialIndex - 1]));
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
              reviewFilter={reviewFilter}
              onReviewFilterChange={setReviewFilter}
              filteredCount={filteredRows.length}
              onClearFilters={clearAdvancedFilters}
            />

            <ResponsiveTable minWidthClassName="min-w-[1100px]" tableClassName="table-fixed text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium transition-colors">
                  <tr>
                    <SortableHeader
                      label="Funcionario"
                      className="w-[24rem] px-3 py-3 xl:px-4"
                      isActive={sortState.column === "funcionario"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "funcionario"));
                      }}
                    />
                    <SortableHeader
                      label="Especialidad SIS"
                      className="w-[11rem] px-3 py-3 xl:px-4"
                      isActive={sortState.column === "specialty_sis"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "specialty_sis"));
                      }}
                    />
                    <SortableHeader
                      label="Hrs/Sem"
                      className="w-[7rem] px-3 py-3 xl:px-4"
                      isActive={sortState.column === "hours_per_week"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "hours_per_week"));
                      }}
                    />
                    <SortableHeader
                      label="Estado"
                      className="w-[5.5rem] px-3 py-3 xl:px-4"
                      isActive={sortState.column === "status"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "status"));
                      }}
                    />
                    <SortableHeader
                      label="Usuario"
                      className="w-[9rem] px-3 py-3 xl:px-4"
                      isActive={sortState.column === "user_name"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "user_name"));
                      }}
                    />
                    <SortableHeader
                      label="Programado"
                      className="w-[9rem] px-3 py-3 xl:px-4"
                      isActive={sortState.column === "programmed_label"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "programmed_label"));
                      }}
                    />
                    <SortableHeader
                      label="Revisión"
                      className="w-[12rem] px-3 py-3 text-center xl:px-4"
                      isActive={sortState.column === "review_status"}
                      direction={sortState.direction}
                      onClick={() => {
                        setCurrentPage(1);
                        setSortState((current) => toggleSort(current, "review_status"));
                      }}
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
                  {loading ? (
                    <tr>
                        <td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-gray-400 xl:px-4">
                        Cargando consolidado general...
                      </td>
                    </tr>
                  ) : currentRows.length > 0 ? (
                    currentRows.map((row) => (
                      <tr key={`${row.user_id}-${row.funcionario}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="max-w-[24rem] px-3 py-3 xl:px-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${getAvatarColor(`${row.user_id}-${row.funcionario}`)}`}>
                              {getInitials(row.funcionario)}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedOfficial(buildOfficialFromRow(row))}
                                className="block w-full truncate text-left text-sm font-semibold text-gray-900 hover:text-primary transition-colors dark:text-white dark:hover:text-blue-400"
                                title={`Ver programación de ${row.funcionario}`}
                              >
                                {row.funcionario}
                              </button>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex max-w-full items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400">
                                  <span className="truncate">{formatRutWithDv(row.rut, row.dv)}</span>
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300" title={row.title}>
                                  <span className="truncate">{row.title}</span>
                                </span>
                                <span className="inline-flex max-w-full items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-300" title={row.law_code || "-"}>
                                  <span className="truncate">{row.law_code || "-"}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-300 truncate xl:px-4" title={row.specialty_sis || "Sin especialidad"}>{row.specialty_sis || "Sin especialidad"}</td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-300 truncate xl:px-4" title={row.hours_per_week}>{row.hours_per_week}</td>
                        <td className="px-3 py-3 xl:px-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(row.status)}`}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 truncate xl:px-4" title={row.user_name}>{row.user_name}</td>
                        <td className="px-3 py-3 xl:px-4">
                          <span className={`inline-flex min-w-[8.5rem] justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${getProgrammedBadgeClass(row.is_scheduled)}`}>
                            {row.programmed_label}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-middle xl:px-4">
                          <div className="flex flex-col items-center justify-center gap-1 text-center">
                            <span className={`inline-flex min-w-[7.5rem] justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${getReviewBadgeClass(row.review_status)}`}>
                              {formatReviewStatus(row.review_status)}
                            </span>
                            <span className="max-w-[10rem] text-[11px] leading-4 text-gray-500 dark:text-gray-400" title={formatReviewMeta(row.reviewed_by_name, row.reviewed_at)}>
                              {row.reviewed_by_name ? <span className="block break-words font-medium">{row.reviewed_by_name}</span> : null}
                              <span className="block break-words">{formatReviewDate(row.reviewed_at) ?? "Pendiente"}</span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                        <td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-500 dark:text-gray-400 xl:px-4">
                        <div className="flex flex-col items-center gap-2">
                          <TableProperties className="h-5 w-5" />
                          <span>{hasAdvancedFilters || searchQuery.trim() ? "No hay registros que coincidan con la búsqueda y filtros aplicados." : "No hay registros para mostrar en General."}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
            </ResponsiveTable>

            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                 Mostrando {visibleStart} a {visibleEnd} de {sortedRows.length} registros
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
          onPrevious={hasPreviousOfficial ? handlePreviousOfficial : undefined}
          onNext={hasNextOfficial ? handleNextOfficial : undefined}
          onReviewSaved={(review) => handleReviewSaved(selectedOfficial.id, review)}
        />
      )}
    </div>
  );
}

export default General;
