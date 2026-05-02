// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

describe("api client admin logs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadApiClient(apiBaseUrl?: string) {
    vi.resetModules();
    if (apiBaseUrl !== undefined) {
      vi.stubEnv("VITE_API_BASE_URL", apiBaseUrl);
    }

    return import("@/lib/api-client");
  }

  it("maps UI log levels to backend query values and normalizes display levels", async () => {
    const { apiClient } = await loadApiClient("http://127.0.0.1:3000/api");
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

  it.each([
    ["empty", ""],
    ["single slash", "/"],
    ["double slash", "//"],
    ["api path", "/api"],
  ])(
    "normalizes %s VITE_API_BASE_URL without generating //api login URLs",
    async (_label, apiBaseUrl) => {
      const { apiClient } = await loadApiClient(apiBaseUrl);
      const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              user: {
                id: "admin",
                email: "admin@yunwu.local",
                role: "admin",
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        ),
      );

      await apiClient.login({
        email: "admin@yunwu.local",
        password: "admin123456",
      });

      const requestUrl = fetchMock.mock.calls[0][0] as string;
      expect(requestUrl).not.toContain("//api");
      expect(requestUrl).toMatch(/\/api\/auth\/login$/);
    },
  );
});
