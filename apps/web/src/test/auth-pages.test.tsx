import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";

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
    isAuthenticated: false,
    isDemo: false,
    isLoading: false,
    isMember: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshSession: vi.fn(),
    register: vi.fn(),
    role: null,
    user: null,
    ...overrides,
  };
}

vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

describe("auth pages", () => {
  beforeEach(() => {
    authState = createAuthState();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns to the original route after login", async () => {
    authState = createAuthState({
      login: vi.fn().mockResolvedValue({
        id: "user_member",
        email: "member@example.com",
        displayName: "Member",
        role: "member",
      }),
    });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: {
              from: {
                pathname: "/history",
                search: "?filter=failed",
                hash: "#latest",
              },
            },
          },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/history" element={<div>history-target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith({
        email: "member@example.com",
        password: "secret123",
      });
    });
    expect(await screen.findByText("history-target")).toBeTruthy();
  });

  it("lands on home after successful registration", async () => {
    authState = createAuthState({
      register: vi.fn().mockResolvedValue({
        id: "user_member",
        email: "new@example.com",
        displayName: "New User",
        role: "member",
      }),
    });

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<div>home-target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("昵称"), {
      target: { value: "New User" },
    });
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "注册并进入创作台" }));

    await waitFor(() => {
      expect(authState.register).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "secret123",
        displayName: "New User",
      });
    });
    expect(await screen.findByText("home-target")).toBeTruthy();
  });
});
