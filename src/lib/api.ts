import {
  APP_ROUTES,
  buildAppPath,
} from "./appPaths";

function normalizeBasePath(path: string | undefined): string {
  const trimmedPath = path?.trim() ?? "";

  if (!trimmedPath || trimmedPath === "/") {
    return "";
  }

  const withLeadingSlash = trimmedPath.startsWith("/") ? trimmedPath : `/${trimmedPath}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function getDefaultApiOrigin(): string {
  if (typeof window === "undefined") {
    return "/programacion";
  }

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const hostname = window.location.hostname || "localhost";

  return `${protocol}//${hostname}`;
}

const DEFAULT_API_ORIGIN = getDefaultApiOrigin();
const rawApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim();
const rawApiBasePath = import.meta.env.VITE_API_BASE_PATH?.trim();
const rawWsOrigin = import.meta.env.VITE_WS_ORIGIN?.trim();
const DEFAULT_API_BASE_PATH = "/programacion/api";

export const API_ORIGIN = rawApiOrigin || DEFAULT_API_ORIGIN;
export const API_BASE_PATH = normalizeBasePath(rawApiBasePath) || DEFAULT_API_BASE_PATH;
export const API_URL = `${API_ORIGIN}${API_BASE_PATH}`;
export const WS_ORIGIN =
  rawWsOrigin || API_ORIGIN.replace(/^http/i, (protocol) => (protocol.toLowerCase() === "https" ? "wss" : "ws"));

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedPath.startsWith("/api")) {
    return `${API_ORIGIN}${normalizedPath}`;
  }

  return `${API_URL}${normalizedPath}`;
}

