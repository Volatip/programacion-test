export const PAGE_HEADER_CONFIG_KEY_PREFIX = "page_header:";
export const PAGE_HEADER_CONFIG_VERSION = 1;
export const PAGE_HEADER_TITLE_MAX_LENGTH = 120;
export const PAGE_HEADER_SUBTITLE_MAX_LENGTH = 240;

export interface PageHeaderConfig {
  version: 1;
  title: string;
  subtitle: string;
}

interface RawPageHeaderConfig {
  version?: unknown;
  title?: unknown;
  subtitle?: unknown;
}

export interface PageHeaderDefaults {
  title: string;
  subtitle: string;
}

function normalizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

export function buildPageHeaderConfigKey(slug: string): string {
  return `${PAGE_HEADER_CONFIG_KEY_PREFIX}${slug.trim()}`;
}

export function buildPageHeaderConfigDescription(slug: string): string {
  return `Configuración del encabezado de la página ${slug.trim()}`;
}

export function sanitizePageHeaderConfig(value: unknown, defaults: PageHeaderDefaults): PageHeaderConfig {
  const rawValue = typeof value === "object" && value !== null ? (value as RawPageHeaderConfig) : {};
  const title = normalizeText(rawValue.title, PAGE_HEADER_TITLE_MAX_LENGTH) || defaults.title.trim();
  const subtitle = normalizeText(rawValue.subtitle, PAGE_HEADER_SUBTITLE_MAX_LENGTH) || defaults.subtitle.trim();

  return {
    version: PAGE_HEADER_CONFIG_VERSION,
    title,
    subtitle,
  };
}

export function parsePageHeaderConfig(rawValue: string | null | undefined, defaults: PageHeaderDefaults): PageHeaderConfig {
  if (!rawValue?.trim()) {
    return sanitizePageHeaderConfig({}, defaults);
  }

  try {
    return sanitizePageHeaderConfig(JSON.parse(rawValue), defaults);
  } catch {
    return sanitizePageHeaderConfig({}, defaults);
  }
}

export function serializePageHeaderConfig(config: PageHeaderConfig): string {
  const sanitizedConfig = sanitizePageHeaderConfig(config, config);

  return JSON.stringify({
    version: PAGE_HEADER_CONFIG_VERSION,
    title: sanitizedConfig.title,
    subtitle: sanitizedConfig.subtitle,
  });
}

export function getPageHeaderValidationError(
  config: Pick<PageHeaderConfig, "title" | "subtitle">,
  options?: { allowEmptySubtitle?: boolean },
): string {
  const title = normalizeText(config.title, PAGE_HEADER_TITLE_MAX_LENGTH);
  const subtitle = normalizeText(config.subtitle, PAGE_HEADER_SUBTITLE_MAX_LENGTH);
  const allowEmptySubtitle = options?.allowEmptySubtitle ?? false;

  if (!title) {
    return "Debes ingresar un título.";
  }

  if (!subtitle && !allowEmptySubtitle) {
    return "Debes ingresar un subtítulo.";
  }

  if (config.title.trim().length > PAGE_HEADER_TITLE_MAX_LENGTH) {
    return `El título no puede exceder ${PAGE_HEADER_TITLE_MAX_LENGTH} caracteres.`;
  }

  if (config.subtitle.trim().length > PAGE_HEADER_SUBTITLE_MAX_LENGTH) {
    return `El subtítulo no puede exceder ${PAGE_HEADER_SUBTITLE_MAX_LENGTH} caracteres.`;
  }

  return "";
}
