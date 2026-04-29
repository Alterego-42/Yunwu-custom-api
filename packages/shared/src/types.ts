import type {
  ASSET_TYPES,
  CAPABILITY_TYPES,
  MESSAGE_TYPES,
  MODEL_TYPES,
  TASK_SOURCE_ACTIONS,
  TASK_STATUSES,
  USER_ROLES,
} from "./constants";

export type CapabilityType = (typeof CAPABILITY_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type TaskSourceAction = (typeof TASK_SOURCE_ACTIONS)[number];
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type ModelType = (typeof MODEL_TYPES)[number];
export type AssetType = (typeof ASSET_TYPES)[number];

export interface ConversationMetadata {
  forkedFromConversationId?: string;
  forkedFromTaskId?: string;
  [key: string]: unknown;
}

export interface TaskMessage {
  id: string;
  type: MessageType;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  metadata?: ConversationMetadata;
  updatedAt: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: TaskMessage[];
  tasks: TaskRecord[];
  assets: AssetRecord[];
}

export interface TaskRecord {
  id: string;
  capability: CapabilityType;
  status: TaskStatus;
  modelId: string;
  prompt: string;
  sourceTaskId?: string;
  sourceAction?: TaskSourceAction;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
  messages?: TaskMessage[];
  assetIds?: string[];
}

export interface ModelRecord {
  id: string;
  name: string;
  type: ModelType;
  capabilityTypes: CapabilityType[];
  enabled: boolean;
  provider?: string;
  description?: string;
}

export interface AssetRecord {
  id: string;
  taskId: string;
  type: AssetType;
  url: string;
  storageKey?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  createdAt: string;
}

export interface CreateConversationInput {
  title?: string;
}

export interface CreateTaskInput {
  conversationId?: string;
  capability: CapabilityType;
  model: string;
  prompt: string;
  assetIds?: string[];
  params?: Record<string, unknown>;
  sourceTaskId?: string;
  sourceAction?: TaskSourceAction;
  fork?: boolean;
}

export interface UploadAssetResponse {
  asset: AssetRecord;
}

export interface CreateTaskResponse {
  task: TaskRecord;
  conversation: ConversationDetail;
}

export interface CapabilitiesResponse {
  capabilities: Array<{
    key: CapabilityType;
    name: string;
  }>;
}

export interface ModelsResponse {
  models: ModelRecord[];
}

export interface ConversationsResponse {
  conversations: ConversationSummary[];
}

export interface ConversationResponse {
  conversation: ConversationDetail;
}

export interface TasksResponse {
  tasks: TaskRecord[];
}

export interface TaskResponse {
  task: TaskRecord;
}

export type ProviderMode = "mock" | "real";
export type ProviderHealthStatus = "ok" | "degraded" | "error";
export type ProviderModelsSource = "configured" | "remote" | "unavailable";

export interface ProviderAdminError {
  category:
    | "missing_api_key"
    | "provider_auth"
    | "provider_network"
    | "provider_unavailable"
    | "invalid_response"
    | "invalid_configuration"
    | "unknown";
  message: string;
  retryable: boolean;
  statusCode?: number;
}

export interface ProviderModelSummary {
  id: string;
  name: string;
  enabled: boolean;
  capabilityTypes: CapabilityType[];
  remoteAvailable?: boolean;
}

export interface ProviderHealthCheck {
  checkedAt: string;
  status: ProviderHealthStatus;
  latencyMs?: number;
  mode: ProviderMode;
  baseUrlReachable: boolean;
  apiKeyConfigured: boolean;
  modelsSource: ProviderModelsSource;
  configuredModelCount: number;
  enabledModelCount: number;
  availableModelCount?: number;
  supportedCapabilities: CapabilityType[];
  defaultModels: Partial<Record<CapabilityType, string>>;
  error?: ProviderAdminError;
}

export interface ProviderLastTest {
  taskId?: string;
  status?: TaskStatus;
  testedAt?: string;
  error?: string;
}

export interface ProviderModelAvailability {
  id: string;
  name: string;
  capabilityTypes: CapabilityType[];
  status: "available" | "missing" | "unknown";
  message: string;
}

export interface ProviderWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface ProviderAlert {
  id: string;
  level: "critical" | "warning";
  kind: string;
  title: string;
  message: string;
  createdAt: string;
  relatedTaskId?: string;
  acknowledgedAt?: string;
}

export interface ProviderAlertSummary {
  hasActiveAlerts: boolean;
  criticalCount: number;
  warningCount: number;
}

export interface ProviderAdminStatus {
  type: string;
  name: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  maskedApiKey?: string;
  mode: ProviderMode;
  supportedCapabilities: CapabilityType[];
  defaultModels: Partial<Record<CapabilityType, string>>;
  models: ProviderModelSummary[];
  lastCheck: ProviderHealthCheck | null;
  lastTest: ProviderLastTest | null;
  modelAvailability: ProviderModelAvailability[];
  warnings: ProviderWarning[];
  alerts: ProviderAlert[];
  summary: ProviderAlertSummary;
}

export interface ProviderAdminResponse {
  provider: ProviderAdminStatus;
}

export interface ProviderCheckResponse {
  provider: ProviderAdminStatus;
  check: ProviderHealthCheck;
}

export interface ProviderTestGenerateResponse extends CreateTaskResponse {
  test: {
    capability: "image.generate";
    model: string;
    mode: ProviderMode;
    queuedAt: string;
    lastTest?: ProviderLastTest;
  };
}
