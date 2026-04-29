import { describe, expect, it, vi } from "vitest";

import {
  getComposerSubmissionGuard,
  getTaskComposerAssets,
  getTaskRuntimeLabel,
  resolveComposerCapability,
  resolveAssetUrl,
} from "@/lib/api-mappers";
import type { AssetRecord, ModelRecord, TaskRecord } from "@/lib/api-types";

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_1",
    capability: "image.generate",
    status: "succeeded",
    modelId: "gpt-image-1",
    prompt: "draw a cat",
    createdAt: "2026-04-24T10:00:00.000Z",
    updatedAt: "2026-04-24T10:02:00.000Z",
    assetIds: [],
    ...overrides,
  };
}

function createAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: "asset_1",
    taskId: "task_1",
    type: "generated",
    url: "/api/assets/asset_1/content",
    createdAt: "2026-04-24T10:02:00.000Z",
    ...overrides,
  };
}

function createModel(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: "gpt-image-1",
    name: "GPT Image 1",
    type: "image-editing",
    capabilityTypes: ["image.generate", "image.edit"],
    enabled: true,
    ...overrides,
  };
}

describe("api mappers", () => {
  it("reuses generated output asset ids for re-edit even if detail assets are missing", () => {
    const task = createTask({
      outputSummary: {
        generatedAssetIds: ["asset_generated_1"],
      },
    });

    const assets = getTaskComposerAssets(task, []);

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      id: "asset_generated_1",
      taskId: "task_1",
      type: "generated",
    });
  });

  it("keeps original input assets for invalid request recovery", () => {
    const task = createTask({
      status: "failed",
      assetIds: ["asset_input_1"],
      failure: {
        category: "invalid_request",
        retryable: false,
      },
    });

    const assets = getTaskComposerAssets(task, []);

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      id: "asset_input_1",
      type: "upload",
    });
  });

  it("prefers image.edit when manual uploads are present", () => {
    expect(
      resolveComposerCapability({
        requestedCapability: "image.generate",
        assetCount: 1,
      }),
    ).toBe("image.edit");
  });

  it("blocks edit submission when the selected model does not support image.edit", () => {
    const guard = getComposerSubmissionGuard({
      models: [
        createModel({
          id: "flux-schnell",
          name: "FLUX Schnell",
          type: "image-generation",
          capabilityTypes: ["image.generate"],
        }),
      ],
      modelId: "flux-schnell",
      requestedCapability: "image.generate",
      assetCount: 1,
    });

    expect(guard.capability).toBe("image.edit");
    expect(guard.reason).toContain("FLUX Schnell");
    expect(guard.reason).toContain("不支持图片编辑");
  });

  it("resolves relative asset urls against api origin", () => {
    const resolvedFromLiteral = resolveAssetUrl("/api/assets/asset_1/content");
    const resolvedFromAsset = resolveAssetUrl(createAsset().url);

    expect(resolvedFromLiteral).toBe(resolvedFromAsset);
    expect(new URL(resolvedFromLiteral ?? "").pathname).toBe(
      "/api/assets/asset_1/content",
    );
  });

  it("formats task runtime from created and updated timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T10:05:00.000Z"));

    expect(
      getTaskRuntimeLabel(
        createTask({
          status: "running",
          updatedAt: "2026-04-24T10:04:00.000Z",
        }),
      ),
    ).toBe("运行 5 分");

    expect(getTaskRuntimeLabel(createTask())).toBe("耗时 2 分");

    vi.useRealTimers();
  });
});
