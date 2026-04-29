import {
  BookImage,
  House,
  LayoutDashboard,
  LogOut,
  MessagesSquare,
  PlusSquare,
  Sparkles,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type AppShellMode = "user" | "admin";

const userNavItems = [
  { to: "/", label: "首页", icon: House },
  { to: "/create", label: "创建", icon: PlusSquare },
  { to: "/history", label: "历史", icon: MessagesSquare },
  { to: "/library", label: "作品库", icon: BookImage },
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,.12),transparent_30%),linear-gradient(180deg,#08111f_0%,#0b1120_32%,#020617_100%)]" />
      <div className="fixed inset-0 -z-10 bg-grid bg-[size:24px_24px] opacity-20" />

      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4 sm:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
          <Link
            to={mode === "admin" ? "/admin" : "/"}
            className="flex items-center gap-3"
          >
            <div className="rounded-2xl border border-primary/30 bg-primary/15 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Yunwu Image Platform</h1>
              <p className="text-xs text-muted-foreground">
                {mode === "admin" ? "管理员后台入口" : "个人创作台"}
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
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
