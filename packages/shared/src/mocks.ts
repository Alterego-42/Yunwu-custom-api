import { createMockAsset, createMockModel, createMockTask, createTaskMessage } from "./helpers";
import type { AssetRecord, ModelRecord, TaskMessage, TaskRecord } from "./types";

export const mockMessages: TaskMessage[] = [
  createTaskMessage(),
  createTaskMessage({
    id: "msg_demo_002",
    type: "task_card",
    content: "Generating preview"
  }),
  createTaskMessage({
    id: "msg_demo_003",
    type: "image_result",
    content: "Assets generated"
  })
];

export const mockTasks: TaskRecord[] = [
  createMockTask({
    id: "task_demo_001",
    status: "running",
    messages: mockMessages,
    assetIds: ["asset_demo_001"]
  }),
  createMockTask({
    id: "task_demo_002",
    capability: "image.edit",
    status: "succeeded",
    modelId: "model_image_editor",
    prompt: "Remove the background and keep soft shadows",
    assetIds: ["asset_demo_002"]
  })
];

export const mockModels: ModelRecord[] = [
  createMockModel(),
  createMockModel({
    id: "model_image_editor",
    name: "Image Editor Pro",
    type: "image-editing",
    capabilityTypes: ["image.edit", "image.background_replace"]
  })
];

export const mockAssets: AssetRecord[] = [
  createMockAsset(),
  createMockAsset({
    id: "asset_demo_002",
    taskId: "task_demo_002",
    type: "generated",
    url: "https://example.com/assets/demo-thumb.png",
    width: 512,
    height: 512
  })
];
