import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, GitBranch, RefreshCcw } from "lucide-react";

import { TaskCard } from "@/components/cards/task-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import {
  formatAbsoluteTime,
  getSourceActionLabel,
  getTaskIntentMode,
  toUiTask,
} from "@/lib/api-mappers";
import type { HistoryResponse, TaskRecord } from "@/lib/api-types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<HistoryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await apiClient.getHistory());
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleRetry = useCallback(
    async (task: TaskRecord) => {
      await apiClient.retryTask(task.id);
      await loadHistory();
    },
    [loadHistory],
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-primary" />
            <CardTitle>历史页</CardTitle>
          </div>
          <CardDescription>按任务时间线展示来源链、失败分类与继续创作入口。</CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
            正在加载历史记录...
          </div>
        ) : null}
        {!loading && !data?.items.length ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
            暂无任务历史。
          </div>
        ) : null}

        {data?.items.map((task) => (
          <Card key={task.id} className="border-white/10 bg-white/[0.03]">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatAbsoluteTime(task.updatedAt)}</span>
                    {task.sourceAction ? (
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5" />
                        {getSourceActionLabel(task.sourceAction)}
                      </span>
                    ) : null}
                    {task.conversationTitle ? <span>{task.conversationTitle}</span> : null}
                  </div>
                  <CardTitle className="text-base">{task.prompt || task.id}</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.conversationId ? (
                    <Button size="sm" variant="outline" onClick={() => navigate(`/workspace/${task.conversationId}`)}>
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
                  <Button
                    size="sm"
                    onClick={() => navigate(`/create?fromTaskId=${task.id}&mode=variant&fork=1`)}
                  >
                    Fork
                  </Button>
                  {task.canRetry ? (
                    <Button size="sm" onClick={() => void handleRetry(task)}>
                      <RefreshCcw className="h-4 w-4" />
                      重试
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TaskCard task={toUiTask(task, [])} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
