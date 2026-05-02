// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { HomePage } from "@/pages/home-page";
import type { AssetRecord, HomeResponse, LibraryItemRecord, TaskRecord } from "@/lib/api-types";

const apiClientMock = vi.hoisted(() => ({
  getHome: vi.fn(),
  retryTask: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

function createTask(index: number, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: `task_${index}`,
    capability: "image.generate",
    status: "failed",
    modelId: "gpt-image-1",
    prompt: `recent task ${index}`,
    createdAt: "2026-04-29T08:00:00.000Z",
    updatedAt: "2026-04-29T08:00:00.000Z",
    assetIds: [],
    conversationId: `conv_${index}`,
    canRetry: true,
    failure: {
      category: "provider_error",
      retryable: true,
      title: "生成失败",
      detail: "请稍后重试。",
    },
    ...overrides,
  };
}

function createHomeResponse(): HomeResponse {
  const recentTasks = Array.from({ length: 5 }, (_, index) => createTask(index + 1, {
    status: "succeeded",
    canRetry: false,
    failure: undefined,
  }));

  return {
    recentConversations: [],
    recentTasks,
    recentAssets: [],
    recoveryTasks: Array.from({ length: 4 }, (_, index) => createTask(index + 10)),
  };
}

function createAsset(id: string, overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id,
    taskId: "task_asset",
    type: "generated",
    url: `/api/assets/${id}/content`,
    createdAt: "2026-04-29T08:00:00.000Z",
    ...overrides,
  };
}

function createLibraryItem(overrides: Partial<LibraryItemRecord> = {}): LibraryItemRecord {
  const task = createTask(30, {
    id: "task_asset",
    status: "succeeded",
    canRetry: false,
    failure: undefined,
    outputSummary: {
      mocked: false,
      generatedAssetIds: ["asset_real"],
    },
  });

  return {
    asset: createAsset("asset_real"),
    task,
    conversation: {
      id: "conv_asset",
      title: "asset conversation",
      updatedAt: "2026-04-29T08:00:00.000Z",
    },
    ...overrides,
  };
}

function renderHomePage() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/workspace/:conversationId" element={<div>workspace-page</div>} />
        <Route path="/create" element={<div>create-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("home page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps ordinary copy free of Round 3 and limits recent task lists", async () => {
    apiClientMock.getHome.mockResolvedValue(createHomeResponse());

    renderHomePage();

    expect(await screen.findByText("recent task 1")).toBeTruthy();
    expect(screen.queryByText("Round 3")).toBeNull();
    expect(screen.queryByText("recent task 5")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "展开全部 5 条" }));
    expect(await screen.findByText("recent task 5")).toBeTruthy();
  });

  it("can ignore a recovery task from the compact list", async () => {
    apiClientMock.getHome.mockResolvedValue(createHomeResponse());

    renderHomePage();

    expect(await screen.findByText("recent task 10")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "忽略" })[0]);

    expect(screen.queryByText("recent task 10")).toBeNull();
  });

  it("renders recovery tasks as compact summary cards with secondary details", async () => {
    apiClientMock.getHome.mockResolvedValue(createHomeResponse());

    renderHomePage();

    expect(await screen.findAllByTestId("compact-recovery-card")).toHaveLength(3);
    expect(screen.getAllByText("失败详情 / 调整入口")[0]).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "打开工作台" })[0]).toBeTruthy();
  });

  it("shows provider unavailable failure detail and no successful output actions", async () => {
    apiClientMock.getHome.mockResolvedValue({
      ...createHomeResponse(),
      recentTasks: [],
      recoveryTasks: [
        createTask(20, {
          errorMessage: "Real image generation unavailable: provider API key is not configured.",
          failure: {
            category: "provider_unavailable",
            retryable: false,
            title: "Provider unavailable",
            detail: "Provider is not configured. Add an API key before retrying real image generation.",
          },
          outputSummary: {
            generatedAssetIds: ["asset_failed"],
          },
        }),
      ],
    });

    renderHomePage();

    expect(await screen.findByText("Provider unavailable")).toBeTruthy();
    expect(screen.getByText(/Provider is not configured/)).toBeTruthy();
    expect(screen.queryByText("结果素材 1 项")).toBeNull();
    expect(screen.queryByLabelText("下载图片")).toBeNull();
  });

  it("keeps mocked or failed assets out of recent works", async () => {
    apiClientMock.getHome.mockResolvedValue({
      ...createHomeResponse(),
      recentAssets: [
        createLibraryItem(),
        createLibraryItem({
          asset: createAsset("asset_mocked", { taskId: "task_mocked" }),
          task: createTask(31, {
            id: "task_mocked",
            status: "succeeded",
            canRetry: false,
            failure: undefined,
            prompt: "mocked random image",
            outputSummary: {
              mocked: true,
              generatedAssetIds: ["asset_mocked"],
            },
          }),
        }),
        createLibraryItem({
          asset: createAsset("asset_failed", { taskId: "task_failed" }),
          task: createTask(32, {
            id: "task_failed",
            status: "failed",
            prompt: "failed random image",
            outputSummary: {
              generatedAssetIds: ["asset_failed"],
            },
          }),
        }),
      ],
    });

    renderHomePage();

    expect(await screen.findByText("recent task 30")).toBeTruthy();
    expect(screen.queryByText("mocked random image")).toBeNull();
    expect(screen.queryByText("failed random image")).toBeNull();
  });
});
