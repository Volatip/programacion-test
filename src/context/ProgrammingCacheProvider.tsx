import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOfficials } from './OfficialsContext';
import { usePeriods } from './PeriodsContext';
import { fetchWithAuth } from '../lib/api';
import { ProgrammingCacheContext, ProgrammingData } from './ProgrammingCacheContextDefs';

export function ProgrammingCacheProvider({ children }: { children: React.ReactNode }) {
  const { officials } = useOfficials();
  const { selectedPeriod } = usePeriods();
  const selectedPeriodId = selectedPeriod?.id ?? null;
  const [cache, setCache] = useState<Record<number, ProgrammingData>>({});
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState(0);
  const cacheRef = useRef<Record<number, ProgrammingData>>({});
  const inFlightFetchesRef = useRef<Map<string, Promise<ProgrammingData | null>>>(new Map());
  const activePrefetchRunRef = useRef(0);

  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);
  
  const cacheProgramming = useCallback((funcionarioId: number, data: Omit<ProgrammingData, 'fetchedAt'>) => {
    const enriched: ProgrammingData = { ...data, fetchedAt: Date.now() };
    setCache(prev => ({
      ...prev,
      [funcionarioId]: enriched
    }));
    cacheRef.current = {
      ...cacheRef.current,
      [funcionarioId]: enriched
    };
    return enriched;
  }, []);

  const fetchBatch = useCallback(async (
    funcionarioIds: number[],
    periodId: number,
    options?: { forceRefresh?: boolean }
  ): Promise<Record<number, ProgrammingData>> => {
    if (funcionarioIds.length === 0) {
      return {};
    }

    try {
      const uniqueFuncionarioIds = [...new Set(funcionarioIds)].filter((funcionarioId) => options?.forceRefresh || !cacheRef.current[funcionarioId]);
      if (uniqueFuncionarioIds.length === 0) {
        return {};
      }

      const queryParams = new URLSearchParams({
        period_id: periodId.toString(),
      });

      for (const funcionarioId of uniqueFuncionarioIds) {
        queryParams.append('funcionario_ids', funcionarioId.toString());
      }

      const response = await fetchWithAuth(`/programming?${queryParams.toString()}`);
      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const officialsMap = new Map<number, ProgrammingData>();

      for (const programming of data) {
        if (!programming?.funcionario_id) {
          continue;
        }

        officialsMap.set(
          programming.funcionario_id,
          cacheProgramming(programming.funcionario_id, programming)
        );
      }

      return Object.fromEntries(officialsMap.entries());
    } catch (error) {
      console.error('[BackgroundExtract] Error fetching batch:', error);
      return {};
    }
  }, [cacheProgramming]);

  // Helper to fetch single programming
  const fetchSingle = useCallback(async (
    funcionarioId: number,
    periodId: number,
    options?: { forceRefresh?: boolean }
  ): Promise<ProgrammingData | null> => {
    const cached = cacheRef.current[funcionarioId];
    if (cached && !options?.forceRefresh) {
      return cached;
    }

    const requestKey = `${periodId}:${funcionarioId}:${options?.forceRefresh ? "refresh" : "default"}`;
    const inFlightRequest = inFlightFetchesRef.current.get(requestKey);
    if (inFlightRequest) {
      return inFlightRequest;
    }

    const requestPromise = (async () => {
      try {
        const results = await fetchBatch([funcionarioId], periodId, options);
        const latest = results[funcionarioId] || null;

        if (!latest && options?.forceRefresh) {
          setCache((prev) => {
            if (!(funcionarioId in prev)) {
              return prev;
            }

            const next = { ...prev };
            delete next[funcionarioId];
            cacheRef.current = next;
            return next;
          });
        }

        return latest;
      } catch (error) {
        console.error(`[BackgroundExtract] Error fetching for ${funcionarioId}:`, error);
        return null;
      } finally {
        inFlightFetchesRef.current.delete(requestKey);
      }
    })();

    inFlightFetchesRef.current.set(requestKey, requestPromise);

    try {
      return await requestPromise;
    } catch {
      return null;
    }
  }, [fetchBatch]);

  // Exposed method for manual fetch (e.g. from Modal if cache miss)
  const fetchProgramming = useCallback(async (
    funcionarioId: number,
    periodId: number,
    options?: { forceRefresh?: boolean }
  ) => {
    // Check cache first
    if (cacheRef.current[funcionarioId] && !options?.forceRefresh) return cacheRef.current[funcionarioId];
    return await fetchSingle(funcionarioId, periodId, options);
  }, [fetchSingle]);

  const getCachedProgramming = useCallback((funcionarioId: number) => {
    return cacheRef.current[funcionarioId];
  }, []);

  const updateCache = useCallback((funcionarioId: number, data: ProgrammingData) => {
    setCache(prev => ({
      ...prev,
      [funcionarioId]: { ...data, fetchedAt: Date.now() }
    }));
    cacheRef.current = {
      ...cacheRef.current,
      [funcionarioId]: { ...data, fetchedAt: Date.now() }
    };
  }, []);

  const removeCachedProgramming = useCallback((funcionarioId: number) => {
    if (funcionarioId in cacheRef.current) {
      const nextRef = { ...cacheRef.current };
      delete nextRef[funcionarioId];
      cacheRef.current = nextRef;
    }

    setCache(prev => {
      if (!(funcionarioId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[funcionarioId];
      return next;
    });
  }, []);

  useEffect(() => {
    activePrefetchRunRef.current += 1;
    inFlightFetchesRef.current.clear();
    cacheRef.current = {};
    setCache({});
    setIsPrefetching(false);
    setPrefetchProgress(0);
  }, [selectedPeriodId]);

  // Background Worker Logic
  useEffect(() => {
    if (!selectedPeriodId || officials.length === 0) return;

    const currentRunId = activePrefetchRunRef.current + 1;
    activePrefetchRunRef.current = currentRunId;

    const runBackgroundExtraction = async () => {
      const candidates = officials.filter((o) =>
        o.programmingId && // Has programming
        !cacheRef.current[o.id] // Not in cache
      );

      if (candidates.length === 0) return;

      console.log(`[BackgroundExtract] Found ${candidates.length} records to prefetch.`);
      setIsPrefetching(true);
      setPrefetchProgress(0);

      // Process in batches to reduce the N+1 pattern.
      const BATCH_SIZE = 25;
      let processed = 0;

      for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        if (activePrefetchRunRef.current !== currentRunId) {
          return;
        }

        const batch = candidates.slice(i, i + BATCH_SIZE);
        await fetchBatch(batch.map(c => c.id), selectedPeriodId);
        processed += batch.length;
        setPrefetchProgress(Math.round((processed / candidates.length) * 100));

        // Small delay to yield to main thread
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (activePrefetchRunRef.current !== currentRunId) {
        return;
      }

      console.log(`[BackgroundExtract] Batch complete. Cache size: ${Object.keys(cacheRef.current).length}`);
      setIsPrefetching(false);
      setPrefetchProgress(100);
    };

    // Debounce slightly to avoid running on every keystroke if officials list updates frequently
    const timeout = setTimeout(runBackgroundExtraction, 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, [officials, selectedPeriodId, fetchBatch]);

  return (
    <ProgrammingCacheContext.Provider value={{ 
      cache, 
      getCachedProgramming, 
      fetchProgramming,
      updateCache,
      removeCachedProgramming,
      isPrefetching,
      prefetchProgress
    }}>
      {children}
    </ProgrammingCacheContext.Provider>
  );
}
