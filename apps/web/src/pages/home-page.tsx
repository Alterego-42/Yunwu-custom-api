import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock3, Sparkles, TriangleAlert } from "lucide-react";

import { LibraryItemCard } from "@/components/cards/library-item-card";
import { TaskCard } from "@/components/cards/task-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import {
  formatRelativeTime,
  getConversationSummary,
  getTaskIntentMode,
  toUiTask,
} from "@/lib/api-mappers";
import type { HomeResponse, TaskRecord } from "@/lib/api-types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

export function HomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHome = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await apiClient.getHome());
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const handleRetry = useCallback(
    async (task: TaskRecord) => {
      await apiClient.retryTask(task.id);
      await loadHome();
      if (task.conversationId) {
        navigate(`/workspace/${task.conversationId}`);
      }
    },
    [loadHome, navigate],
  );

  const stats = useMemo(
    () => [
      {
        label: "最近会话",
        value: data?.recentConversations.length ?? 0,
        icon: Clock3,
      },
      {
        label: "最近作品",
        value: data?.recentAssets.length ?? 0,
        icon: Sparkles,
      },
      {
        label: "待恢复任务",
        value: data?.recoveryTasks.length ?? 0,
        icon: TriangleAlert,
      },
    ],
    [data],
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle>首页</CardTitle>
          <CardDescription>聚合最近会话、最近任务、最近作品和失败恢复入口。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle>最近会话</CardTitle>
            <CardDescription>从首页直接回到上次工作台。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
                正在加载首页数据...
              </div>
            ) : null}
            {!loading && !data?.recentConversations.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
                还没有会话，去创建页开始第一条任务。
              </div>
            ) : null}
            {data?.recentConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => navigate(`/workspace/${conversation.id}`)}
                className="w-full rounded-xl border border-white/10 bg-black/20 p-4 text-left transition hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{conversation.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {getConversationSummary(conversation)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(conversation.updatedAt)}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle>失败恢复</CardTitle>
            <CardDescription>系统类失败可重试，内容类失败走参数回填。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && !data?.recoveryTasks.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
                当前没有待恢复任务。
              </div>
            ) : null}
            {data?.recoveryTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={toUiTask(task, [])}
                compact
                actions={
                  <>
                    {task.canRetry ? (
                      <Button size="sm" onClick={() => void handleRetry(task)}>
                        一键重试
                      </Button>
                    ) : null}
                    {task.failure?.category === "invalid_request" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/create?fromTaskId=${task.id}&mode=${getTaskIntentMode(task)}`)}
                      >
                        调整后继续
                      </Button>
                    ) : null}
                    {task.conversationId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/workspace/${task.conversationId}`)}
                      >
                        打开工作台
                      </Button>
                    ) : null}
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle>最近任务</CardTitle>
            <CardDescription>继续创作默认回原会话，显式 fork 才分支。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.recentTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={toUiTask(task, [])}
                compact
                actions={
                  <>
                    {task.conversationId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/workspace/${task.conversationId}`)}
                      >
                        打开工作台
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/create?fromTaskId=${task.id}&mode=${getTaskIntentMode(task)}`)}
                    >
                      继续创作
                    </Button>
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle>最近作品</CardTitle>
            <CardDescription>已自动排除软删除作品。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {data?.recentAssets.map((item) => (
              <LibraryItemCard
                key={item.asset.id}
                item={item}
                actions={
                  <>
                    {item.conversation?.id ? (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/workspace/${item.conversation?.id}`)}>
                        查看来源
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/create?fromTaskId=${item.task.id}&mode=edit`)}
                    >
                      再编辑
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/create?fromTaskId=${item.task.id}&mode=variant&fork=1`)}
                    >
                      Fork
                    </Button>
                  </>
                }
              />
            ))}
            {!loading && !data?.recentAssets.length ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
                最近作品为空，先去创建页生成第一张图。
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => navigate("/create")}>
          前往创建页
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
