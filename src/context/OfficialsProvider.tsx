import React, { useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { usePeriods } from './PeriodsContext';
import { fetchWithAuth, buildApiUrl } from '../lib/api';
import { OfficialsContext, Funcionario, Group } from './OfficialsContextDefs';

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
  const [officials, setOfficials] = useState<Funcionario[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    setOfficials([]);
    setGroups([]);
  }, [user?.id]);

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
    if (!user || !selectedPeriod) {
      setOfficials([]);
      return;
    }
    try {
      const response = await fetchWithAuth(`/funcionarios?active_only=false&period_id=${selectedPeriod.id}`);
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
  }, [user, selectedPeriod]);

  useEffect(() => {
    fetchOfficials();
  }, [fetchOfficials]); // Refetch when user or period changes

  const searchOfficials = async (query: string, global: boolean = false): Promise<Funcionario[]> => {
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
    if (!user) {
      setGroups([]);
      return;
    }
    try {
      const response = await fetchWithAuth('/groups');
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
  }, [user]);

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

  const removeOfficial = async (id: number, reason?: string) => {
    if (!user) return;
    try {
      if (reason) {
        // New dismiss logic
        const response = await fetchWithAuth(buildApiUrl(`/funcionarios/${id}/dismiss`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ reason: reason })
        });
        
        if (response.ok) {
            // Update UI accordingly
            if (reason === "Agregado por Error") {
                 setOfficials(prev => prev.filter(o => o.id !== id));
            } else {
                 // Soft delete/Status change
                 setOfficials(prev => prev.map(o => o.id === id ? { ...o, status: 'inactivo' } : o));
            }
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
             updateOfficialLocally(id, { status: 'activo' });
        }
    } catch (error) {
        console.error("Error activating official:", error);
    }
  }, [user, updateOfficialLocally]);

  const addGroup = async (name: string) => {
    if (!user) return;
    try {
      const response = await fetchWithAuth(buildApiUrl('/groups'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
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
      }
    } catch (error) {
      console.error("Error assigning group:", error);
    }
  };

  return (
    <OfficialsContext.Provider value={{ 
      officials, 
      addOfficial, 
      removeOfficial,
      activateOfficial, 
      updateOfficialLocally,
      searchOfficials,
      hrDatabase: officials, 
      groups,
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
