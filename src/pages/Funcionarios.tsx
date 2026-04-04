import { useState, useEffect } from "react";
import { useOfficials, Funcionario } from "../context/OfficialsContext";
import { usePeriods } from "../context/PeriodsContext";
import { PageHeader } from "../components/ui/PageHeader";
import { ToastType } from "../components/ui/Toast";
import { FuncionariosModals } from "../components/funcionarios/FuncionariosModals";
import { FuncionariosPagination } from "../components/funcionarios/FuncionariosPagination";
import { FuncionariosTable } from "../components/funcionarios/FuncionariosTable";
import { FuncionariosToolbar } from "../components/funcionarios/FuncionariosToolbar";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { useAuth } from "../context/AuthContext";
import { dismissReasonsApi, type DismissReason } from "../lib/dismissReasons";
import { isSupervisorRole } from "../lib/userRoles";
import { useSupervisorScope } from "../context/SupervisorScopeContext";
import { SupervisorScopePanel } from "../components/supervisor/SupervisorScopePanel";

// Helper to normalize RUT input for search
// Removes dots but keeps hyphen and other characters to allow user typing
const normalizeRutInput = (value: string) => {
  return value.replace(/\./g, '');
};

export function Funcionarios() {
  const { user } = useAuth();
  const { isSupervisor, isScopeReady } = useSupervisorScope();
  const { officials, addOfficial, removeOfficial, activateOfficial, searchOfficials } = useOfficials();
  const { isReadOnly } = usePeriods();
  const canManageOfficials = !isSupervisorRole(user?.role);
  const isReadOnlyView = isReadOnly || !canManageOfficials;
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [titleFilter, setTitleFilter] = useState("");
  const [lawFilter, setLawFilter] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [hoursFilter, setHoursFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("activo"); // Default to activo

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  
  // Add Official Modal State
  const [isAddOfficialModalOpen, setIsAddOfficialModalOpen] = useState(false);
  const [addOfficialSearchQuery, setAddOfficialSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Funcionario[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Delete / Dismiss Modal State
  const [isDismissModalOpen, setIsDismissModalOpen] = useState(false);
  const [selectedOfficialId, setSelectedOfficialId] = useState<number | null>(null);
  const [dismissReasons, setDismissReasons] = useState<DismissReason[]>([]);
  const [dismissReasonId, setDismissReasonId] = useState<number | null>(null);
  const [dismissSuboptionId, setDismissSuboptionId] = useState<number | null>(null);
  const [dismissError, setDismissError] = useState("");
  const [isProcessingDismiss, setIsProcessingDismiss] = useState(false);
  const [showConfirmHardDelete, setShowConfirmHardDelete] = useState(false);
  const [isLoadingDismissReasons, setIsLoadingDismissReasons] = useState(false);

  // Activate Official Modal State
  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [isProcessingActivation, setIsProcessingActivation] = useState(false);

  // Toast State
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<ToastType>("info");

  const showToast = (message: string, type: ToastType = "info") => {
    setToastMessage(message);
    setToastType(type);
    setToastOpen(true);
  };

  // Search effect for modal
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (addOfficialSearchQuery) {
        setIsSearching(true);
        // Pass true to search globally (in RRHH database) instead of just user's list
        const results = await searchOfficials(addOfficialSearchQuery, true);
        // Filter out officials already in the main list
        const filteredResults = results.filter(
          result => !officials.some(o => o.rut === result.rut) // Check by RUT to avoid adding same person twice
        );
        setSearchResults(filteredResults);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [addOfficialSearchQuery, searchOfficials, officials]);

  useEffect(() => {
    let cancelled = false;

    const loadDismissReasons = async () => {
      setIsLoadingDismissReasons(true);
      try {
        const data = await dismissReasonsApi.list(true);
        if (!cancelled) {
          setDismissReasons(data);
        }
      } catch (error) {
        console.error("Error loading dismiss reasons:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingDismissReasons(false);
        }
      }
    };

    void loadDismissReasons();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDismissReason = dismissReasons.find((reason) => reason.id === dismissReasonId) ?? null;
  const selectedDismissSuboption = selectedDismissReason?.suboptions.find((suboption) => suboption.id === dismissSuboptionId) ?? null;
  const requiresSuboption = Boolean(selectedDismissReason && selectedDismissReason.suboptions.length > 0);
  const isHideReason = selectedDismissReason?.action_type === "hide";

  const handleConfirmActivate = async () => {
    if (!selectedOfficialId) return;
    
    setIsProcessingActivation(true);
    try {
        await activateOfficial(selectedOfficialId);
        setIsActivateModalOpen(false);
        showToast("Funcionario reactivado correctamente", "success");
    } catch (error) {
        console.error("Error activating:", error);
        showToast("Error al reactivar el funcionario", "error");
    } finally {
        setIsProcessingActivation(false);
    }
  };

  const handleInitiateActivate = (id: number) => {
    setSelectedOfficialId(id);
    setIsActivateModalOpen(true);
  };

  const handleInitiateDelete = (id: number) => {
    setSelectedOfficialId(id);
    setIsDismissModalOpen(true);
    setDismissReasonId(null);
    setDismissSuboptionId(null);
    setDismissError("");
    setShowConfirmHardDelete(false);
  };
  
  const handleConfirmDismiss = async () => {
    if (!selectedOfficialId || !selectedDismissReason) {
        setDismissError("Debe seleccionar un motivo.");
        return;
    }

    if (requiresSuboption && !selectedDismissSuboption) {
        setDismissError("Debe seleccionar una subopción.");
        return;
    }

    if (isHideReason && !showConfirmHardDelete) {
        setShowConfirmHardDelete(true);
        return;
    }
    
    setIsProcessingDismiss(true);
    try {
        await removeOfficial(selectedOfficialId, {
          reasonId: selectedDismissReason.id,
          suboptionId: selectedDismissSuboption?.id,
        });
        setIsDismissModalOpen(false);
        showToast(isHideReason ? "Funcionario eliminado correctamente" : "Funcionario dado de baja correctamente", "success");
    } catch (error) {
        console.error("Error dismissing:", error);
        setDismissError("Error al procesar la solicitud.");
    } finally {
        setIsProcessingDismiss(false);
    }
  };

  const handleAddOfficial = (official: Funcionario) => {
    addOfficial(official);
  };

  // Filter officials based on local search and advanced filters
  const filteredOfficials = officials.filter((f) => {
    const matchesSearch = searchQuery
      ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.rut.includes(searchQuery)
      : true;

    const matchesTitle = titleFilter ? f.title.toLowerCase().includes(titleFilter.toLowerCase()) : true;
    const matchesLaw = lawFilter ? f.law.toLowerCase().includes(lawFilter.toLowerCase()) : true;
    const matchesSpecialty = specialtyFilter ? f.sisSpecialty.toLowerCase().includes(specialtyFilter.toLowerCase()) : true;
    const matchesHours = hoursFilter ? String(f.hours).includes(hoursFilter) : true;
    
    let matchesStatus = true;
    if (statusFilter === "activo") {
        matchesStatus = f.status === "activo";
    } else if (statusFilter === "inactivo") {
        matchesStatus = f.status === "inactivo";
    }
    // "todos" passes true

    return matchesSearch && matchesTitle && matchesLaw && matchesSpecialty && matchesHours && matchesStatus;
  });

  // Pagination Logic
  const sortedOfficials = [...filteredOfficials].sort((a, b) => a.name.localeCompare(b.name));
  const totalPages = Math.ceil(sortedOfficials.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOfficials = sortedOfficials.slice(startIndex, endIndex);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Helper to get formatted display text for contract hours
  const getContractHoursDisplay = (func: Funcionario) => {
    // If we have detailed contracts, use them
    if (func.contracts && func.contracts.length > 0) {
        const contractStrings = func.contracts.map(c => `${c.hours} hrs`);
        
        if (contractStrings.length === 1) {
            return contractStrings[0];
        } else if (contractStrings.length > 1) {
            const last = contractStrings.pop();
            return `${contractStrings.join(', ')} y ${last}`;
        }
    }
    
    // Fallback for when no contracts array but we have the string "X hrs y Y hrs"
    if (typeof func.hours === 'string' && func.hours.includes(' y ')) {
        const parts = func.hours.split(' y ');
        if (parts.length > 1) {
             const last = parts.pop();
             return `${parts.join(', ')} y ${last}`;
        }
    }
    
    return typeof func.hours === 'string' ? func.hours : `${func.hours} hrs.`;
  };

  return (
    <div className="space-y-6 relative">
      <PageHeader 
        title="Funcionarios" 
        subtitle={`${canManageOfficials ? "Administra" : "Consulta"} los funcionarios (${filteredOfficials.length} total)`}
      >
        <ContextualHelpButton slug="funcionarios" />
      </PageHeader>

      <SupervisorScopePanel blocking={isSupervisor && !isScopeReady} />

      {isSupervisor && !isScopeReady ? null : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden w-full transition-colors">
            <FuncionariosToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={(value) => {
            setSearchQuery(normalizeRutInput(value));
            setCurrentPage(1);
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            setCurrentPage(1);
          }}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          hasActiveFilters={showFilters || Boolean(titleFilter || lawFilter || specialtyFilter || hoursFilter)}
          titleFilter={titleFilter}
          onTitleFilterChange={(value) => {
            setTitleFilter(value);
            setCurrentPage(1);
          }}
          lawFilter={lawFilter}
          onLawFilterChange={(value) => {
            setLawFilter(value);
            setCurrentPage(1);
          }}
          specialtyFilter={specialtyFilter}
          onSpecialtyFilterChange={(value) => {
            setSpecialtyFilter(value);
            setCurrentPage(1);
          }}
          hoursFilter={hoursFilter}
           onHoursFilterChange={(value) => {
             setHoursFilter(value);
             setCurrentPage(1);
           }}
           onAddOfficial={() => setIsAddOfficialModalOpen(true)}
            canManageOfficials={canManageOfficials}
            isReadOnly={isReadOnlyView}
         />

            <FuncionariosTable
              officials={currentOfficials}
              statusFilter={statusFilter}
               isReadOnly={isReadOnlyView}
               canManageOfficials={canManageOfficials}
              getContractHoursDisplay={getContractHoursDisplay}
              onActivate={handleInitiateActivate}
              onDelete={handleInitiateDelete}
            />

            <FuncionariosPagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={filteredOfficials.length}
              startIndex={startIndex}
              endIndex={endIndex}
              onItemsPerPageChange={(value) => {
                setItemsPerPage(value);
                setCurrentPage(1);
              }}
              onPageChange={handlePageChange}
            />
          </div>
          
        <FuncionariosModals
            isActivateModalOpen={isActivateModalOpen}
            setIsActivateModalOpen={setIsActivateModalOpen}
            isProcessingActivation={isProcessingActivation}
            handleConfirmActivate={handleConfirmActivate}
          isDismissModalOpen={isDismissModalOpen}
          setIsDismissModalOpen={setIsDismissModalOpen}
          isProcessingDismiss={isProcessingDismiss}
          dismissReasons={dismissReasons}
          isLoadingDismissReasons={isLoadingDismissReasons}
          dismissReasonId={dismissReasonId}
          setDismissReasonId={setDismissReasonId}
          dismissSuboptionId={dismissSuboptionId}
          setDismissSuboptionId={setDismissSuboptionId}
          setShowConfirmHardDelete={setShowConfirmHardDelete}
          setDismissError={setDismissError}
          dismissError={dismissError}
          showConfirmHardDelete={showConfirmHardDelete}
          selectedDismissReason={selectedDismissReason}
          handleConfirmDismiss={handleConfirmDismiss}
            isAddOfficialModalOpen={isAddOfficialModalOpen}
            setIsAddOfficialModalOpen={setIsAddOfficialModalOpen}
            addOfficialSearchQuery={addOfficialSearchQuery}
            setAddOfficialSearchQuery={setAddOfficialSearchQuery}
            isSearching={isSearching}
            searchResults={searchResults}
            handleAddOfficial={handleAddOfficial}
            normalizeRutInput={normalizeRutInput}
            toastOpen={toastOpen}
            toastMessage={toastMessage}
            toastType={toastType}
            setToastOpen={setToastOpen}
          />
        </>
      )}
    </div>
  );
}
