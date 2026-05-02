// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminPage } from "@/pages/admin-page";
import type {
  AdminLogsResponse,
  AdminProviderStatus,
  TaskRecord,
} from "@/lib/api-types";

const apiClientMock = vi.hoisted(() => ({
  acknowledgeAdminProviderAlert: vi.fn(),
  checkAdminProvider: vi.fn(),
  getAdminProvider: vi.fn(),
  getBaseUrl: vi.fn(),
  getTask: vi.fn(),
  getTaskEvents: vi.fn(),
  listAdminLogs: vi.fn(),
  listAdminModelCapabilities: vi.fn(),
  listTasks: vi.fn(),
  retryTask: vi.fn(),
  testGenerateAdminProvider: vi.fn(),
  updateAdminModelCapability: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiClientMock,
}));

function createProvider(): AdminProviderStatus {
  return {
    name: "Yunwu",
    type: "openai-compatible",
    apiKeyConfigured: true,
    baseUrl: "https://api.example.test/v1",
    mode: "real",
    defaultGenerateModel: "gpt-image-1",
    defaultEditModel: "gpt-image-1",
    alerts: [],
    summary: {
      activeAlerts: 0,
    },
    lastCheck: {
      ok: true,
      status: "healthy",
      checkedAt: "2026-05-01T08:00:00.000Z",
    },
  };
}

function createTask(): TaskRecord {
  return {
    id: "task_admin_1",
    capability: "image.generate",
    status: "succeeded",
    modelId: "gpt-image-1",
    prompt: "admin task",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-01T08:05:00.000Z",
    assetIds: [],
  };
}

function createLogsResponse(): AdminLogsResponse {
  return {
    logs: [
      {
        id: "log_debug_1",
        timestamp: "2026-05-01T08:06:00.000Z",
        level: "DEBUG",
        context: "admin.logs",
        message: "DEBUG provider heartbeat accepted",
        trace: "trace line one\ntrace line two",
      },
    ],
    total: 1,
  };
}

function setupApiMocks() {
  const task = createTask();

  apiClientMock.getBaseUrl.mockReturnValue("http://127.0.0.1:3000/api");
  apiClientMock.getAdminProvider.mockResolvedValue(createProvider());
  apiClientMock.listAdminModelCapabilities.mockResolvedValue([]);
  apiClientMock.listTasks.mockResolvedValue([task]);
  apiClientMock.getTask.mockResolvedValue(task);
  apiClientMock.getTaskEvents.mockResolvedValue([]);
  apiClientMock.listAdminLogs.mockResolvedValue(createLogsResponse());
}

describe("admin page logs", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requests admin logs and renders DEBUG entries", async () => {
    setupApiMocks();

    render(<AdminPage />);

    expect(await screen.findByText("DEBUG provider heartbeat accepted")).toBeTruthy();
    expect(screen.getByText("系统日志 / DEBUG")).toBeTruthy();
    expect(screen.getByText("admin.logs")).toBeTruthy();
    expect(apiClientMock.listAdminLogs).toHaveBeenCalledWith({
      level: "DEBUG",
      search: "",
      limit: 50,
    });
  });

  it("exposes refresh and level filtering controls", async () => {
    setupApiMocks();

    render(<AdminPage />);

    expect(await screen.findByText("DEBUG provider heartbeat accepted")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh logs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("DEBUG"), {
      target: { value: "ERROR" },
    });

    await waitFor(() => {
      expect(apiClientMock.listAdminLogs).toHaveBeenCalledWith(
        expect.objectContaining({ level: "ERROR" }),
      );
    });
  });
});
