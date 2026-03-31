import { useEffect, useState } from "react";
import { buildApiUrl, fetchWithAuth } from "../lib/api";
import { normalizeText } from "../lib/normalizeText";

export interface ActivityConfig {
  id: number;
  name: string;
  order_index?: number;
  profession?: string;
  specialty?: string;
  process?: string;
  visible?: string;
  req_rendimiento?: string;
}

interface SpecialtyConfig {
  name: string;
  stats?: {
    new_consult_percentage: number;
    yield_new: number;
    yield_control: number;
  };
}

interface NamedConfig {
  name: string;
}

export interface ProgrammingConfigData {
  activities: ActivityConfig[];
  performanceUnits: string[];
  processList: string[];
  rawProcesses: string[];
  specialties: string[];
  specialtyStats: Record<string, { newConsultPercentage: number; minsalYieldNew: number; minsalYieldControl: number }>;
}

const programmingConfigCache = new Map<number, Omit<ProgrammingConfigData, "processList">>();
const programmingConfigInFlight = new Map<number, Promise<Omit<ProgrammingConfigData, "processList">>>();

async function loadProgrammingConfig(periodId: number): Promise<Omit<ProgrammingConfigData, "processList">> {
  const cached = programmingConfigCache.get(periodId);
  if (cached) {
    return cached;
  }

  const inFlight = programmingConfigInFlight.get(periodId);
  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const periodQuery = `?period_id=${periodId}`;
    const [specsRes, procsRes, actsRes, unitsRes] = await Promise.all([
      fetchWithAuth(buildApiUrl(`/config/specialties${periodQuery}`)),
      fetchWithAuth(buildApiUrl(`/config/processes${periodQuery}`)),
      fetchWithAuth(buildApiUrl(`/config/activities${periodQuery}`)),
      fetchWithAuth(buildApiUrl(`/config/performance-units${periodQuery}`))
    ]);

    const config: Omit<ProgrammingConfigData, "processList"> = {
      activities: [],
      performanceUnits: [],
      rawProcesses: [],
      specialties: [],
      specialtyStats: {}
    };

    if (specsRes.ok) {
      const specs: SpecialtyConfig[] = await specsRes.json();
      config.specialties = specs.map((s) => s.name);
      specs.forEach((s) => {
        if (s.stats) {
          config.specialtyStats[s.name] = {
            newConsultPercentage: s.stats.new_consult_percentage,
            minsalYieldNew: s.stats.yield_new,
            minsalYieldControl: s.stats.yield_control
          };
        }
      });
    }

    if (procsRes.ok) {
      const procs: NamedConfig[] = await procsRes.json();
      config.rawProcesses = procs.map((p) => p.name);
    }

    if (unitsRes.ok) {
      const units: NamedConfig[] = await unitsRes.json();
      config.performanceUnits = units.map((u) => u.name);
    }

    if (actsRes.ok) {
      config.activities = await actsRes.json();
    }

    programmingConfigCache.set(periodId, config);
    programmingConfigInFlight.delete(periodId);
    return config;
  })().catch((error) => {
    programmingConfigInFlight.delete(periodId);
    throw error;
  });

  programmingConfigInFlight.set(periodId, request);
  return request;
}

export function useProgrammingConfig(periodId: number | undefined, funcionarioTitle: string | undefined) {
  const [configState, setConfigState] = useState<ProgrammingConfigData>({
    activities: [],
    performanceUnits: [],
    processList: [],
    rawProcesses: [],
    specialties: [],
    specialtyStats: {}
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!periodId) {
        if (isMounted) {
          setConfigState({
            activities: [],
            performanceUnits: [],
            processList: [],
            rawProcesses: [],
            specialties: [],
            specialtyStats: {}
          });
        }
        return;
      }

      try {
        const loadedConfig = await loadProgrammingConfig(periodId);
        if (!isMounted) {
          return;
        }

        const isMedicalOfficial = funcionarioTitle === "Médico(a) Cirujano(a)";
        let processList = loadedConfig.rawProcesses;

        if (!isMedicalOfficial) {
          const targetProfession = normalizeText(funcionarioTitle || "").toUpperCase();
          const validProcesses = new Set<string>();

          loadedConfig.activities.forEach((activity) => {
            if ((activity.visible || "SI").toUpperCase() !== "SI") {
              return;
            }

            const activityProfession = normalizeText(activity.profession || "").toUpperCase();
            if (activityProfession === targetProfession && activity.process) {
              validProcesses.add(activity.process);
            }
          });

          processList = loadedConfig.rawProcesses.filter((process) => validProcesses.has(process));
        }

        setConfigState({
          ...loadedConfig,
          processList
        });
      } catch (error) {
        if (isMounted) {
          console.error("Error fetching config:", error);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [periodId, funcionarioTitle]);

  return configState;
}
