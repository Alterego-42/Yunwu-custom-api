import { useMemo } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDashed,
  Clock3,
  LoaderCircle,
  RefreshCcw,
  User2,
  XCircle,
} from "lucide-react";

import { TaskAssetPreview, TaskCard } from "@/components/cards/task-card";
import { Composer } from "@/components/chat/composer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  TaskEventRecord,
  UiTask,
  UiTaskAsset,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type ChatMessage = ReturnType<typeof toUiMessage>;
type ConnectionMode = "sse" | "polling" | "connecting" | "idle";
type EventTone = "queued" | "submitted" | "running" | "succeeded" | "failed" | "retry" | "neutral";

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
      kind: "task-event";
      createdAt: string;
      order: number;
      event: TaskEventRecord;
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
  idle: "border-white/10 bg-black/20 text-muted-foreground",
};

const connectionLabelMap: Record<ConnectionMode, string> = {
  sse: "Live SSE",
  polling: "Polling",
  connecting: "Connecting",
  idle: "Idle",
};

const statusLabelMap: Record<string, string> = {
  queued: "排队中",
  submitted: "已提交",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
  expired: "已过期",
  action_required: "待处理",
  retry: "重试",
};

const eventToneMap: Record<
  EventTone,
  {
    avatar: string;
    badge: string;
    card: string;
    progress: string;
  }
> = {
  queued: {
    avatar: "bg-sky-400/15 text-sky-200",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-100",
    card: "border-sky-400/20 bg-sky-400/[0.07]",
    progress: "bg-sky-400",
  },
  submitted: {
    avatar: "bg-sky-400/15 text-sky-200",
    badge: "border-sky-400/30 bg-sky-400/10 text-sky-100",
    card: "border-sky-400/20 bg-sky-400/[0.07]",
    progress: "bg-sky-400",
  },
  running: {
    avatar: "bg-amber-400/15 text-amber-200",
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    card: "border-amber-400/20 bg-amber-400/[0.07]",
    progress: "bg-amber-400",
  },
  succeeded: {
    avatar: "bg-emerald-400/15 text-emerald-200",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    card: "border-emerald-400/20 bg-emerald-400/[0.07]",
    progress: "bg-emerald-400",
  },
  failed: {
    avatar: "bg-rose-400/15 text-rose-200",
    badge: "border-destructive/40 bg-destructive/10 text-destructive",
    card: "border-destructive/30 bg-destructive/[0.08]",
    progress: "bg-destructive",
  },
  retry: {
    avatar: "bg-fuchsia-400/15 text-fuchsia-200",
    badge: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100",
    card: "border-fuchsia-400/20 bg-fuchsia-400/[0.07]",
    progress: "bg-fuchsia-400",
  },
  neutral: {
    avatar: "bg-white/10 text-white",
    badge: "border-white/10 bg-white/[0.06] text-muted-foreground",
    card: "border-white/10 bg-white/[0.03]",
    progress: "bg-primary",
  },
};

