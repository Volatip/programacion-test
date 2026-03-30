import { useEffect, useMemo, useState } from "react";
import type { Funcionario, Group } from "../context/OfficialsContextDefs";

interface UseAddOfficialToGroupModalParams {
  isOpen: boolean;
  officials: Funcionario[];
  groups: Group[];
  groupId: number;
  assignToGroup: (officialId: number, groupId: number) => Promise<void>;
}

export function useAddOfficialToGroupModal({
  isOpen,
  officials,
  groups,
  groupId,
  assignToGroup,
}: UseAddOfficialToGroupModalParams) {
  const [searchQuery, setSearchQuery] = useState("");
  const [addedOfficials, setAddedOfficials] = useState<number[]>([]);
  const [recentAddedId, setRecentAddedId] = useState<number | null>(null);

  const availableOfficials = useMemo(
    () =>
      officials
        .filter((official) => official.groupId !== groupId && official.status === "activo" && !addedOfficials.includes(official.id))
        .sort((a, b) => {
          const aHasGroup = a.groupId !== null && a.groupId !== undefined && a.groupId !== 0;
          const bHasGroup = b.groupId !== null && b.groupId !== undefined && b.groupId !== 0;

          if (aHasGroup !== bHasGroup) {
            return aHasGroup ? 1 : -1;
          }

          const dateA = a.createdAtRaw ? new Date(a.createdAtRaw).getTime() : 0;
          const dateB = b.createdAtRaw ? new Date(b.createdAtRaw).getTime() : 0;

          if (dateA !== dateB) {
            return dateA - dateB;
          }

          return a.id - b.id;
        }),
    [addedOfficials, groupId, officials],
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableOfficials;
    }

    const query = searchQuery.toLowerCase();
    return availableOfficials.filter(
      (official) => official.name.toLowerCase().includes(query) || official.rut.toLowerCase().includes(query),
    );
  }, [availableOfficials, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setAddedOfficials([]);
      setRecentAddedId(null);
    }
  }, [isOpen]);

  const handleAdd = async (official: Funcionario) => {
    await assignToGroup(official.id, groupId);
    setAddedOfficials((prev) => [...prev, official.id]);
    setRecentAddedId(official.id);

    setTimeout(() => {
      setRecentAddedId(null);
    }, 2000);
  };

  const getCurrentGroupName = (currentGroupId: number) => {
    if (!currentGroupId) {
      return "Sin grupo";
    }

    const group = groups.find((item) => item.id === currentGroupId);
    return group ? group.name : "Desconocido";
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    recentAddedId,
    addedCount: addedOfficials.length,
    handleAdd,
    getCurrentGroupName,
  };
}
