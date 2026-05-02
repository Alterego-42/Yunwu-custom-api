// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { CreatePage } from "@/pages/create-page";
import type { ConversationDetail, ModelRecord, TaskRecord } from "@/lib/api-types";

const apiClientMock = vi.hoisted(() => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
  listModels: vi.fn(),
  uploadAsset: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

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

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_created",
    capability: "image.generate",
    status: "submitted",
    modelId: "gpt-image-1",
    prompt: "draw a clean workspace",
    createdAt: "2026-04-29T08:00:00.000Z",
    updatedAt: "2026-04-29T08:00:00.000Z",
    assetIds: [],
    conversationId: "conv_created",
    ...overrides,
  };
}

function createConversation(): ConversationDetail {
  return {
    id: "conv_created",
    title: "新的工作台",
    status: "running",
    updatedAt: "2026-04-29T08:00:00.000Z",
    messages: [],
    tasks: [createTask()],
    assets: [],
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function createAsset(overrides: Partial<ConversationDetail["assets"][number]> = {}) {
  return {
    id: "asset_upload_1",
    taskId: "asset_upload_1",
    type: "upload" as const,
    url: "/api/assets/asset_upload_1/content",
    mimeType: "image/png",
    createdAt: "2026-04-29T08:00:00.000Z",
    ...overrides,
  };
}

function renderCreatePage(initialEntry = "/create") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/create" element={<CreatePage />} />
        <Route path="/workspace/:conversationId" element={<div>workspace-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("create page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates a task and navigates directly to the workspace", async () => {
    apiClientMock.listModels.mockResolvedValue([createModel()]);
    apiClientMock.createTask.mockResolvedValue({
      task: createTask(),
      conversation: createConversation(),
    });

    renderCreatePage();

    expect(await screen.findByText("发起创作")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("输入提示词或调整说明，提交后进入工作台。"), {
      target: { value: "draw a clean workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交并进入工作台" }));

    await waitFor(() => {
      expect(apiClientMock.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: undefined,
          capability: "image.generate",
          prompt: "draw a clean workspace",
          model: "gpt-image-1",
        }),
      );
      expect(screen.getByTestId("location").textContent).toBe("/workspace/conv_created");
    });
  });

  it("submits uploaded assets as image.edit with an edit-capable model", async () => {
    apiClientMock.listModels.mockResolvedValue([
      createModel({
        id: "text-image-only",
        name: "Text Image Only",
        type: "image-generation",
        capabilityTypes: ["image.generate"],
      }),
      createModel({
        id: "edit-image-model",
        name: "Edit Image Model",
        capabilityTypes: ["image.generate", "image.edit"],
      }),
    ]);
    apiClientMock.uploadAsset.mockResolvedValue({
      asset: createAsset(),
    });
    apiClientMock.createTask.mockResolvedValue({
      task: createTask({
        capability: "image.edit",
        modelId: "edit-image-model",
        assetIds: ["asset_upload_1"],
      }),
      conversation: createConversation(),
    });

    const { container } = renderCreatePage();

    fireEvent.change(await screen.findByPlaceholderText("输入提示词或调整说明，提交后进入工作台。"), {
      target: { value: "make the uploaded image cinematic" },
    });
    const fileInput = container.querySelector<HTMLInputElement>("input[type='file']");
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [new File(["image"], "source.png", { type: "image/png" })] },
    });

    await waitFor(() => {
      expect(apiClientMock.uploadAsset).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText("模型")).toHaveProperty("value", "edit-image-model");
    });

    fireEvent.click(screen.getByRole("button", { name: "提交并进入工作台" }));

    await waitFor(() => {
      expect(apiClientMock.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "make the uploaded image cinematic",
          model: "edit-image-model",
          capability: "image.edit",
          assetIds: ["asset_upload_1"],
        }),
      );
    });
  });

  it("submits source assets and source metadata when re-editing from a task", async () => {
    apiClientMock.listModels.mockResolvedValue([
      createModel({
        id: "text-image-only",
        name: "Text Image Only",
        type: "image-generation",
        capabilityTypes: ["image.generate"],
      }),
      createModel({
        id: "edit-image-model",
        name: "Edit Image Model",
        capabilityTypes: ["image.generate", "image.edit"],
      }),
    ]);
    apiClientMock.getTask.mockResolvedValue(
      createTask({
        id: "task_source",
        status: "succeeded",
        modelId: "text-image-only",
        conversationId: "conv_source",
        outputSummary: {
          generatedAssetIds: ["asset_generated_1"],
        },
      }),
    );
    apiClientMock.createTask.mockResolvedValue({
      task: createTask({
        capability: "image.edit",
        modelId: "edit-image-model",
        assetIds: ["asset_generated_1"],
        sourceTaskId: "task_source",
        sourceAction: "edit",
      }),
      conversation: createConversation(),
    });

    renderCreatePage("/create?fromTaskId=task_source&mode=edit");

    expect(await screen.findByText("来源任务")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByLabelText("模型")).toHaveProperty("value", "edit-image-model");
      expect(screen.getByText("asset_generated_1")).toBeTruthy();
      expect(screen.getByRole("button", { name: "提交并进入工作台" })).toHaveProperty(
        "disabled",
        false,
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "提交并进入工作台" }));

    await waitFor(() => {
      expect(apiClientMock.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conv_source",
          prompt: "draw a clean workspace",
          model: "edit-image-model",
          capability: "image.edit",
          assetIds: ["asset_generated_1"],
          sourceTaskId: "task_source",
          sourceAction: "edit",
          fork: false,
        }),
      );
    });
  });
});
