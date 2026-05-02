import type {
  AssetRecord,
  CapabilityType,
  ConversationDetail,
  ConversationSummary,
  ModelRecord,
  TaskMessage,
  TaskRecord,
  TaskSourceAction,
  TaskStatus,
  UiImageResult,
  UiTask,
  UiTaskAsset,
  UiTaskRoundNavigation,
} from "@/lib/api-types";
import { apiClient } from "@/lib/api-client";

const ACTIVE_TASK_STATUSES = new Set<TaskStatus>(["queued", "submitted", "running"]);

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

export function formatAbsoluteTime(value?: string) {
  if (!value) {
    return "暂无时间";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

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
    if (conversation.tasks.some(isTaskActive)) {
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

  if (conversation.metadata) {
    const metadataModel =
      typeof conversation.metadata.model === "string"
        ? conversation.metadata.model
        : typeof conversation.metadata.recentTaskModel === "string"
          ? conversation.metadata.recentTaskModel
          : typeof conversation.metadata.lastTaskModel === "string"
            ? conversation.metadata.lastTaskModel
            : undefined;

    if (metadataModel) {
      return metadataModel;
    }
  }

  if ("tasks" in conversation) {
    return conversation.tasks.at(-1)?.modelId ?? "未选择";
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

export function toConversationSummary(conversation: ConversationDetail): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    metadata: conversation.metadata,
    summary: conversation.messages.at(-1)?.content,
    status: conversation.tasks.some(isTaskActive)
      ? "running"
      : conversation.tasks.length > 0
        ? "done"
        : "idle",
    model: getConversationModel(conversation),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
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

export function isTaskActive(task: Pick<TaskRecord, "status">) {
  return ACTIVE_TASK_STATUSES.has(task.status);
}

export function getTaskProgress(task: TaskRecord) {
  if (typeof task.progress === "number") {
    return Math.min(100, Math.max(0, Math.round(task.progress)));
  }

  switch (task.status) {
    case "queued":
      return 8;
    case "submitted":
      return 20;
    case "running":
      return 72;
    case "action_required":
      return 92;
    case "succeeded":
    case "failed":
    case "cancelled":
    case "expired":
      return 100;
    default:
      return 0;
  }
}

export function getTaskInputAssetIds(task: TaskRecord) {
  return Array.isArray(task.assetIds) ? task.assetIds : [];
}

export function getTaskOutputAssetIds(task: TaskRecord) {
  const generatedAssetIds = task.outputSummary?.generatedAssetIds;
  return Array.isArray(generatedAssetIds)
    ? generatedAssetIds.filter((value): value is string => typeof value === "string")
    : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function hasMockedMarker(value: unknown): boolean {
  const record = asRecord(value);

  if (record.mocked === true) {
    return true;
  }

  const metadata = asRecord(record.metadata);
  if (metadata.mocked === true) {
    return true;
  }

  const assets = record.assets;
  if (Array.isArray(assets) && assets.some(hasMockedMarker)) {
    return true;
  }

  return false;
}

export function isTaskMocked(task: Pick<TaskRecord, "outputSummary">) {
  return hasMockedMarker(task.outputSummary);
}

export function isTaskRealSucceeded(
  task: Pick<TaskRecord, "status" | "outputSummary">,
) {
  return task.status === "succeeded" && !isTaskMocked(task);
}

export function isLibraryItemDisplayable(item: {
  asset: AssetRecord;
  task: Pick<TaskRecord, "status" | "outputSummary">;
}) {
  const assetWithRuntimeFields = item.asset as AssetRecord & {
    mocked?: unknown;
    metadata?: unknown;
  };

  return (
    item.asset.type === "generated" &&
    !hasMockedMarker(assetWithRuntimeFields) &&
    isTaskRealSucceeded(item.task)
  );
}

function createTaskPlaceholderAsset(task: TaskRecord, assetId: string): AssetRecord {
  const isRecoveryInput = task.failure?.category === "invalid_request";

  return {
    id: assetId,
    taskId: task.id,
    type: isRecoveryInput ? "upload" : "generated",
    url: "",
    mimeType: isRecoveryInput ? "image/source" : "image/generated",
    createdAt: task.updatedAt ?? task.createdAt ?? new Date().toISOString(),
  };
}

export function getTaskComposerAssetIds(task: TaskRecord) {
  if (task.failure?.category === "invalid_request") {
    return getTaskInputAssetIds(task);
  }

  const outputAssetIds = getTaskOutputAssetIds(task);
  return outputAssetIds.length > 0 ? outputAssetIds : getTaskInputAssetIds(task);
}

export function getTaskComposerAssets(task: TaskRecord, assets: AssetRecord[]) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  return getTaskComposerAssetIds(task).map((assetId) => {
    return assetsById.get(assetId) ?? createTaskPlaceholderAsset(task, assetId);
  });
}

export function getTaskStatusLabel(status: TaskStatus) {
  const labels: Record<TaskStatus, string> = {
    queued: "排队中",
    submitted: "已提交",
    running: "执行中",
    succeeded: "已完成",
    failed: "失败",
    cancelled: "已取消",
    expired: "已过期",
    action_required: "待处理",
  };

  return labels[status] ?? status;
}

export function getSourceActionLabel(action?: TaskSourceAction | null) {
  switch (action) {
    case "retry":
      return "重试链";
    case "edit":
      return "再编辑";
    case "variant":
      return "生成变体";
    case "fork":
      return "Fork 分支";
    default:
      return "新任务";
  }
}

export function summarizeParams(params?: Record<string, unknown>) {
  if (!params || Object.keys(params).length === 0) {
    return "默认参数";
  }

  return Object.entries(params)
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(" · ");
}

export function getTaskFailureDescription(task: TaskRecord) {
  return task.failure?.detail ?? task.errorMessage ?? "任务执行失败。";
}

export function getTaskIntentMode(task: TaskRecord) {
  if (task.sourceAction === "variant") {
    return "variant" as const;
  }

  return "edit" as const;
}

export function modelSupportsCapability(
  model: Pick<ModelRecord, "capabilityTypes"> | undefined,
  capability: CapabilityType,
) {
  return model?.capabilityTypes.includes(capability) ?? false;
}

export function isModelTaskSubmittable(
  model: Pick<ModelRecord, "status" | "taskSupported"> | undefined,
) {
  return Boolean(model && model.taskSupported !== false && model.status !== "unsupported");
}

export function resolveComposerCapability(input: {
  requestedCapability: CapabilityType;
  assetCount?: number;
}) {
  return (input.assetCount ?? 0) > 0 ? ("image.edit" as CapabilityType) : input.requestedCapability;
}

export function getComposerSubmissionGuard(input: {
  models: ModelRecord[];
  modelId?: string;
  requestedCapability: CapabilityType;
  assetCount?: number;
}) {
  const capability = resolveComposerCapability(input);
  const assetCount = input.assetCount ?? 0;
  const model = input.models.find((item) => item.id === input.modelId);

  if (capability === "image.edit" && assetCount === 0) {
    return {
      capability,
      reason: "图片编辑需要先上传或选择至少一张参考图。",
    };
  }

  if (input.modelId && model && !isModelTaskSubmittable(model)) {
    return {
      capability,
      reason: model.statusMessage || "该模型暂未接入当前任务通道。",
    };
  }

  if (input.modelId && model && !modelSupportsCapability(model, capability)) {
    return {
      capability,
      reason:
        capability === "image.edit"
          ? `当前模型 ${toModelLabel(model)} 不支持图片编辑，请切换到支持图片编辑的模型。`
          : `当前模型 ${toModelLabel(model)} 不支持当前能力。`,
    };
  }

  return {
    capability,
    reason: undefined,
  };
}

export function resolveAssetUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  try {
    const resolved = new URL(url, apiClient.getBaseUrl());
    const base = new URL(apiClient.getBaseUrl());
    if (resolved.origin !== base.origin && resolved.pathname.startsWith("/api/assets/")) {
      return new URL(`${resolved.pathname}${resolved.search}`, base).toString();
    }

    return resolved.toString();
  } catch {
    return url;
  }
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds} 秒`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
  }

  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return remainMinutes > 0 ? `${hours} 小时 ${remainMinutes} 分` : `${hours} 小时`;
}

export function getTaskRuntimeLabel(task: Pick<TaskRecord, "createdAt" | "updatedAt" | "status">) {
  const startAt = new Date(task.createdAt).getTime();
  const endAt = isTaskActive(task)
    ? Date.now()
    : new Date(task.updatedAt ?? task.createdAt).getTime();

  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    return "运行时长未知";
  }

  return `${isTaskActive(task) ? "运行" : "耗时"} ${formatDuration(endAt - startAt)}`;
}

export function toUiTaskAsset(asset: AssetRecord): UiTaskAsset {
  const size = asset.width && asset.height ? `${asset.width} × ${asset.height}` : undefined;

  return {
    id: asset.id,
    type: asset.type,
    url: resolveAssetUrl(asset.url),
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt,
    label: size ?? asset.mimeType ?? asset.id,
  };
}

export function toUiTask(task: TaskRecord, assets: AssetRecord[]): UiTask {
  const inputAssetIds = new Set(getTaskInputAssetIds(task));
  const outputAssetIds = new Set(getTaskOutputAssetIds(task));
  const inputAssets = assets
    .filter((asset) => inputAssetIds.has(asset.id))
    .map(toUiTaskAsset);
  const resultAssets = isTaskRealSucceeded(task)
    ? assets
        .filter((asset) => outputAssetIds.has(asset.id) || asset.taskId === task.id)
        .filter((asset) => asset.type === "generated")
        .filter((asset) => !hasMockedMarker(asset))
        .map(toUiTaskAsset)
    : [];

  return {
    id: task.id,
    title: task.prompt || task.capability,
    prompt: task.prompt,
    progress: getTaskProgress(task),
    status: task.status,
    eta: getTaskRuntimeLabel(task),
    tags: [task.capability, task.modelId].filter(Boolean),
    capability: task.capability,
    model: task.modelId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    errorMessage: task.errorMessage,
    summary: task.failure?.detail,
    inputAssets,
    resultAssets,
    assetIds: task.assetIds,
    params: task.params,
    failure: task.failure,
    canRetry: task.canRetry,
    conversationId: task.conversationId,
    conversationTitle: task.conversationTitle,
    sourceTaskId: task.sourceTaskId,
    sourceAction: task.sourceAction,
    inputSummary: task.inputSummary,
    outputSummary: task.outputSummary,
  };
}

function getTaskSortTime(task: Pick<TaskRecord, "createdAt" | "updatedAt">) {
  const value = new Date(task.createdAt ?? task.updatedAt ?? 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}

export function buildTaskRoundNavigation(tasks: TaskRecord[]) {
  const result = new Map<string, UiTaskRoundNavigation>();
  const originalOrder = new Map(tasks.map((task, index) => [task.id, index]));
  const orderedTasks = [...tasks].sort((left, right) => {
    const diff = getTaskSortTime(left) - getTaskSortTime(right);
    return diff !== 0 ? diff : (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0);
  });
  const taskById = new Map(orderedTasks.map((task) => [task.id, task]));
  const retryLineageByRootId = new Map<string, TaskRecord[]>();

  function getRootId(task: TaskRecord) {
    let current = task;
    const seen = new Set<string>([task.id]);

    while (
      current.sourceAction === "retry" &&
      current.sourceTaskId &&
      taskById.has(current.sourceTaskId) &&
      !seen.has(current.sourceTaskId)
    ) {
      seen.add(current.sourceTaskId);
      current = taskById.get(current.sourceTaskId) ?? current;
    }

    return current.id;
  }

  function assignNavigation(groupId: string, items: TaskRecord[]) {
    const taskIds = items.map((task) => task.id);

    items.forEach((task, index) => {
      result.set(task.id, {
        scope: "retry",
        groupId,
        taskIds,
        index: index + 1,
        total: items.length,
        previousTaskId: items[index - 1]?.id,
        nextTaskId: items[index + 1]?.id,
      });
    });
  }

  orderedTasks.forEach((task) => {
    if (task.sourceAction !== "retry") {
      if (!orderedTasks.some((item) => item.sourceAction === "retry" && item.sourceTaskId === task.id)) {
        return;
      }
    }

    const rootId = getRootId(task);
    const lineage = retryLineageByRootId.get(rootId) ?? [];
    lineage.push(task);
    retryLineageByRootId.set(rootId, lineage);
  });

  retryLineageByRootId.forEach((lineage, rootId) => {
    const retryItems = lineage.filter((task) => task.sourceAction === "retry");

    if (retryItems.length > 0 && lineage.length > 1) {
      assignNavigation(rootId, lineage);
    }
  });

  return result;
}

export function toImageResults(tasks: TaskRecord[], assets: AssetRecord[]): UiImageResult[] {
  return assets
    .filter((asset) => asset.type === "generated")
    .filter((asset) => !hasMockedMarker(asset))
    .flatMap((asset, index): UiImageResult[] => {
      const task = tasks.find((item) => item.id === asset.taskId);

      if (task && !isTaskRealSucceeded(task)) {
        return [];
      }

      return [
        {
          id: asset.id,
          prompt: task?.prompt ?? "生成结果",
          size:
            asset.width && asset.height
              ? `${asset.width} × ${asset.height}`
              : asset.mimeType ?? "未知尺寸",
          model: task?.modelId ?? "unknown",
          badge: `结果 ${index + 1}`,
          url: resolveAssetUrl(asset.url),
        },
      ];
    });
}

export function toModelLabel(model: ModelRecord) {
  return model.name || model.id;
}

function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} 项`;
  }

  if (value && typeof value === "object") {
    return `${Object.keys(value).length} 个字段`;
  }

  return "空";
}
