export const HOME_TIMELINE_CONFIG_KEY = "home_timeline";
export const HOME_TIMELINE_DESCRIPTION = "Línea de tiempo editable de la página Inicio";

export const HOME_TIMELINE_COLORS = ["indigo", "emerald", "amber", "rose", "violet"] as const;

export type HomeTimelineColor = typeof HOME_TIMELINE_COLORS[number];

export interface HomeTimelineSectionContent {
  title: string;
  subtitle: string;
  description: string;
  showTitle: boolean;
  showSubtitle: boolean;
  showDescription: boolean;
}

export interface HomeTimelineMilestone {
  id: string;
  title: string;
  date: string;
  description: string;
  color: HomeTimelineColor;
  isActive?: boolean;
}

export interface HomeTimelineConfig {
  section: HomeTimelineSectionContent;
  milestones: HomeTimelineMilestone[];
}

type RawMilestone = Partial<HomeTimelineMilestone>;

interface RawTimelineConfig {
  title?: unknown;
  subtitle?: unknown;
  description?: unknown;
  section?: Partial<HomeTimelineSectionContent> | null;
  milestones?: unknown;
}

export const DEFAULT_HOME_TIMELINE_SECTION: HomeTimelineSectionContent = {
  title: "Línea de tiempo",
  subtitle: "Hitos del proceso",
  description: "Resumen visual del flujo operativo en Inicio. Los administradores pueden ajustar hitos, fechas y color de cada etapa.",
  showTitle: true,
  showSubtitle: true,
  showDescription: true,
};

export const DEFAULT_HOME_TIMELINE: HomeTimelineMilestone[] = [
  {
    id: "timeline-1",
    title: "Definición del período",
    date: "Semana 1",
    description: "Se consolidan fechas, equipos y prioridades iniciales para preparar la programación.",
    color: "indigo",
    isActive: true,
  },
  {
    id: "timeline-2",
    title: "Carga de insumos",
    date: "Semana 2",
    description: "Se integran especialidades, procesos, actividades y otros datos base del período.",
    color: "emerald",
    isActive: false,
  },
  {
    id: "timeline-3",
    title: "Programación y revisión",
    date: "Semana 3",
    description: "Los responsables ajustan la programación, validan observaciones y corrigen desvíos.",
    color: "amber",
    isActive: false,
  },
  {
    id: "timeline-4",
    title: "Cierre y seguimiento",
    date: "Semana 4",
    description: "Se revisa el resultado final del período y quedan listos los próximos hitos operativos.",
    color: "rose",
    isActive: false,
  },
];

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isHomeTimelineColor(value: unknown): value is HomeTimelineColor {
  return typeof value === "string" && HOME_TIMELINE_COLORS.includes(value as HomeTimelineColor);
}

export function createEmptyMilestone(index: number): HomeTimelineMilestone {
  return {
    id: `timeline-${Date.now()}-${index}`,
    title: "",
    date: "",
    description: "",
    color: HOME_TIMELINE_COLORS[index % HOME_TIMELINE_COLORS.length],
    isActive: false,
  };
}

export function sanitizeTimelineMilestones(value: unknown): HomeTimelineMilestone[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map<HomeTimelineMilestone | null>((item, index) => {
      const milestone = item as RawMilestone;
      const title = normalizeText(milestone?.title);
      const date = normalizeText(milestone?.date);
      const description = normalizeText(milestone?.description);

      if (!title || !date) {
        return null;
      }

      return {
        id: normalizeText(milestone?.id) || `timeline-${index + 1}`,
        title,
        date,
        description,
        isActive: Boolean(milestone?.isActive),
        color: isHomeTimelineColor(milestone?.color)
          ? milestone.color
          : HOME_TIMELINE_COLORS[index % HOME_TIMELINE_COLORS.length],
      } satisfies HomeTimelineMilestone;
    })
    .filter((milestone): milestone is HomeTimelineMilestone => milestone !== null);
}

export function sanitizeTimelineSection(value: unknown): HomeTimelineSectionContent {
  const section = typeof value === "object" && value !== null ? (value as Partial<HomeTimelineSectionContent>) : {};

  return {
    title: normalizeText(section.title) || DEFAULT_HOME_TIMELINE_SECTION.title,
    subtitle: normalizeText(section.subtitle) || DEFAULT_HOME_TIMELINE_SECTION.subtitle,
    description: normalizeText(section.description) || DEFAULT_HOME_TIMELINE_SECTION.description,
    showTitle: typeof section.showTitle === "boolean" ? section.showTitle : DEFAULT_HOME_TIMELINE_SECTION.showTitle,
    showSubtitle: typeof section.showSubtitle === "boolean" ? section.showSubtitle : DEFAULT_HOME_TIMELINE_SECTION.showSubtitle,
    showDescription: typeof section.showDescription === "boolean" ? section.showDescription : DEFAULT_HOME_TIMELINE_SECTION.showDescription,
  };
}

export function sanitizeTimelineConfig(value: unknown): HomeTimelineConfig {
  if (Array.isArray(value)) {
    return {
      section: DEFAULT_HOME_TIMELINE_SECTION,
      milestones: sanitizeTimelineMilestones(value),
    };
  }

  const config = typeof value === "object" && value !== null ? (value as RawTimelineConfig) : {};
  const rawSection = config.section ?? {
    title: config.title,
    subtitle: config.subtitle,
    description: config.description,
  };

  return {
    section: sanitizeTimelineSection(rawSection),
    milestones: sanitizeTimelineMilestones(config.milestones),
  };
}

export function parseTimelineConfig(rawValue: string | null | undefined): HomeTimelineConfig {
  if (!rawValue?.trim()) {
    return {
      section: DEFAULT_HOME_TIMELINE_SECTION,
      milestones: [],
    };
  }

  try {
    return sanitizeTimelineConfig(JSON.parse(rawValue));
  } catch {
    return {
      section: DEFAULT_HOME_TIMELINE_SECTION,
      milestones: [],
    };
  }
}

export function serializeTimelineConfig(config: HomeTimelineConfig): string {
  const sanitizedConfig = sanitizeTimelineConfig(config);

  return JSON.stringify({
    section: sanitizedConfig.section,
    milestones: sanitizedConfig.milestones.map(({ id, title, date, description, color, isActive }) => ({
      id,
      title,
      date,
      description,
      color,
      isActive: Boolean(isActive),
    })),
  });
}

export function serializeTimelineMilestones(milestones: HomeTimelineMilestone[]): string {
  return JSON.stringify(
    sanitizeTimelineMilestones(milestones).map(({ id, title, date, description, color, isActive }) => ({
      id,
      title,
      date,
      description,
      color,
      isActive: Boolean(isActive),
    }))
  );
}
