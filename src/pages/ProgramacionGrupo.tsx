import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Search } from "lucide-react";
import { useOfficials, Funcionario } from "../context/OfficialsContext";
import { usePeriods } from "../context/PeriodsContext";
import { ProgrammingGroupHeader } from "../components/programacion/ProgrammingGroupHeader";
import { ProgrammingGroupOfficialsList } from "../components/programacion/ProgrammingGroupOfficialsList";
import { ProgrammingModal } from "../components/programacion/ProgrammingModal";
import { AddOfficialToGroupModal } from "../components/programacion/AddOfficialToGroupModal";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { APP_ROUTES } from "../lib/appPaths";
import { getOfficialsForProgrammingGroup, isAutomaticProgrammingGroup } from "../lib/programmingGroups";
import { useAuth } from "../context/AuthContext";
import { isReadOnlyRole } from "../lib/userRoles";
import { useSupervisorScope } from "../context/SupervisorScopeContext";
import { SupervisorScopePanel } from "../components/supervisor/SupervisorScopePanel";

export function ProgramacionGrupo() {
  const { user } = useAuth();
  const { isSupervisor, isScopeReady } = useSupervisorScope();
  const { groupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { officials: myOfficials, groups, assignToGroup } = useOfficials();
  const { isReadOnly } = usePeriods();
  const canManageProgramming = !isReadOnlyRole(user?.role);
  const isReadOnlyView = isReadOnly || !canManageProgramming;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOfficial, setSelectedOfficial] = useState<Funcionario | null>(null);
  const [isAddOfficialModalOpen, setIsAddOfficialModalOpen] = useState(false);

  const group = groups.find((g) => g.id === Number(groupId));
  const isLoadingGroupData = groups.length === 0 && myOfficials.length === 0;
  const isAutomaticGroup = isAutomaticProgrammingGroup(Number(groupId));

  const groupOfficials = getOfficialsForProgrammingGroup(myOfficials, Number(groupId));

  useEffect(() => {
    const selectedOfficialId = (location.state as { selectedOfficialId?: number } | null)?.selectedOfficialId;
    if (!selectedOfficialId) {
      return;
    }

    const officialToOpen = groupOfficials.find((official) => official.id === selectedOfficialId);
    if (officialToOpen) {
      setSelectedOfficial(officialToOpen);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [groupOfficials, location.pathname, location.state, navigate]);

  const filteredOfficials = searchQuery
    ? groupOfficials.filter(
        (f) =>
          f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          f.rut.includes(searchQuery)
      )
    : groupOfficials;

  const selectedOfficialIndex = selectedOfficial
    ? filteredOfficials.findIndex((f) => f.id === selectedOfficial.id)
    : -1;

  const hasPreviousOfficial = selectedOfficialIndex > 0;
  const hasNextOfficial = selectedOfficialIndex !== -1 && selectedOfficialIndex < filteredOfficials.length - 1;

  if (isLoadingGroupData) {
    return <div className="p-8 text-center">Cargando grupo...</div>;
  }

  if (isSupervisor && !isScopeReady) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto">
        <SupervisorScopePanel blocking />
      </div>
    );
  }

  if (!group) {
    return <div className="p-8 text-center">Grupo no encontrado</div>;
  }

  const handleNextOfficial = () => {
    if (!hasNextOfficial) {
      setSelectedOfficial(null);
      return;
    }

    setSelectedOfficial(filteredOfficials[selectedOfficialIndex + 1]);
  };

  const handlePreviousOfficial = () => {
    if (!hasPreviousOfficial) return;
    setSelectedOfficial(filteredOfficials[selectedOfficialIndex - 1]);
  };

  const handleRemoveFromGroup = async (e: React.MouseEvent, official: Funcionario) => {
    e.stopPropagation();
    if (!confirm(`¿Está seguro que desea quitar a ${official.name} de este grupo?`)) return;

    await assignToGroup(official.id, 0);
  };

  const formatContractHours = (func: Funcionario) => {
    if (func.contracts && func.contracts.length > 0) {
      const contractStrings = func.contracts.map((c) => `${c.hours} hrs`);

      if (contractStrings.length === 1) {
        return contractStrings[0];
      }

      if (contractStrings.length > 1) {
        const last = contractStrings.pop();
        return `${contractStrings.join(", ")} y ${last}`;
      }
    }

    if (typeof func.hours === "string" && func.hours.includes(" y ")) {
      const parts = func.hours.split(" y ");
      if (parts.length > 1) {
        const last = parts.pop();
        return `${parts.join(", ")} y ${last}`;
      }
    }

    return typeof func.hours === "string" ? func.hours : `${func.hours} hrs.`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <ProgrammingGroupHeader
            groupName={group.name}
            officialsCount={groupOfficials.length}
             isReadOnly={isReadOnlyView}
             canAssignOfficials={!isAutomaticGroup && canManageProgramming}
            onBack={() => navigate(APP_ROUTES.programming)}
            onAddOfficial={() => setIsAddOfficialModalOpen(true)}
          />
        </div>
        <ContextualHelpButton slug="programacion-grupo" className="mt-1" />
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en este grupo..."
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-gray-900 dark:text-white dark:placeholder-gray-500"
          />
        </div>
      </div>

      <ProgrammingGroupOfficialsList
        officials={filteredOfficials}
         isReadOnly={isReadOnlyView}
         canAssignOfficials={!isAutomaticGroup && canManageProgramming}
        showInactiveReason={isAutomaticGroup}
        formatContractHours={formatContractHours}
        onSelectOfficial={setSelectedOfficial}
        onRemoveFromGroup={handleRemoveFromGroup}
      />

      {selectedOfficial && (
        <ProgrammingModal
          funcionario={selectedOfficial}
          onClose={() => setSelectedOfficial(null)}
          onPrevious={hasPreviousOfficial ? handlePreviousOfficial : undefined}
          onNext={hasNextOfficial ? handleNextOfficial : undefined}
        />
      )}

      {!isAutomaticGroup && canManageProgramming && (
        <AddOfficialToGroupModal
          isOpen={isAddOfficialModalOpen}
          onClose={() => setIsAddOfficialModalOpen(false)}
          groupId={group.id}
          groupName={group.name}
        />
      )}
    </div>
  );
}
