import { createContext, useContext } from 'react';

export interface Period {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    status: 'ANTIGUO' | 'ACTIVO' | 'OCULTO';
    is_active: boolean; // Deprecated but kept for compatibility
    is_closed: boolean;
}

export interface PeriodsContextType {
    periods: Period[];
    selectedPeriod: Period | null;
    activePeriod: Period | null;
    loading: boolean;
    isReadOnly: boolean;
    setSelectedPeriod: (period: Period | null) => void;
    refreshPeriods: (options?: { forceActiveSelection?: boolean }) => Promise<void>;
}

export const PeriodsContext = createContext<PeriodsContextType | undefined>(undefined);

export const usePeriods = () => {
    const context = useContext(PeriodsContext);
    if (context === undefined) {
        throw new Error('usePeriods must be used within a PeriodsProvider');
    }
    return context;
};
