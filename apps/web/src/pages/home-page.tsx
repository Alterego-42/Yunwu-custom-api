import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock3, Sparkles, TriangleAlert } from "lucide-react";

import { LibraryItemCard } from "@/components/cards/library-item-card";
import { TaskCard } from "@/components/cards/task-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import {
  formatRelativeTime,
  getConversationSummary,
  getTaskIntentMode,
  isLibraryItemDisplayable,
  toUiTask,
} from "@/lib/api-mappers";
import type { HomeResponse, TaskRecord } from "@/lib/api-types";
import { loadStoredUserSettings } from "@/lib/user-settings";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function RecoveryTaskCompactCard({
  task,
  onRetry,
  onOpenWorkspace,
  onAdjust,
  onIgnore,
}: {
  task: TaskRecord;
  onRetry: (task: TaskRecord) => void;
  onOpenWorkspace: (task: TaskRecord) => void;
  onAdjust: (task: TaskRecord) => void;
  onIgnore: (taskId: string) => void;
}) {
  return (
    <div
      className="rounded-xl border border-destructive/25 bg-destructive/[0.07] p-3"
      data-testid="compact-recovery-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{task.prompt || task.id}</p>
            <Badge variant="outline" className="border-destructive/30 text-destructive">
              失败
            </Badge>
            <Badge variant="outline">{task.modelId}</Badge>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {task.failure?.title ?? task.errorMessage ?? "任务执行失败，可在工作台查看上下文。"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {task.canRetry ? (
            <Button size="sm" onClick={() => onRetry(task)}>
              一键重试
            </Button>
          ) : null}
          {task.conversationId ? (
            <Button size="sm" variant="outline" onClick={() => onOpenWorkspace(task)}>
              打开工作台
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => onIgnore(task.id)}>
            忽略
          </Button>
        </div>
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none">失败详情 / 调整入口</summary>
        <div className="mt-2 rounded-lg border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-low)/0.82)] p-2">
          <p>{task.failure?.detail ?? task.errorMessage ?? "暂无更多失败详情。"}</p>
          {task.failure?.category === "invalid_request" ? (
            <Button className="mt-2" size="sm" variant="outline" onClick={() => onAdjust(task)}>
              调整后继续
            </Button>
          ) : null}
        </div>
      </details>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HomeResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllRecentTasks, setShowAllRecentTasks] = useState(false);
  const [showAllRecoveryTasks, setShowAllRecoveryTasks] = useState(false);
  const [ignoredTaskIds, setIgnoredTaskIds] = useState<string[]>([]);
  const recentItemsLimit = loadStoredUserSettings().ui.recentItemsLimit;

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

  const ignoredTaskIdSet = useMemo(() => new Set(ignoredTaskIds), [ignoredTaskIds]);
  const visibleRecoveryTasks = useMemo(() => {
    const tasks = (data?.recoveryTasks ?? []).filter((task) => !ignoredTaskIdSet.has(task.id));
    return showAllRecoveryTasks ? tasks : tasks.slice(0, 3);
  }, [data?.recoveryTasks, ignoredTaskIdSet, showAllRecoveryTasks]);
  const visibleRecentTasks = useMemo(() => {
    const tasks = (data?.recentTasks ?? []).filter((task) => !ignoredTaskIdSet.has(task.id));
    return showAllRecentTasks ? tasks : tasks.slice(0, recentItemsLimit);
  }, [data?.recentTasks, ignoredTaskIdSet, recentItemsLimit, showAllRecentTasks]);
  const visibleRecentAssets = useMemo(
    () => (data?.recentAssets ?? []).filter(isLibraryItemDisplayable),
    [data?.recentAssets],
  );
  const openWorkspace = useCallback(
    (task: TaskRecord) => {
      if (task.conversationId) {
        navigate(`/workspace/${task.conversationId}`);
      }
    },
    [navigate],
  );
  const adjustTask = useCallback(
    (task: TaskRecord) => {
      navigate(`/create?fromTaskId=${task.id}&mode=${getTaskIntentMode(task)}`);
    },
    [navigate],
  );
  const recoveryTotal = (data?.recoveryTasks ?? []).filter((task) => !ignoredTaskIdSet.has(task.id)).length;
  const recentTaskTotal = (data?.recentTasks ?? []).filter((task) => !ignoredTaskIdSet.has(task.id)).length;
  const ignoreTask = useCallback((taskId: string) => {
    setIgnoredTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
  }, []);
  const stats = useMemo(
    () => [
      {
        label: "最近会话",
        value: data?.recentConversations.length ?? 0,
        icon: Clock3,
      },
      {
        label: "最近作品",
        value: visibleRecentAssets.length,
        icon: Sparkles,
      },
      {
        label: "待恢复任务",
        value: recoveryTotal,
        icon: TriangleAlert,
      },
    ],
    [data?.recentConversations.length, recoveryTotal, visibleRecentAssets.length],
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>首页</CardTitle>
          <CardDescription>快速回到最近工作台、作品和待处理任务。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.92)] p-4">
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
        <Card>
          <CardHeader>
            <CardTitle>最近会话</CardTitle>
            <CardDescription>从首页直接回到上次工作台。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
                正在加载首页数据...
              </div>
            ) : null}
            {!loading && !data?.recentConversations.length ? (
              <div className="rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
                还没有会话，去创建页开始第一条任务。
              </div>
            ) : null}
            {data?.recentConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => navigate(`/workspace/${conversation.id}`)}
                className="w-full rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-left transition hover:bg-[hsl(var(--surface-container-high)/0.94)]"
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

        <Card>
          <CardHeader>
            <CardTitle>失败恢复</CardTitle>
            <CardDescription>只显示最新几条，可忽略不再处理的任务。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && recoveryTotal === 0 ? (
              <div className="rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
                当前没有待恢复任务。
              </div>
            ) : null}
            {visibleRecoveryTasks.map((task) => (
              <RecoveryTaskCompactCard
                key={task.id}
                task={task}
                onRetry={(nextTask) => void handleRetry(nextTask)}
                onOpenWorkspace={openWorkspace}
                onAdjust={adjustTask}
                onIgnore={ignoreTask}
              />
            ))}
            {recoveryTotal > 3 ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAllRecoveryTasks((current) => !current)}
              >
                {showAllRecoveryTasks ? "收起" : `展开全部 ${recoveryTotal} 条`}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>最近任务</CardTitle>
            <CardDescription>默认只显示最新几条，更多任务可展开查看。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && recentTaskTotal === 0 ? (
              <div className="rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
                暂无最近任务。
              </div>
            ) : null}
            {visibleRecentTasks.map((task) => (
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
                    <Button size="sm" variant="ghost" onClick={() => ignoreTask(task.id)}>
                      忽略
                    </Button>
                  </>
                }
              />
            ))}
            {recentTaskTotal > recentItemsLimit ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAllRecentTasks((current) => !current)}
              >
                {showAllRecentTasks ? "收起" : `展开全部 ${recentTaskTotal} 条`}
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近作品</CardTitle>
            <CardDescription>查看最近完成的作品。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {visibleRecentAssets.map((item) => (
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
            {!loading && !visibleRecentAssets.length ? (
              <div className="rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
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
