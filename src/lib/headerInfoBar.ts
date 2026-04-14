export const HEADER_INFO_CONFIG_KEY = "header_info_text";
export const HEADER_INFO_DESCRIPTION = "Texto de la barra informativa del header";
export const HEADER_INFO_MAX_LENGTH = 200;

export const HEADER_INFO_BAR_COLORS = ["default", "blue", "emerald", "amber", "rose", "violet"] as const;

export type HeaderInfoBarColor = typeof HEADER_INFO_BAR_COLORS[number];

export interface HeaderInfoBarSegment {
  id: string;
  text: string;
  color: HeaderInfoBarColor;
}

export interface HeaderInfoBarCountdown {
  enabled: boolean;
  targetDate: string;
  prefix: string;
  suffix: string;
  color: HeaderInfoBarColor;
}

export interface HeaderInfoBarConfig {
  version: 1;
  segments: HeaderInfoBarSegment[];
  countdown: HeaderInfoBarCountdown | null;
}

interface RawHeaderInfoBarConfig {
  version?: unknown;
  segments?: unknown;
  countdown?: unknown;
}

interface RawHeaderInfoBarSegment {
  id?: unknown;
  text?: unknown;
  color?: unknown;
}

interface RawHeaderInfoBarCountdown {
  enabled?: unknown;
  targetDate?: unknown;
  prefix?: unknown;
  suffix?: unknown;
  color?: unknown;
}

