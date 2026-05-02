import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  type RouteObject,
} from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminPage } from "@/pages/admin-page";
import { CreatePage } from "@/pages/create-page";
import { HistoryPage } from "@/pages/history-page";
import { HomePage } from "@/pages/home-page";
import { LibraryPage } from "@/pages/library-page";
import { LoginPage } from "@/pages/login-page";
import { RegisterPage } from "@/pages/register-page";
import { SettingsPage } from "@/pages/settings-page";
import { WorkspacePage } from "@/pages/workspace-page";

function FullscreenState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <FullscreenState>
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        正在恢复登录态...
      </FullscreenState>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAdmin, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <FullscreenState>
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        正在校验权限...
      </FullscreenState>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function UserShellLayout() {
  return <AppShell mode="user" />;
}

function AdminShellLayout() {
  return <AppShell mode="admin" />;
}

export function createAppRoutes(): RouteObject[] {
  return [
    {
      path: "/login",
      element: <LoginPage />,
    },
    {
      path: "/register",
      element: <RegisterPage />,
    },
    {
      path: "/",
      element: (
        <RequireAuth>
          <UserShellLayout />
        </RequireAuth>
      ),
      children: [
        {
          index: true,
          element: <HomePage />,
        },
        {
          path: "create",
          element: <CreatePage />,
        },
        {
          path: "workspace/:conversationId",
          element: <WorkspacePage />,
        },
        {
          path: "history",
          element: <HistoryPage />,
        },
        {
          path: "library",
          element: <LibraryPage />,
        },
        {
          path: "settings",
          element: <SettingsPage />,
        },
        {
          path: "*",
          element: <Navigate to="/" replace />,
        },
      ],
    },
    {
      path: "/admin",
      element: (
        <RequireAdmin>
          <AdminShellLayout />
        </RequireAdmin>
      ),
      children: [
        {
          index: true,
          element: <AdminPage />,
        },
      ],
    },
    {
      path: "*",
      element: <Navigate to="/" replace />,
    },
  ];
}

export function App() {
  const router = createBrowserRouter(createAppRoutes());

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
