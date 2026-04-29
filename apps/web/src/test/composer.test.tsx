// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Composer } from "@/components/chat/composer";
import type { AssetRecord, ModelRecord } from "@/lib/api-types";

afterEach(() => {
  cleanup();
});

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

function createAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: "asset_upload_1",
    taskId: "asset_upload_1",
    type: "upload",
    url: "/api/assets/asset_upload_1/content",
    mimeType: "image/png",
    createdAt: "2026-04-29T08:00:00.000Z",
    ...overrides,
  };
}

describe("composer upload edit flow", () => {
  it("submits manual uploads as image.edit even when the draft started as image.generate", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[createModel()]}
        uploads={[createAsset()]}
        initialDraft={{
          prompt: "make the uploaded image warmer",
          capability: "image.generate",
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "image.edit",
        assetIds: ["asset_upload_1"],
      }),
    );
  });

  it("blocks submission when the selected model does not support image.edit", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[
          createModel({
            id: "flux-schnell",
            name: "FLUX Schnell",
            type: "image-generation",
            capabilityTypes: ["image.generate"],
          }),
        ]}
        uploads={[createAsset()]}
        initialDraft={{
          prompt: "edit the uploaded image",
          model: "flux-schnell",
          capability: "image.generate",
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByText(/FLUX Schnell 不支持图片编辑/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "发送" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
