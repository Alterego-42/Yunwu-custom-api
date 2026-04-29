import {
  ASSET_TYPES,
  CAPABILITY_TYPES,
  MESSAGE_TYPES,
  MODEL_TYPES,
  TASK_SOURCE_ACTIONS,
  TASK_STATUSES,
  USER_ROLES,
} from "./constants";
import type {
  AssetRecord,
  AssetType,
  CapabilityType,
  MessageType,
  ModelRecord,
  ModelType,
  TaskSourceAction,
  TaskMessage,
  TaskRecord,
  TaskStatus,
  UserRole
} from "./types";

const DEFAULT_TIMESTAMP = "2026-01-01T00:00:00.000Z";

export const isCapabilityType = (value: string): value is CapabilityType =>
  CAPABILITY_TYPES.includes(value as CapabilityType);

export const isTaskStatus = (value: string): value is TaskStatus =>
  TASK_STATUSES.includes(value as TaskStatus);

export const isUserRole = (value: string): value is UserRole =>
  USER_ROLES.includes(value as UserRole);

export const isTaskSourceAction = (
  value: string
): value is TaskSourceAction =>
  TASK_SOURCE_ACTIONS.includes(value as TaskSourceAction);

export const isMessageType = (value: string): value is MessageType =>
  MESSAGE_TYPES.includes(value as MessageType);

export const isModelType = (value: string): value is ModelType =>
  MODEL_TYPES.includes(value as ModelType);

export const isAssetType = (value: string): value is AssetType =>
  ASSET_TYPES.includes(value as AssetType);

export const createTaskMessage = (
  overrides: Partial<TaskMessage> = {}
): TaskMessage => ({
  id: overrides.id ?? "msg_demo_001",
  type: overrides.type ?? "system_notice",
  content: overrides.content ?? "Task created",
  createdAt: overrides.createdAt ?? DEFAULT_TIMESTAMP
});

export const createMockTask = (
  overrides: Partial<TaskRecord> = {}
): TaskRecord => ({
  id: overrides.id ?? "task_demo_001",
  capability: overrides.capability ?? "image.generate",
  status: overrides.status ?? "queued",
  modelId: overrides.modelId ?? "gpt-image-1",
  prompt: overrides.prompt ?? "A soft cloud city over a calm lake",
  createdAt: overrides.createdAt ?? DEFAULT_TIMESTAMP,
  updatedAt: overrides.updatedAt ?? DEFAULT_TIMESTAMP,
  messages: overrides.messages ?? [createTaskMessage()],
  assetIds: overrides.assetIds ?? []
});

export const createMockModel = (
  overrides: Partial<ModelRecord> = {}
): ModelRecord => ({
  id: overrides.id ?? "gpt-image-1",
  name: overrides.name ?? "GPT Image 1",
  type: overrides.type ?? "image-generation",
  capabilityTypes: overrides.capabilityTypes ?? ["image.generate"],
  enabled: overrides.enabled ?? true,
  provider: overrides.provider ?? "openai-compatible",
  description: overrides.description ?? "OpenAI-compatible image generation model"
});

export const createMockAsset = (
  overrides: Partial<AssetRecord> = {}
): AssetRecord => ({
  id: overrides.id ?? "asset_demo_001",
  taskId: overrides.taskId ?? "task_demo_001",
  type: overrides.type ?? "generated",
  url: overrides.url ?? "https://example.com/assets/demo.png",
  mimeType: overrides.mimeType ?? "image/png",
  width: overrides.width ?? 1024,
  height: overrides.height ?? 1024,
  createdAt: overrides.createdAt ?? DEFAULT_TIMESTAMP
});
