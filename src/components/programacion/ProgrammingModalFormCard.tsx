import type { FormEvent, MouseEvent } from "react";
import { RefreshCw } from "lucide-react";

import type { Funcionario } from "../../context/OfficialsContext";
import type { Group } from "../../context/OfficialsContextDefs";
import type { ActivityConfig, ProgrammingConfigData } from "../../hooks/useProgrammingConfig";
import type { ProgrammingActivityEntry } from "../../lib/programmingForm";
import { ProgrammingActivitiesEmptyState } from "./ProgrammingActivitiesEmptyState";
import { ProgrammingActivitiesTable } from "./ProgrammingActivitiesTable";
import { ProgrammingActionBar } from "./ProgrammingActionBar";
import { ProgrammingConfigPanels } from "./ProgrammingConfigPanels";
import { ProgrammingCopySection } from "./ProgrammingCopySection";
import { ProgrammingMetadataSection } from "./ProgrammingMetadataSection";
import type { DismissReason } from "../../lib/dismissReasons";

interface ProgrammingModalFormCardProps {
  isLoadingProgramming: boolean;
  isReadOnly: boolean;
  showCopyAndProcess: boolean;
  copySearchQuery: string;
  onCopySearchQueryChange: (value: string) => void;
  selectedCopyFuncionario: Funcionario | null;
  onSelectCopyFuncionario: (funcionario: Funcionario | null) => void;
  myOfficials: Funcionario[];
  funcionario: Funcionario;
  onCopyProgramming: () => void;
  showPerformanceUnit: boolean;
  selectedPerformanceUnit: string;
  setSelectedPerformanceUnit: (value: string) => void;
  performanceUnitsList: string[];
  showSpecialty: boolean;
  specialtiesList: string[];
  globalSpecialty: string;
  onGlobalSpecialtyChange: (value: string) => void;
  specialtyStats: ProgrammingConfigData["specialtyStats"];
  processList: string[];
  selectedProcess: string;
  onProcessChange: (value: string) => void;
  isExempt: boolean;
  formErrors: Record<string, boolean>;
  clearError: (field: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  hideActivitiesTable: boolean;
  activityEntries: ProgrammingActivityEntry[];
  activitiesList: ActivityConfig[];
  isMedicalOfficial: boolean;
  timeUnit: "hours" | "minutes";
  handleTimeUnitChange: (value: "hours" | "minutes") => void;
  updateEntry: (id: number, field: keyof ProgrammingActivityEntry, value: string) => void;
  addEntry: () => void;
  removeEntry: (id: number) => void;
  shouldShowPerformanceFields: (activityName: string) => boolean;
  calculateCupos: (assignedHours: string, performance: string) => { agenda: string | number; annual: string | number };
  assignedGroupId: number | "none" | "";
  handleGroupChange: (newGroupId: number | "none" | "") => void;
  groups: Group[];
  pendingStatus: string;
  currentOfficialStatus: string;
  handleStatusChange: (newValue: string) => void;
  dismissReasons: DismissReason[];
  selectedDismissReasonId: number | null;
  selectedDismissSuboptionId: number | null;
  handleDismissSuboptionChange: (suboptionId: number | null) => void;
  showClearPartialCommissionAction: boolean;
  dismissPartialHours: string;
  setDismissPartialHours: (value: string) => void;
  observations: string;
  setObservations: (value: string) => void;
  onPrint: () => void;
  onClose: () => void;
  onDelete: () => void;
  onSaveAndNext: (event: MouseEvent<HTMLButtonElement>) => void;
  onNext?: () => void;
  programmingId: number | null;
  isSubmitting: boolean;
  isAvailableNegative: boolean;
  isSaved: boolean;
  hasNext: boolean;
}

export function ProgrammingModalFormCard({
  isLoadingProgramming,
  isReadOnly,
  showCopyAndProcess,
  copySearchQuery,
  onCopySearchQueryChange,
  selectedCopyFuncionario,
  onSelectCopyFuncionario,
  myOfficials,
  funcionario,
  onCopyProgramming,
  showPerformanceUnit,
  selectedPerformanceUnit,
  setSelectedPerformanceUnit,
  performanceUnitsList,
  showSpecialty,
  specialtiesList,
  globalSpecialty,
  onGlobalSpecialtyChange,
  specialtyStats,
  processList,
  selectedProcess,
  onProcessChange,
  isExempt,
  formErrors,
  clearError,
  onSubmit,
  hideActivitiesTable,
  activityEntries,
  activitiesList,
  isMedicalOfficial,
  timeUnit,
  handleTimeUnitChange,
  updateEntry,
  addEntry,
  removeEntry,
  shouldShowPerformanceFields,
  calculateCupos,
  assignedGroupId,
  handleGroupChange,
  groups,
  pendingStatus,
  currentOfficialStatus,
  handleStatusChange,
  dismissReasons,
  selectedDismissReasonId,
  selectedDismissSuboptionId,
  handleDismissSuboptionChange,
  showClearPartialCommissionAction,
  dismissPartialHours,
  setDismissPartialHours,
  observations,
  setObservations,
  onPrint,
  onClose,
  onDelete,
  onSaveAndNext,
  onNext,
  programmingId,
  isSubmitting,
  isAvailableNegative,
  isSaved,
  hasNext,
}: ProgrammingModalFormCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm relative min-h-[400px]">
      {isLoadingProgramming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-800/80 z-20 rounded-xl backdrop-blur-sm">
          <RefreshCw className="w-10 h-10 text-primary animate-spin mb-4" />
          <span className="text-gray-500 dark:text-gray-400 font-medium">Cargando programación...</span>
        </div>
      ) : null}

