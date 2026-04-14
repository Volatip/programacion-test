import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SESSION_STORAGE_KEYS,
  authApi,
  buildWebSocketProtocols,
  clearSession,
  fetchWithAuth,
  getStoredSession,
  persistSession,
} from './api';

describe('session hardening helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('stores tokens in sessionStorage and keeps user data in localStorage', () => {
    persistSession({ id: 1, name: 'Ada' }, 'access-token', 'refresh-token');

    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.user)).toBe(JSON.stringify({ id: 1, name: 'Ada' }));
    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.token)).toBeNull();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.token)).toBe('access-token');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBe('refresh-token');
  });

  it('migrates legacy tokens out of localStorage on read', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEYS.user, '{"id":1}');
    window.localStorage.setItem(SESSION_STORAGE_KEYS.token, 'legacy-access');
    window.localStorage.setItem(SESSION_STORAGE_KEYS.refreshToken, 'legacy-refresh');

    expect(getStoredSession()).toEqual({
      user: '{"id":1}',
      token: 'legacy-access',
      refreshToken: 'legacy-refresh',
    });

    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.token)).toBeNull();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.token)).toBe('legacy-access');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBe('legacy-refresh');
  });

  it('clears both storage backends', () => {
    persistSession({ id: 1 }, 'access-token', 'refresh-token');
    clearSession();

    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.user)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.token)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it('removes stale refresh tokens when persisting a session without refresh token', () => {
    window.localStorage.setItem(SESSION_STORAGE_KEYS.refreshToken, 'legacy-refresh');
    window.sessionStorage.setItem(SESSION_STORAGE_KEYS.refreshToken, 'stale-refresh');

    persistSession({ id: 2 }, 'access-token', null);

    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.token)).toBe('access-token');
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBeNull();
    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.refreshToken)).toBeNull();
  });

  it('builds websocket bearer subprotocols without query strings', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_WS_ORIGIN', 'ws://localhost');
    vi.stubEnv('VITE_APP_BASE_PATH', '/programacion');
    const { WS_ORIGIN, buildWebSocketProtocols, buildWsUrl } = await import('./api');

    expect(buildWebSocketProtocols('jwt-token')).toEqual(['bearer', 'jwt-token']);
    expect(buildWsUrl('/ws/info-bar')).toBe(`${WS_ORIGIN}/programacion/ws/info-bar`);
    expect(buildWsUrl('/ws/info-bar')).not.toContain('?');
  });

  it('omits websocket auth subprotocols when the token is blank', () => {
    expect(buildWebSocketProtocols('   ')).toEqual([]);
  });

  it('omits the authorization header when there is no active token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithAuth('/users/me');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/me'), expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }));
  });

  it('omits the authorization header on logout when token is blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authApi.logout('', 'refresh-token');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/logout'), expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }));
  });

  it('omits the authorization header when the stored token only contains whitespace', async () => {
    window.sessionStorage.setItem(SESSION_STORAGE_KEYS.token, '   ');

    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithAuth('/users/me');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/me'), expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }));
  });

  it('omits the authorization header on logout when token only contains whitespace', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authApi.logout('   ', 'refresh-token');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/logout'), expect.objectContaining({
      headers: expect.not.objectContaining({ Authorization: expect.any(String) }),
    }));
  });

  it('redirects expired sessions to login using the resolved app base path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithAuth('/users/me')).rejects.toThrow('Session expired');

    expect(window.localStorage.getItem(SESSION_STORAGE_KEYS.user)).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEYS.token)).toBeNull();
  });

  it('builds auth redirects under /programacion when the app is mounted there', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_APP_BASE_PATH', '/programacion');
    window.history.replaceState({}, '', '/programacion/login');

    const { redirectToLogin } = await import('./api');
    const locationRef = { href: '' };

    redirectToLogin(locationRef);

    expect(locationRef.href).toBe('/programacion/login');
  });

  it('keeps root-relative auth routes when the app runs locally without a base path', async () => {
    vi.resetModules();
    window.history.replaceState({}, '', '/login');

    const { redirectToLogin } = await import('./api');
    const { resolveAppBasePath, joinAppPath } = await import('./appPaths');
    const locationRef = { href: '' };

    redirectToLogin(locationRef);

    expect(resolveAppBasePath({
      location: {
        hostname: 'localhost',
        port: '5173',
        pathname: '/login',
      },
      isDev: true,
    })).toBe('');
    expect(locationRef.href).toBe('/login');
    expect(joinAppPath('', '/login')).toBe('/login');
  });

  it('builds app login redirects under /programacion when the app is mounted there', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_APP_BASE_PATH', '/programacion');
    window.history.replaceState({}, '', '/programacion/login');

    const { buildAppPath, APP_ROUTES } = await import('./appPaths');

    expect(buildAppPath(APP_ROUTES.login)).toBe('/programacion/login');
  });

  it('builds api urls under /programacion/api in mounted server mode', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_ORIGIN', 'http://localhost');
    vi.stubEnv('VITE_API_BASE_PATH', '/programacion/api');
    window.history.replaceState({}, '', '/programacion/login');

    const { buildApiUrl } = await import('./api');

    expect(buildApiUrl('/users/login')).toBe('http://localhost/programacion/api/users/login');
  });

  it('keeps API_URL mounted under /programacion outside local runtime', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_ORIGIN', 'http://localhost');
    vi.stubEnv('VITE_API_BASE_PATH', '/programacion/api');
    window.history.replaceState({}, '', '/programacion/login');

    const { API_URL } = await import('./api');

    expect(API_URL).toBe('http://localhost/programacion/api');
  });

  it('respects paths that already start with /api', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_ORIGIN', 'http://localhost');
    vi.stubEnv('VITE_API_BASE_PATH', '/programacion/api');
    window.history.replaceState({}, '', '/programacion/login');

    const { buildApiUrl } = await import('./api');

    expect(buildApiUrl('/api/users/login')).toBe('http://localhost/api/users/login');
  });

  it('uses a configurable local api base path when provided', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_ORIGIN', 'http://127.0.0.1:8000');
    vi.stubEnv('VITE_API_BASE_PATH', '/api');
    window.history.replaceState({}, '', '/programacion/login');

    const { API_URL, buildApiUrl } = await import('./api');

    expect(API_URL).toBe('http://127.0.0.1:8000/api');
    expect(buildApiUrl('/users/login')).toBe('http://127.0.0.1:8000/api/users/login');
  });
});
