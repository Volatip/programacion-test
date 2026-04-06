import React, { useState, useEffect, useCallback } from "react";
import { useOfficials, Funcionario } from "../../context/OfficialsContext";
import { usePeriods } from "../../context/PeriodsContext";
import { useAuth } from "../../context/AuthContext";
import { useProgrammingCache } from "../../context/ProgrammingCacheContext";
import { ProgrammingData } from "../../context/ProgrammingCacheContextDefs";
import { Modal } from "../ui/Modal";
import { Toast, ToastType } from "../ui/Toast";
import { generateProgrammingPDF } from "../../lib/pdf-generator";
import { useProgrammingConfig } from "../../hooks/useProgrammingConfig";
import { useProgrammingModalActions } from "../../hooks/useProgrammingModalActions";
import { useProgrammingSave } from "../../hooks/useProgrammingSave";
import { validateProgrammingForm } from "../../lib/programmingValidation";
import { ProgrammingModalFormCard } from "./ProgrammingModalFormCard";
import { ProgrammingModalHeader } from "./ProgrammingModalHeader";
import { ProgrammingSummaryCard } from "./ProgrammingSummaryCard";
import {
  ensureMinimumProgrammingEntries,
  mapProgrammingItemsToEntries,
  type ProgrammingActivityEntry,
} from "../../lib/programmingForm";
import {
  calculateProgrammingCupos,
  createDefaultProgrammingEntries,
  formatProgrammingLunchTime,
  getProgrammingAvailabilityState,
  getProgrammingContractHoursString,
  getProgrammingVisualState,
  parseProgrammingContractHours,
} from "../../lib/programmingModalUtils";
import { isSupervisorRole } from "../../lib/userRoles";


type ActivityEntry = ProgrammingActivityEntry;

interface ProgrammingModalProps {
  funcionario: Funcionario | null;
  onClose: () => void;
  onNext?: () => void;
}

