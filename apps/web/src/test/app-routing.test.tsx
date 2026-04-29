import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  useLocation,
  useRoutes,
} from "react-router-dom";

type AuthState = {
  defaultRoute: string;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isDemo: boolean;
  isLoading: boolean;
  isMember: boolean;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  role: string | null;
  user: { id: string; email: string; displayName?: string | null; role?: string | null } | null;
};

let authState: AuthState;

function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    defaultRoute: "/",
    isAdmin: false,
    isAuthenticated: true,
    isDemo: false,
    isLoading: false,
    isMember: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    register: vi.fn(),
    role: "member",
    user: {
      id: "user_member",
      email: "member@example.com",
      displayName: "Member",
      role: "member",
    },
    ...overrides,
  };
}

vi.mock("@/lib/auth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => authState,
}));

vi.mock("@/components/layout/app-shell", async () => {
  return {
    AppShell: ({ mode = "user" }: { mode?: "user" | "admin" }) => (
      <div data-testid={`shell-${mode}`}>
        <Outlet />
      </div>
    ),
  };
});

vi.mock("@/pages/home-page", () => ({
  HomePage: () => <div>home-page</div>,
}));

vi.mock("@/pages/create-page", () => ({
  CreatePage: () => <div>create-page</div>,
}));

vi.mock("@/pages/history-page", () => ({
  HistoryPage: () => <div>history-page</div>,
}));

vi.mock("@/pages/library-page", () => ({
  LibraryPage: () => <div>library-page</div>,
}));

vi.mock("@/pages/workspace-page", () => ({
  WorkspacePage: () => {
    const location = useLocation();
    return <div>{`workspace-page:${location.pathname}`}</div>;
  },
}));

vi.mock("@/pages/admin-page", () => ({
  AdminPage: () => <div>admin-page</div>,
}));

vi.mock("@/pages/login-page", () => ({
  LoginPage: () => {
    const location = useLocation();
    const fromPath =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
      "none";
    return <div>{`login-page:from=${fromPath}`}</div>;
  },
}));

vi.mock("@/pages/register-page", () => ({
  RegisterPage: () => <div>register-page</div>,
}));

import { createAppRoutes } from "@/app";

function RouteHarness() {
  const element = useRoutes(createAppRoutes());
  const location = useLocation();

  return (
    <>
      <div data-testid="location">{location.pathname}</div>
      {element}
    </>
  );
}

describe("app routing", () => {
  beforeEach(() => {
    authState = createAuthState();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("redirects protected routes to login and preserves return path", async () => {
    authState = createAuthState({
      defaultRoute: "/",
      isAuthenticated: false,
      isMember: false,
      role: null,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={["/history"]}>
        <RouteHarness />
      </MemoryRouter>,
    );

    expect(await screen.findByText("login-page:from=/history")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/login");
  });

  it("wires user routes to the real page slots under the user shell", async () => {
    render(
      <MemoryRouter initialEntries={["/create"]}>
        <RouteHarness />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("shell-user")).toBeTruthy();
    expect(screen.getByText("create-page")).toBeTruthy();

    cleanup();
    render(
      <MemoryRouter initialEntries={["/library"]}>
        <RouteHarness />
      </MemoryRouter>,
    );
    expect(await screen.findByText("library-page")).toBeTruthy();

    cleanup();
    render(
      <MemoryRouter initialEntries={["/workspace/conv_123"]}>
        <RouteHarness />
      </MemoryRouter>,
    );
    expect(
      await screen.findByText("workspace-page:/workspace/conv_123"),
    ).toBeTruthy();
  });

  it("keeps admin shell separate and blocks members from admin route", async () => {
    authState = createAuthState({
      defaultRoute: "/admin",
      isAdmin: true,
      role: "admin",
      user: {
        id: "user_admin",
        email: "admin@example.com",
        displayName: "Admin",
        role: "admin",
      },
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <RouteHarness />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("shell-admin")).toBeTruthy();
    expect(screen.getByText("admin-page")).toBeTruthy();

    authState = createAuthState();
    cleanup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <RouteHarness />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(await screen.findByText("home-page")).toBeTruthy();
  });
});
