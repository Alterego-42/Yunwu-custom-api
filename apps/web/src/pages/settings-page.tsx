import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, RotateCcw, Settings2, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import type { ApiKeyMutationResponse, ApiKeyStatus, ModelRecord } from "@/lib/api-types";
import {
  DEFAULT_USER_SETTINGS,
  CUSTOM_GRADIENT_PRESETS,
  DARK_THEME_PRESETS,
  LIGHT_THEME_PRESETS,
  MODEL_CATALOG,
  YUNWU_BASE_URL_OPTIONS,
  applyUserTheme,
  loadStoredUserSettings,
  saveStoredUserSettings,
  normalizeUserSettings,
  type AppThemeMode,
  type CustomGradientPreset,
  type DarkThemePreset,
  type AppDensity,
  type AppFontSize,
  type LightThemePreset,
  type UserSettings,
} from "@/lib/user-settings";
import { cn } from "@/lib/utils";

const modelTypes = [
  { value: "all", label: "全部类型" },
  { value: "image-generation", label: "文生图" },
  { value: "image-editing", label: "图片编辑" },
];

const fontSizeOptions: Array<{ value: AppFontSize; label: string }> = [
  { value: "small", label: "小" },
  { value: "medium", label: "标准" },
  { value: "large", label: "大" },
];

const densityOptions: Array<{ value: AppDensity; label: string }> = [
  { value: "compact", label: "紧凑" },
  { value: "comfortable", label: "舒适" },
  { value: "spacious", label: "宽松" },
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "设置保存失败，请稍后重试。";
}

function normalizeApiSettings(payload: unknown): UserSettings | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const settings = "settings" in record ? record.settings : payload;

  if (!settings || typeof settings !== "object") {
    return null;
  }

  const settingsRecord = settings as Record<string, unknown>;
  if (
    !("baseUrl" in settingsRecord) &&
    !("theme" in settingsRecord) &&
    !("darkPreset" in settingsRecord) &&
    !("lightPreset" in settingsRecord) &&
    !("customTheme" in settingsRecord) &&
    !("enabledModelIds" in settingsRecord) &&
    !("availableModelIds" in settingsRecord) &&
    !("ui" in settingsRecord)
  ) {
    return null;
  }

  const ui = settingsRecord.ui && typeof settingsRecord.ui === "object" ? settingsRecord.ui : {};

  return normalizeUserSettings({
    ...settingsRecord,
    theme: settingsRecord.theme ?? (ui as Record<string, unknown>).theme,
    darkPreset: settingsRecord.darkPreset ?? (ui as Record<string, unknown>).darkPreset,
    lightPreset: settingsRecord.lightPreset ?? (ui as Record<string, unknown>).lightPreset,
    customColor: settingsRecord.customColor ?? (ui as Record<string, unknown>).customColor,
    customTheme: settingsRecord.customTheme ?? (ui as Record<string, unknown>).customTheme,
    availableModelIds: settingsRecord.availableModelIds ?? settingsRecord.enabledModelIds,
    ui,
  });
}

function normalizeApiKeyStatus(payload: unknown): ApiKeyStatus {
  const root = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const settings =
    root.settings && typeof root.settings === "object" ? (root.settings as Record<string, unknown>) : root;
  const apiKey =
    settings.apiKey && typeof settings.apiKey === "object"
      ? (settings.apiKey as Record<string, unknown>)
      : settings.providerApiKey && typeof settings.providerApiKey === "object"
        ? (settings.providerApiKey as Record<string, unknown>)
      : root.apiKey && typeof root.apiKey === "object"
        ? (root.apiKey as Record<string, unknown>)
        : root.providerApiKey && typeof root.providerApiKey === "object"
          ? (root.providerApiKey as Record<string, unknown>)
        : settings;
  const configured = apiKey.configured ?? apiKey.apiKeyConfigured;
  const masked = apiKey.masked ?? apiKey.maskedApiKey;

  return {
    configured: configured === true,
    masked: typeof masked === "string" ? masked : null,
    lastVerifiedAt: typeof apiKey.lastVerifiedAt === "string" ? apiKey.lastVerifiedAt : null,
  };
}

