import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "登录失败，请稍后重试。";
}

function resolveRedirectTarget(
  state: unknown,
  fallbackPath: string,
  disallowedPaths: string[] = ["/login", "/register"],
) {
  const from = (
    state as {
      from?: { pathname?: string; search?: string; hash?: string };
    } | null
  )?.from;
  if (!from?.pathname || disallowedPaths.includes(from.pathname)) {
    return fallbackPath;
  }

  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { defaultRoute, isAuthenticated, isLoading, login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = useMemo(() => {
    return resolveRedirectTarget(location.state, defaultRoute);
  }, [defaultRoute, location.state]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const nextUser = await login({ email: email.trim(), password });
      const nextDefaultRoute = nextUser.role === "admin" ? "/admin" : "/";
      navigate(resolveRedirectTarget(location.state, nextDefaultRoute), {
        replace: true,
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,.14),transparent_30%),linear-gradient(180deg,#08111f_0%,#0b1120_32%,#020617_100%)]" />
      <div className="fixed inset-0 -z-10 bg-grid bg-[size:24px_24px] opacity-20" />

      <div className="mx-auto flex min-h-screen max-w-[1800px] items-center justify-center px-4 py-8 sm:px-6">
        <Card className="w-full max-w-md border-white/10 bg-black/30">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-primary/30 bg-primary/15 p-2 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>登录 Yunwu</CardTitle>
                <CardDescription>
                  登录后进入工作台；管理页仅管理员可见。
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="demo@yunwu.local"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  密码
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>个人用户请使用注册入口创建账号。</span>
                <Link
                  to="/register"
                  state={location.state}
                  className="inline-flex items-center gap-1 text-primary transition hover:text-primary/80"
                >
                  去注册
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <Button
                className="w-full"
                type="submit"
                disabled={submitting || isLoading}
              >
                {submitting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                登录
              </Button>
            </form>

            {!isLoading && isAuthenticated && user ? null : (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                admin/demo/member 共用统一登录口，管理员登录后会自动进入
                `/admin`。
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
