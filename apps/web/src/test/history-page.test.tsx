// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { HistoryPage } from "@/pages/history-page";
import type { HistoryResponse, TaskRecord } from "@/lib/api-types";

const apiClientMock = vi.hoisted(() => ({
  getHistory: vi.fn(),
  retryTask: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_history",
    capability: "image.generate",
    status: "failed",
    modelId: "gpt-image-1",
    prompt: "history batch task",
    createdAt: "2026-04-29T08:00:00.000Z",
    updatedAt: "2026-04-29T08:00:00.000Z",
    assetIds: [],
    conversationId: "conv_history",
    conversationTitle: "History conversation",
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

function renderHistoryPage(response: HistoryResponse) {
  apiClientMock.getHistory.mockResolvedValue(response);

  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <Routes>
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/workspace/:conversationId" element={<div>workspace-page</div>} />
        <Route path="/create" element={<div>create-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("history page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("hides direct continue, fork, and retry actions for batch tasks", async () => {
    renderHistoryPage({
      items: [
        createTask({
          batch: {
            isBatch: true,
            batchSize: 4,
            returnedCount: 4,
            successCount: 2,
            failedCount: 2,
            loadingCount: 0,
            firstFailureMessage: "Provider rate limited.",
            partialSuccess: true,
          },
        }),
      ],
    });

    expect((await screen.findAllByText("history batch task")).length).toBeGreaterThan(0);
    expect(screen.getByText("共 4 个")).toBeTruthy();
    expect(screen.getByText("失败 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: "打开工作台" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "继续创作" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fork" })).toBeNull();
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
    expect(apiClientMock.retryTask).not.toHaveBeenCalled();
  });

  it("renders successful batch slots from embedded asset summaries and opens preview", async () => {
    renderHistoryPage({
      items: [
        createTask({
          status: "succeeded",
          canRetry: false,
          failure: undefined,
          batch: {
            isBatch: true,
            batchSize: 2,
            returnedCount: 2,
            successCount: 2,
            failedCount: 0,
            loadingCount: 0,
          },
          batchItems: [
            {
              id: "slot_1",
              taskId: "task_history",
              batchIndex: 0,
              status: "succeeded",
              progress: 100,
              assetId: "asset_batch_1",
              attempt: 1,
              createdAt: "2026-04-29T08:00:00.000Z",
              updatedAt: "2026-04-29T08:00:00.000Z",
            },
            {
              id: "slot_2",
              taskId: "task_history",
              batchIndex: 1,
              status: "succeeded",
              progress: 100,
              assetId: "asset_batch_2",
              attempt: 1,
              createdAt: "2026-04-29T08:00:00.000Z",
              updatedAt: "2026-04-29T08:00:00.000Z",
            },
          ],
          outputSummary: {
            mocked: false,
            generatedAssetIds: ["asset_batch_1", "asset_batch_2"],
            assets: [
              {
                id: "asset_batch_1",
                url: "/api/assets/asset_batch_1/content",
                mimeType: "image/png",
                width: 1024,
                height: 1024,
                batchIndex: 0,
                batchItemId: "slot_1",
              },
              {
                id: "asset_batch_2",
                url: "/api/assets/asset_batch_2/content",
                mimeType: "image/png",
                width: 1536,
                height: 1024,
                batchIndex: 1,
                batchItemId: "slot_2",
              },
            ],
          },
        }),
      ],
    });

    expect(await screen.findByText("成功 2")).toBeTruthy();
    expect(screen.queryByText("图片待加载")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "预览素材 1536 × 1024" }));

    const dialog = screen.getByRole("dialog", { name: "1536 × 1024 预览" });
    expect(within(dialog).getByRole("img", { name: "1536 × 1024" })).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "打开原图" })).toBeTruthy();
  });
});
