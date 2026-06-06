// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { TaskCard } from "@/components/cards/task-card";
import type { UiTask } from "@/lib/api-types";

function createUiTask(overrides: Partial<UiTask> = {}): UiTask {
  return {
    id: "task_1",
    title: "生成一张图",
    progress: 100,
    status: "succeeded",
    eta: "耗时 2 分",
    tags: ["image.generate", "gpt-image-1"],
    capability: "image.generate",
    createdAt: "2026-04-29T08:00:00.000Z",
    updatedAt: "2026-04-29T08:02:00.000Z",
    resultAssets: [
      {
        id: "asset_result",
        type: "generated",
        url: "/api/assets/asset_result/content",
        mimeType: "image/png",
        createdAt: "2026-04-29T08:02:00.000Z",
        label: "结果图",
      },
    ],
    inputAssets: [
      {
        id: "asset_input",
        type: "upload",
        url: "/api/assets/asset_input/content",
        mimeType: "image/png",
        createdAt: "2026-04-29T08:00:00.000Z",
        label: "参考图",
      },
    ],
    ...overrides,
  };
}

describe("task card", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens result assets in an in-page preview with original and download actions", () => {
    render(<TaskCard task={createUiTask()} />);

    fireEvent.click(screen.getByRole("button", { name: "预览素材 结果图" }));

    const dialog = screen.getByRole("dialog", { name: "结果图 预览" });
    expect(within(dialog).getByRole("img", { name: "结果图" })).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: "打开原图" }).getAttribute("target")).toBe(
      "_blank",
    );
    expect(within(dialog).getByRole("link", { name: "下载" }).hasAttribute("download")).toBe(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "关闭图片预览" }));

    expect(screen.queryByRole("dialog", { name: "结果图 预览" })).toBeNull();
  });

  it("opens input assets in the same in-page preview", () => {
    render(<TaskCard task={createUiTask()} />);

    fireEvent.click(screen.getByRole("button", { name: "预览参考素材 参考图" }));

    expect(screen.getByRole("dialog", { name: "参考图 预览" })).toBeTruthy();
  });

  it("renders batch progress and opens successful batch results only", () => {
    const onEditAsset = vi.fn();
    const batchAsset = {
      id: "asset_batch_1",
      type: "generated" as const,
      url: "/api/assets/asset_batch_1/content",
      mimeType: "image/png",
      createdAt: "2026-04-29T08:02:00.000Z",
      label: "批量结果 1",
    };

    render(
      <TaskCard
        task={createUiTask({
          title: "批量生成",
          resultAssets: [],
          batch: {
            isBatch: true,
            batchSize: 3,
            returnedCount: 2,
            successCount: 1,
            failedCount: 1,
            loadingCount: 1,
            firstFailureMessage: "Provider rate limited.",
            partialSuccess: true,
          },
          batchSlots: [
            {
              id: "slot_1",
              taskId: "task_1",
              batchIndex: 0,
              status: "succeeded",
              progress: 100,
              asset: batchAsset,
              attempt: 1,
            },
            {
              id: "slot_2",
              taskId: "task_1",
              batchIndex: 1,
              status: "failed",
              progress: 100,
              errorMessage: "Provider rate limited.",
              attempt: 1,
            },
            {
              id: "slot_3",
              taskId: "task_1",
              batchIndex: 2,
              status: "running",
              progress: 20,
              attempt: 1,
            },
          ],
        })}
        onEditAsset={onEditAsset}
      />,
    );

    expect(screen.getByText("部分完成")).toBeTruthy();
    expect(screen.getByText("共 3 个")).toBeTruthy();
    expect(screen.getByText("已返回 2")).toBeTruthy();
    expect(screen.getByText("成功 1")).toBeTruthy();
    expect(screen.getByText("处理中 1")).toBeTruthy();
    expect(screen.getByText("失败 1")).toBeTruthy();
    expect(screen.getByText("首个失败：Provider rate limited.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "查看批量结果" }));

    const dialog = screen.getByRole("dialog", { name: "批量结果" });
    expect(within(dialog).getByRole("img", { name: "批量结果 1" })).toBeTruthy();
    expect(within(dialog).getByText("#1")).toBeTruthy();
    expect(within(dialog).queryByText("#2")).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: /再编辑/ }));

    expect(onEditAsset).toHaveBeenCalledWith(batchAsset);
  });
});
