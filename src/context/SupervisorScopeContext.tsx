/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchWithAuth, getStoredSession } from "../lib/api";
import { useAuth } from "./AuthContext";

const SUPERVISOR_SCOPE_STORAGE_KEY = "supervisor_scope_user_id";

interface SupervisedUser {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface SupervisorScopeContextValue {
  isSupervisor: boolean;
  users: SupervisedUser[];
  selectedUserId: number | null;
  selectedUser: SupervisedUser | null;
  loadingUsers: boolean;
  usersError: string | null;
  isScopeReady: boolean;
  setSelectedUserId: (userId: number | null) => void;
  refreshUsers: () => Promise<void>;
}

const SupervisorScopeContext = createContext<SupervisorScopeContextValue | undefined>(undefined);

function readStoredSupervisorUserId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(SUPERVISOR_SCOPE_STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function persistSupervisorUserId(userId: number | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (userId === null) {
      window.sessionStorage.removeItem(SUPERVISOR_SCOPE_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(SUPERVISOR_SCOPE_STORAGE_KEY, String(userId));
  } catch {
    // Ignore storage errors.
  }
}

export function SupervisorScopeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [users, setUsers] = useState<SupervisedUser[]>([]);
  const [selectedUserId, setSelectedUserIdState] = useState<number | null>(() => readStoredSupervisorUserId());
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const isSupervisor = user?.role === "supervisor";

  const setSelectedUserId = useCallback((userId: number | null) => {
    setSelectedUserIdState(userId);
    persistSupervisorUserId(userId);
  }, []);

  const refreshUsers = useCallback(async () => {
    if (!isSupervisor) {
      setUsers([]);
      setUsersError(null);
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);
    setUsersError(null);

    try {
      const response = await fetchWithAuth("/users/supervised-options");
      if (!response.ok) {
        throw new Error("No se pudo cargar la lista de usuarios supervisados.");
      }

      const data: SupervisedUser[] = await response.json();
      setUsers(data);
      setSelectedUserIdState((currentValue) => {
        const storedValue = currentValue ?? readStoredSupervisorUserId();
        const nextValue = data.some((item) => item.id === storedValue) ? storedValue : null;
        persistSupervisorUserId(nextValue);
        return nextValue;
      });
    } catch (error) {
      console.error("Error fetching supervised users:", error);
      setUsers([]);
      setUsersError("No se pudo cargar la lista de usuarios supervisados.");
    } finally {
      setLoadingUsers(false);
    }
  }, [isSupervisor]);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setUsersError(null);
      setLoadingUsers(false);
      setSelectedUserIdState(null);
      persistSupervisorUserId(null);
      return;
    }

    if (!isSupervisor) {
      setUsers([]);
      setUsersError(null);
      setLoadingUsers(false);
      return;
    }

    const { token } = getStoredSession();
    if (!token) {
      return;
    }

    void refreshUsers();
  }, [isSupervisor, refreshUsers, user]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const value = useMemo<SupervisorScopeContextValue>(
    () => ({
      isSupervisor,
      users,
      selectedUserId,
      selectedUser,
      loadingUsers,
      usersError,
      isScopeReady: !isSupervisor || selectedUserId !== null,
      setSelectedUserId,
      refreshUsers,
    }),
    [isSupervisor, loadingUsers, refreshUsers, selectedUser, selectedUserId, setSelectedUserId, users, usersError],
  );

  return <SupervisorScopeContext.Provider value={value}>{children}</SupervisorScopeContext.Provider>;
}

export function useSupervisorScope() {
  const context = useContext(SupervisorScopeContext);
  if (context === undefined) {
    throw new Error("useSupervisorScope must be used within a SupervisorScopeProvider");
  }

  return context;
}