export const HEADER_INFO_BAR_COLOR_LABELS: Record<HeaderInfoBarColor, string> = {
  default: "Azul institucional",
  blue: "Azul",
  emerald: "Verde",
  amber: "Ámbar",
  rose: "Rosado",
  violet: "Violeta",
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isHeaderInfoBarColor(value: unknown): value is HeaderInfoBarColor {
  return typeof value === "string" && HEADER_INFO_BAR_COLORS.includes(value as HeaderInfoBarColor);
}

function createSegmentId(index: number): string {
  return `header-segment-${Date.now()}-${index}`;
}

export function createHeaderInfoBarSegment(index: number, overrides: Partial<HeaderInfoBarSegment> = {}): HeaderInfoBarSegment {
  return {
    id: overrides.id ?? createSegmentId(index),
    text: overrides.text ?? "",
    color: overrides.color ?? "default",
  };
}

export function createDefaultHeaderInfoBarConfig(): HeaderInfoBarConfig {
  return {
    version: 1,
    segments: [createHeaderInfoBarSegment(0, { text: "¡Bienvenido al sistema de gestión!" })],
    countdown: null,
  };
}

export function sanitizeHeaderInfoBarConfig(value: unknown): HeaderInfoBarConfig {
  if (typeof value === "string") {
    const text = value.trim();
    return {
      version: 1,
      segments: text ? [createHeaderInfoBarSegment(0, { id: "legacy-segment", text })] : [],
      countdown: null,
    };
  }

  const rawConfig = typeof value === "object" && value !== null ? (value as RawHeaderInfoBarConfig) : {};
  const rawSegments = Array.isArray(rawConfig.segments) ? rawConfig.segments : [];
  const segments = rawSegments
    .map<HeaderInfoBarSegment | null>((segment, index) => {
      const rawSegment = typeof segment === "object" && segment !== null ? (segment as RawHeaderInfoBarSegment) : {};
      const text = normalizeText(rawSegment.text);

      if (!text) {
        return null;
      }

      return createHeaderInfoBarSegment(index, {
        id: normalizeText(rawSegment.id) || `segment-${index + 1}`,
        text,
        color: isHeaderInfoBarColor(rawSegment.color) ? rawSegment.color : "default",
      });
    })
    .filter((segment): segment is HeaderInfoBarSegment => segment !== null);

  const rawCountdown = typeof rawConfig.countdown === "object" && rawConfig.countdown !== null
    ? (rawConfig.countdown as RawHeaderInfoBarCountdown)
    : null;

  const countdown = rawCountdown
    ? {
        enabled: typeof rawCountdown.enabled === "boolean" ? rawCountdown.enabled : Boolean(normalizeText(rawCountdown.targetDate)),
        targetDate: normalizeText(rawCountdown.targetDate),
        prefix: normalizeText(rawCountdown.prefix),
        suffix: normalizeText(rawCountdown.suffix),
        color: isHeaderInfoBarColor(rawCountdown.color) ? rawCountdown.color : "amber",
      } satisfies HeaderInfoBarCountdown
    : null;

  return {
    version: 1,
    segments,
    countdown,
  };
}

export function parseHeaderInfoBarConfig(rawValue: string | null | undefined): HeaderInfoBarConfig {
  if (!rawValue?.trim()) {
    return createDefaultHeaderInfoBarConfig();
  }

  try {
    return sanitizeHeaderInfoBarConfig(JSON.parse(rawValue));
  } catch {
    return sanitizeHeaderInfoBarConfig(rawValue);
  }
}

export function cloneHeaderInfoBarConfig(config: HeaderInfoBarConfig): HeaderInfoBarConfig {
  return sanitizeHeaderInfoBarConfig(JSON.parse(JSON.stringify(config)));
}

export function serializeHeaderInfoBarConfig(config: HeaderInfoBarConfig): string {
  const sanitizedConfig = sanitizeHeaderInfoBarConfig(config);

  return JSON.stringify({
    version: 1,
    segments: sanitizedConfig.segments.map(({ id, text, color }) => ({
      id,
      text,
      color,
    })),
    countdown: sanitizedConfig.countdown?.enabled
      ? {
          enabled: true,
          targetDate: sanitizedConfig.countdown.targetDate,
          prefix: sanitizedConfig.countdown.prefix,
          suffix: sanitizedConfig.countdown.suffix,
          color: sanitizedConfig.countdown.color,
        }
      : null,
  });
}

export function getHeaderInfoBarEditableLength(config: HeaderInfoBarConfig): number {
  const sanitizedConfig = sanitizeHeaderInfoBarConfig(config);

  return sanitizedConfig.segments.reduce((total, segment) => total + segment.text.length, 0)
    + (sanitizedConfig.countdown?.enabled ? sanitizedConfig.countdown.prefix.length + sanitizedConfig.countdown.suffix.length : 0);
}

export function getHeaderInfoBarValidationError(config: HeaderInfoBarConfig): string {
  const sanitizedConfig = sanitizeHeaderInfoBarConfig(config);
  const hasSegments = sanitizedConfig.segments.length > 0;
  const hasCountdown = Boolean(sanitizedConfig.countdown?.enabled);

  if (!hasSegments && !hasCountdown) {
    return "Debes ingresar al menos un segmento o habilitar el contador";
  }

  if (sanitizedConfig.countdown?.enabled && !sanitizedConfig.countdown.targetDate) {
    return "Debes seleccionar una fecha para el contador";
  }

  if (getHeaderInfoBarEditableLength(sanitizedConfig) > HEADER_INFO_MAX_LENGTH) {
    return `El contenido editable no puede exceder los ${HEADER_INFO_MAX_LENGTH} caracteres`;
  }

  return "";
}

function parseLocalDate(dateValue: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function getHeaderInfoBarCountdownDays(targetDate: string, now: Date = new Date()): number | null {
  const target = parseLocalDate(targetDate);
  if (!target) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = target.getTime() - today.getTime();
  return Math.max(0, Math.round(difference / 86400000));
}

export function buildHeaderInfoBarCountdownText(countdown: HeaderInfoBarCountdown | null, now: Date = new Date()): string {
  if (!countdown?.enabled) {
    return "";
  }

  const days = getHeaderInfoBarCountdownDays(countdown.targetDate, now);
  if (days === null) {
    return "";
  }

  return [countdown.prefix, String(days), countdown.suffix].filter(Boolean).join(" ").trim();
}

export function buildHeaderInfoBarPlainText(config: HeaderInfoBarConfig, now: Date = new Date()): string {
  const sanitizedConfig = sanitizeHeaderInfoBarConfig(config);
  const segmentText = sanitizedConfig.segments.map((segment) => segment.text).join(" ").trim();
  const countdownText = buildHeaderInfoBarCountdownText(sanitizedConfig.countdown, now);

  return [segmentText, countdownText].filter(Boolean).join(" ").trim();
}