export function buildWsUrl(path: string): string {
  if (/^wss?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${WS_ORIGIN}${buildAppPath(normalizedPath)}`;
}

export function redirectToLogin(locationRef: Pick<Location, "href"> | null = typeof window === "undefined" ? null : window.location): void {
  if (!locationRef) {
    return;
  }

  const targetPath = buildAppPath(APP_ROUTES.login);

  if (import.meta.env.MODE === "test" && locationRef === window.location && typeof window !== "undefined") {
    window.history.replaceState({}, "", targetPath);
    return;
  }

  try {
    locationRef.href = targetPath;
  } catch {
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", targetPath);
    }
  }
}

export const SESSION_STORAGE_KEYS = {
  user: "user",
  token: "token",
  refreshToken: "refresh_token",
} as const;

function normalizeAuthToken(token: string | null | undefined): string | null {
  const normalizedToken = token?.trim();
  return normalizedToken ? normalizedToken : null;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function getStorage(kind: "local" | "session"): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function migrateLegacySession(localStorageRef: StorageLike | null, sessionStorageRef: StorageLike | null): void {
  if (!localStorageRef || !sessionStorageRef) {
    return;
  }

  const legacyToken = localStorageRef.getItem(SESSION_STORAGE_KEYS.token);
  const legacyRefreshToken = localStorageRef.getItem(SESSION_STORAGE_KEYS.refreshToken);

  if (legacyToken && !sessionStorageRef.getItem(SESSION_STORAGE_KEYS.token)) {
    sessionStorageRef.setItem(SESSION_STORAGE_KEYS.token, legacyToken);
  }

  if (legacyRefreshToken && !sessionStorageRef.getItem(SESSION_STORAGE_KEYS.refreshToken)) {
    sessionStorageRef.setItem(SESSION_STORAGE_KEYS.refreshToken, legacyRefreshToken);
  }

  if (legacyToken) {
    localStorageRef.removeItem(SESSION_STORAGE_KEYS.token);
  }

  if (legacyRefreshToken) {
    localStorageRef.removeItem(SESSION_STORAGE_KEYS.refreshToken);
  }
}

export function buildWebSocketProtocols(token: string): string[] {
  const normalizedToken = normalizeAuthToken(token);
  return normalizedToken ? ["bearer", normalizedToken] : [];
}

export interface StoredSession {
  user: string | null;
  token: string | null;
  refreshToken: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

export interface AuthUserResponse {
  id: number;
  name: string;
  email: string;
  role: string;
  last_access?: string;
}

export interface LoginResponse extends AuthTokens {
  token_type: string;
  user: AuthUserResponse;
}

export interface ProgrammingReviewerSummary {
  id: number;
  name: string;
}

export interface ProgrammingReviewEvent {
  id: number;
  programming_id: number;
  action: "validated" | "fix_required";
  comment?: string | null;
  reviewed_by_id: number;
  reviewed_by_name?: string | null;
  reviewed_at: string;
  email_status?: string | null;
  email_error?: string | null;
}

export interface ProgrammingReviewResponse {
  programming_id: number;
  review_status: "validated" | "fix_required";
  reviewed_at: string;
  reviewed_by: ProgrammingReviewerSummary;
  review_comment?: string | null;
  notifications_created: number;
  email: {
    attempted: boolean;
    status: "sent" | "failed" | "skipped";
    detail?: string | null;
  };
}

export interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  payload_json?: string | null;
  created_at: string;
  read_at?: string | null;
}

export interface NotificationSummary {
  unread_count: number;
}

export interface SmtpSettingsResponse {
  host: string;
  port: number;
  username: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
  password_configured: boolean;
  review_fix_required_subject: string;
  review_fix_required_body: string;
}

export interface SmtpSettingsUpdate {
  host: string;
  port: number;
  username: string;
  password?: string;
  from_email: string;
  from_name: string;
  use_tls: boolean;
  use_ssl: boolean;
  review_fix_required_subject: string;
  review_fix_required_body: string;
}

export interface SmtpTestEmailRequest {
  recipient: string;
}

export interface SmtpTestEmailResponse {
  recipient: string;
  message: string;
}

export interface AppConfigResponse {
  key: string;
  value: string;
  description?: string | null;
  updated_at?: string | null;
}

export interface AppConfigUpdate {
  key: string;
  value: string;
  description?: string;
}

export function getStoredSession(): StoredSession {
  const localStorageRef = getStorage("local");
  const sessionStorageRef = getStorage("session");
  migrateLegacySession(localStorageRef, sessionStorageRef);

  return {
    user: localStorageRef?.getItem(SESSION_STORAGE_KEYS.user) ?? null,
    token: sessionStorageRef?.getItem(SESSION_STORAGE_KEYS.token) ?? null,
    refreshToken: sessionStorageRef?.getItem(SESSION_STORAGE_KEYS.refreshToken) ?? null,
  };
}

export function persistSession(user: unknown, token: string, refreshToken?: string | null): void {
  const localStorageRef = getStorage("local");
  const sessionStorageRef = getStorage("session");

  localStorageRef?.setItem(SESSION_STORAGE_KEYS.user, JSON.stringify(user));
  sessionStorageRef?.setItem(SESSION_STORAGE_KEYS.token, token);
  localStorageRef?.removeItem(SESSION_STORAGE_KEYS.token);

  if (refreshToken) {
    sessionStorageRef?.setItem(SESSION_STORAGE_KEYS.refreshToken, refreshToken);
    localStorageRef?.removeItem(SESSION_STORAGE_KEYS.refreshToken);
  } else {
    sessionStorageRef?.removeItem(SESSION_STORAGE_KEYS.refreshToken);
    localStorageRef?.removeItem(SESSION_STORAGE_KEYS.refreshToken);
  }
}

export function clearSession(): void {
  const localStorageRef = getStorage("local");
  const sessionStorageRef = getStorage("session");

  localStorageRef?.removeItem(SESSION_STORAGE_KEYS.user);
  localStorageRef?.removeItem(SESSION_STORAGE_KEYS.token);
  localStorageRef?.removeItem(SESSION_STORAGE_KEYS.refreshToken);
  sessionStorageRef?.removeItem(SESSION_STORAGE_KEYS.token);
  sessionStorageRef?.removeItem(SESSION_STORAGE_KEYS.refreshToken);
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(buildApiUrl(path), options);
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function parseErrorDetail(response: Response, fallbackMessage: string): Promise<string> {
  try {
    const errorData = await response.json();
    if (typeof errorData?.detail === "string" && errorData.detail.trim()) {
      return errorData.detail;
    }
  } catch {
    // Ignore JSON parse errors and use the fallback below.
  }

  return fallbackMessage;
}

export const authApi = {
  login: (rut: string, password: string) =>
    apiFetch("/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rut, password }),
    }),

  refresh: (refreshToken: string) =>
    apiFetch("/users/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  logout: (token: string, refreshToken?: string | null) => {
    const normalizedToken = normalizeAuthToken(token);

    return apiFetch("/users/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken ?? null }),
    });
  },
};

export const programmingReviewApi = {
  submit: (programmingId: number, payload: { action: "validated" | "fix_required"; comment?: string }) =>
    fetchWithAuth(`/programming/${programmingId}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  history: (programmingId: number) => fetchWithAuth(`/programming/${programmingId}/review-history`),
};

export const notificationsApi = {
  summary: () => fetchWithAuth("/notifications/summary"),
  list: (status: "unread" | "all" = "unread") => fetchWithAuth(`/notifications?status=${status}`),
  markRead: (payload: { ids?: number[]; all?: boolean }) =>
    fetchWithAuth("/notifications/read", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const smtpSettingsApi = {
  read: () => fetchWithAuth("/config/smtp-settings"),
  update: (payload: SmtpSettingsUpdate) =>
    fetchWithAuth("/config/smtp-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  sendTest: (payload: SmtpTestEmailRequest) =>
    fetchWithAuth("/config/smtp-settings/test", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const appConfigApi = {
  read: (key: string) => fetchWithAuth(`/config/configs/${encodeURIComponent(key)}`),
  upsert: (payload: AppConfigUpdate) =>
    fetchWithAuth("/config/configs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const { token } = getStoredSession();
  const normalizedToken = normalizeAuthToken(token);

  const headers = {
    ...options.headers,
  } as Record<string, string>;

  if (normalizedToken) {
    headers.Authorization = `Bearer ${normalizedToken}`;
  }

  if (!(options.body instanceof FormData) && !((options.headers as Record<string, string> | undefined)?.["Content-Type"])) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: headers as HeadersInit,
  });

  if (response.status === 401) {
    clearSession();
    redirectToLogin();
    throw new Error("Session expired");
  }

  return response;
}
