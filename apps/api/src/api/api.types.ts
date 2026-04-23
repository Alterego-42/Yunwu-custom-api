import type {
  AssetRecord,
  CapabilityType,
  ModelRecord,
  ProviderAdminResponse,
  ProviderAlert,
  ProviderAlertSummary,
  ProviderCheckResponse,
  ProviderHealthCheck,
  ProviderLastTest,
  ProviderModelAvailability,
  ProviderModelSummary,
  ProviderTestGenerateResponse,
  ProviderWarning,
  TaskMessage,
  TaskRecord as SharedTaskRecord,
} from "@yunwu/shared";

export type {
  AssetRecord,
  CapabilityType,
  ModelRecord,
  ProviderAdminResponse,
  ProviderAlert,
  ProviderAlertSummary,
  ProviderCheckResponse,
  ProviderHealthCheck,
  ProviderLastTest,
  ProviderModelAvailability,
  ProviderModelSummary,
  ProviderTestGenerateResponse,
  ProviderWarning,
  TaskMessage,
};

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

export interface TaskRecord extends SharedTaskRecord {
  errorMessage?: string;
  progress?: number;
  conversationId?: string;
  conversationTitle?: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
}

export interface ConversationDetail extends ConversationSummary {
  messages: TaskMessage[];
  tasks: TaskRecord[];
  assets: AssetRecord[];
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

export interface CreateTaskResponse {
  task: TaskRecord;
  conversation: ConversationDetail;
}

export interface UploadAssetResponse {
  asset: AssetRecord;
}

export interface TaskResponse {
  task: TaskRecord;
}

export interface TasksResponse {
  tasks: TaskRecord[];
}

export interface RetryTaskResponse {
  task: TaskRecord;
  retriedFromTaskId: string;
}

export interface TaskEventRecord {
  id: string;
  taskId: string;
  eventType: string;
  status?: string;
  summary: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface TaskEventsResponse {
  events: TaskEventRecord[];
}

export interface ConversationTaskEventRecord {
  id: string;
  taskId: string;
  conversationId: string;
  eventType: string;
  status: string;
  title: string;
  detail: string;
  errorMessage: string | null;
  progress: number | null;
  assetIds: string[];
  createdAt: string;
  retryOfTaskId?: string;
  retryTaskId?: string;
}

export interface ConversationTaskEventsResponse {
  events: ConversationTaskEventRecord[];
}

export interface AdminModelCapabilityRecord {
  id: string;
  provider: string;
  model: string;
  modality: string;
  name: string;
  description?: string;
  capabilityTypes: CapabilityType[];
  enabled: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModelCapabilitiesResponse {
  modelCapabilities: AdminModelCapabilityRecord[];
}

export interface AdminModelCapabilityResponse {
  modelCapability: AdminModelCapabilityRecord;
}

export interface ConversationEvent {
  type: "connected" | "task.updated" | "conversation.updated" | "heartbeat";
  conversationId: string;
  taskId?: string;
  status?: string;
  updatedAt: string;
}
