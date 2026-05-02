// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { LibraryPage } from "@/pages/library-page";
import type {
  AssetRecord,
  LibraryItemRecord,
  LibraryResponse,
  TaskRecord,
} from "@/lib/api-types";

const apiClientMock = vi.hoisted(() => ({
  deleteLibraryAsset: vi.fn(),
  getLibrary: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_real",
    capability: "image.generate",
    status: "succeeded",
    modelId: "gpt-image-1",
    prompt: "real provider output",
    createdAt: "2026-04-29T08:00:00.000Z",
    updatedAt: "2026-04-29T08:00:00.000Z",
    assetIds: [],
    outputSummary: {
      mocked: false,
      generatedAssetIds: ["asset_real"],
    },
    ...overrides,
  };
}

function createAsset(overrides: Partial<AssetRecord> = {}): AssetRecord {
  return {
    id: "asset_real",
    taskId: "task_real",
    type: "generated",
    url: "/api/assets/asset_real/content",
    createdAt: "2026-04-29T08:00:00.000Z",
    ...overrides,
  };
}

function createLibraryItem(overrides: Partial<LibraryItemRecord> = {}): LibraryItemRecord {
  return {
    asset: createAsset(),
    task: createTask(),
    conversation: {
      id: "conv_real",
      title: "real conversation",
      updatedAt: "2026-04-29T08:00:00.000Z",
    },
    ...overrides,
  };
}

function renderLibraryPage(response: LibraryResponse) {
  apiClientMock.getLibrary.mockResolvedValue(response);

  return render(
    <MemoryRouter initialEntries={["/library"]}>
      <LibraryPage />
    </MemoryRouter>,
  );
}

describe("library page", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows only succeeded non-mocked generated assets", async () => {
    renderLibraryPage({
      items: [
        createLibraryItem(),
        createLibraryItem({
          asset: createAsset({
            id: "asset_mocked",
            taskId: "task_mocked",
          }),
          task: createTask({
            id: "task_mocked",
            prompt: "mocked random output",
            outputSummary: {
              mocked: true,
              generatedAssetIds: ["asset_mocked"],
            },
          }),
        }),
        createLibraryItem({
          asset: createAsset({
            id: "asset_failed",
            taskId: "task_failed",
          }),
          task: createTask({
            id: "task_failed",
            status: "failed",
            prompt: "failed provider output",
            errorMessage: "Provider unavailable",
            outputSummary: {
              generatedAssetIds: ["asset_failed"],
            },
          }),
        }),
      ],
    });

    expect(await screen.findByText("real provider output")).toBeTruthy();
    expect(screen.queryByText("mocked random output")).toBeNull();
    expect(screen.queryByText("failed provider output")).toBeNull();
    expect(screen.getAllByText("下载")).toHaveLength(1);
  });
});