function getModelLabels(model: ModelRecord) {
  const labels: string[] = [];
  if (model.capabilityTypes.includes("image.generate") || model.type === "image-generation") {
    labels.push("文生图");
  }
  if (model.capabilityTypes.includes("image.edit") || model.type === "image-editing") {
    labels.push("图片编辑");
  }
  if (model.taskSupported === false || model.status === "unsupported") {
    labels.push("暂不可提交");
  }
  return labels.length ? labels : ["暂不可提交"];
}

export function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(() => loadStoredUserSettings());
  const [remoteModels, setRemoteModels] = useState<ModelRecord[]>([]);
  const [vendorFilter, setVendorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ configured: false, masked: null });
  const [apiKeyBusy, setApiKeyBusy] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const [modelList, remoteSettings] = await Promise.all([
        apiClient.listModels().catch(() => []),
        apiClient.getUserSettings().catch((requestError) => {
          if (!ignore) {
            setError(`${getErrorMessage(requestError)}（正在使用本地兜底配置）`);
          }
          return null;
        }),
      ]);

      if (ignore) {
        return;
      }

      setRemoteModels(modelList);
      if (remoteSettings) {
        const normalized = normalizeApiSettings(remoteSettings);
        if (normalized) {
          setSettings(normalized);
          saveStoredUserSettings(normalized);
          setError(null);
        }
        setApiKeyStatus(normalizeApiKeyStatus(remoteSettings));
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, []);

  const catalog = useMemo(() => {
    const byId = new Map(MODEL_CATALOG.map((item) => [item.id, item]));
    for (const item of remoteModels) {
      byId.set(item.id, {
        ...item,
        vendor: item.provider ?? "Provider",
      });
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [remoteModels]);

  const vendors = useMemo(
    () => ["all", ...Array.from(new Set(catalog.map((item) => item.vendor))).sort()],
    [catalog],
  );
  const filteredCatalog = catalog.filter(
    (item) =>
      (vendorFilter === "all" || item.vendor === vendorFilter) &&
      (typeFilter === "all" || item.type === typeFilter),
  );
  const availableModels = settings.availableModelIds
    .map((id) => catalog.find((item) => item.id === id))
    .filter((item): item is (typeof catalog)[number] => Boolean(item));

  async function persistSettings(next: UserSettings, successMessage = "已保存到后端设置") {
    setSettings(next);
    applyUserTheme(next);
    setStatus(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await apiClient.updateUserSettings(next);
      const normalized = normalizeApiSettings(response) ?? next;
      setSettings(normalized);
      saveStoredUserSettings(normalized);
      setStatus(successMessage);
      const modelList = await apiClient.listModels().catch(() => null);
      if (modelList) {
        setRemoteModels(modelList);
      }
    } catch (requestError) {
      setError(`${getErrorMessage(requestError)}（未写入后端，刷新后将回到上次已保存配置）`);
    } finally {
      setIsSaving(false);
    }
  }

  function updateTheme(theme: AppThemeMode) {
    void persistSettings({ ...settings, theme });
  }

  function updateDarkPreset(darkPreset: DarkThemePreset) {
    void persistSettings(
      {
        ...settings,
        theme: "dark",
        darkPreset,
        themePreset: { ...settings.themePreset, dark: darkPreset },
      },
      "已切换暗色主题预设",
    );
  }

  function updateLightPreset(lightPreset: LightThemePreset) {
    void persistSettings(
      {
        ...settings,
        theme: "light",
        lightPreset,
        themePreset: { ...settings.themePreset, light: lightPreset },
      },
      "已切换明亮主题预设",
    );
  }

  function previewCustomTheme(customTheme: Partial<UserSettings["customTheme"]>) {
    const next = {
      ...settings,
      theme: "custom" as const,
      themePreset: {
        ...settings.themePreset,
        custom: customTheme.gradientPreset ?? settings.customTheme.gradientPreset,
      },
      customTheme: { ...settings.customTheme, ...customTheme },
    };
    setSettings(next);
    applyUserTheme(next);
  }

  function persistCustomTheme(customTheme: Partial<UserSettings["customTheme"]> = {}) {
    void persistSettings(
      {
        ...settings,
        theme: "custom",
        themePreset: {
          ...settings.themePreset,
          custom: customTheme.gradientPreset ?? settings.customTheme.gradientPreset,
        },
        customTheme: { ...settings.customTheme, ...customTheme },
      },
      "已保存自选配色",
    );
  }

  function updateCustomGradientPreset(gradientPreset: CustomGradientPreset) {
    const preset = CUSTOM_GRADIENT_PRESETS.find((item) => item.value === gradientPreset);
    const nextTheme = {
      ...settings.customTheme,
      gradientPreset,
      ...(preset?.backgroundColor ? { backgroundColor: preset.backgroundColor } : {}),
      ...(preset?.gradientColor
        ? { backgroundSecondaryColor: preset.gradientColor, gradientColor: preset.gradientColor }
        : {}),
      ...(typeof preset?.gradientAngle === "number" ? { gradientAngle: preset.gradientAngle } : {}),
    };

    void persistSettings(
      {
        ...settings,
        theme: "custom",
        themePreset: { ...settings.themePreset, custom: gradientPreset },
        customTheme: nextTheme,
      },
      "已切换自选渐变预设",
    );
  }

  function updateUi(ui: Partial<UserSettings["ui"]>, successMessage = "已保存界面参数") {
    void persistSettings({ ...settings, ui: { ...settings.ui, ...ui } }, successMessage);
  }

  function updateBaseUrl(baseUrl: string) {
    void persistSettings({ ...settings, baseUrl }, "已保存线路设置，后续任务将使用该线路");
  }

  function toggleModel(modelId: string) {
    const exists = settings.availableModelIds.includes(modelId);
    const nextIds = exists
      ? settings.availableModelIds.filter((id) => id !== modelId)
      : [...settings.availableModelIds, modelId];

    void persistSettings({
      ...settings,
      availableModelIds: nextIds,
    }, "已更新可用模型，后续创建任务将使用新列表");
  }

  function resetSettings() {
    setSettings(DEFAULT_USER_SETTINGS);
    applyUserTheme(DEFAULT_USER_SETTINGS);
    void persistSettings(DEFAULT_USER_SETTINGS, "已恢复默认配置");
  }

  async function handleApiKeyMutation(
    action: () => Promise<ApiKeyMutationResponse>,
    successMessage: string,
    options: { clearInput?: boolean } = {},
  ) {
    setApiKeyBusy(true);
    setStatus(null);
    setError(null);
    try {
      const response = await action();
      setApiKeyStatus(normalizeApiKeyStatus(response));
      if (options.clearInput) {
        setApiKeyInput("");
      }
      setStatus(successMessage);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setApiKeyBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 overflow-hidden">
      <Card className="bg-[hsl(var(--surface-container-low)/0.94)]">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 shrink-0 text-primary" />
                <CardTitle className="break-words">配置中心</CardTitle>
              </div>
              <CardDescription className="mt-2 max-w-2xl break-words">
                切换 Yunwu 线路、主题、可用模型和界面参数；线路与模型更改会影响后续新任务。
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={resetSettings}>
              <RotateCcw className="h-4 w-4" />
              {isSaving ? "保存中..." : "恢复默认"}
            </Button>
          </div>
          {status ? (
            <div className="rounded-[1.1rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-high)/0.82)] px-3 py-2 text-sm text-primary">
              {status}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-[1.1rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-high)/0.82)] px-3 py-2 text-sm text-amber-100">
              {error}
            </div>
          ) : null}
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="min-w-0 bg-[hsl(var(--surface-container-low)/0.94)]">
          <CardHeader>
            <CardTitle>基础配置</CardTitle>
            <CardDescription className="break-words">
              普通用户可自由切换线路与主题，线路选择会用于后续任务。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-medium">访问线路</h3>
              <div className="grid gap-2">
                {YUNWU_BASE_URL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "min-w-0 rounded-[1.15rem] border border-[hsl(var(--outline-variant)/0.7)] px-4 py-3 text-left transition-colors",
                      settings.baseUrl === option.value
                        ? "bg-[hsl(var(--surface-container-high)/0.82)]"
                        : "bg-[hsl(var(--surface-container-low)/0.72)] hover:bg-[hsl(var(--surface-container)/0.78)]",
                    )}
                    onClick={() => updateBaseUrl(option.value)}
                    disabled={isSaving}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 font-medium">{option.label}</span>
                      {settings.baseUrl === option.value ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </span>
                    <span className="mt-1 block break-all text-xs text-muted-foreground">
                      {option.value}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">主题</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  ["dark", "暗色"],
                  ["light", "明亮"],
                  ["custom", "自选配色"],
                ].map(([value, label]) => (
                  <Button
                    key={value}
                    variant={settings.theme === value ? "default" : "outline"}
                    disabled={isSaving}
                    onClick={() => updateTheme(value as AppThemeMode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <label className="block space-y-2 text-sm">
                <span className="text-muted-foreground">自选主色</span>
                <Input
                  aria-label="自选主色"
                  type="color"
                  className="h-11 w-full"
                  value={settings.customColor}
                  onChange={(event) => {
                    const next = { ...settings, customColor: event.target.value, theme: "custom" as const };
                    setSettings(next);
                    applyUserTheme(next);
                  }}
                  onBlur={(event) =>
                    void persistSettings({
                      ...settings,
                      customColor: event.currentTarget.value,
                      theme: "custom",
                    })
                  }
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">暗色预设</span>
                  <select
                    aria-label="暗色主题预设"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                    value={settings.darkPreset}
                    onChange={(event) => updateDarkPreset(event.target.value as DarkThemePreset)}
                    disabled={isSaving}
                  >
                    {DARK_THEME_PRESETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">明亮预设</span>
                  <select
                    aria-label="明亮主题预设"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                    value={settings.lightPreset}
                    onChange={(event) => updateLightPreset(event.target.value as LightThemePreset)}
                    disabled={isSaving}
                  >
                    {LIGHT_THEME_PRESETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-[1.2rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] p-3">
                <div className="mb-3 text-sm font-medium">自选配色</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">自选前景色</span>
                    <Input
                      aria-label="自选前景色"
                      type="color"
                      className="h-11 w-full"
                      value={settings.customTheme.foregroundColor}
                      onChange={(event) => previewCustomTheme({ foregroundColor: event.target.value })}
                      onBlur={(event) =>
                        persistCustomTheme({ foregroundColor: event.currentTarget.value })
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">自选背景主色</span>
                    <Input
                      aria-label="自选背景主色"
                      type="color"
                      className="h-11 w-full"
                      value={settings.customTheme.backgroundColor}
                      onChange={(event) =>
                        previewCustomTheme({
                          backgroundColor: event.target.value,
                          gradientPreset: "manual",
                        })
                      }
                      onBlur={(event) =>
                        persistCustomTheme({
                          backgroundColor: event.currentTarget.value,
                          gradientPreset: "manual",
                        })
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">自选背景次色</span>
                    <Input
                      aria-label="自选背景次色"
                      type="color"
                      className="h-11 w-full"
                      value={settings.customTheme.backgroundSecondaryColor}
                      onChange={(event) =>
                        previewCustomTheme({
                          backgroundSecondaryColor: event.target.value,
                          gradientColor: event.target.value,
                          gradientPreset: "manual",
                        })
                      }
                      onBlur={(event) =>
                        persistCustomTheme({
                          backgroundSecondaryColor: event.currentTarget.value,
                          gradientColor: event.currentTarget.value,
                          gradientPreset: "manual",
                        })
                      }
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">渐变角度</span>
                    <Input
                      aria-label="渐变角度"
                      type="number"
                      min={0}
                      max={360}
                      value={settings.customTheme.gradientAngle}
                      onChange={(event) =>
                        previewCustomTheme({
                          gradientAngle: Number(event.target.value),
                          gradientPreset: "manual",
                        })
                      }
                      onBlur={(event) =>
                        persistCustomTheme({
                          gradientAngle: Number(event.currentTarget.value),
                          gradientPreset: "manual",
                        })
                      }
                    />
                  </label>
                </div>
                <label className="mt-3 block space-y-2 text-sm">
                  <span className="text-muted-foreground">渐变预设</span>
                  <select
                    aria-label="自选渐变预设"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                    value={settings.customTheme.gradientPreset}
                    onChange={(event) =>
                      updateCustomGradientPreset(event.target.value as CustomGradientPreset)
                    }
                    disabled={isSaving}
                  >
                    {CUSTOM_GRADIENT_PRESETS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">字体大小</span>
                  <select
                    aria-label="字体大小"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                    value={settings.ui.fontSize}
                    onChange={(event) => updateUi({ fontSize: event.target.value as AppFontSize })}
                    disabled={isSaving}
                  >
                    {fontSizeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="text-muted-foreground">界面密度</span>
                  <select
                    aria-label="界面密度"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                    value={settings.ui.density}
                    onChange={(event) => updateUi({ density: event.target.value as AppDensity })}
                    disabled={isSaving}
                  >
                    {densityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">UI 参数</h3>
              </div>
              <label className="block space-y-2 text-sm">
                <span className="text-muted-foreground">最近项显示数量</span>
                <Input
                  aria-label="最近项显示数量"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.ui.recentItemsLimit}
                  onChange={(event) =>
                    updateUi({ recentItemsLimit: Number(event.target.value) }, "已保存最近项显示数量")
                  }
                  disabled={isSaving}
                />
              </label>
              <label className="block space-y-2 text-sm">
                <span className="text-muted-foreground">信息栏显示条数</span>
                <Input
                  aria-label="信息栏显示条数"
                  type="number"
                  min={1}
                  max={20}
                  value={settings.ui.infoBarLimit}
                  onChange={(event) =>
                    updateUi({ infoBarLimit: Number(event.target.value) }, "已保存信息栏显示条数")
                  }
                  disabled={isSaving}
                />
              </label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-medium">API key</h3>
              </div>
              <div className="rounded-[1.2rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] p-3 text-sm">
                <p className="text-muted-foreground">当前状态</p>
                <p className="mt-1 font-medium">
                  {apiKeyStatus.configured ? `已配置 ${apiKeyStatus.masked ?? "******"}` : "未配置"}
                </p>
              </div>
              <Input
                aria-label="API key"
                type="password"
                autoComplete="new-password"
                placeholder={apiKeyStatus.configured ? "输入新 key 可替换当前配置" : "输入 API key"}
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={apiKeyBusy || !apiKeyInput.trim()}
                  onClick={() =>
                    void handleApiKeyMutation(
                      () => apiClient.updateUserApiKey(apiKeyInput.trim()),
                      "API key 已保存",
                      { clearInput: true },
                    )
                  }
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={apiKeyBusy || (!apiKeyStatus.configured && !apiKeyInput.trim())}
                  onClick={() =>
                    void handleApiKeyMutation(
                      () => apiClient.verifyUserApiKey(apiKeyInput.trim() || undefined),
                      "API key 连通性验证完成",
                    )
                  }
                >
                  验证连通性
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={apiKeyBusy || !apiKeyStatus.configured}
                  onClick={() =>
                    void handleApiKeyMutation(
                      () => apiClient.clearUserApiKey(),
                      "API key 已清除",
                      { clearInput: true },
                    )
                  }
                >
                  清除
                </Button>
              </div>
            </section>
          </CardContent>
        </Card>

        <Card className="min-w-0 bg-[hsl(var(--surface-container-low)/0.94)]">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>模型管理</CardTitle>
                <CardDescription className="break-words">
                  按厂商和类型筛选，把模型加入当前可用列表。
                </CardDescription>
              </div>
              <Badge variant="secondary">{availableModels.length} 个可用</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">模型厂商</span>
                <select
                  aria-label="模型厂商"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                  value={vendorFilter}
                  onChange={(event) => setVendorFilter(event.target.value)}
                >
                  {vendors.map((vendor) => (
                    <option key={vendor} value={vendor}>
                      {vendor === "all" ? "全部厂商" : vendor}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">模型类型</span>
                <select
                  aria-label="模型类型"
                    className="w-full rounded-full border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] px-3 py-2 text-foreground outline-none"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  {modelTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="rounded-[1.2rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] p-3" data-testid="available-model-list">
              <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                当前可用模型
              </p>
              <div className="flex flex-wrap gap-2">
                {availableModels.map((model) => (
                  <Badge key={model.id} className="max-w-full break-all">
                    {model.id}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid max-h-[520px] gap-3 overflow-auto pr-1">
              {filteredCatalog.map((model) => {
                const enabled = settings.availableModelIds.includes(model.id);

                return (
                  <div
                    key={model.id}
                    className="min-w-0 rounded-[1.2rem] border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container-low)/0.82)] p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{model.name}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {model.vendor} / {model.id}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={enabled ? "secondary" : "outline"}
                        disabled={isSaving}
                        onClick={() => toggleModel(model.id)}
                      >
                        {enabled ? "移出可用" : "加入可用"}
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getModelLabels(model).map((label) => (
                        <Badge key={label} variant="outline">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
