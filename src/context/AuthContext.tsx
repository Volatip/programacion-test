/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import {
  authApi,
  clearSession,
  getStoredSession,
  parseErrorDetail,
  parseJsonResponse,
  persistSession,
  type LoginResponse
} from '../lib/api';

export type UserRole = 'admin' | 'medical_coordinator' | 'non_medical_coordinator' | 'supervisor' | 'user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  initials: string;
  last_access?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  login: (rut: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSession = getStoredSession();
    
    if (storedSession.user && storedSession.token) {
      try {
        setUser(JSON.parse(storedSession.user));
        setToken(storedSession.token);
        if (storedSession.refreshToken) setRefreshToken(storedSession.refreshToken);
      } catch (e) {
        console.error("Failed to parse user from local storage", e);
        clearSession();
      }
    }
    setLoading(false);
  }, []);

  // Token Refresh Logic
  const login = async (rut: string, password: string) => {
    try {
      const response = await authApi.login(rut, password);

      if (!response.ok) {
        throw new Error(await parseErrorDetail(response, 'Login failed'));
      }

      const data = await parseJsonResponse<LoginResponse>(response);
      
      // Data structure: { access_token, token_type, user, refresh_token }
      const userData = data.user;
      const accessToken = data.access_token;
      const newRefreshToken = data.refresh_token;
      
      // Calculate initials
      const initials = userData.name
        ? userData.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
        : 'U';

      const newUser: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role as UserRole,
        initials: initials,
        last_access: userData.last_access
      };

      setUser(newUser);
      setToken(accessToken);
      setRefreshToken(newRefreshToken);
      persistSession(newUser, accessToken, newRefreshToken);
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = useCallback(async () => {
    // Call backend to revoke token if possible
    if (token) {
        try {
            await authApi.logout(token, refreshToken);
        } catch (e) {
            console.warn("Backend logout failed (network error?)", e);
        }
    }

    setUser(null);
    setToken(null);
    setRefreshToken(null);
    clearSession();
  }, [token, refreshToken]);

  useEffect(() => {
      if (!token || !refreshToken) return;

      // Setup interval to refresh token before it expires (e.g., every 14 minutes if expires in 15)
      const interval = setInterval(async () => {
          try {
              const response = await authApi.refresh(refreshToken);

              if (response.ok) {
                  const data = await parseJsonResponse<{ access_token: string; refresh_token?: string }>(response);
                  setToken(data.access_token);
                  persistSession(user, data.access_token, data.refresh_token ?? refreshToken);
                  // Refresh token might be rotated or same
                  if (data.refresh_token) {
                      setRefreshToken(data.refresh_token);
                  }
                  console.log("Token refreshed automatically");
              } else {
                  console.warn("Failed to refresh token, logging out");
                  logout();
              }
          } catch (error) {
              console.error("Error refreshing token", error);
              logout();
          }
      }, 14 * 60 * 1000); // 14 minutes

      return () => clearInterval(interval);
  }, [token, refreshToken, user, logout]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, token, refreshToken, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
