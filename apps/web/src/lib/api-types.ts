import type {
  AssetRecord,
  CapabilityType,
  ModelRecord,
  TaskMessage,
  TaskRecord,
  TaskStatus,
} from "@yunwu/shared";

export type ConversationSummary = {
  id: string;
  title: string;
  summary?: string;
  status?: "idle" | "running" | "done";
  model?: string;
  createdAt?: string;
  updatedAt: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: TaskMessage[];
  tasks: TaskRecord[];
  assets: AssetRecord[];
};

export type CreateConversationInput = {
  title?: string;
};

export type CreateTaskInput = {
  conversationId: string;
  capability: CapabilityType;
  model: string;
  prompt: string;
  assetIds?: string[];
  params?: Record<string, unknown>;
};

export type CreateTaskResponse = {
  task: TaskRecord;
  conversation: ConversationDetail;
};

export type UploadAssetResponse = {
  asset: AssetRecord;
};

export type ApiTask = TaskRecord & {
  progress?: number;
  conversationId?: string;
  conversationTitle?: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
};

export type TaskEventRecord = {
  id: string;
  taskId: string;
  conversationId?: string;
  eventType: string;
  status?: TaskStatus | "retry" | (string & {});
  title?: string;
  detail?: string;
  errorMessage?: string;
  progress?: number;
  assetIds?: string[];
  retryOfTaskId?: string;
  retryTaskId?: string;
  summary?: string;
  details?: Record<string, unknown>;
  createdAt: string;
};

export type AdminModelCapabilityRecord = ModelRecord & {
  model: string;
  modality: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AdminProviderMode = "mock" | "real" | (string & {});

export type AdminProviderAvailabilityStatus =
  | "available"
  | "missing"
  | "unknown"
  | (string & {});

export type AdminProviderWarning =
  | string
  | {
      code?: string;
      title?: string;
      message?: string;
      severity?: "info" | "warning" | "error" | (string & {});
    };

export type AdminProviderAlertSeverity =
  | "critical"
  | "warning"
  | "info"
  | "error"
  | (string & {});

export type AdminProviderAlert = {
  id: string;
  title?: string;
  message?: string;
  severity?: AdminProviderAlertSeverity;
  status?: string;
  taskId?: string | null;
  task?: Pick<ApiTask, "id"> | null;
  createdAt?: string;
  updatedAt?: string;
  detectedAt?: string;
  triggeredAt?: string;
  occurredAt?: string;
  acknowledgedAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type AdminProviderAlertSummary = {
  activeAlerts?: number;
  activeCount?: number;
  totalActive?: number;
  criticalAlerts?: number;
  criticalCount?: number;
  warningAlerts?: number;
  warningCount?: number;
  infoAlerts?: number;
  infoCount?: number;
};

export type AdminProviderModelAvailability = {
  id?: string;
  model?: string;
  modelId?: string;
  name?: string;
  enabled?: boolean;
  status?: AdminProviderAvailabilityStatus;
  availability?: AdminProviderAvailabilityStatus;
  message?: string;
  hint?: string;
  reason?: string;
  capabilityTypes?: string[];
};

export type AdminProviderStatus = {
  id?: string;
  name: string;
  type: string;
  baseUrl?: string | null;
  apiKeyConfigured: boolean;
  maskedApiKey?: string | null;
  mode: AdminProviderMode;
  supportedCapabilities?: string[];
  defaultModels?: Partial<Record<string, string>>;
  defaultGenerateModel?: string | null;
  defaultEditModel?: string | null;
  models?: Array<{
    id: string;
    name: string;
    enabled: boolean;
    capabilityTypes: string[];
    remoteAvailable?: boolean;
  }>;
  lastCheck?: AdminProviderCheckResult;
  lastTest?: AdminProviderTestGenerateResult;
  modelAvailability?: AdminProviderModelAvailability[];
  warnings?: AdminProviderWarning[];
  alerts?: AdminProviderAlert[];
  summary?: AdminProviderAlertSummary;
  updatedAt?: string;
};

export type AdminProviderCheckResult = {
  ok: boolean;
  status?: "healthy" | "degraded" | "unhealthy" | (string & {});
  message?: string;
  errorSummary?: string;
  checkedAt?: string;
  latencyMs?: number;
  provider?: AdminProviderStatus;
  details?: Record<string, unknown>;
};

export type AdminProviderTestGenerateResult = {
  ok?: boolean;
  taskId?: string;
  task?: ApiTask;
  status?: string;
  message?: string;
  errorSummary?: string;
  failureSummary?: string;
  result?: Record<string, unknown> | string | null;
  assetIds?: string[];
  queuedAt?: string;
  createdAt?: string;
  completedAt?: string;
};

export type UiTaskAsset = {
  id: string;
  type: AssetRecord["type"];
  url?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt: string;
  label: string;
};

export type UiTask = {
  id: string;
  title: string;
  progress: number;
  status: TaskStatus;
  eta: string;
  tags: string[];
  prompt?: string;
  capability?: CapabilityType;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
  errorMessage?: string;
  summary?: string;
  inputAssets?: UiTaskAsset[];
  resultAssets?: UiTaskAsset[];
};

export type UiImageResult = {
  id: string;
  prompt: string;
  size: string;
  model: string;
  badge: string;
  url?: string;
};

export type { AssetRecord, CapabilityType, ModelRecord, TaskMessage, TaskRecord, TaskStatus };