export function ProgrammingModal({ funcionario, onClose, onNext }: ProgrammingModalProps) {
  const { officials: myOfficials, groups, assignToGroup, refreshOfficials, updateOfficialLocally } = useOfficials();
  const { selectedPeriod, isReadOnly } = usePeriods();
  const { user } = useAuth();
  const isReadOnlyView = isReadOnly || isSupervisorRole(user?.role);
  const { getCachedProgramming, fetchProgramming, updateCache, removeCachedProgramming } = useProgrammingCache();
  
  // Determine if the official is a Medical professional
  const isMedicalOfficial = funcionario?.title === "Médico(a) Cirujano(a)";

  // Determine effective user role context
  // If admin, we adapt the view based on the OFFICIAL being edited
  const effectiveRole = user?.role === 'admin' 
    ? (isMedicalOfficial ? 'medical_coordinator' : 'non_medical_coordinator')
    : user?.role;

  // Visibility logic based on effective role
  const showSpecialty = isMedicalOfficial;
  const showCopyAndProcess = effectiveRole === 'non_medical_coordinator';

  // Configuration State
  const {
    activities: activitiesList,
    specialties: specialtiesList,
    processList,
    performanceUnits: performanceUnitsList,
    specialtyStats
  } = useProgrammingConfig(selectedPeriod?.id, funcionario?.title);

  // New state for assigned group
  const [assignedGroupId, setAssignedGroupId] = useState<number | "none" | "">(""); // "" for unselected

  // Status State - synced with official status
  const [currentOfficialStatus, setCurrentOfficialStatus] = useState<string>(funcionario?.status || "activo");

  // Initialize status when funcionario changes
  useEffect(() => {
    if (funcionario) {
        // Normalize status
        setCurrentOfficialStatus(funcionario.status || "activo");
    }
  }, [funcionario]);

  const [observations, setObservations] = useState<string>("");
  const [prais, setPrais] = useState<"Si" | "No" | "">("No"); // Default to "No"
  
  // Copy programming state
  const [copySearchQuery, setCopySearchQuery] = useState("");
  const [selectedCopyFuncionario, setSelectedCopyFuncionario] = useState<Funcionario | null>(null);
  const [copySourceId, setCopySourceId] = useState<number | null>(null);

  // Multiple programmers detection state
  const [otherProgrammers, setOtherProgrammers] = useState<string[]>([]);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [updaterName, setUpdaterName] = useState<string | null>(null);

  // Global specialty and process state
  const [globalSpecialty, setGlobalSpecialty] = useState("");
  const [selectedProcess, setSelectedProcess] = useState("");
  const [selectedPerformanceUnit, setSelectedPerformanceUnit] = useState("");
  const assignedStatus = currentOfficialStatus === "inactivo" ? "Inactivo" : "Activo";

  const visualState = funcionario
    ? getProgrammingVisualState(funcionario, assignedStatus)
    : null;
  const showPerformanceUnit = visualState?.showPerformanceUnit ?? false;

  // Time unit state
  const [timeUnit, setTimeUnit] = useState<"hours" | "minutes">("hours");

  // Form states with multiple entries
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([]);
  
  // Helper function to check if performance fields should be visible for an activity
  const shouldShowPerformanceFields = (activityName: string) => {
    if (!activityName) return false;
    const activity = activitiesList.find(a => a.name === activityName);
    return activity?.req_rendimiento === "SI";
  };
  const [isSaved, setIsSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [programmingId, setProgrammingId] = useState<number | null>(null);
  const [programmingVersion, setProgrammingVersion] = useState<number | null>(null);
  const [lastUpdatedDate, setLastUpdatedDate] = useState<string | null>(null);
  const [isLoadingProgramming, setIsLoadingProgramming] = useState(false);

  // Validation State
  const [toastConfig, setToastConfig] = useState<{isOpen: boolean; message: React.ReactNode; type: ToastType; duration?: number}>({
    isOpen: false,
    message: "",
    type: "info",
    duration: undefined,
  });
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Detectar cuando aparece el mensaje de carga
  useEffect(() => {
    if (isLoadingProgramming) {
      console.log("El modal está mostrando: Cargando programación...");
    }
  }, [isLoadingProgramming]);

  // Helper to clear error
  const clearError = (field: string) => {
    setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
    });
  };

  // Initialize form when funcionario changes
  useEffect(() => {
    if (funcionario && specialtiesList.length > 0) {
      setIsLoadingProgramming(true);
      
      // Reset defaults first
      const defaultSpecialty = ""; // No default, force selection
      const initialGroupId = (funcionario.groupId && funcionario.groupId !== 0) ? funcionario.groupId : "none";
      
      setAssignedGroupId(initialGroupId !== "none" ? initialGroupId : ""); 
      
      setObservations("");
      setPrais("No"); // Default to "No"
      setGlobalSpecialty(""); // Force selection
      
      // Initialize Process based on Role Logic immediately
      if (funcionario.title === "Médico(a) Cirujano(a)") {
          setSelectedProcess("");
      } else if (processList.length > 0) {
          // If non-medical, we force user to select now that it is mandatory
          setSelectedProcess(""); 
      } else {
          setSelectedProcess("");
      }

      if (performanceUnitsList.length > 0) setSelectedPerformanceUnit("");
      setTimeUnit("hours");
      setProgrammingId(null);
      setProgrammingVersion(null);
      setLastUpdatedDate(null);
      setIsSaved(false);
      
      // Default empty entries
      const defaultEntries = createDefaultProgrammingEntries(4, defaultSpecialty);
      setActivityEntries(defaultEntries);

      // Fetch existing programming if available
      if (selectedPeriod) {
        const loadProgramming = async () => {
             // Check cache first to avoid flickering
             const cached = getCachedProgramming(funcionario.id);
             
             if (cached) {
                 // Use cached data immediately
                 console.log("Using cached programming for:", funcionario.name);
                 populateForm(cached);
                 // Add artificial delay to show loading state consistently
                 setTimeout(() => setIsLoadingProgramming(false), 300);
                 return;
             }
             
             // If not in cache, fetch it
             try {
                 const data = await fetchProgramming(funcionario.id, selectedPeriod.id);
                 if (data) {
                     populateForm(data);
                 } else {
                     setDefaults();
                 }
             } catch (err) {
                 console.error("Error loading programming:", err);
                 setDefaults();
             } finally {
                 setTimeout(() => setIsLoadingProgramming(false), 300);
             }
        };
        
        loadProgramming();
      } else {
          setIsLoadingProgramming(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    funcionario,
    selectedPeriod,
    specialtiesList,
    processList,
    performanceUnitsList,
  ]);

  // Calculate other programmers whenever user or loaded data changes
  useEffect(() => {
    if (!user?.name) {
        // If user is not yet loaded, we can't reliably filter.
        // Option 1: Don't show anything yet.
        setOtherProgrammers([]);
        return;
    }

    const others = new Set<string>();
    
    if (creatorName && creatorName !== user.name) {
        others.add(creatorName);
    }
    if (updaterName && updaterName !== user.name) {
        others.add(updaterName);
    }
    
    setOtherProgrammers(Array.from(others));
  }, [user, creatorName, updaterName]);

  // Helper to populate form from data
  const populateForm = useCallback((existing: ProgrammingData) => {
      setProgrammingId(existing.id);
      setProgrammingVersion(existing.version ?? 1);
      setLastUpdatedDate(existing.updated_at || null);
      setObservations(existing.observation || "");

      // Store programmer names for validation
      setCreatorName(existing.created_by_name || null);
      setUpdaterName(existing.updated_by_name || null);
      
      // We rely on the LIVE official group status (from useEffect) rather than the saved snapshot
      // setAssignedGroupId(existing.assigned_group_id !== null ? existing.assigned_group_id : "");
      
      // Note: assignedStatus is now handled by currentOfficialStatus (Funcionario status)
      // We ignore existing.assigned_status from programming record in favor of the live Official status
      
      // PRAIS: existing.prais is bool. 
      // If it was saved, it has a value (true/false).
      // But we want to ensure explicit selection if we edit? 
      // If it's already saved as False, how do we know if it was "Default False" or "Selected No"?
      // The schema defaulted to False. 
      // If we want to force re-selection on old data, we might treat False as unselected? No, that's dangerous.
      // We assume if it's existing data, it's valid.
      // BUT if we are "implementing validation... including creation and edit modes", maybe we assume old data is valid?
      // Or we check if `prais` is strictly None in DB? DB has default False.
      // Let's trust existing data for PRAIS (Si/No).
      setPrais(existing.prais ? "Si" : "No");
      
      if (existing.global_specialty) setGlobalSpecialty(existing.global_specialty);
      else setGlobalSpecialty("");
      
      // Only set selectedProcess if the official is NOT a medical doctor
      const isMedical = funcionario?.title === "Médico(a) Cirujano(a)";
      if (!isMedical && existing.selected_process) {
          setSelectedProcess(existing.selected_process);
      } else if (!isMedical && processList.length > 0) {
          // If existing but no process set, force selection
          setSelectedProcess("");
      } else {
          setSelectedProcess("");
      }

      if (existing.selected_performance_unit) setSelectedPerformanceUnit(existing.selected_performance_unit);
      if (existing.time_unit) setTimeUnit(existing.time_unit as "hours" | "minutes");

      if (existing.items && existing.items.length > 0) {
        const mappedItems = mapProgrammingItemsToEntries(existing.items, "");
        setActivityEntries(
          ensureMinimumProgrammingEntries(mappedItems, 4, existing.global_specialty || "")
        );
      }
  }, [funcionario?.title, processList.length]);

  const setDefaults = useCallback(() => {
      setOtherProgrammers([]);
      setCreatorName(null);
      setUpdaterName(null);
      setProgrammingId(null);
      setProgrammingVersion(null);
      setLastUpdatedDate(null);
      // No existing programming found
      // Ensure correct defaults based on role
      const isMedical = funcionario?.title === "Médico(a) Cirujano(a)";
      if (isMedical) {
          setSelectedProcess("");
      } else if (processList.length > 0) {
          // Force selection for non-medical
          setSelectedProcess("");
      }
  }, [funcionario?.title, processList.length]);

  const reloadLatestProgramming = useCallback(async () => {
    if (!funcionario || !selectedPeriod) {
      return;
    }

    setIsLoadingProgramming(true);

    try {
      const latest = await fetchProgramming(funcionario.id, selectedPeriod.id, { forceRefresh: true });

      if (latest) {
        populateForm(latest);
        updateCache(funcionario.id, latest);
        setToastConfig({
          isOpen: true,
          type: "info",
          message: "Se recargó la versión más reciente de la programación. Revisá los cambios antes de guardar nuevamente.",
        });
        return;
      }

      setDefaults();
      setToastConfig({
        isOpen: true,
        type: "warning",
        message: "No se encontró una programación vigente para recargar. Revisá el estado actual antes de volver a guardar.",
      });
    } catch (error) {
      console.error("Error reloading programming after conflict:", error);
      setToastConfig({
        isOpen: true,
        type: "error",
        message: "No se pudo recargar la programación más reciente. Intentá nuevamente.",
      });
    } finally {
      setIsLoadingProgramming(false);
    }
  }, [fetchProgramming, funcionario, populateForm, selectedPeriod, setDefaults, updateCache]);

  const handleGlobalSpecialtyChange = (newSpecialty: string) => {
    setGlobalSpecialty(newSpecialty);
    clearError('globalSpecialty');
    setActivityEntries(prev => prev.map(entry => ({
      ...entry,
      specialty: newSpecialty
    })));
  };

  const handleProcessChange = (newProcess: string) => {
      setSelectedProcess(newProcess);
      clearError('selectedProcess');
  };

  const handleTimeUnitChange = (newUnit: "hours" | "minutes") => {
    if (newUnit === timeUnit) return;
    
    setActivityEntries(prev => prev.map(entry => {
      const val = parseFloat(entry.assignedHours.replace(',', '.'));
      if (isNaN(val)) return entry;
      
      let newVal;
      if (newUnit === "minutes") {
        newVal = Math.round(val * 60);
      } else {
        // Round to 2 decimals to avoid infinite precision issues (e.g. 20 min / 60 = 0.333...)
        newVal = Math.round((val / 60) * 100) / 100;
      }
      
      return {
        ...entry,
        assignedHours: newVal.toString()
      };
    }));
    
    setTimeUnit(newUnit);
  };

  const updateEntry = (id: number, field: keyof ActivityEntry, value: string) => {
    setActivityEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
    clearError(`activity_${id}_${field}`);
  };

  const addEntry = () => {
    setActivityEntries((prev) => [
      ...prev,
      {
        id: Math.max(0, ...prev.map((e) => e.id)) + 1,
        activity: "",
        specialty: globalSpecialty,
        assignedHours: "",
        performance: "",
      },
    ]);
  };

  const removeEntry = (id: number) => {
    if (activityEntries.length > 1) {
      setActivityEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
  };

  const { handleCopyProgramming, handleDeleteProgramming } = useProgrammingModalActions({
    funcionario,
    selectedPeriodId: selectedPeriod?.id,
    selectedCopyFuncionario,
    isMedicalOfficial,
    programmingId,
    fetchProgramming,
    removeCachedProgramming,
    updateOfficialLocally,
    onClose,
    setToastConfig,
    setTimeUnit,
    setGlobalSpecialty,
    setSelectedProcess,
    setSelectedPerformanceUnit,
    setAssignedGroupId,
    setActivityEntries,
    setCopySourceId,
  });

  const hideActivitiesTable = visualState?.hideActivitiesTable ?? false;

  const handleGroupChange = (newGroupId: number | "none" | "") => {
      setAssignedGroupId(newGroupId);
      clearError('assignedGroupId');
  };

  const validateForm = (): string[] => {
    const { errors, missingFields } = validateProgrammingForm({
      pendingStatus: assignedStatus,
      isAvailableNegative,
      showSpecialty,
      globalSpecialty,
      hideActivitiesTable,
      showPerformanceUnit,
      selectedPerformanceUnit,
      prais,
      activityEntries,
      selectedProcess,
      showCopyAndProcess,
      shouldShowPerformanceFields,
    });
    setFormErrors(errors);
    return missingFields;
  };

  // Helper to get display text for contract hours
  const getContractHoursDisplay = (funcionarioData: Funcionario): React.ReactNode => {
     const text = getProgrammingContractHoursString(funcionarioData);
     
     // Apply specific styling for complex cases (multiple contracts)
     if (text.includes(',') || text.includes(' y ')) {
         return (
            <span className="whitespace-nowrap font-medium text-gray-900 dark:text-white">
                {text}
            </span>
         );
     }
    
    return <span>{text}</span>;
  };

  const totalContractHours = funcionario ? parseProgrammingContractHours(funcionario) : 0;
  const contractHoursDisplayText = funcionario ? getContractHoursDisplay(funcionario) : "0 hrs";



  const totalScheduledHours = activityEntries.reduce((acc, entry) => {
    const hours = parseFloat(entry.assignedHours.replace(',', '.')) || 0;
    const hoursValue = timeUnit === 'minutes' ? hours / 60 : hours;
    return acc + hoursValue;
  }, 0);

  const lunchMinutes = funcionario?.lunchTime ? parseInt(funcionario.lunchTime) : 0;
  const {
    availableHoursFormatted,
    isAvailableNegative,
    availableColorClass,
  } = getProgrammingAvailabilityState({
    totalContractHours,
    totalScheduledHours,
    lunchMinutes,
  });

  const { handleSave } = useProgrammingSave({
    funcionario,
    selectedPeriodId: selectedPeriod?.id,
    programmingId,
    programmingVersion,
    observations,
    assignedGroupId,
    currentOfficialStatus,
    prais,
    globalSpecialty,
    selectedProcess,
    selectedPerformanceUnit,
    timeUnit,
    activityEntries,
    activitiesList,
    totalScheduledHours,
    copySourceId,
    isSubmitting,
    onNext,
    onClose,
    validateForm,
    assignToGroup,
    refreshOfficials,
    reloadLatestProgramming,
    updateCache,
    updateOfficialLocally,
    setCopySourceId,
    setProgrammingId,
    setProgrammingVersion,
    setLastUpdatedDate,
    setIsSaved,
    setIsSubmitting,
    setToastConfig,
  });

  if (!funcionario) return null;
  const isExempt = visualState?.isExempt ?? false;

  const modalTitle = (
    <ProgrammingModalHeader
      otherProgrammers={otherProgrammers}
      showOtherProgrammersNotice={!isSupervisorRole(user?.role)}
      contractHoursDisplayText={contractHoursDisplayText}
      totalScheduledHours={totalScheduledHours}
      availableColorClass={availableColorClass}
      availableHoursFormatted={availableHoursFormatted}
    />
  );

  const handlePrint = () => {
    // Resolve contract hours display text to a clean string for the PDF
    const resolvedContractHoursStr = getProgrammingContractHoursString(funcionario);

    // Call the external PDF generator with all required data
    generateProgrammingPDF({
      funcionario,
      selectedPeriod,
      activityEntries,
      timeUnit,
      prais,
      currentOfficialStatus,
      assignedGroupId: assignedGroupId === "none" || assignedGroupId === "" ? null : assignedGroupId,
      groups,
      totalContractHours,
      contractHoursDisplayText: resolvedContractHoursStr,
      totalScheduledHours,
      availableHoursFormatted,
      observations,
      globalSpecialty,
      selectedProcess,
      selectedPerformanceUnit
    });
  };

  return (
    <Modal
      isOpen={!!funcionario}
      onClose={onClose}
      title={modalTitle}
      className="max-w-[90rem]"
      resetScrollKey={funcionario.id}
    >
        <div className="p-6 space-y-4">
          <ProgrammingSummaryCard
            funcionario={funcionario}
            contractHoursDisplayText={contractHoursDisplayText}
            formatLunchTime={(lunchTime) => formatProgrammingLunchTime(lunchTime, timeUnit)}
            lastUpdatedDate={lastUpdatedDate}
            prais={prais}
            setPrais={setPrais}
            clearError={clearError}
            formErrors={formErrors}
            isReadOnly={isReadOnlyView}
            isExempt={isExempt}
          />

          <ProgrammingModalFormCard
            isLoadingProgramming={isLoadingProgramming}
            isReadOnly={isReadOnlyView}
            showCopyAndProcess={showCopyAndProcess}
            copySearchQuery={copySearchQuery}
            onCopySearchQueryChange={setCopySearchQuery}
            selectedCopyFuncionario={selectedCopyFuncionario}
            onSelectCopyFuncionario={setSelectedCopyFuncionario}
            myOfficials={myOfficials}
            funcionario={funcionario}
            onCopyProgramming={handleCopyProgramming}
            showPerformanceUnit={showPerformanceUnit}
            selectedPerformanceUnit={selectedPerformanceUnit}
            setSelectedPerformanceUnit={setSelectedPerformanceUnit}
            performanceUnitsList={performanceUnitsList}
            showSpecialty={showSpecialty}
            specialtiesList={specialtiesList}
            globalSpecialty={globalSpecialty}
            onGlobalSpecialtyChange={handleGlobalSpecialtyChange}
            specialtyStats={specialtyStats}
            processList={processList}
            selectedProcess={selectedProcess}
            onProcessChange={handleProcessChange}
            isExempt={isExempt}
            formErrors={formErrors}
            clearError={clearError}
            onSubmit={(e) => handleSave(e, false)}
            hideActivitiesTable={hideActivitiesTable}
            activityEntries={activityEntries}
            activitiesList={activitiesList}
            isMedicalOfficial={isMedicalOfficial}
            timeUnit={timeUnit}
            handleTimeUnitChange={handleTimeUnitChange}
            updateEntry={updateEntry}
            addEntry={addEntry}
            removeEntry={removeEntry}
            shouldShowPerformanceFields={shouldShowPerformanceFields}
            calculateCupos={(assignedHours, performance) => calculateProgrammingCupos(assignedHours, performance, timeUnit)}
            assignedGroupId={assignedGroupId}
            handleGroupChange={handleGroupChange}
            groups={groups}
            observations={observations}
            setObservations={setObservations}
            onPrint={handlePrint}
            onClose={onClose}
            onDelete={handleDeleteProgramming}
            onSaveAndNext={(e) => handleSave(e, true)}
            onNext={onNext}
            programmingId={programmingId}
            isSubmitting={isSubmitting}
            isAvailableNegative={isAvailableNegative}
            isSaved={isSaved}
            hasNext={!!onNext}
          />
        </div>
        <Toast 
            isOpen={toastConfig.isOpen}
            message={toastConfig.message}
            type={toastConfig.type}
            duration={toastConfig.duration}
            onClose={() => setToastConfig(prev => ({ ...prev, isOpen: false }))}
        />
    </Modal>
  );
}
