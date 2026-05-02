// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
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
});
