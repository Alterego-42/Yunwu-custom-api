import type { ReactNode } from "react";
import { Gauge, ListTodo, SlidersHorizontal } from "lucide-react";

import { TaskCard } from "@/components/cards/task-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UiTask } from "@/lib/api-types";

export function DetailPanel({
  tasks,
  queueLength,
  renderTaskActions,
}: {
  tasks: UiTask[];
  queueLength: number;
  renderTaskActions?: (task: UiTask) => ReactNode;
}) {
  const succeededCount = tasks.filter((task) => task.status === "succeeded").length;
  const failedCount = tasks.filter((task) =>
    ["failed", "cancelled", "expired"].includes(task.status),
  ).length;
  const orderedTasks = [...tasks].sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <CardTitle>辅助详情</CardTitle>
          </div>
          <CardDescription>
            下方展示会话概览与最近任务，主任务进展已改为聊天区单卡刷新。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">任务视图</span>
              <Badge>聊天时间线</Badge>
            </div>
            <p className="mt-3 text-foreground">
              用户消息与单条任务卡按时间排序，任务状态、失败原因和结果素材直接在卡片内更新。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gauge className="h-4 w-4" />
                当前任务数
              </div>
              <p className="mt-2 text-lg font-semibold">{tasks.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ListTodo className="h-4 w-4" />
                队列长度
              </div>
              <p className="mt-2 text-lg font-semibold">{queueLength}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-muted-foreground">已完成</div>
              <p className="mt-2 text-lg font-semibold">{succeededCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-muted-foreground">异常 / 结束</div>
              <p className="mt-2 text-lg font-semibold">{failedCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold">最近任务</p>
          <p className="text-xs text-muted-foreground">用于快速浏览，不再承担主任务视图职责。</p>
        </div>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
              当前会话暂无任务。
            </div>
          ) : null}
          {orderedTasks.map((task) => (
            <TaskCard key={task.id} task={task} compact actions={renderTaskActions?.(task)} />
          ))}
        </div>
      </div>
    </div>
  );
}