      {isReadOnly && <div className="absolute top-0 right-0 left-0 h-1 bg-amber-400 rounded-t-xl z-10" />}

      {isReadOnly && (
        <div className="flex justify-end items-start mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
            Modo Lectura
          </span>
        </div>
      )}

      {!isReadOnly && showCopyAndProcess && (
        <ProgrammingCopySection
          copySearchQuery={copySearchQuery}
          onCopySearchQueryChange={onCopySearchQueryChange}
          selectedCopyFuncionario={selectedCopyFuncionario}
          onSelectCopyFuncionario={onSelectCopyFuncionario}
          onClearSelectedCopyFuncionario={() => onSelectCopyFuncionario(null)}
          myOfficials={myOfficials}
          funcionario={funcionario}
          onCopyProgramming={onCopyProgramming}
        />
      )}

      <ProgrammingConfigPanels
        showPerformanceUnit={showPerformanceUnit}
        selectedPerformanceUnit={selectedPerformanceUnit}
        setSelectedPerformanceUnit={setSelectedPerformanceUnit}
        performanceUnits={performanceUnitsList}
        showSpecialty={showSpecialty}
        specialties={specialtiesList}
        globalSpecialty={globalSpecialty}
        onGlobalSpecialtyChange={onGlobalSpecialtyChange}
        specialtyStats={specialtyStats}
        showCopyAndProcess={showCopyAndProcess}
        processList={processList}
        selectedProcess={selectedProcess}
        onProcessChange={onProcessChange}
        isReadOnly={isReadOnly}
        isExempt={isExempt}
        formErrors={formErrors}
        clearError={clearError}
      />

      <form onSubmit={onSubmit} className="space-y-6">
        {!hideActivitiesTable ? (
          <ProgrammingActivitiesTable
            activityEntries={activityEntries}
            activitiesList={activitiesList}
            specialtiesList={specialtiesList}
            funcionarioTitle={funcionario.title}
            isMedicalOfficial={isMedicalOfficial}
            globalSpecialty={globalSpecialty}
            selectedProcess={selectedProcess}
            showSpecialty={showSpecialty}
            isExempt={isExempt}
            isReadOnly={isReadOnly}
            timeUnit={timeUnit}
            handleTimeUnitChange={handleTimeUnitChange}
            updateEntry={updateEntry}
            addEntry={addEntry}
            removeEntry={removeEntry}
            shouldShowPerformanceFields={shouldShowPerformanceFields}
            calculateCupos={calculateCupos}
            formErrors={formErrors}
          />
        ) : (
          <ProgrammingActivitiesEmptyState />
        )}

        <ProgrammingMetadataSection
          assignedGroupId={assignedGroupId}
          handleGroupChange={handleGroupChange}
          groups={groups}
          formErrors={formErrors}
          pendingStatus={pendingStatus}
          currentOfficialStatus={currentOfficialStatus}
          handleStatusChange={handleStatusChange}
          dismissReasons={dismissReasons}
          selectedDismissReasonId={selectedDismissReasonId}
          selectedDismissSuboptionId={selectedDismissSuboptionId}
          handleDismissSuboptionChange={handleDismissSuboptionChange}
          showClearPartialCommissionAction={showClearPartialCommissionAction}
          dismissPartialHours={dismissPartialHours}
          setDismissPartialHours={setDismissPartialHours}
          observations={observations}
          setObservations={setObservations}
          isReadOnly={isReadOnly}
        />

        <ProgrammingActionBar
          onPrint={onPrint}
          onClose={onClose}
          onDelete={onDelete}
          onSaveAndNext={onSaveAndNext}
          onNext={onNext}
          isReadOnly={isReadOnly}
          programmingId={programmingId}
          isSubmitting={isSubmitting}
          isAvailableNegative={isAvailableNegative}
          isSaved={isSaved}
          hasNext={hasNext}
        />
      </form>
    </div>
  );
}
