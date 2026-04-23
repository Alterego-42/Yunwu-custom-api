import type {
  AssetRecord,
  ConversationDetail,
  ConversationSummary,
  ModelRecord,
  TaskMessage,
  TaskRecord,
  UiImageResult,
  UiTask,
} from "@/lib/api-types";

export function formatRelativeTime(value?: string) {
  if (!value) {
    return "暂无时间";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  return date.toLocaleString();
}

export function getConversationStatus(conversation?: ConversationDetail | ConversationSummary) {
  if (!conversation) {
    return "idle" as const;
  }

  if ("status" in conversation && conversation.status) {
    return conversation.status;
  }

  if ("tasks" in conversation) {
    if (conversation.tasks.some((task) => ["queued", "submitted", "running"].includes(task.status))) {
      return "running" as const;
    }

    if (conversation.tasks.some((task) => task.status === "succeeded")) {
      return "done" as const;
    }
  }

  return "idle" as const;
}

export function getConversationModel(conversation?: ConversationDetail | ConversationSummary) {
  if (!conversation) {
    return "未选择";
  }

  if ("model" in conversation && conversation.model) {
    return conversation.model;
  }

  if ("tasks" in conversation) {
    return conversation.tasks[0]?.modelId ?? "未选择";
  }

  return "未选择";
}

export function getConversationSummary(conversation?: ConversationDetail | ConversationSummary) {
  if (!conversation) {
    return "选择或新建会话后开始创建任务。";
  }

  if ("summary" in conversation && conversation.summary) {
    return conversation.summary;
  }

  if ("messages" in conversation) {
    return conversation.messages.at(-1)?.content ?? "暂无消息，发送提示词后会创建任务。";
  }

  return "点击查看会话详情。";
}

export function toUiMessage(message: TaskMessage) {
  const role =
    message.type === "text"
      ? ("user" as const)
      : message.type === "system_notice"
        ? ("system" as const)
        : ("assistant" as const);

  return {
    id: message.id,
    role,
    content: message.content,
    time: formatRelativeTime(message.createdAt),
  };
}

export function toUiTask(task: TaskRecord): UiTask {
  const isDone = task.status === "succeeded";
  const isFailed =
    task.status === "failed" || task.status === "cancelled" || task.status === "expired";
  const progress = isDone ? 100 : isFailed ? 100 : task.status === "running" ? 72 : 12;

  return {
    id: task.id,
    title: task.prompt || task.capability,
    progress,
    status: task.status,
    eta: isDone
      ? "已完成"
      : isFailed
        ? task.errorMessage ?? "已结束"
        : `更新于 ${formatRelativeTime(task.updatedAt)}`,
    tags: [task.capability, task.modelId].filter(Boolean),
  };
}

export function toImageResults(tasks: TaskRecord[], assets: AssetRecord[]): UiImageResult[] {
  return assets
    .filter((asset) => asset.type === "generated")
    .map((asset, index) => {
      const task = tasks.find((item) => item.id === asset.taskId);

      return {
        id: asset.id,
        prompt: task?.prompt ?? "生成结果",
        size:
          asset.width && asset.height
            ? `${asset.width} × ${asset.height}`
            : asset.mimeType ?? "未知尺寸",
        model: task?.modelId ?? "unknown",
        badge: `结果 ${index + 1}`,
        url: asset.url,
      };
    });
}

export function toModelLabel(model: ModelRecord) {
  return model.name || model.id;
}
