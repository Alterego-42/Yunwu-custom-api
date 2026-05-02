import {
  BookImage,
  House,
  LayoutDashboard,
  LogOut,
  Monitor,
  MessagesSquare,
  PlusSquare,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { applyUserTheme } from "@/lib/user-settings";
import { cn } from "@/lib/utils";

type AppShellMode = "user" | "admin";

const userNavItems = [
  { to: "/", label: "首页", icon: House },
  { to: "/create", label: "创建", icon: PlusSquare },
  { to: "/history", label: "历史", icon: MessagesSquare },
  { to: "/library", label: "作品库", icon: BookImage },
  { to: "/settings", label: "配置", icon: Settings },
];

const adminNavItems = [
  { to: "/admin", label: "管理台", icon: LayoutDashboard },
];

function getRoleLabel(role: string | null) {
  switch (role) {
    case "admin":
      return "管理员";
    case "demo":
      return "演示账号";
    case "member":
      return "个人用户";
    default:
      return "用户";
  }
}

export function AppShell({ mode = "user" }: { mode?: AppShellMode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, role, user, logout } = useAuth();
  const navItems = mode === "admin" ? adminNavItems : userNavItems;
  const [recentWorkspaceHref, setRecentWorkspaceHref] = useState("/create");
  const currentWorkspaceHref = useMemo(() => {
    const match = location.pathname.match(/^\/workspace\/([^/]+)/);
    return match ? `/workspace/${match[1]}` : undefined;
  }, [location.pathname]);
  const workspaceHref = currentWorkspaceHref ?? recentWorkspaceHref;

  useEffect(() => {
    applyUserTheme();
  }, []);

  useEffect(() => {
    if (mode !== "user" || currentWorkspaceHref) {
      return;
    }

    let cancelled = false;
    apiClient
      .getHome()
      .then((home) => {
        if (!cancelled) {
          setRecentWorkspaceHref(
            home.recentConversations[0]?.id
              ? `/workspace/${home.recentConversations[0].id}`
              : "/create",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentWorkspaceHref("/create");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceHref, mode]);

  async function handleLogout() {
    await logout();
    navigate("/login", {
      replace: true,
      state: {
        from:
          mode === "admin"
            ? {
                pathname: "/admin",
              }
            : undefined,
      },
    });
  }

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <div className="fixed inset-0 -z-20 bg-background" />
      <div className="fixed inset-0 -z-10 bg-app-shell" />
      <div className="fixed inset-0 -z-10 bg-grid bg-[size:24px_24px] opacity-[var(--shell-grid-opacity)]" />

      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-3 sm:px-5">
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.76)] px-4 py-2.5 shadow-[var(--header-shadow)] backdrop-blur-md">
          <Link
            to={mode === "admin" ? "/admin" : "/"}
            className="flex items-center gap-3"
          >
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-high)/0.8)] p-1.5 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Yunwu Image Platform</h1>
              <p className="text-xs text-muted-foreground">
                {mode === "admin" ? "管理员后台入口" : "个人创作台"}
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 rounded-full border border-[hsl(var(--outline-variant)/0.65)] bg-[hsl(var(--surface-container-low)/0.58)] p-1">
            {mode === "user" ? (
              <NavLink
                to={workspaceHref}
                className={() =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                    location.pathname.startsWith("/workspace")
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Monitor className="h-3.5 w-3.5" />
                工作台
              </NavLink>
            ) : null}
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(mode === "admin" ? "/" : "/admin", {
                    replace: location.pathname === "/admin" || mode === "admin",
                  })
                }
              >
                <LayoutDashboard className="h-4 w-4" />
                {mode === "admin" ? "前往创作台" : "前往管理台"}
              </Button>
            ) : null}
            <div className="text-right">
              <p className="text-sm font-medium">
                {user?.displayName || user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {getRoleLabel(role)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              退出
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
