import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { SettingsPage } from "@/pages/settings-page";
import {
  applyUserTheme,
  DEFAULT_AVAILABLE_MODEL_IDS,
  MODEL_CATALOG,
  normalizeUserSettings,
} from "@/lib/user-settings";

const mocks = vi.hoisted(() => ({
  getUserSettings: vi.fn(),
  listModels: vi.fn(),
  updateUserSettings: vi.fn().mockResolvedValue({}),
  updateUserApiKey: vi.fn(),
  verifyUserApiKey: vi.fn(),
  clearUserApiKey: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    listModels: mocks.listModels,
    getUserSettings: mocks.getUserSettings,
    updateUserSettings: mocks.updateUserSettings,
    updateUserApiKey: mocks.updateUserApiKey,
    verifyUserApiKey: mocks.verifyUserApiKey,
    clearUserApiKey: mocks.clearUserApiKey,
  },
}));

describe("settings page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("style");
    mocks.getUserSettings.mockReset();
    mocks.getUserSettings.mockRejectedValue(new Error("not ready"));
    mocks.listModels.mockReset();
    mocks.listModels.mockResolvedValue([]);
    mocks.updateUserSettings.mockClear();
    mocks.updateUserSettings.mockResolvedValue({});
    mocks.updateUserApiKey.mockReset();
    mocks.updateUserApiKey.mockResolvedValue({ apiKey: { configured: true, masked: "sk-***1234" } });
    mocks.verifyUserApiKey.mockReset();
    mocks.verifyUserApiKey.mockResolvedValue({
      ok: true,
      status: "ok",
      message: "API key connectivity check succeeded.",
      apiKey: { configured: true, maskedApiKey: "sk-***1234" },
      check: { baseUrlReachable: true, modelsSource: "remote" },
    });
    mocks.clearUserApiKey.mockReset();
    mocks.clearUserApiKey.mockResolvedValue({ apiKey: { configured: false, masked: null } });
  });

  afterEach(() => {
    cleanup();
  });

  it("derives the catalog from shared definitions for all GPT, Gemini, and Grok image models", () => {
    const requiredModelIds = [
      "gpt-image-2",
      "gpt-image-1.5",
      "gpt-image-1.5-all",
      "gpt-image-2-all",
      "gpt-image-1",
      "gpt-image-1-all",
      "gpt-image-1-mini",
      "gpt-4o-image-vip",
      "gemini-3-pro-image-preview",
      "gemini-3.1-flash-image-preview",
      "gemini-2.5-flash-image",
      "gemini-2.5-flash-image-preview",
      "grok-imagine-image",
      "grok-imagine-image-pro",
      "grok-4.2-image",
      "grok-4.1-image",
      "grok-4-image",
      "grok-3-image",
    ];
    const catalogById = new Map(MODEL_CATALOG.map((model) => [model.id, model]));

    expect(DEFAULT_AVAILABLE_MODEL_IDS).toEqual([
      "gpt-image-2",
      "gemini-3-pro-image-preview",
      "gemini-3.1-flash-image-preview",
      "grok-4.2-image",
      "grok-imagine-image-pro",
    ]);
    expect(requiredModelIds.every((modelId) => catalogById.has(modelId))).toBe(true);
    expect(catalogById.get("gemini-3-pro-image-preview")?.capabilityTypes).toContain(
      "image.generate",
    );
    expect(catalogById.get("gemini-3-pro-image-preview")?.capabilityTypes).toContain(
      "image.edit",
    );
    expect(catalogById.get("gemini-2.5-flash-image")?.capabilityTypes).toContain(
      "image.edit",
    );
    expect(catalogById.get("grok-3-image")?.capabilityTypes).toContain(
      "image.edit",
    );
    expect(catalogById.get("grok-4.2-image")?.capabilityTypes).toContain(
      "image.edit",
    );
    expect(catalogById.get("gpt-4o-image-vip")?.capabilityTypes).not.toContain(
      "image.edit",
    );
  });

  it("renders the user settings structure and constrained copy", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("配置中心")).toBeTruthy();
    expect(mocks.getUserSettings).toHaveBeenCalledTimes(1);
    expect(mocks.listModels).toHaveBeenCalled();
    expect(screen.getByText("基础配置")).toBeTruthy();
    expect(screen.getByText("模型管理")).toBeTruthy();
    expect(screen.getByText("访问线路")).toBeTruthy();
    expect(screen.queryByText("Yunwu base_url")).toBeNull();
    expect(screen.getByText("字体大小")).toBeTruthy();
    expect(screen.getByLabelText("暗色主题预设")).toBeTruthy();
    expect(screen.getByLabelText("明亮主题预设")).toBeTruthy();
    expect(screen.getByLabelText("自选前景色")).toBeTruthy();
    expect(screen.getByLabelText("自选背景主色")).toBeTruthy();
    expect(screen.getByLabelText("自选背景次色")).toBeTruthy();
    expect(screen.getByLabelText("自选渐变预设")).toBeTruthy();
    expect(screen.getByText("界面密度")).toBeTruthy();
    expect(screen.getByText("最近项显示数量")).toBeTruthy();
    expect(screen.getByText("信息栏显示条数")).toBeTruthy();
    expect(screen.getByText("API key")).toBeTruthy();
    expect(screen.getByLabelText("模型厂商")).toBeTruthy();
    expect(screen.getByLabelText("模型类型")).toBeTruthy();
    expect(screen.getByText("https://yunwu.ai")).toBeTruthy();
    expect(screen.getByText("https://api3.wlai.vip")).toBeTruthy();
    expect(screen.queryByText("https://yunwu.ai/v1")).toBeNull();
    expect(screen.queryByText("https://api.yunwu.ai/v1")).toBeNull();
  });

  it("switches theme state and applies it to the document root", async () => {
    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "明亮" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    await waitFor(() => expect(mocks.updateUserSettings).toHaveBeenCalled());
    expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: "light" }),
    );
  });

  it("switches light and dark preset fields and serializes them with the theme", async () => {
    render(<SettingsPage />);

    fireEvent.change(await screen.findByLabelText("明亮主题预设"), {
      target: { value: "sunrise" },
    });

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("light"));
    expect(document.documentElement.dataset.themePreset).toBe("sunrise");
    expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        theme: "light",
        lightPreset: "sunrise",
        themePreset: expect.objectContaining({ light: "sunrise" }),
      }),
    );

    fireEvent.change(screen.getByLabelText("暗色主题预设"), {
      target: { value: "graphite" },
    });

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
    expect(document.documentElement.dataset.themePreset).toBe("graphite");
    expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        theme: "dark",
        darkPreset: "graphite",
        themePreset: expect.objectContaining({ dark: "graphite" }),
      }),
    );
  });

  it("persists custom foreground and gradient colors to css variables and storage", async () => {
    render(<SettingsPage />);

    const foreground = await screen.findByLabelText("自选前景色");
    const background = screen.getByLabelText("自选背景主色");
    const gradient = screen.getByLabelText("自选背景次色");
    const angle = screen.getByLabelText("渐变角度");

    fireEvent.change(foreground, { target: { value: "#111827" } });
    fireEvent.blur(foreground);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("custom"));
    expect(document.documentElement.style.getPropertyValue("--foreground")).toBe("221 39% 11%");
    await waitFor(() =>
      expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customTheme: expect.objectContaining({ foregroundColor: "#111827" }),
        }),
      ),
    );

    fireEvent.change(background, { target: { value: "#f8fafc" } });
    fireEvent.blur(background);
    fireEvent.change(gradient, { target: { value: "#dbeafe" } });
    fireEvent.blur(gradient);
    fireEvent.change(angle, { target: { value: "222" } });
    fireEvent.blur(angle);

    await waitFor(() =>
      expect(window.localStorage.getItem("yunwu:user-settings:v1")).toContain("#dbeafe"),
    );
    expect(document.documentElement.style.getPropertyValue("--custom-bg")).toBe("#f8fafc");
    expect(document.documentElement.style.getPropertyValue("--custom-bg-2")).toBe("#dbeafe");
    expect(document.documentElement.style.getPropertyValue("--custom-gradient-color")).toBe("#dbeafe");
    expect(document.documentElement.style.getPropertyValue("--shell-bg")).toContain("#f8fafc");
    expect(document.documentElement.style.getPropertyValue("--shell-bg")).toContain("#dbeafe");
    expect(document.documentElement.style.getPropertyValue("--shell-bg")).toContain("222deg");
    expect(document.documentElement.style.getPropertyValue("--surface-container-lowest")).not.toBe(
      "0 0% 100%",
    );
    expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        customTheme: expect.objectContaining({
          backgroundColor: "#f8fafc",
          backgroundSecondaryColor: "#dbeafe",
          gradientColor: "#dbeafe",
          gradientAngle: 222,
          gradientPreset: "manual",
        }),
        themePreset: expect.objectContaining({ custom: "manual" }),
      }),
    );
  });

  it("applies custom gradient presets and keeps preset fields backward compatible", async () => {
    render(<SettingsPage />);

    fireEvent.change(await screen.findByLabelText("自选渐变预设"), {
      target: { value: "pearl" },
    });

    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("custom"));
    expect(document.documentElement.dataset.themePreset).toBe("pearl");
    expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        theme: "custom",
        customTheme: expect.objectContaining({
          backgroundColor: "#f8fafc",
          backgroundSecondaryColor: "#dbeafe",
          gradientColor: "#dbeafe",
          gradientPreset: "pearl",
        }),
        themePreset: expect.objectContaining({ custom: "pearl" }),
      }),
    );

    expect(normalizeUserSettings({ theme: "custom", customColor: "#0ea5e9" })).toEqual(
      expect.objectContaining({
        darkPreset: "ocean",
        lightPreset: "mist",
        customTheme: expect.objectContaining({
          gradientColor: "#0ea5e9",
          gradientPreset: "manual",
        }),
      }),
    );
  });

  it("sets light mode preset and flattened shadow css variables", () => {
    applyUserTheme(
      normalizeUserSettings({
        theme: "light",
        lightPreset: "sage",
      }),
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.themePreset).toBe("sage");
    expect(document.documentElement.style.getPropertyValue("--background")).toBe("160 100% 98%");
    expect(document.documentElement.style.getPropertyValue("--mdui-elevation-level1")).toBe(
      "0 1px 2px rgba(15, 23, 42, 0.05)",
    );
    expect(document.documentElement.style.getPropertyValue("--panel-shadow")).toBe(
      "0 1px 2px rgba(15, 23, 42, 0.05)",
    );
    expect(document.documentElement.style.getPropertyValue("--button-shadow")).toBe("none");
  });

  it("normalizes legacy local storage theme fields into the current schema", () => {
    const normalized = normalizeUserSettings({
      theme: "custom",
      customColor: "#0ea5e9",
      ui: {
        darkPreset: "violet",
        lightPreset: "sunrise",
        gradientPreset: "ember",
      },
      customTheme: {
        foregroundColor: "#111827",
        backgroundColor: "#f8fafc",
        gradientColor: "#dbeafe",
        gradientAngle: 222.4,
      },
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        themePreset: {
          dark: "violet",
          light: "sunrise",
          custom: "ember",
        },
        darkPreset: "violet",
        lightPreset: "sunrise",
        customColor: "#0ea5e9",
        customTheme: expect.objectContaining({
          foregroundColor: "#111827",
          backgroundColor: "#f8fafc",
          backgroundSecondaryColor: "#dbeafe",
          gradientColor: "#dbeafe",
          gradientAngle: 222,
          gradientPreset: "ember",
          ringColor: "#0ea5e9",
        }),
      }),
    );
  });

  it("persists font size and density settings to the backend payload", async () => {
    render(<SettingsPage />);

    fireEvent.change(await screen.findByLabelText("字体大小"), { target: { value: "large" } });
    await waitFor(() => expect(document.documentElement.dataset.fontSize).toBe("large"));

    fireEvent.change(screen.getByLabelText("界面密度"), { target: { value: "compact" } });
    await waitFor(() => expect(document.documentElement.dataset.density).toBe("compact"));

    expect(mocks.updateUserSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ui: expect.objectContaining({ density: "compact" }),
      }),
    );
  });

  it("shows only the five required default available models", async () => {
    render(<SettingsPage />);

    const list = await screen.findByTestId("available-model-list");
    const badges = within(list).getAllByText(
      /gpt-image-2|gemini-3-pro-image-preview|gemini-3\.1-flash-image-preview|grok-4\.2-image|grok-imagine-image-pro/,
    );

    expect(badges).toHaveLength(5);
    expect(within(list).queryByText("gpt-image-1")).toBeNull();
    expect(within(list).queryByText("qwen-image-max")).toBeNull();
  });

  it("uses backend settings over local storage and caches the response after load", async () => {
    window.localStorage.setItem(
      "yunwu:user-settings:v1",
      JSON.stringify({
        theme: "dark",
        baseUrl: "https://yunwu.ai/v1",
        customColor: "#38bdf8",
        availableModelIds: ["gpt-image-1"],
        ui: { fontSize: "small", density: "compact", recentItemsLimit: 3, infoBarLimit: 2 },
      }),
    );
    mocks.getUserSettings.mockResolvedValueOnce({
      settings: {
        baseUrl: "https://api3.wlai.vip",
        enabledModelIds: DEFAULT_AVAILABLE_MODEL_IDS,
        ui: {
          theme: "light",
          customColor: "#38bdf8",
          fontSize: "large",
          density: "spacious",
          recentItemsLimit: 8,
          infoBarLimit: 7,
        },
        providerApiKey: {
          configured: true,
          masked: "sk-***1234",
          maskedApiKey: "sk-***1234",
        },
      },
    });

    render(<SettingsPage />);

    expect(await screen.findByDisplayValue("7")).toBeTruthy();
    await waitFor(() => {
      expect(window.localStorage.getItem("yunwu:user-settings:v1")).toContain(
        "gemini-3-pro-image-preview",
      );
    });
    expect(document.documentElement.dataset.fontSize).toBe("large");
    expect(await screen.findByText(/已配置 sk-\*\*\*1234/)).toBeTruthy();
    expect(window.localStorage.getItem("yunwu:user-settings:v1")).not.toContain("sk-");
  });

  it("normalizes legacy or invalid base_url values to the default route", () => {
    expect(normalizeUserSettings({ baseUrl: "https://yunwu.ai/v1" }).baseUrl).toBe(
      "https://yunwu.ai",
    );
    expect(
      normalizeUserSettings({ baseUrl: "https://api.yunwu.ai/v1" }).baseUrl,
    ).toBe("https://yunwu.ai");
    expect(normalizeUserSettings({ baseUrl: "https://example.com" }).baseUrl).toBe(
      "https://yunwu.ai",
    );
    expect(normalizeUserSettings({ baseUrl: "https://api3.wlai.vip" }).baseUrl).toBe(
      "https://api3.wlai.vip",
    );
  });

  it("keeps local storage as fallback when PATCH settings fails", async () => {
    mocks.updateUserSettings.mockRejectedValueOnce(new Error("offline"));

    render(<SettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "明亮" }));

    await waitFor(() => expect(mocks.updateUserSettings).toHaveBeenCalled());
    expect(window.localStorage.getItem("yunwu:user-settings:v1")).toBeNull();
    expect(await screen.findByText(/未写入后端/)).toBeTruthy();
  });

  it("saves, verifies, and clears api keys without writing the key to local storage", async () => {
    mocks.getUserSettings.mockResolvedValueOnce({
      settings: {
        baseUrl: "https://yunwu.ai",
        enabledModelIds: DEFAULT_AVAILABLE_MODEL_IDS,
        ui: {},
        providerApiKey: { configured: true, maskedApiKey: "sk-***0000" },
      },
    });

    render(<SettingsPage />);

    const input = await screen.findByLabelText("API key");
    expect(await screen.findByText(/已配置 sk-\*\*\*0000/)).toBeTruthy();

    fireEvent.change(input, { target: { value: "sk-live-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(mocks.updateUserApiKey).toHaveBeenCalledWith("sk-live-secret"));
    expect(window.localStorage.getItem("yunwu:user-settings:v1")).not.toContain("sk-live-secret");
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "验证连通性" }));
    await waitFor(() => expect(mocks.verifyUserApiKey).toHaveBeenCalledWith(undefined));

    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    await waitFor(() => expect(mocks.clearUserApiKey).toHaveBeenCalled());
    expect(await screen.findByText("未配置")).toBeTruthy();
  });

  it("renders user-facing model tags instead of internal capability enums", async () => {
    mocks.listModels.mockResolvedValueOnce([
      {
        id: "remote-edit",
        name: "Remote Edit",
        type: "image-editing",
        capabilityTypes: ["image.edit"],
        enabled: true,
        provider: "yunwu",
      },
      {
        id: "remote-blocked",
        name: "Remote Blocked",
        type: "image-generation",
        capabilityTypes: ["image.generate"],
        enabled: true,
        taskSupported: false,
        provider: "yunwu",
      },
    ]);

    render(<SettingsPage />);

    expect(await screen.findAllByText("文生图")).toBeTruthy();
    expect(await screen.findAllByText("图片编辑")).toBeTruthy();
    expect((await screen.findAllByText("暂不可提交")).length).toBeGreaterThan(0);
    expect(screen.queryByText("image.generate")).toBeNull();
    expect(screen.queryByText("image.edit")).toBeNull();
  });
});
