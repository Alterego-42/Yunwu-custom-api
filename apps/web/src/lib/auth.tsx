import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { apiClient } from "@/lib/api-client";

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  role?: string | null;
  metadata?: Record<string, unknown>;
};

type AuthSession = {
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUserRole(user: AuthUser | null) {
  return user?.role ?? (typeof user?.metadata?.role === "string" ? user.metadata.role : null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await apiClient.getSession();
      setSession(nextSession);
      return nextSession?.user ?? null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const nextSession = await apiClient.login(input);
    setSession(nextSession);
    return nextSession.user;
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const role = normalizeUserRole(user);

    return {
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: role === "admin",
      login,
      logout,
      refreshSession,
    };
  }, [isLoading, login, logout, refreshSession, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
