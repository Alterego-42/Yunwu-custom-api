import type { ReactNode } from "react";
import { Gauge, ListTodo, SlidersHorizontal } from "lucide-react";

import { TaskCard } from "@/components/cards/task-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UiTask, UiTaskRoundNavigation } from "@/lib/api-types";

type TaskRoundNavigation = UiTaskRoundNavigation & {
  onPrevious?: () => void;
  onNext?: () => void;
};

export function DetailPanel({
  tasks,
  queueLength,
  renderTaskActions,
  taskRoundNavigationById,
  focusedTaskId,
}: {
  tasks: UiTask[];
  queueLength: number;
  renderTaskActions?: (task: UiTask) => ReactNode;
  taskRoundNavigationById?: Map<string, TaskRoundNavigation>;
  focusedTaskId?: string;
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
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const renderedRetryGroups = new Set<string>();
  const visibleTasks = orderedTasks
    .map((task) => {
      const navigation = taskRoundNavigationById?.get(task.id);

      if (!navigation || navigation.total <= 1) {
        return task;
      }

      if (renderedRetryGroups.has(navigation.groupId)) {
        return null;
      }

      renderedRetryGroups.add(navigation.groupId);
      const selectedTaskId =
        focusedTaskId && navigation.taskIds.includes(focusedTaskId)
          ? focusedTaskId
          : navigation.taskIds.at(-1) ?? navigation.taskIds[0];

      return taskById.get(selectedTaskId) ?? task;
    })
    .filter((task): task is UiTask => Boolean(task));

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            <CardTitle>工作台概览</CardTitle>
          </div>
          <CardDescription>
            查看当前任务数量、队列和最近任务。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 text-sm">
          <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">任务视图</span>
              <Badge>时间线</Badge>
            </div>
            <p className="mt-3 text-foreground">
              消息、任务状态、失败原因和结果素材会按时间顺序展示。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gauge className="h-4 w-4" />
                当前任务数
              </div>
              <p className="mt-2 text-lg font-semibold">{tasks.length}</p>
            </div>
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ListTodo className="h-4 w-4" />
                队列长度
              </div>
              <p className="mt-2 text-lg font-semibold">{queueLength}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-3">
              <div className="text-muted-foreground">已完成</div>
              <p className="mt-2 text-lg font-semibold">{succeededCount}</p>
            </div>
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-3">
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
          <p className="text-xs text-muted-foreground">快速回看最新任务。</p>
        </div>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-4 text-sm text-muted-foreground">
              当前会话暂无任务。
            </div>
          ) : null}
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              compact
              actions={renderTaskActions?.(task)}
              roundNavigation={taskRoundNavigationById?.get(task.id)}
              isFocused={focusedTaskId === task.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
