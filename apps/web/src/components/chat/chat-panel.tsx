import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  User2,
  XCircle,
} from "lucide-react";

import { TaskCard } from "@/components/cards/task-card";
import { Composer } from "@/components/chat/composer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatRelativeTime,
  getConversationModel,
  getConversationSummary,
  toUiMessage,
} from "@/lib/api-mappers";
import type {
  AssetRecord,
  CapabilityType,
  ConversationDetail,
  ModelRecord,
  UiTask,
  UiTaskRoundNavigation,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type ChatMessage = ReturnType<typeof toUiMessage>;
type ConnectionMode = "sse" | "polling" | "connecting" | "idle";
type TaskRoundNavigation = UiTaskRoundNavigation & {
  onPrevious?: () => void;
  onNext?: () => void;
};

type TimelineItem =
  | {
      id: string;
      kind: "message";
      createdAt: string;
      order: number;
      message: ChatMessage;
    }
  | {
      id: string;
      kind: "task";
      createdAt: string;
      order: number;
      task: UiTask;
    };

const connectionToneMap: Record<ConnectionMode, string> = {
  sse: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  polling: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  connecting: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  idle: "border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.86)] text-muted-foreground",
};

const connectionLabelMap: Record<ConnectionMode, string> = {
  sse: "实时更新",
  polling: "自动刷新",
  connecting: "连接中",
  idle: "待更新",
};

function getTimelineTimestamp(value?: string) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getTaskHeadline(task: UiTask) {
  switch (task.status) {
    case "queued":
      return "任务已入队";
    case "submitted":
      return "任务已提交";
    case "running":
      return "任务执行中";
    case "succeeded":
      return "任务已完成";
    case "failed":
      return "任务失败";
    case "cancelled":
      return "任务已取消";
    case "expired":
      return "任务已过期";
    case "action_required":
      return "任务待处理";
    default:
      return "任务更新";
  }
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser ? (
        <Avatar className="mt-1 h-8 w-8 shrink-0 border border-[hsl(var(--outline-variant)/0.7)]">
          <AvatarFallback
            className={
              isSystem
                ? "bg-amber-400/15 text-amber-200"
                : "bg-[hsl(var(--surface-container-high))] text-primary"
            }
          >
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      ) : null}
      <div className={cn("min-w-0 max-w-[760px]", isUser ? "text-right" : "text-left")}>
        <div className={cn("flex items-center gap-2", isUser ? "justify-end" : "justify-start")}>
          <p className="text-sm font-medium text-foreground">{isUser ? "你" : isSystem ? "系统" : "Yunwu"}</p>
          <p className="text-xs text-muted-foreground">{message.time}</p>
        </div>
        <div
          className={
            isUser
              ? "mt-2 inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-left text-sm text-primary-foreground"
              : isSystem
                ? "mt-2 inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50"
                : "mt-2 inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.9)] px-4 py-3 text-sm text-foreground"
          }
        >
          {message.content}
        </div>
      </div>
      {isUser ? (
        <Avatar className="mt-1 h-8 w-8 shrink-0 border border-[hsl(var(--outline-variant)/0.7)]">
          <AvatarFallback className="bg-primary/20 text-primary">
            <User2 className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

function TaskBubble({
  task,
  actions,
  roundNavigation,
  isFocused,
}: {
  task: UiTask;
  actions?: ReactNode;
  roundNavigation?: TaskRoundNavigation;
  isFocused?: boolean;
}) {
  const isActive = task.status === "queued" || task.status === "submitted" || task.status === "running";
  const isSuccess = task.status === "succeeded";

  return (
    <div className="flex gap-3">
      <Avatar className="mt-1 h-8 w-8 border border-[hsl(var(--outline-variant)/0.7)]">
        <AvatarFallback
          className={
            isActive
              ? "bg-amber-400/15 text-amber-200"
              : isSuccess
                ? "bg-emerald-400/15 text-emerald-200"
                : "bg-rose-400/15 text-rose-200"
          }
        >
          {isActive ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{getTaskHeadline(task)}</p>
          <p className="text-xs text-muted-foreground">
            {formatRelativeTime(task.updatedAt ?? task.createdAt)}
          </p>
        </div>
        <TaskCard task={task} actions={actions} roundNavigation={roundNavigation} isFocused={isFocused} />
      </div>
    </div>
  );
}

export function ChatPanel({
  session,
  models,
  isLoading,
  error,
  uploadError,
  uploads,
  isUploading,
  tasks,
  connectionMode,
  composerDraft,
  composerSubmitLabel,
  composerHint,
  onResetComposer,
  onUpload,
  onRemoveUpload,
  onSubmitTask,
  renderTaskActions,
  taskRoundNavigationById,
  focusedTaskId,
}: {
  session?: ConversationDetail;
  models: ModelRecord[];
  isLoading?: boolean;
  error?: string | null;
  uploadError?: string | null;
  uploads: AssetRecord[];
  isUploading?: boolean;
  tasks: UiTask[];
  connectionMode?: ConnectionMode;
  composerDraft?: {
    prompt?: string;
    model?: string;
    capability?: CapabilityType;
    params?: Record<string, unknown>;
  };
  composerSubmitLabel?: string;
  composerHint?: string | null;
  onResetComposer?: () => void;
  onUpload: (file: File) => Promise<void>;
  onRemoveUpload: (assetId: string) => void;
  onSubmitTask: (input: {
    prompt: string;
    model: string;
    capability: CapabilityType;
    assetIds?: string[];
    params?: Record<string, unknown>;
  }) => Promise<void>;
  renderTaskActions?: (task: UiTask) => ReactNode;
  taskRoundNavigationById?: Map<string, TaskRoundNavigation>;
  focusedTaskId?: string;
}) {
  const activeTaskCount = tasks.filter((task) =>
    ["queued", "submitted", "running"].includes(task.status),
  ).length;
  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!session) {
      return [];
    }

    const messageItems: TimelineItem[] = session.messages.map((message, index) => ({
      id: `message-${message.id}`,
      kind: "message",
      createdAt: message.createdAt,
      order: index * 2,
      message: toUiMessage(message),
    }));
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const renderedRetryGroups = new Set<string>();
    const taskItems: TimelineItem[] = tasks
      .map((task, index): TimelineItem | null => {
        const navigation = taskRoundNavigationById?.get(task.id);
        const isRetryGroup = navigation && navigation.total > 1;

        if (isRetryGroup) {
          if (renderedRetryGroups.has(navigation.groupId)) {
            return null;
          }

          renderedRetryGroups.add(navigation.groupId);
          const selectedTaskId =
            focusedTaskId && navigation.taskIds.includes(focusedTaskId)
              ? focusedTaskId
              : navigation.taskIds.at(-1) ?? navigation.taskIds[0];
          const selectedTask = taskById.get(selectedTaskId) ?? task;

          return {
            id: `retry-task-${navigation.groupId}`,
            kind: "task",
            createdAt: task.createdAt ?? task.updatedAt ?? "",
            order: index * 2 + 1,
            task: selectedTask,
          };
        }

        return {
          id: `task-${task.id}`,
          kind: "task",
          createdAt: task.createdAt ?? task.updatedAt ?? "",
          order: index * 2 + 1,
          task,
        };
      })
      .filter((item): item is TimelineItem => Boolean(item));

    return [...messageItems, ...taskItems].sort((left, right) => {
      const diff = getTimelineTimestamp(left.createdAt) - getTimelineTimestamp(right.createdAt);
      return diff !== 0 ? diff : left.order - right.order;
    });
  }, [focusedTaskId, session, taskRoundNavigationById, tasks]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" data-testid="workspace-chat-panel">
      <Card className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 truncate text-lg font-semibold">{session?.title || "选择或新建会话"}</h2>
              <Badge>{getConversationModel(session)}</Badge>
              <Badge variant="outline" className={connectionToneMap[connectionMode ?? "idle"]}>
                {connectionLabelMap[connectionMode ?? "idle"]}
              </Badge>
              {activeTaskCount > 0 ? <Badge variant="outline">进行中 {activeTaskCount}</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {activeTaskCount > 0
                ? `当前有 ${activeTaskCount} 个任务在更新，结果会自动出现在时间线中。`
                : getConversationSummary(session)}
            </p>
          </div>
          <div className="rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.86)] px-3 py-1 text-xs text-muted-foreground">
            上次更新 {formatRelativeTime(session?.updatedAt)}
          </div>
        </div>
      </Card>

      <Card className="relative min-h-0 flex-1 overflow-hidden" data-testid="workspace-message-scroll-container">
        <ScrollArea className="h-full">
          <div className="space-y-5 p-4">
            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!isLoading && !error && !session ? (
              <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
                先选择一个会话，或发起一次新创作。
              </div>
            ) : null}

            {!isLoading && !error && session && timelineItems.length === 0 ? (
              <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
                还没有消息或任务。发送提示词后，进展和结果会在这里更新。
              </div>
            ) : null}

            {timelineItems.map((item) =>
              item.kind === "message" ? (
                <MessageBubble key={item.id} message={item.message} />
              ) : (
                <TaskBubble
                  key={item.id}
                  task={item.task}
                  actions={renderTaskActions?.(item.task)}
                  roundNavigation={taskRoundNavigationById?.get(item.task.id)}
                  isFocused={focusedTaskId === item.task.id}
                />
              ),
            )}

            {!isLoading && !error && session && timelineItems.length > 0 && activeTaskCount === 0 ? (
              <div className="flex gap-3">
                <Avatar className="mt-1 h-8 w-8 border border-[hsl(var(--outline-variant)/0.7)]">
                  <AvatarFallback className="bg-[hsl(var(--surface-container-high))] text-primary">
                    <CircleDashed className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-tl-sm border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.9)] px-4 py-3 text-sm text-muted-foreground">
                  当前工作台已更新到最新状态。
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
        {isLoading ? (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-background/45 backdrop-blur-[1px]"
            data-testid="workspace-detail-loading-overlay"
          >
            <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.94)] px-4 py-2 text-sm text-muted-foreground shadow-[var(--mdui-elevation-level1)]">
              <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              正在加载会话
            </div>
          </div>
        ) : null}
      </Card>

      <div className="mt-auto shrink-0 space-y-2" data-testid="workspace-composer-dock">
        {composerHint ? (
          <Card className="p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{composerHint}</p>
              {onResetComposer ? (
                <Button variant="ghost" size="sm" onClick={onResetComposer}>
                  清除预填
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Composer
          models={models}
          disabled={!session || Boolean(error)}
          uploads={uploads}
          uploadError={uploadError}
          isUploading={isUploading}
          initialDraft={composerDraft}
          submitLabel={composerSubmitLabel}
          onUpload={onUpload}
          onRemoveUpload={onRemoveUpload}
          onSubmit={onSubmitTask}
        />
      </div>
    </div>
  );
}
