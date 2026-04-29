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
} from "@/lib/api-types";

type ChatMessage = ReturnType<typeof toUiMessage>;
type ConnectionMode = "sse" | "polling" | "connecting" | "idle";

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
  idle: "border-white/10 bg-black/20 text-muted-foreground",
};

const connectionLabelMap: Record<ConnectionMode, string> = {
  sse: "Live SSE",
  polling: "Polling",
  connecting: "Connecting",
  idle: "Idle",
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

function TaskBubble({ task, actions }: { task: UiTask; actions?: ReactNode }) {
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
        <TaskCard task={task} actions={actions} />
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
    const taskItems: TimelineItem[] = tasks
      .map((task, index) => ({
        id: `task-${task.id}`,
        kind: "task",
        createdAt: task.createdAt ?? task.updatedAt ?? "",
        order: index * 2 + 1,
        task,
      }));

    return [...messageItems, ...taskItems].sort((left, right) => {
      const diff = getTimelineTimestamp(left.createdAt) - getTimelineTimestamp(right.createdAt);
      return diff !== 0 ? diff : left.order - right.order;
    });
  }, [session, tasks]);

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
              {activeTaskCount > 0 ? <Badge variant="outline">进行中 {activeTaskCount}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeTaskCount > 0
                ? `主时间线只保留单条任务卡，状态会原位刷新。当前有 ${activeTaskCount} 个任务在更新。`
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

            {!isLoading && !error && !session ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                先选择一个会话，或新建会话后开始提交任务。
              </div>
            ) : null}

            {!isLoading && !error && session && timelineItems.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                还没有聊天消息或任务。发送提示词后，任务卡会在这里按创建顺序更新状态与结果。
              </div>
            ) : null}

            {timelineItems.map((item) =>
              item.kind === "message" ? (
                <MessageBubble key={item.id} message={item.message} />
              ) : (
                <TaskBubble key={item.id} task={item.task} actions={renderTaskActions?.(item.task)} />
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
                  当前会话已同步到最新状态；后续 SSE 或轮询只会刷新现有任务卡内容。
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </Card>

      <div className="space-y-3">
        {composerHint ? (
          <Card className="border-white/10 bg-white/[0.03] p-4">
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