function getTimelineTimestamp(value?: string) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function clampProgress(value?: number) {
  if (typeof value !== "number") {
    return undefined;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function toTimelineAsset(asset: AssetRecord): UiTaskAsset {
  const size = asset.width && asset.height ? `${asset.width} × ${asset.height}` : undefined;

  return {
    id: asset.id,
    type: asset.type,
    url: asset.url,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt,
    label: size ?? asset.mimeType ?? asset.id,
  };
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

function inferEventTone(event: TaskEventRecord): EventTone {
  const status = event.status?.toLowerCase();
  const eventType = event.eventType.toLowerCase();

  if (status === "retry" || eventType.includes("retry")) {
    return "retry";
  }

  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "expired" ||
    eventType.includes("fail") ||
    eventType.includes("error")
  ) {
    return "failed";
  }

  if (status === "succeeded" || eventType.includes("success") || eventType.includes("complete")) {
    return "succeeded";
  }

  if (status === "running" || eventType.includes("running") || eventType.includes("progress")) {
    return "running";
  }

  if (status === "submitted" || eventType.includes("submitted")) {
    return "submitted";
  }

  if (status === "queued" || eventType.includes("queued")) {
    return "queued";
  }

  return "neutral";
}

function getEventLabel(event: TaskEventRecord) {
  return event.status ? (statusLabelMap[event.status] ?? event.status) : event.eventType;
}

function getEventTitle(event: TaskEventRecord, task?: UiTask) {
  return (
    event.title?.trim() ||
    (event.status ? statusLabelMap[event.status] : undefined) ||
    event.summary?.trim() ||
    task?.title ||
    "任务事件"
  );
}

function getEventDetail(event: TaskEventRecord, title: string, task?: UiTask) {
  const detail = event.detail?.trim();
  const summary = event.summary?.trim();

  if (detail) {
    return detail;
  }

  if (summary && summary !== title) {
    return summary;
  }

  return task?.summary;
}

function getEventProgress(event: TaskEventRecord, task?: UiTask) {
  const apiProgress = clampProgress(event.progress);

  if (apiProgress !== undefined) {
    return apiProgress;
  }

  switch (event.status) {
    case "queued":
      return 8;
    case "submitted":
      return 20;
    case "running":
      return task?.progress ?? 72;
    case "action_required":
      return 92;
    case "succeeded":
    case "failed":
    case "cancelled":
    case "expired":
      return 100;
    default:
      return undefined;
  }
}

function getEventAssets(
  event: TaskEventRecord,
  task: UiTask | undefined,
  assetsById: Map<string, AssetRecord>,
) {
  const explicitAssets =
    event.assetIds
      ?.map((assetId) => assetsById.get(assetId))
      .filter((asset): asset is AssetRecord => Boolean(asset))
      .map(toTimelineAsset) ?? [];

  if (explicitAssets.length > 0) {
    return explicitAssets;
  }

  if (inferEventTone(event) === "succeeded") {
    return task?.resultAssets ?? [];
  }

  return [];
}

function renderEventIcon(event: TaskEventRecord) {
  const tone = inferEventTone(event);

  if (tone === "retry") {
    return <RefreshCcw className="h-4 w-4" />;
  }

  if (tone === "queued" || tone === "submitted" || tone === "running") {
    return <LoaderCircle className="h-4 w-4 animate-spin" />;
  }

  if (tone === "succeeded") {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  if (tone === "failed") {
    return <XCircle className="h-4 w-4" />;
  }

  return <CircleDashed className="h-4 w-4" />;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className="flex gap-3">
      <Avatar className="mt-1 h-8 w-8 border border-white/10">
        <AvatarFallback
          className={
            isUser
              ? "bg-primary/20 text-primary"
              : isSystem
                ? "bg-amber-400/15 text-amber-200"
                : "bg-white/10 text-white"
          }
        >
          {isUser ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{isUser ? "你" : isSystem ? "系统" : "Yunwu"}</p>
          <p className="text-xs text-muted-foreground">{message.time}</p>
        </div>
        <div
          className={
            isUser
              ? "mt-2 rounded-2xl rounded-tl-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
              : isSystem
                ? "mt-2 rounded-2xl rounded-tl-sm border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50"
                : "mt-2 rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-foreground"
          }
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

function TaskEventBubble({
  event,
  task,
  assets,
}: {
  event: TaskEventRecord;
  task?: UiTask;
  assets: AssetRecord[];
}) {
  const tone = inferEventTone(event);
  const toneStyle = eventToneMap[tone];
  const title = getEventTitle(event, task);
  const detail = getEventDetail(event, title, task);
  const progress = getEventProgress(event, task);
  const failureReason = event.errorMessage?.trim() || (tone === "failed" ? task?.errorMessage : undefined);
  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const eventAssets = getEventAssets(event, task, assetsById);

  return (
    <div className="flex gap-3">
      <Avatar className="mt-1 h-8 w-8 border border-white/10">
        <AvatarFallback className={toneStyle.avatar}>{renderEventIcon(event)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <Badge variant="outline" className={toneStyle.badge}>
            {getEventLabel(event)}
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-black/20 text-muted-foreground">
            {event.eventType}
          </Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="h-3 w-3" />
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        <div className={cn("rounded-2xl rounded-tl-sm border px-4 py-3", toneStyle.card)}>
          {task?.title && task.title !== title ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.title}</p>
          ) : null}

          {detail ? <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{detail}</p> : null}

          {failureReason ? (
            <div className="mt-3 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                失败原因
              </div>
              <p className="whitespace-pre-wrap">{failureReason}</p>
            </div>
          ) : null}

          {event.retryOfTaskId || event.retryTaskId ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {event.retryOfTaskId ? (
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1">
                  来源任务 {event.retryOfTaskId}
                </span>
              ) : null}
              {event.retryTaskId ? (
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2.5 py-1 text-fuchsia-100">
                  重试任务 {event.retryTaskId}
                </span>
              ) : null}
            </div>
          ) : null}

          {progress !== undefined ? (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>事件进度</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className={cn("h-2 rounded-full transition-all", toneStyle.progress)}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : null}

          {eventAssets.length > 0 ? (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                结果资产 / 缩略预览
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {eventAssets.map((asset) => (
                  <TaskAssetPreview key={asset.id} asset={asset} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>Task {event.taskId}</span>
            <span>Event {event.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskBubble({ task }: { task: UiTask }) {
  const isActive = task.status === "queued" || task.status === "submitted" || task.status === "running";
  const isSuccess = task.status === "succeeded";

  return (
    <div className="flex gap-3">
      <Avatar className="mt-1 h-8 w-8 border border-white/10">
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
        <TaskCard task={task} />
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
  taskEventError,
  uploads,
  isUploading,
  tasks,
  taskEvents,
  connectionMode,
  onUpload,
  onRemoveUpload,
  onSubmitTask,
}: {
  session?: ConversationDetail;
  models: ModelRecord[];
  isLoading?: boolean;
  error?: string | null;
  uploadError?: string | null;
  taskEventError?: string | null;
  uploads: AssetRecord[];
  isUploading?: boolean;
  tasks: UiTask[];
  taskEvents: TaskEventRecord[];
  connectionMode?: ConnectionMode;
  onUpload: (file: File) => Promise<void>;
  onRemoveUpload: (assetId: string) => void;
  onSubmitTask: (input: {
    prompt: string;
    model: string;
    capability: CapabilityType;
    assetIds?: string[];
  }) => Promise<void>;
}) {
  const activeTaskCount = tasks.filter((task) =>
    ["queued", "submitted", "running"].includes(task.status),
  ).length;
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!session) {
      return [];
    }

    const taskIdsWithEvents = new Set(taskEvents.map((event) => event.taskId));
    const messageItems: TimelineItem[] = session.messages.map((message, index) => ({
      id: `message-${message.id}`,
      kind: "message",
      createdAt: message.createdAt,
      order: index * 3,
      message: toUiMessage(message),
    }));
    const eventItems: TimelineItem[] = taskEvents.map((event, index) => ({
      id: `task-event-${event.id}`,
      kind: "task-event",
      createdAt: event.createdAt,
      order: index * 3 + 1,
      event,
    }));
    const taskItems: TimelineItem[] = tasks
      .filter((task) => !taskIdsWithEvents.has(task.id))
      .map((task, index) => ({
        id: `task-${task.id}`,
        kind: "task",
        createdAt: task.createdAt ?? task.updatedAt ?? "",
        order: index * 3 + 2,
        task,
      }));

    return [...messageItems, ...eventItems, ...taskItems].sort((left, right) => {
      const diff = getTimelineTimestamp(left.createdAt) - getTimelineTimestamp(right.createdAt);
      return diff !== 0 ? diff : left.order - right.order;
    });
  }, [session, taskEvents, tasks]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <Card className="border-white/10 bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{session?.title || "选择或新建会话"}</h2>
              <Badge>{getConversationModel(session)}</Badge>
              <Badge variant="outline" className={connectionToneMap[connectionMode ?? "idle"]}>
                {connectionLabelMap[connectionMode ?? "idle"]}
              </Badge>
              {taskEvents.length > 0 ? <Badge variant="outline">事件 {taskEvents.length}</Badge> : null}
              {activeTaskCount > 0 ? <Badge variant="outline">进行中 {activeTaskCount}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {taskEvents.length > 0
                ? "主时间线已按时间混排用户消息与任务历史事件；右侧仅保留任务摘要。"
                : activeTaskCount > 0
                  ? `任务状态、结果图片和失败原因会直接回到聊天时间线。当前有 ${activeTaskCount} 个任务在更新。`
                  : getConversationSummary(session)}
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-muted-foreground">
            上次更新 {formatRelativeTime(session?.updatedAt)}
          </div>
        </div>
      </Card>

      <Card className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-5">
            {isLoading ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                正在加载会话详情...
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!error && taskEventError ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                {taskEventError}
              </div>
            ) : null}

            {!isLoading && !error && !session ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                先选择一个会话，或新建会话后开始提交任务。
              </div>
            ) : null}

            {!isLoading && !error && session && timelineItems.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                还没有聊天消息或任务事件。发送提示词后，任务历史、失败原因与结果缩略图会按时间顺序出现在这里。
              </div>
            ) : null}

            {timelineItems.map((item) =>
              item.kind === "message" ? (
                <MessageBubble key={item.id} message={item.message} />
              ) : item.kind === "task-event" ? (
                <TaskEventBubble
                  key={item.id}
                  event={item.event}
                  task={taskById.get(item.event.taskId)}
                  assets={session?.assets ?? []}
                />
              ) : (
                <TaskBubble key={item.id} task={item.task} />
              ),
            )}

            {!isLoading && !error && session && timelineItems.length > 0 && activeTaskCount === 0 ? (
              <div className="flex gap-3">
                <Avatar className="mt-1 h-8 w-8 border border-white/10">
                  <AvatarFallback className="bg-white/10 text-white">
                    <CircleDashed className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-muted-foreground">
                  当前会话已同步到最新状态，后续 SSE 或轮询更新会继续追加任务历史事件。
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </Card>

      <Composer
        models={models}
        disabled={!session || Boolean(error)}
        uploads={uploads}
        uploadError={uploadError}
        isUploading={isUploading}
        onUpload={onUpload}
        onRemoveUpload={onRemoveUpload}
        onSubmit={onSubmitTask}
      />
    </div>
  );
}
