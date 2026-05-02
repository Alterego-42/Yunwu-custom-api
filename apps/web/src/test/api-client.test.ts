// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";

describe("api client admin logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps UI log levels to backend query values and normalizes display levels", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            logs: [
              {
                id: "log_1",
                timestamp: "2026-05-01T08:00:00.000Z",
                level: "debug",
                context: "admin.logs",
                message: "debug message",
              },
            ],
            total: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const response = await apiClient.listAdminLogs({
      level: "INFO",
      search: "provider health",
      limit: 25,
    });

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe("/api/admin/logs");
    expect(requestUrl.searchParams.get("level")).toBe("log");
    expect(requestUrl.searchParams.get("search")).toBe("provider health");
    expect(requestUrl.searchParams.get("limit")).toBe("25");
    expect(response.logs[0].level).toBe("DEBUG");

    await apiClient.listAdminLogs({ level: "ALL" });

    const allRequestUrl = new URL(fetchMock.mock.calls[1][0] as string);
    expect(allRequestUrl.searchParams.get("level")).toBe("all");
  });
});
