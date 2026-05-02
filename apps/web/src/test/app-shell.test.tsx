import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";

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

const apiClientMock = vi.hoisted(() => ({
  getHome: vi.fn(),
}));

function createAuthState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    defaultRoute: "/",
    isAdmin: false,
    isAuthenticated: true,
    isDemo: false,
    isLoading: false,
    isMember: true,
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
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
  useAuth: () => authState,
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

function LocationProbe() {
  const location = useLocation();
  const fromPath =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    "none";

  return <div data-testid="location">{`${location.pathname}|from=${fromPath}`}</div>;
}

function renderShell({
  initialPath = "/workspace/conv_123",
  mode = "user",
}: {
  initialPath?: string;
  mode?: "user" | "admin";
}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <LocationProbe />
              <AppShell mode={mode} />
            </>
          }
        >
          <Route path="workspace/:conversationId" element={<div>workspace-content</div>} />
          <Route path="create" element={<div>create-content</div>} />
          <Route path="history" element={<div>history-content</div>} />
          <Route path="library" element={<div>library-content</div>} />
          <Route path="settings" element={<div>settings-content</div>} />
          <Route path="admin" element={<div>admin-content</div>} />
          <Route index element={<div>home-content</div>} />
        </Route>
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/admin" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("app shell", () => {
  beforeEach(() => {
    authState = createAuthState();
    apiClientMock.getHome.mockResolvedValue({
      recentConversations: [{ id: "conv_recent", title: "最近工作台", updatedAt: "2026-04-29T08:00:00.000Z" }],
      recentTasks: [],
      recentAssets: [],
      recoveryTasks: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps workspace content mounted while exposing user nav links", async () => {
    renderShell({ initialPath: "/workspace/conv_123", mode: "user" });

    expect(await screen.findByText("workspace-content")).toBeTruthy();
    expect(screen.getByRole("link", { name: "首页" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "工作台" }).getAttribute("href")).toBe("/workspace/conv_123");
    expect(screen.getByRole("link", { name: "创建" }).getAttribute("href")).toBe("/create");
    expect(screen.getByRole("link", { name: "历史" }).getAttribute("href")).toBe("/history");
    expect(screen.getByRole("link", { name: "作品库" }).getAttribute("href")).toBe("/library");
    expect(screen.getByRole("link", { name: "配置" }).getAttribute("href")).toBe("/settings");
  });

  it("links workspace nav to the most recent conversation outside workspace", async () => {
    renderShell({ initialPath: "/create", mode: "user" });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "工作台" }).getAttribute("href")).toBe("/workspace/conv_recent");
    });
  });

  it("falls workspace nav back to create when there is no conversation", async () => {
    apiClientMock.getHome.mockResolvedValue({
      recentConversations: [],
      recentTasks: [],
      recentAssets: [],
      recoveryTasks: [],
    });

    renderShell({ initialPath: "/create", mode: "user" });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "工作台" }).getAttribute("href")).toBe("/create");
    });
  });

  it("lets an admin switch from user shell to admin route", async () => {
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

    renderShell({ initialPath: "/create", mode: "user" });

    fireEvent.click(screen.getByRole("button", { name: "前往管理台" }));

    await waitFor(() => {
      expect(screen.getByTestId("location").textContent).toBe("/admin|from=none");
    });
  });

  it("routes admin logout to login and preserves admin return target", async () => {
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

    renderShell({ initialPath: "/admin", mode: "admin" });

    fireEvent.click(screen.getByRole("button", { name: "退出" }));

    await waitFor(() => {
      expect(authState.logout).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("location").textContent).toBe("/login|from=/admin");
    });
  });
});
