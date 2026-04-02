import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "../lib/api";

export interface DashboardStats {
  summary: {
    active_officials: number;
    programmed: number;
    unprogrammed: number;
    period_name: string;
    inactive_total: number;
    inactive_resignation: number;
    inactive_mobility: number;
    shift_hours?: number;
    shift_officials_count?: number;
  };
  chart_data: {
    period: string;
    hours: number;
    shift_hours: number;
  }[];
  group_chart_data?: {
    name: string;
    hours: number;
    shift_hours: number;
    count: number;
    shift_count: number;
  }[];
}

interface UseDashboardStatsOptions {
  periodId?: number;
  userId?: number;
  enabled?: boolean;
}

export function useDashboardStats({ periodId, userId, enabled = true }: UseDashboardStatsOptions) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async (retryCount = 0) => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    const maxRetries = 3;
    const baseDelay = 1000;

    try {
      const queryParams = new URLSearchParams();
      if (periodId) {
        queryParams.append("period_id", periodId.toString());
      }
      if (userId) {
        queryParams.append("user_id", userId.toString());
      }

      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetchWithAuth(`/stats/dashboard?${queryParams.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) throw new Error("Endpoint no encontrado (404)");
        if (response.status === 500) throw new Error("Error interno del servidor (500)");
        throw new Error(`Error en la solicitud: ${response.status}`);
      }

      const data: DashboardStats = await response.json();
      setStats(data);
    } catch (caughtError: unknown) {
      if (caughtError instanceof Error && caughtError.name === "AbortError") {
        console.log("Fetch aborted");
        return;
      }

      const typedError =
        caughtError instanceof Error ? caughtError : new Error("No se pudieron cargar los datos.");

      console.error(`Attempt ${retryCount + 1} failed:`, typedError);

      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`Retrying in ${delay}ms...`);
        setTimeout(() => {
          void fetchStats(retryCount + 1);
        }, delay);
      } else {
        setError(typedError.message || "No se pudieron cargar los datos. Por favor intente más tarde.");
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, periodId, userId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchStats();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
}
