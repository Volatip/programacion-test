import { createContext, useContext } from 'react';

export interface ProgrammingItemData {
  id?: number;
  activity_name: string;
  activity_type_id?: number | null;
  specialty: string;
  assigned_hours: number;
  performance: number;
}

export interface ProgrammingData {
  id: number;
  version: number;
  observation: string;
  assigned_group_id: number | null;
  assigned_status: string;
  status_start_date: string;
  status_end_date: string;
  prais: boolean;
  global_specialty: string;
  selected_process: string;
  selected_performance_unit: string;
  time_unit: string;
  dismiss_reason_id?: number | null;
  dismiss_suboption_id?: number | null;
  dismiss_partial_hours?: number | null;
  items: ProgrammingItemData[];
  updated_at: string;
  created_by_name?: string;
  updated_by_name?: string;
  fetchedAt: number; // Timestamp for cache invalidation if needed
}

export interface ProgrammingCacheContextType {
  cache: Record<number, ProgrammingData>;
  getCachedProgramming: (funcionarioId: number) => ProgrammingData | undefined;
  fetchProgramming: (funcionarioId: number, periodId: number, options?: { forceRefresh?: boolean }) => Promise<ProgrammingData | null>;
  updateCache: (funcionarioId: number, data: ProgrammingData) => void;
  removeCachedProgramming: (funcionarioId: number) => void;
  isPrefetching: boolean;
  prefetchProgress: number; // 0 to 100
}

export const ProgrammingCacheContext = createContext<ProgrammingCacheContextType | undefined>(undefined);

export function useProgrammingCache() {
  const context = useContext(ProgrammingCacheContext);
  if (context === undefined) {
    throw new Error('useProgrammingCache must be used within a ProgrammingCacheProvider');
  }
  return context;
}
