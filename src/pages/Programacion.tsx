import { useEffect, useMemo, useRef, useState } from "react";
import { useOfficials, Group } from "../context/OfficialsContext";
import { usePeriods } from "../context/PeriodsContext";
import { useProgrammingClassification } from "../hooks/useProgrammingClassification";
import { ProgrammingGroupModals } from "../components/programacion/ProgrammingGroupModals";
import { ProgrammingGroupsPanel } from "../components/programacion/ProgrammingGroupsPanel";
import { ProgrammingSearchBar } from "../components/programacion/ProgrammingSearchBar";
import { ProgrammingStatusSummary } from "../components/programacion/ProgrammingStatusSummary";
import { PageHeader } from "../components/ui/PageHeader";
import { ContextualHelpButton } from "../components/contextual-help/ContextualHelpButton";
import { useAuth } from "../context/AuthContext";
import { isReadOnlyRole } from "../lib/userRoles";
import { useSupervisorScope } from "../context/SupervisorScopeContext";
import { SupervisorScopePanel } from "../components/supervisor/SupervisorScopePanel";
import { matchesOfficialSearch } from "../lib/officialSearch";

export function Programacion() {
  const { user } = useAuth();
  const { isSupervisor, isScopeReady } = useSupervisorScope();
  const { officials: myOfficials, groups, addGroup, updateGroup, removeGroup } = useOfficials();
  const { isReadOnly } = usePeriods();
  const canManageProgramming = !isReadOnlyRole(user?.role);
  const isReadOnlyView = isReadOnly || !canManageProgramming;
  const [searchQuery, setSearchQuery] = useState("");

  const { scheduledFuncionarios, unscheduledFuncionarios } = useProgrammingClassification();

  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isEditGroupModalOpen, setIsEditGroupModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<Group | null>(null);
  const [openMenuGroupId, setOpenMenuGroupId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [addingToGroup, setAddingToGroup] = useState<Group | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuGroupId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredFuncionarios = useMemo(() => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      return [];
    }

    return myOfficials.filter(
      (funcionario) =>
        funcionario.status === "activo" &&
        matchesOfficialSearch({
          name: funcionario.name,
          rut: funcionario.rut,
          query: trimmedQuery,
        })
    );
  }, [myOfficials, searchQuery]);

  const handleCreateGroup = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setNewGroupName("");
    setIsCreateGroupModalOpen(true);
  };

  const confirmCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      addGroup(newGroupName.trim());
      setIsCreateGroupModalOpen(false);
    }
  };

  const toggleMenu = (e: React.MouseEvent, groupId: number) => {
    e.stopPropagation();
    setOpenMenuGroupId(openMenuGroupId === groupId ? null : groupId);
  };

  const handleEditGroup = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setEditingGroup(group);
    setNewGroupName(group.name);
    setOpenMenuGroupId(null);
    setIsEditGroupModalOpen(true);
  };

  const confirmEditGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGroup && newGroupName.trim()) {
      updateGroup(editingGroup.id, newGroupName.trim());
      setIsEditGroupModalOpen(false);
      setEditingGroup(null);
    }
  };

  const handleDeleteGroup = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setGroupToDelete(group);
    setOpenMenuGroupId(null);
    setIsDeleteGroupModalOpen(true);
  };

  const confirmDeleteGroup = () => {
    if (groupToDelete) {
      removeGroup(groupToDelete.id);
      setIsDeleteGroupModalOpen(false);
      setGroupToDelete(null);
    }
  };

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        pageSlug="programacion"
        title="Programación"
        subtitle="Gestión de grupos y asignación de actividades"
      >
         <ContextualHelpButton slug="programacion" />
         <ProgrammingSearchBar
           searchQuery={searchQuery}
           setSearchQuery={setSearchQuery}
           filteredFuncionarios={filteredFuncionarios}
         />
      </PageHeader>

      <SupervisorScopePanel blocking={isSupervisor && !isScopeReady} />

      {isSupervisor && !isScopeReady ? null : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <ProgrammingGroupsPanel
                groups={groups}
                isReadOnly={isReadOnlyView}
                openMenuGroupId={openMenuGroupId}
                menuRef={menuRef}
                onCreateGroup={handleCreateGroup}
                onToggleMenu={toggleMenu}
                onEditGroup={handleEditGroup}
                onDeleteGroup={handleDeleteGroup}
                canAssignOfficials={canManageProgramming}
                onAddOfficialToGroup={setAddingToGroup}
              />
            </div>

            <ProgrammingStatusSummary
              scheduledFuncionarios={scheduledFuncionarios}
              unscheduledFuncionarios={unscheduledFuncionarios}
            />
          </div>

          <ProgrammingGroupModals
            isCreateGroupModalOpen={isCreateGroupModalOpen}
            isEditGroupModalOpen={isEditGroupModalOpen}
            isDeleteGroupModalOpen={isDeleteGroupModalOpen}
            newGroupName={newGroupName}
            setNewGroupName={setNewGroupName}
            groupToDelete={groupToDelete}
            addingToGroup={addingToGroup}
            setIsCreateGroupModalOpen={setIsCreateGroupModalOpen}
            setIsEditGroupModalOpen={setIsEditGroupModalOpen}
            setIsDeleteGroupModalOpen={setIsDeleteGroupModalOpen}
            setAddingToGroup={setAddingToGroup}
            confirmCreateGroup={confirmCreateGroup}
            confirmEditGroup={confirmEditGroup}
            confirmDeleteGroup={confirmDeleteGroup}
          />
        </>
      )}
    </div>
  );
}
