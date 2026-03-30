import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchWithAuth } from '../lib/api';
import { PeriodsContext, Period } from './PeriodsContextDefs';

// Simple fetch wrapper since 'api' utility is missing
const api = {
    get: (url: string) => fetchWithAuth(url),
};

export const PeriodsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [periods, setPeriods] = useState<Period[]>([]);
    const [selectedPeriod, setSelectedPeriodState] = useState<Period | null>(null);
    const [activePeriod, setActivePeriod] = useState<Period | null>(null);
    const [loading, setLoading] = useState(true);

    const isReadOnly = selectedPeriod?.status === 'ANTIGUO';

    const setSelectedPeriod = (period: Period | null) => {
        setSelectedPeriodState(period);
        if (period) {
            localStorage.setItem('selectedPeriodId', period.id.toString());
        } else {
            localStorage.removeItem('selectedPeriodId');
        }
    };

    const refreshPeriods = useCallback(async () => {
        if (!isAuthenticated) return;
        setLoading(true);
        try {
            const response = await api.get('/periods');
            if (response.ok) {
                const data = await response.json();
                setPeriods(data);
                
                const active = data.find((p: Period) => p.is_active);
                setActivePeriod(active || null);
                
                // Initialize selection logic
                // 1. Try to restore from localStorage
                // 2. If not found, default to active period
                const storedId = localStorage.getItem('selectedPeriodId');
                let targetPeriod = null;

                if (storedId) {
                    targetPeriod = data.find((p: Period) => p.id === parseInt(storedId));
                }

                if (!targetPeriod && active) {
                    targetPeriod = active;
                }

                setSelectedPeriod(targetPeriod || null);
            }
        } catch (error) {
            console.error("Error fetching periods:", error);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            refreshPeriods();
        }
    }, [isAuthenticated, refreshPeriods]);

    return (
        <PeriodsContext.Provider value={{ 
            periods, 
            selectedPeriod, 
            activePeriod, 
            loading, 
            isReadOnly,
            setSelectedPeriod, 
            refreshPeriods 
        }}>
            {children}
        </PeriodsContext.Provider>
    );
};
