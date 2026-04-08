import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SESSION_STORAGE_KEYS,
  WS_ORIGIN,
  authApi,
  buildWsUrl,
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

  it('builds websocket bearer subprotocols without query strings', () => {
    expect(buildWebSocketProtocols('jwt-token')).toEqual(['bearer', 'jwt-token']);
    expect(buildWsUrl('/ws/info-bar')).toBe(`${WS_ORIGIN}/ws/info-bar`);
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
    window.history.replaceState({}, '', '/programacion/login');

    const { buildAppPath, APP_ROUTES } = await import('./appPaths');

    expect(buildAppPath(APP_ROUTES.login)).toBe('/programacion/login');
  });

  it('keeps local api urls under /api even when the app is mounted under /programacion in local runtime', async () => {
    vi.resetModules();
    window.history.replaceState({}, '', '/programacion/login');

    const { buildApiUrl } = await import('./api');

    expect(buildApiUrl('/users/login')).toContain('http://localhost:8000/api/users/login');
    expect(buildApiUrl('/users/login')).not.toContain('/programacion/api/users/login');
  });
});
