import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AdminPage } from "@/pages/admin-page";
import { LoginPage } from "@/pages/login-page";
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
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <FullscreenState>
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        正在校验权限...
      </FullscreenState>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <WorkspacePage />,
      },
      {
        path: "admin",
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
