import React, { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { usePeriods } from './PeriodsContext';
import { fetchWithAuth, buildApiUrl, parseErrorDetail } from '../lib/api';
import { OfficialsContext, Funcionario, Group } from './OfficialsContextDefs';
import { buildProgrammingGroups } from '../lib/programmingGroups';
import { useSupervisorScope } from './SupervisorScopeContext';

interface RawFuncionario {
  id: number;
  name: string;
  title?: string;
  rut?: string;
  dv?: string;
  law_code?: string;
  hours_per_week?: number;
  is_scheduled?: boolean;
  programming_id?: number;
  group_id?: number;
  specialty_sis?: string;
  lunch_time_minutes?: number;
  status?: string;
  inactive_reason?: string | null;
  active_status_label?: string | null;
  has_future_dismiss_scheduled?: boolean;
  future_dismiss_start_date?: string | null;
  holiday_days?: number;
  administrative_days?: number;
  congress_days?: number;
  breastfeeding_time?: number;
  created_at: string;
  observations?: string;
  programming_updated_at?: string;
  total_scheduled_hours?: number;
  contracts?: {
    id: number;
    law_code: string;
    hours: number;
    observations: string;
  }[];
}

interface RawGroup {
  id: number;
  name: string;
  count?: number;
}

export function OfficialsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { selectedPeriod } = usePeriods();
  const { isSupervisor, isScopeReady, selectedUserId: scopedUserId } = useSupervisorScope();
  const [officials, setOfficials] = useState<Funcionario[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const groupsWithCurrentPeriodCounts = useMemo(() => {
    return buildProgrammingGroups(groups, officials);
  }, [groups, officials]);

  useEffect(() => {
    setOfficials([]);
    setGroups([]);
  }, [user?.id, selectedPeriod?.id, scopedUserId]);

  const mapFuncionario = (item: RawFuncionario): Funcionario => ({
    id: item.id,
    name: item.name,
    title: item.title,
    rut: item.rut && item.dv ? `${item.rut}-${item.dv}` : item.rut || "",
    law: item.law_code || "",
    hours: item.hours_per_week || 0,
    initial: item.name.charAt(0).toUpperCase(),
    color: "bg-blue-600",
    isScheduled: item.is_scheduled || false,
    programmingId: item.programming_id,
    groupId: item.group_id || 0,
    sisSpecialty: item.specialty_sis || "Sin Especialidad",
    lunchTime: `${item.lunch_time_minutes || 0} min`,
    status: item.status || "activo", // Added status
    inactiveReason: item.inactive_reason || undefined,
    activeStatusLabel: item.active_status_label || undefined,
    hasFutureDismissScheduled: item.has_future_dismiss_scheduled || false,
    futureDismissStartDate: item.future_dismiss_start_date || undefined,
    
    holidayDays: item.holiday_days || 0,
    administrativeDays: item.administrative_days || 0,
    congressDays: item.congress_days || 0,
    breastfeedingTime: item.breastfeeding_time || 0,

    lastUpdated: new Date(item.created_at).toLocaleDateString(),
    createdAtRaw: item.created_at, // Store raw date for sorting
    observations: item.observations || "",
    programmingUpdatedAt: item.programming_updated_at,
    totalScheduledHours: item.total_scheduled_hours || 0,
    contracts: item.contracts || []
  });

  const updateOfficialLocally = useCallback((id: number, patch: Partial<Funcionario>) => {
    setOfficials((prev) =>
      prev.map((official) => (official.id === id ? { ...official, ...patch } : official))
    );
  }, []);

  const fetchOfficials = useCallback(async () => {
    if (!user || !selectedPeriod || (isSupervisor && !isScopeReady)) {
      setOfficials([]);
      return;
    }
    try {
      const queryParams = new URLSearchParams({
        active_only: "false",
        period_id: selectedPeriod.id.toString(),
      });
      if (isSupervisor && scopedUserId) {
        queryParams.append("user_id", scopedUserId.toString());
      }

      const response = await fetchWithAuth(`/funcionarios?${queryParams.toString()}`);
      if (response.ok) {
        const data: RawFuncionario[] = await response.json();
        const mappedOfficials = data.map(mapFuncionario);
        setOfficials(mappedOfficials);
      } else {
        setOfficials([]);
      }
    } catch (error) {
      setOfficials([]);
      console.error("Error fetching officials:", error);
    }
  }, [isScopeReady, isSupervisor, scopedUserId, user, selectedPeriod]);

  useEffect(() => {
    fetchOfficials();
  }, [fetchOfficials]); // Refetch when user or period changes

  const searchOfficials = async (query: string, global: boolean = false): Promise<Funcionario[]> => {
    if (isSupervisor && !isScopeReady) {
      return [];
    }

    try {
      let url = `/funcionarios/search?q=${query}`;
      if (global) {
        url += `&search_mode=global`;
      } else {
        url += `&search_mode=local`;
      }
      
      if (selectedPeriod) {
        url += `&period_id=${selectedPeriod.id}`;
      }

      if (isSupervisor && scopedUserId) {
        url += `&user_id=${scopedUserId}`;
      }
      
      const response = await fetchWithAuth(url);
      if (response.ok) {
        const data: RawFuncionario[] = await response.json();
        return data.map(mapFuncionario);
      }
      return [];
    } catch (error) {
      console.error("Error searching officials:", error);
      return [];
    }
  };

  const fetchGroups = useCallback(async () => {
    if (!user || !selectedPeriod || (isSupervisor && !isScopeReady)) {
      setGroups([]);
      return;
    }
    try {
      const queryParams = new URLSearchParams({
        period_id: selectedPeriod.id.toString(),
      });
      if (isSupervisor && scopedUserId) {
        queryParams.append("user_id", scopedUserId.toString());
      }

      const response = await fetchWithAuth(`/groups?${queryParams.toString()}`);
      if (response.ok) {
        const data: RawGroup[] = await response.json();
        setGroups(data.map((g) => ({
          id: g.id,
          name: g.name,
          count: g.count || 0
        })));
      } else {
        setGroups([]);
      }
    } catch (error) {
      setGroups([]);
      console.error("Error fetching groups:", error);
    }
  }, [isScopeReady, isSupervisor, scopedUserId, user, selectedPeriod]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const addOfficial = async (official: Funcionario) => {
    if (!user) return;
    try {
      // Use new bind endpoint
      const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${official.id}/bind`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await fetchOfficials();
      }
    } catch (error) {
      console.error("Error activating official:", error);
    }
  };

  const removeOfficial = async (id: number, reason?: string | { reasonId?: number; reason?: string; suboptionId?: number; suboption?: string; partialHours?: number; startDate?: string }) => {
    if (!user) return;
    try {
      if (reason) {
        const payload = typeof reason === 'string'
          ? { reason }
          : {
              reason_id: reason.reasonId,
              reason: reason.reason,
              suboption_id: reason.suboptionId,
              suboption: reason.suboption,
              partial_hours: reason.partialHours,
              start_date: reason.startDate,
            };

        const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${id}/dismiss`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
             const result = await response.json();
             if (result.action === "Hide") {
                  setOfficials(prev => prev.filter(o => o.id !== id));
              } else {
                   setOfficials(prev => prev.map(o => o.id === id ? {
                     ...o,
                     status: result.status || 'inactivo',
                     inactiveReason: result.status === 'inactivo' ? result.reason : undefined,
                     activeStatusLabel: result.active_status_label || undefined,
                     hasFutureDismissScheduled: result.has_future_dismiss_scheduled || false,
                     futureDismissStartDate: result.future_dismiss_start_date || undefined,
                   } : o));
               }
        } else {
            throw new Error(await parseErrorDetail(response, "No se pudo procesar la baja del funcionario."));
        }
      } else {
        // Fallback or just unbind logic if needed (though UI should drive this)
        // Use new unbind endpoint
        const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${id}/bind`), {
            method: 'DELETE'
        });
        if (response.ok) {
            setOfficials(prev => prev.filter(o => o.id !== id));
        }
      }
    } catch (error) {
      console.error("Error deactivating official:", error);
      throw error;
    }
  };

  const activateOfficial = useCallback(async (id: number) => {
    if (!user) return;
    try {
        const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${id}/activate`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
             updateOfficialLocally(id, { status: 'activo', inactiveReason: undefined, activeStatusLabel: undefined, hasFutureDismissScheduled: false, futureDismissStartDate: undefined });
        }
    } catch (error) {
        console.error("Error activating official:", error);
    }
  }, [user, updateOfficialLocally]);

  const clearPartialCommission = useCallback(async (id: number) => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${id}/activate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clear_partial_commission: true })
      });

      if (response.ok) {
        updateOfficialLocally(id, { status: 'activo', inactiveReason: undefined, activeStatusLabel: undefined, hasFutureDismissScheduled: false, futureDismissStartDate: undefined });
      }
    } catch (error) {
      console.error("Error clearing partial commission:", error);
      throw error;
    }
  }, [user, updateOfficialLocally]);

  const clearFutureDismiss = useCallback(async (id: number) => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${id}/clear-future-dismiss`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        updateOfficialLocally(id, {
          status: 'activo',
          inactiveReason: undefined,
          activeStatusLabel: undefined,
          hasFutureDismissScheduled: false,
          futureDismissStartDate: undefined,
        });
        return;
      }

      throw new Error(await parseErrorDetail(response, 'No se pudo quitar la baja futura del funcionario.'));
    } catch (error) {
      console.error('Error clearing future dismiss:', error);
      throw error;
    }
  }, [user, updateOfficialLocally]);

  const addGroup = async (name: string) => {
    if (!user || !selectedPeriod) return;
    try {
      const response = await fetchWithAuth(buildApiUrl('/groups'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, period_id: selectedPeriod.id })
      });
      if (response.ok) {
        fetchGroups();
      }
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const updateGroup = async (id: number, name: string) => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(buildApiUrl(`/groups/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      if (response.ok) {
        fetchGroups();
      }
    } catch (error) {
      console.error("Error updating group:", error);
    }
  };

  const removeGroup = async (id: number) => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(buildApiUrl(`/groups/${id}`), {
        method: 'DELETE'
      });
      if (response.ok) {
        setGroups(prev => prev.filter(g => g.id !== id));
      }
    } catch (error) {
      console.error("Error deleting group:", error);
    }
  };

  const assignToGroup = async (officialId: number, groupId: number) => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${officialId}/group`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ group_id: groupId || null })
      });
      
      if (response.ok) {
        setOfficials(prev => prev.map(o => {
            if (o.id === officialId) {
                return { ...o, groupId: groupId };
            }
            return o;
        }));
        // Refresh groups to update counts if we implement counting
        fetchGroups();
        return;
      }

      throw new Error(await parseErrorDetail(response, "No se pudo asignar el funcionario al grupo."));
    } catch (error) {
      console.error("Error assigning group:", error);
      throw error;
    }
  };

  return (
    <OfficialsContext.Provider value={{ 
      officials, 
      addOfficial, 
      removeOfficial,
      activateOfficial,
      clearPartialCommission,
      clearFutureDismiss,
      updateOfficialLocally,
      searchOfficials,
      hrDatabase: officials, 
      groups: groupsWithCurrentPeriodCounts,
      addGroup,
      updateGroup,
      removeGroup,
      assignToGroup,
      refreshOfficials: fetchOfficials
    }}>
      {children}
    </OfficialsContext.Provider>
  );
}
