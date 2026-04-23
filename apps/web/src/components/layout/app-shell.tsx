import { LayoutDashboard, LogOut, MessagesSquare, Sparkles } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "工作台", icon: MessagesSquare, adminOnly: false },
  { to: "/admin", label: "管理页", icon: LayoutDashboard, adminOnly: true },
];

export function AppShell() {
  const navigate = useNavigate();
  const { isAdmin, user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,.12),transparent_30%),linear-gradient(180deg,#08111f_0%,#0b1120_32%,#020617_100%)]" />
      <div className="fixed inset-0 -z-10 bg-grid bg-[size:24px_24px] opacity-20" />

      <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col px-4 py-4 sm:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 backdrop-blur">
          <Link to="/" className="flex items-center gap-3">
            <div className="rounded-2xl border border-primary/30 bg-primary/15 p-2 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Yunwu Image Platform</h1>
              <p className="text-xs text-muted-foreground">Vite + React + Tailwind + shadcn/ui shell</p>
            </div>
          </Link>

          <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
            {navItems
              .filter((item) => !item.adminOnly || isAdmin)
              .map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
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
            <div className="text-right">
              <p className="text-sm font-medium">{user?.displayName || user?.email}</p>
              <p className="text-xs text-muted-foreground">{isAdmin ? "admin" : "demo / user"}</p>
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
