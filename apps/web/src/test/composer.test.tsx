// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("submits the selected image size through params", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[createModel()]}
        initialDraft={{
          prompt: "draw a wide cinematic poster",
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("尺寸"), {
      target: { value: "1536x1024" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByLabelText("尺寸").className).toContain("w-[118px]");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          size: "1536x1024",
        }),
      }),
    );
  });

  it("omits size when automatic size is selected", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[createModel()]}
        initialDraft={{
          prompt: "draw with provider default size",
          params: { size: "1024x1024", quality: "high" },
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("尺寸"), {
      target: { value: "auto" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          quality: "high",
        },
      }),
    );
  });

  it("supports Grok documented generation sizes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[createModel({ id: "grok-4.2-image", name: "Grok 4.2 Image" })]}
        initialDraft={{
          prompt: "draw a tall poster",
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("尺寸"), {
      target: { value: "720x1280" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          size: "720x1280",
        }),
      }),
    );
  });

  it("hydrates the size selector from an existing task draft", () => {
    render(
      <Composer
        models={[createModel()]}
        initialDraft={{
          prompt: "continue this vertical image",
          params: { size: "1024x1536" },
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByLabelText("尺寸")).toHaveProperty("value", "1024x1536");
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

  it("keeps Gemini selected when upload forces edit and Gemini supports editing", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[
          createModel({
            id: "gemini-3-pro-image-preview",
            name: "Gemini 3 Pro Image Preview",
            type: "image-generation",
            capabilityTypes: ["image.generate", "image.edit"],
          }),
          createModel({
            id: "gpt-image-2",
            name: "GPT Image 2",
            capabilityTypes: ["image.generate", "image.edit"],
          }),
        ]}
        uploads={[createAsset()]}
        initialDraft={{
          prompt: "edit the uploaded image",
          capability: "image.generate",
        }}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("模型")).toHaveProperty("value", "gemini-3-pro-image-preview");
    });

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "image.edit",
        model: "gemini-3-pro-image-preview",
      }),
    );
  });

  it("keeps blocking edit submission when no edit-capable model is available", () => {
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
          capability: "image.generate",
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("模型")).toHaveProperty("value", "flux-schnell");
    expect(screen.getByText(/FLUX Schnell 不支持图片编辑/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the generate default model when no upload forces edit", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[
          createModel({
            id: "gemini-3-pro-image-preview",
            name: "Gemini 3 Pro Image Preview",
            type: "image-generation",
            capabilityTypes: ["image.generate"],
          }),
          createModel({
            id: "gpt-image-2",
            name: "GPT Image 2",
            capabilityTypes: ["image.generate", "image.edit"],
          }),
        ]}
        initialDraft={{
          prompt: "draw a mountain",
          capability: "image.generate",
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("模型")).toHaveProperty("value", "gemini-3-pro-image-preview");

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        capability: "image.generate",
        model: "gemini-3-pro-image-preview",
      }),
    );
  });

  it("renders readable model options without transparent select text", () => {
    render(
      <Composer
        models={[
          createModel({
            id: "very-long-readable-model-id-for-default-selection",
            name: "默认高清图片模型 - 支持长名称显示",
          }),
        ]}
        initialDraft={{
          prompt: "draw a mountain",
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const modelSelect = screen.getByLabelText("模型");

    expect(modelSelect.textContent).toContain("默认高清图片模型 - 支持长名称显示");
    expect(modelSelect.className).toContain("bg-[hsl(var(--surface-container-lowest))]");
    expect(modelSelect.className).toContain("text-foreground");
    expect(modelSelect.className).toContain("min-w-0");
    expect(modelSelect.className).toContain("flex-1");
    expect(modelSelect.className).toContain("truncate");
  });

  it("marks unsupported models and blocks submission when selected", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[
          createModel({
            id: "unsupported-model",
            name: "Unsupported Model",
            taskSupported: false,
            statusMessage: "该模型正在接入中。",
          }),
        ]}
        initialDraft={{
          prompt: "draw a mountain",
          model: "unsupported-model",
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("模型").textContent).toContain("Unsupported Model（暂不可提交）");
    expect(screen.getByText("该模型正在接入中。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("defaults to the first enabled model that can submit tasks", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <Composer
        models={[
          createModel({
            id: "unsupported-model",
            name: "Unsupported Model",
            taskSupported: false,
          }),
          createModel({
            id: "supported-model",
            name: "Supported Model",
          }),
        ]}
        initialDraft={{
          prompt: "draw a mountain",
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("模型")).toHaveProperty("value", "supported-model");

    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "supported-model",
      }),
    );
  });

  it("starts the composer textarea as a one-line auto-height input", () => {
    render(
      <Composer
        models={[createModel()]}
        initialDraft={{
          prompt: "draw a mountain",
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const textarea = screen.getByRole("textbox");

    expect(textarea).toHaveProperty("rows", 1);
    expect(textarea.className).toContain("min-h-[42px]");
    expect(textarea.className).toContain("max-h-[104px]");
    expect(textarea.className).toContain("resize-none");
    expect((textarea as HTMLTextAreaElement).style.overflowY).toBe("hidden");
  });
});
