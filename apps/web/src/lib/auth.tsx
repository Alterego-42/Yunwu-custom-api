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

export type AuthRole = "member" | "admin" | "demo" | (string & {});

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  role?: AuthRole | null;
  metadata?: Record<string, unknown>;
};

type AuthSession = {
  user: AuthUser;
};

type AuthContextValue = {
  user: AuthUser | null;
  role: AuthRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDemo: boolean;
  isMember: boolean;
  defaultRoute: string;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  register: (input: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUserRole(user: AuthUser | null): AuthRole | null {
  if (typeof user?.role === "string" && user.role.trim()) {
    return user.role;
  }

  if (typeof user?.metadata?.role === "string" && user.metadata.role.trim()) {
    return user.metadata.role as AuthRole;
  }

  return null;
}

function getDefaultRouteForUser(user: AuthUser | null) {
  return normalizeUserRole(user) === "admin" ? "/admin" : "/";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = (await apiClient.getSession()) ?? null;
      setSession(nextSession);
      return nextSession?.user ?? null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const nextSession = await apiClient.login(input);
      setSession(nextSession);
      return nextSession.user;
    },
    [],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName?: string;
    }) => {
      const nextSession = await apiClient.register(input);
      setSession(nextSession);
      return nextSession.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await apiClient.logout();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const role = normalizeUserRole(user);
    const defaultRoute = getDefaultRouteForUser(user);

    return {
      user,
      role,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: role === "admin",
      isDemo: role === "demo",
      isMember: role === "member",
      defaultRoute,
      login,
      register,
      logout,
      refreshSession,
    };
  }, [isLoading, login, logout, refreshSession, register, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return value;
}
