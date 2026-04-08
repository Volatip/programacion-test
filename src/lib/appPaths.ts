const DEFAULT_APP_BASE_PATH = "/programacion";
const LOCAL_FRONTEND_PORTS = new Set(["3000", "5173", "5174", "5175", "5176"]);

type LocationLike = Pick<Location, "hostname" | "port" | "pathname">;

function normalizePathSegment(path: string): string {
  const trimmedPath = path.trim();

  if (!trimmedPath || trimmedPath === "/" || trimmedPath === "./") {
    return "";
  }

  const withLeadingSlash = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isLocalDevFrontend(location?: LocationLike | null, isDev = false): boolean {
  if (!location) {
    return false;
  }

  return Boolean(isDev) || (isLocalHostname(location.hostname) && LOCAL_FRONTEND_PORTS.has(location.port || ""));
}

export function getAppMountPathFromApiBasePath(apiBasePath: string): string {
  const normalizedApiBasePath = normalizePathSegment(apiBasePath);

  if (!normalizedApiBasePath || normalizedApiBasePath === "/api") {
    return "";
  }

  return normalizedApiBasePath.endsWith("/api") ? normalizedApiBasePath.slice(0, -4) : normalizedApiBasePath;
}

function inferMountedBasePath(location?: LocationLike | null): string {
  const pathname = normalizePathSegment(location?.pathname ?? "");

  if (pathname === DEFAULT_APP_BASE_PATH || pathname.startsWith(`${DEFAULT_APP_BASE_PATH}/`)) {
    return DEFAULT_APP_BASE_PATH;
  }

  return "";
}

interface ResolveAppBasePathOptions {
  appBasePath?: string | null;
  apiBasePath?: string | null;
  baseUrl?: string | null;
  location?: LocationLike | null;
  isDev?: boolean;
}

export function resolveAppBasePath({
  appBasePath,
  apiBasePath,
  baseUrl,
  location,
  isDev = false,
}: ResolveAppBasePathOptions = {}): string {
  const normalizedExplicitBasePath = normalizePathSegment(appBasePath ?? "");
  if (normalizedExplicitBasePath) {
    return normalizedExplicitBasePath;
  }

  const normalizedApiBasePath = normalizePathSegment(apiBasePath ?? "");
  if (normalizedApiBasePath) {
    return getAppMountPathFromApiBasePath(normalizedApiBasePath);
  }

  const normalizedBaseUrl = normalizePathSegment(baseUrl ?? "");
  if (normalizedBaseUrl) {
    return normalizedBaseUrl;
  }

  const inferredMountedBasePath = inferMountedBasePath(location);
  if (inferredMountedBasePath) {
    return inferredMountedBasePath;
  }

  return isLocalDevFrontend(location, isDev) ? "" : DEFAULT_APP_BASE_PATH;
}

export function joinAppPath(basePath: string, path: string): string {
  const normalizedBasePath = normalizePathSegment(basePath);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath === "/") {
    return normalizedBasePath || "/";
  }

  return `${normalizedBasePath}${normalizedPath}`;
}

const rawAppBasePath = import.meta.env.VITE_APP_BASE_PATH?.trim();
const rawApiBasePath = import.meta.env.VITE_API_BASE_PATH?.trim();

export const APP_BASE_PATH = resolveAppBasePath({
  appBasePath: rawAppBasePath,
  apiBasePath: rawApiBasePath,
  baseUrl: import.meta.env.BASE_URL,
  location: typeof window === "undefined" ? null : window.location,
  isDev: import.meta.env.DEV,
});

export function buildAppPath(path: string): string {
  return joinAppPath(APP_BASE_PATH, path);
}

export function buildPublicAssetPath(assetName: string): string {
  const normalizedBaseUrl = import.meta.env.BASE_URL === "./" ? `${APP_BASE_PATH || ""}/` : import.meta.env.BASE_URL;
  return `${normalizedBaseUrl}${assetName.replace(/^\/+/, "")}`;
}

export const APP_ROUTES = {
  home: "/",
  login: "/login",
  users: "/usuarios",
  bajas: "/bajas",
  contextualHelpAdmin: "/admin/ayudas-contextuales",
  periods: "/periodos",
  rrhh: "/rrhh",
  carga: "/carga",
  general: "/general",
  officials: "/funcionarios",
  programming: "/programacion",
  programmingScheduled: "/programacion/programados",
  programmingUnscheduled: "/programacion/no-programados",
  programmingGroupPattern: "/programacion/grupo/:groupId",
  programmingGroup: (groupId: number | string) => `/programacion/grupo/${groupId}`,
} as const;
