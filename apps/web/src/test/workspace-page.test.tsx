// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { WorkspacePage } from "@/pages/workspace-page";
import type { ConversationDetail, ConversationSummary, ModelRecord, TaskRecord } from "@/lib/api-types";

const apiClientMock = vi.hoisted(() => ({
  archiveConversation: vi.fn(),
  createTask: vi.fn(),
  deleteConversation: vi.fn(),
  getConversation: vi.fn(),
  getConversationEventsUrl: vi.fn((id: string) => `/api/conversations/${id}/events`),
  listConversations: vi.fn(),
  listModels: vi.fn(),
  retryTask: vi.fn(),
  uploadAsset: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {}

  close() {}
}

function createTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task_failed",
    capability: "image.generate",
    status: "failed",
    modelId: "gpt-image-1",
    prompt: "失败任务",
    createdAt: "2026-04-29T08:00:00.000Z",
    updatedAt: "2026-04-29T08:00:00.000Z",
    assetIds: [],
    conversationId: "conv_1",
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

function createSummary(id: string, title: string, overrides: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id,
    title,
    updatedAt: "2026-04-29T08:00:00.000Z",
    ...overrides,
  };
}

function createConversation(
  id: string,
  title: string,
  tasks: TaskRecord[],
  overrides: Partial<ConversationDetail> = {},
): ConversationDetail {
  return {
    ...createSummary(id, title),
    messages: [],
    tasks,
    assets: [],
    ...overrides,
  };
}

const models: ModelRecord[] = [
  {
    id: "gpt-image-1",
    name: "GPT Image",
    type: "image-generation",
    capabilityTypes: ["image.generate"],
    enabled: true,
  },
  {
    id: "recent-model",
    name: "Recent Model",
    type: "image-generation",
    capabilityTypes: ["image.generate"],
    enabled: true,
  },
];
const longUserMessage =
  "This is a deliberately long workspace message that should wrap inside a bounded bubble instead of stretching across the entire timeline.";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderWorkspace(initialPath = "/workspace/conv_1") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/workspace/:conversationId"
          element={
            <>
              <LocationProbe />
              <WorkspacePage />
            </>
          }
        />
        <Route path="/create" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("workspace page", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", MockEventSource);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const conv1 = createConversation("conv_1", "First", [
      createTask({ id: "task_old", status: "succeeded", canRetry: false, modelId: "old-model" }),
      createTask({
        id: "task_failed",
        modelId: "recent-model",
        sourceTaskId: "task_old",
        sourceAction: "retry",
      }),
    ], {
      messages: [
        {
          id: "msg_long",
          type: "text",
          content: longUserMessage,
          createdAt: "2026-04-29T08:00:00.000Z",
        },
      ],
    });
    const conv2 = createConversation("conv_2", "Second", [
      createTask({
        id: "task_second",
        status: "succeeded",
        canRetry: false,
        modelId: "second-model",
        conversationId: "conv_2",
      }),
    ]);

    apiClientMock.listConversations.mockResolvedValue([
      createSummary("conv_1", "First"),
      createSummary("conv_2", "Second"),
    ]);
    apiClientMock.listModels.mockResolvedValue(models);
    apiClientMock.getConversation.mockImplementation((id: string) =>
      Promise.resolve(id === "conv_2" ? conv2 : conv1),
    );
    apiClientMock.retryTask.mockResolvedValue(
      createTask({ id: "task_retry", status: "queued", modelId: "recent-model" }),
    );
    apiClientMock.archiveConversation.mockResolvedValue({});
    apiClientMock.deleteConversation.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("hydrates unselected session models from the latest task", async () => {
    renderWorkspace();

    expect((await screen.findAllByText("First")).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getAllByText("recent-model").length).toBeGreaterThan(0);
      expect(screen.getAllByText("second-model").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("未选择")).toBeNull();
  });

  it("keeps a compact functional session search filter", async () => {
    renderWorkspace();

    const sessionList = await screen.findByTestId("session-list");
    const searchInput = within(sessionList).getByLabelText("搜索会话");

    expect(searchInput.className).toContain("min-w-0");

    fireEvent.change(searchInput, { target: { value: "Second" } });

    expect(within(sessionList).queryByText("First")).toBeNull();
    expect(within(sessionList).getByText("Second")).toBeTruthy();
  });

  it("keeps session archive and delete actions visible in the normal unfiltered list", async () => {
    renderWorkspace();

    const sessionList = await screen.findByTestId("session-list");
    const actionRails = await within(sessionList).findAllByTestId("session-card-actions");

    expect(actionRails.length).toBeGreaterThanOrEqual(2);
    expect(within(sessionList).getByRole("button", { name: "归档 First" })).toBeTruthy();
    expect(within(sessionList).getByRole("button", { name: "删除 First" })).toBeTruthy();
    expect(actionRails[0].className).toContain("w-8");
    expect(actionRails[0].className).toContain("shrink-0");
  });

  it("keeps long session titles and summaries clipped inside the expanded list", async () => {
    const longTitle = "这是一个非常非常长的会话标题用于验证左侧会话栏不会挤出状态和操作按钮";
    const longSummary = "这是一段非常长的会话摘要，用于验证摘要文本会被截断并且不会把状态徽标或操作按钮挤出侧边栏。";
    const longModel = "very-long-model-name-that-must-not-push-session-card-actions-out-of-view";

    apiClientMock.listConversations.mockResolvedValue([
      createSummary("conv_1", longTitle, {
        summary: longSummary,
        model: longModel,
        status: "done",
      }),
    ]);
    apiClientMock.getConversation.mockResolvedValue(
      createConversation("conv_1", longTitle, [], {
        summary: longSummary,
        model: longModel,
      }),
    );

    renderWorkspace();

    const sessionList = await screen.findByTestId("session-list");
    const title = within(sessionList).getByText(longTitle);
    const summary = within(sessionList).getByText(longSummary);

    expect(title.className).toContain("line-clamp-2");
    expect(summary.className).toContain("line-clamp-2");
    expect(within(sessionList).getByText("已完成")).toBeTruthy();
    expect(within(sessionList).getByRole("button", { name: `归档 ${longTitle}` })).toBeTruthy();
    expect(within(sessionList).getByRole("button", { name: `删除 ${longTitle}` })).toBeTruthy();
    expect(within(sessionList).getByText(longModel).className).toContain("truncate");
    expect(within(sessionList).getByTestId("session-card-actions").className).toContain("w-8");
  });

  it("uses a viewport-constrained workspace with internal scroll and a composer bottom dock", async () => {
    renderWorkspace();

    const shell = await screen.findByTestId("workspace-page-shell");
    const mainRegion = await screen.findByTestId("workspace-main-region");
    const sessionList = await screen.findByTestId("session-list");
    const chatPanel = await screen.findByTestId("workspace-chat-panel");
    const messageScroller = await screen.findByTestId("workspace-message-scroll-container");
    const composerDock = await screen.findByTestId("workspace-composer-dock");

    expect(shell.className).toContain("h-[calc(100dvh-104px)]");
    expect(shell.className).toContain("overflow-hidden");
    expect(mainRegion.className).toContain("min-h-0");
    expect(mainRegion.className).toContain("overflow-hidden");
    expect(sessionList.className).toContain("h-full");
    expect(chatPanel.className).toContain("h-full");
    expect(chatPanel.className).toContain("overflow-hidden");
    expect(messageScroller.className).toContain("flex-1");
    expect(messageScroller.className).toContain("overflow-hidden");
    expect(composerDock.className).toContain("mt-auto");
    expect(composerDock.className).toContain("shrink-0");
  });

  it("shows conversation switching loading in the workspace body instead of the session list", async () => {
    const conv1 = createConversation("conv_1", "First", []);
    const conv2 = createConversation("conv_2", "Second", []);
    let resolveConv2: (value: ConversationDetail) => void = () => {};
    const conv2Promise = new Promise<ConversationDetail>((resolve) => {
      resolveConv2 = resolve;
    });

    apiClientMock.listConversations.mockResolvedValue([
      createSummary("conv_1", "First", { model: "recent-model" }),
      createSummary("conv_2", "Second", { model: "second-model" }),
    ]);
    apiClientMock.getConversation.mockImplementation((id: string) =>
      id === "conv_2" ? conv2Promise : Promise.resolve(conv1),
    );

    renderWorkspace();

    const sessionList = await screen.findByTestId("session-list");
    fireEvent.click(within(sessionList).getByText("Second"));

    expect(await screen.findByTestId("workspace-detail-loading-overlay")).toBeTruthy();
    expect(within(sessionList).queryByText("正在加载会话")).toBeNull();

    resolveConv2(conv2);
  });

  it("switches retry attempts within one task card and keeps attempt-specific actions", async () => {
    renderWorkspace();

    expect((await screen.findAllByRole("button", { name: "一键重试" })).length).toBeGreaterThan(0);

    fireEvent.click((await screen.findAllByRole("button", { name: "上一重试轮次" }))[0]);

    expect((await screen.findAllByRole("button", { name: "重试" })).length).toBeGreaterThan(0);
  });

  it("shows task round switching and constrains message bubble width", async () => {
    renderWorkspace();

    expect((await screen.findAllByTestId("task-round-switcher")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("2/2")).length).toBeGreaterThan(0);

    const messageBubble = (await screen.findAllByText(longUserMessage)).find((element) =>
      element.className.includes("inline-block"),
    );

    expect(messageBubble?.className).toContain("inline-block");
    expect(messageBubble?.className).toContain("max-w-full");
    expect(messageBubble?.className).toContain("break-words");
  });

  it("retries failed retryable tasks and refreshes the current conversation", async () => {
    renderWorkspace();

    fireEvent.click((await screen.findAllByRole("button", { name: "一键重试" }))[0]);

    await waitFor(() => {
      expect(apiClientMock.retryTask).toHaveBeenCalledWith("task_failed");
      expect(apiClientMock.getConversation).toHaveBeenCalledWith("conv_1");
    });
  });

  it("archives and deletes sessions through compact list actions", async () => {
    renderWorkspace();

    fireEvent.click(await screen.findByRole("button", { name: "归档 First" }));

    await waitFor(() => {
      expect(apiClientMock.archiveConversation).toHaveBeenCalledWith("conv_1");
      expect(screen.getByTestId("location").textContent).toBe("/workspace/conv_2");
    });

    fireEvent.click(await screen.findByRole("button", { name: "删除 Second" }));

    await waitFor(() => {
      expect(apiClientMock.deleteConversation).toHaveBeenCalledWith("conv_2");
      expect(screen.getByTestId("location").textContent).toBe("/create");
    });
  });
});
