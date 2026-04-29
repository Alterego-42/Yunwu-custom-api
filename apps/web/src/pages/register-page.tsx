import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LoaderCircle, Sparkles, UserPlus } from "lucide-react";

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
  return error instanceof Error ? error.message : "注册失败，请稍后重试。";
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

export function RegisterPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { defaultRoute, isAuthenticated, isLoading, register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await register({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      navigate(redirectTo, { replace: true });
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
                <CardTitle>注册 Yunwu 个人账号</CardTitle>
                <CardDescription>
                  注册成功后将直接进入个人创作台。
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="displayName">
                  昵称
                </label>
                <Input
                  id="displayName"
                  type="text"
                  autoComplete="nickname"
                  placeholder="可选，用于展示"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  邮箱
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
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
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="confirmPassword"
                >
                  确认密码
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="再次输入密码"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={submitting}
                  minLength={8}
                  required
                />
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>已有账号可直接登录。</span>
                <Link
                  to="/login"
                  state={location.state}
                  className="inline-flex items-center gap-1 text-primary transition hover:text-primary/80"
                >
                  去登录
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
                  <UserPlus className="h-4 w-4" />
                )}
                注册并进入创作台
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
