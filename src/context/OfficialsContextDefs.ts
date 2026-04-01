import { createContext, useContext } from 'react';

export interface Funcionario {
  id: number;
  name: string;
  title: string;
  rut: string;
  law: string;
  hours: number | string;
  initial: string;
  color: string;
  isScheduled: boolean;
  programmingId?: number;
  groupId: number;
  sisSpecialty: string;
  lunchTime: string;
  status: string; // Added status
  inactiveReason?: string;
  // Added fields
  holidayDays: number;
  administrativeDays: number;
  congressDays: number;
  breastfeedingTime: number;
  
  lastUpdated: string;
  createdAtRaw?: string; // Optional raw date string for sorting
  observations: string;
  programmingUpdatedAt?: string;
  totalScheduledHours?: number;
  contracts?: {
    id: number;
    law_code: string;
    hours: number;
    observations: string;
  }[];
}

export interface Group {
  id: number;
  name: string;
  count: number;
   isAutomatic?: boolean;
}

export interface OfficialsContextType {
  officials: Funcionario[];
  addOfficial: (official: Funcionario) => Promise<void>;
  removeOfficial: (id: number, reason?: string) => Promise<void>;
  activateOfficial: (id: number) => Promise<void>; // Added activate
  updateOfficialLocally: (id: number, patch: Partial<Funcionario>) => void;
  searchOfficials: (query: string, global?: boolean) => Promise<Funcionario[]>;
  hrDatabase: Funcionario[]; // Kept for compatibility, but might be empty or full list if needed
  groups: Group[];
  addGroup: (name: string) => void;
  updateGroup: (id: number, name: string) => void;
  removeGroup: (id: number) => void;
  assignToGroup: (officialId: number, groupId: number) => Promise<void>;
  refreshOfficials: () => Promise<void>;
}

export const OfficialsContext = createContext<OfficialsContextType | undefined>(undefined);

export function useOfficials() {
  const context = useContext(OfficialsContext);
  if (context === undefined) {
    throw new Error('useOfficials must be used within an OfficialsProvider');
  }
  return context;
}
