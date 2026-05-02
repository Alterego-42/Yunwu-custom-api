import type { ModelRecord } from "@/lib/api-types";
import {
  DEFAULT_YUNWU_MODEL_IDS,
  YUNWU_MODEL_DEFINITIONS,
  type YunwuModelDefinition,
} from "@yunwu/shared";

export type AppThemeMode = "dark" | "light" | "custom";
export type DarkThemePreset = "ocean" | "graphite" | "violet";
export type LightThemePreset = "mist" | "sunrise" | "sage";
export type CustomGradientPreset = "manual" | "aurora" | "pearl" | "ember";
export type ThemePresetSettings = {
  dark: DarkThemePreset;
  light: LightThemePreset;
  custom: CustomGradientPreset;
};
export type AppFontSize = "small" | "medium" | "large";
export type AppDensity = "compact" | "comfortable" | "spacious";

export type UserUiSettings = {
  fontSize: AppFontSize;
  density: AppDensity;
  recentItemsLimit: number;
  infoBarLimit: number;
};

export type UserSettings = {
  baseUrl: string;
  theme: AppThemeMode;
  themePreset: ThemePresetSettings;
  darkPreset: DarkThemePreset;
  lightPreset: LightThemePreset;
  customColor: string;
  customTheme: {
    foregroundColor: string;
    backgroundColor: string;
    backgroundSecondaryColor: string;
    gradientColor: string;
    gradientAngle: number;
    gradientPreset: CustomGradientPreset;
    surfaceColor: string;
    borderColor: string;
    ringColor: string;
  };
  availableModelIds: string[];
  ui: UserUiSettings;
};

export type ModelCatalogItem = ModelRecord & {
  vendor: string;
};

export const YUNWU_BASE_URL_OPTIONS = [
  {
    id: "yunwu-primary",
    label: "Yunwu 默认线路",
    value: "https://yunwu.ai",
  },
  {
    id: "yunwu-api3",
    label: "Yunwu API3 线路",
    value: "https://api3.wlai.vip",
  },
] as const;

export const DEFAULT_AVAILABLE_MODEL_IDS = [
  ...DEFAULT_YUNWU_MODEL_IDS,
];

export const DARK_THEME_PRESETS: Array<{ value: DarkThemePreset; label: string }> = [
  { value: "ocean", label: "Ocean" },
  { value: "graphite", label: "Graphite" },
  { value: "violet", label: "Violet" },
];

export const LIGHT_THEME_PRESETS: Array<{ value: LightThemePreset; label: string }> = [
  { value: "mist", label: "Mist" },
  { value: "sunrise", label: "Sunrise" },
  { value: "sage", label: "Sage" },
];

export const CUSTOM_GRADIENT_PRESETS: Array<{
  value: CustomGradientPreset;
  label: string;
  backgroundColor?: string;
  gradientColor?: string;
  gradientAngle?: number;
}> = [
  { value: "manual", label: "手动渐变" },
  {
    value: "aurora",
    label: "Aurora",
    backgroundColor: "#08111f",
    gradientColor: "#164e63",
    gradientAngle: 145,
  },
  {
    value: "pearl",
    label: "Pearl",
    backgroundColor: "#f8fafc",
    gradientColor: "#dbeafe",
    gradientAngle: 160,
  },
  {
    value: "ember",
    label: "Ember",
    backgroundColor: "#1c0f0a",
    gradientColor: "#7c2d12",
    gradientAngle: 135,
  },
];

const DARK_THEME_VARIANTS: Record<
  DarkThemePreset,
  {
    primary: string;
    foreground: string;
    background: string;
    backgroundSecondary: string;
    surface: string;
    secondary: string;
    muted: string;
    accent: string;
    destructive: string;
    border: string;
    ring: string;
    shellGridOpacity: number;
    gradientColor: string;
    gradientAngle: number;
  }
> = {
  ocean: {
    primary: "#38bdf8",
    foreground: "#f2f7ff",
    background: "#020617",
    backgroundSecondary: "#0b1120",
    surface: "#0f172a",
    secondary: "#1e293b",
    muted: "#172033",
    accent: "#1d2f48",
    destructive: "#ef4444",
    border: "#27364d",
    ring: "#38bdf8",
    shellGridOpacity: 0.2,
    gradientColor: "#164e63",
    gradientAngle: 180,
  },
  graphite: {
    primary: "#cbd5e1",
    foreground: "#f8fafc",
    background: "#0b1020",
    backgroundSecondary: "#121827",
    surface: "#111827",
    secondary: "#1f2937",
    muted: "#1b2434",
    accent: "#243041",
    destructive: "#ef4444",
    border: "#2b3443",
    ring: "#94a3b8",
    shellGridOpacity: 0.15,
    gradientColor: "#334155",
    gradientAngle: 180,
  },
  violet: {
    primary: "#c084fc",
    foreground: "#fbf5ff",
    background: "#100816",
    backgroundSecondary: "#1b1224",
    surface: "#1d1328",
    secondary: "#2b1f36",
    muted: "#251a2f",
    accent: "#3b2650",
    destructive: "#fb7185",
    border: "#3a2a47",
    ring: "#c084fc",
    shellGridOpacity: 0.16,
    gradientColor: "#6b21a8",
    gradientAngle: 170,
  },
};

const LIGHT_THEME_VARIANTS: Record<
  LightThemePreset,
  {
    primary: string;
    foreground: string;
    background: string;
    backgroundSecondary: string;
    surface: string;
    secondary: string;
    muted: string;
    accent: string;
    destructive: string;
    border: string;
    ring: string;
    shellGridOpacity: number;
    gradientColor: string;
    gradientAngle: number;
  }
> = {
  mist: {
    primary: "#0284c7",
    foreground: "#0f172a",
    background: "#f8fbff",
    backgroundSecondary: "#e9f4fb",
    surface: "#ffffff",
    secondary: "#e7eef6",
    muted: "#eaf0f6",
    accent: "#d9ecf7",
    destructive: "#dc2626",
    border: "#cdd8e4",
    ring: "#0284c7",
    shellGridOpacity: 0.1,
    gradientColor: "#bae6fd",
    gradientAngle: 180,
  },
  sunrise: {
    primary: "#b45309",
    foreground: "#23180f",
    background: "#fffaf0",
    backgroundSecondary: "#f5ead7",
    surface: "#fffdf7",
    secondary: "#f1e3cf",
    muted: "#f4eadb",
    accent: "#f3dfbe",
    destructive: "#c2410c",
    border: "#dfceb8",
    ring: "#b45309",
    shellGridOpacity: 0.08,
    gradientColor: "#f7c97f",
    gradientAngle: 180,
  },
  sage: {
    primary: "#0f766e",
    foreground: "#10201e",
    background: "#f3fffb",
    backgroundSecondary: "#dff7ef",
    surface: "#fbfffd",
    secondary: "#d9f0e8",
    muted: "#e3f5ef",
    accent: "#ccf1e5",
    destructive: "#dc2626",
    border: "#bfd7cf",
    ring: "#0f766e",
    shellGridOpacity: 0.08,
    gradientColor: "#8ddbc7",
    gradientAngle: 180,
  },
};

export const MODEL_CATALOG: ModelCatalogItem[] = YUNWU_MODEL_DEFINITIONS.map(
  (model) => ({
    id: model.id,
    name: model.name,
    type: model.capabilities.includes("image.edit")
      ? "image-editing"
      : "image-generation",
    capabilityTypes: model.capabilities,
    enabled: model.defaultEnabled,
    provider: "openai-compatible",
    vendor: resolveModelVendor(model),
    taskSupported: model.taskSupported,
    status: model.taskSupported ? "available" : "unsupported",
    statusMessage: model.taskSupported
      ? undefined
      : "This model is registered but its Yunwu API family is not implemented for task submission yet.",
    description: model.description,
  }),
);

function resolveModelVendor(model: YunwuModelDefinition) {
  if (model.id.startsWith("gpt-")) {
    return "OpenAI";
  }
  if (model.id.startsWith("gemini-") || model.id.startsWith("google/")) {
    return "Google";
  }
  if (model.id.startsWith("grok-")) {
    return "xAI";
  }
  if (model.id.startsWith("doubao-")) {
    return "ByteDance";
  }
  if (model.id.startsWith("qwen-") || model.id.startsWith("z-image")) {
    return "Alibaba";
  }
  if (model.id.startsWith("mj_")) {
    return "Midjourney";
  }
  if (model.id.startsWith("ideogram")) {
    return "Ideogram";
  }
  if (
    model.id.startsWith("flux") ||
    model.id.includes("/flux") ||
    model.id.startsWith("black-forest-labs/")
  ) {
    return "Black Forest Labs";
  }

  return model.family;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  baseUrl: YUNWU_BASE_URL_OPTIONS[0].value,
  theme: "dark",
  themePreset: {
    dark: "ocean",
    light: "mist",
    custom: "manual",
  },
  darkPreset: "ocean",
  lightPreset: "mist",
  customColor: "#38bdf8",
  customTheme: {
    foregroundColor: "#f8fafc",
    backgroundColor: "#08111f",
    backgroundSecondaryColor: "#164e63",
    gradientColor: "#164e63",
    gradientAngle: 145,
    gradientPreset: "manual",
    surfaceColor: "#111827",
    borderColor: "#263244",
    ringColor: "#38bdf8",
  },
  availableModelIds: DEFAULT_AVAILABLE_MODEL_IDS,
  ui: {
    fontSize: "medium",
    density: "comfortable",
    recentItemsLimit: 4,
    infoBarLimit: 5,
  },
};

const STORAGE_KEY = "yunwu:user-settings:v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeBaseUrl(value: unknown) {
  if (value === "https://api3.wlai.vip") {
    return value;
  }

  return DEFAULT_USER_SETTINGS.baseUrl;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function normalizeDarkPreset(value: unknown): DarkThemePreset {
  return value === "graphite" || value === "violet" || value === "ocean"
    ? value
    : DEFAULT_USER_SETTINGS.darkPreset;
}

function normalizeLightPreset(value: unknown): LightThemePreset {
  return value === "sunrise" || value === "sage" || value === "mist"
    ? value
    : DEFAULT_USER_SETTINGS.lightPreset;
}

function normalizeGradientPreset(value: unknown): CustomGradientPreset {
  return value === "aurora" || value === "pearl" || value === "ember" || value === "manual"
    ? value
    : DEFAULT_USER_SETTINGS.customTheme.gradientPreset;
}

function normalizeGradientAngle(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(360, Math.max(0, Math.round(value)))
    : DEFAULT_USER_SETTINGS.customTheme.gradientAngle;
}

export function normalizeUserSettings(value: unknown): UserSettings {
  if (!isRecord(value)) {
    return DEFAULT_USER_SETTINGS;
  }

  const availableModelIds = Array.isArray(value.availableModelIds)
    ? value.availableModelIds.filter((item): item is string => typeof item === "string")
    : DEFAULT_AVAILABLE_MODEL_IDS;
  const ui = isRecord(value.ui) ? value.ui : {};
  const fontSize =
    ui.fontSize === "small" || ui.fontSize === "large" || ui.fontSize === "medium"
      ? ui.fontSize
      : DEFAULT_USER_SETTINGS.ui.fontSize;
  const density =
    ui.density === "compact" || ui.density === "spacious" || ui.density === "comfortable"
      ? ui.density
      : DEFAULT_USER_SETTINGS.ui.density;
  const recentItemsLimit =
    typeof ui.recentItemsLimit === "number" && Number.isFinite(ui.recentItemsLimit)
      ? Math.min(20, Math.max(1, Math.round(ui.recentItemsLimit)))
      : DEFAULT_USER_SETTINGS.ui.recentItemsLimit;
  const infoBarLimit =
    typeof ui.infoBarLimit === "number" && Number.isFinite(ui.infoBarLimit)
      ? Math.min(20, Math.max(1, Math.round(ui.infoBarLimit)))
      : DEFAULT_USER_SETTINGS.ui.infoBarLimit;
  const customTheme = isRecord(value.customTheme) ? value.customTheme : {};
  const themePreset = isRecord(value.themePreset) ? value.themePreset : {};
  const legacyCustomColor = isHexColor(value.customColor)
    ? value.customColor
    : DEFAULT_USER_SETTINGS.customColor;
  const darkPreset = normalizeDarkPreset(value.darkPreset ?? themePreset.dark ?? ui.darkPreset);
  const lightPreset = normalizeLightPreset(value.lightPreset ?? themePreset.light ?? ui.lightPreset);
  const customPreset = normalizeGradientPreset(
    themePreset.custom ?? customTheme.gradientPreset ?? ui.customPreset ?? ui.gradientPreset,
  );
  const backgroundSecondaryColor = isHexColor(customTheme.backgroundSecondaryColor)
    ? customTheme.backgroundSecondaryColor
    : isHexColor(customTheme.gradientColor)
      ? customTheme.gradientColor
      : legacyCustomColor;

  return {
    baseUrl: normalizeBaseUrl(value.baseUrl),
    theme:
      value.theme === "light" || value.theme === "custom" || value.theme === "dark"
        ? value.theme
        : DEFAULT_USER_SETTINGS.theme,
    themePreset: {
      dark: darkPreset,
      light: lightPreset,
      custom: customPreset,
    },
    darkPreset,
    lightPreset,
    customColor:
      isHexColor(value.customColor) ? value.customColor : DEFAULT_USER_SETTINGS.customColor,
    customTheme: {
      foregroundColor: isHexColor(customTheme.foregroundColor)
        ? customTheme.foregroundColor
        : DEFAULT_USER_SETTINGS.customTheme.foregroundColor,
      backgroundColor: isHexColor(customTheme.backgroundColor)
        ? customTheme.backgroundColor
        : DEFAULT_USER_SETTINGS.customTheme.backgroundColor,
      backgroundSecondaryColor,
      gradientColor: isHexColor(customTheme.gradientColor)
        ? customTheme.gradientColor
        : backgroundSecondaryColor,
      gradientAngle: normalizeGradientAngle(customTheme.gradientAngle),
      gradientPreset: customPreset,
      surfaceColor: isHexColor(customTheme.surfaceColor)
        ? customTheme.surfaceColor
        : DEFAULT_USER_SETTINGS.customTheme.surfaceColor,
      borderColor: isHexColor(customTheme.borderColor)
        ? customTheme.borderColor
        : DEFAULT_USER_SETTINGS.customTheme.borderColor,
      ringColor: isHexColor(customTheme.ringColor)
        ? customTheme.ringColor
        : legacyCustomColor,
    },
    availableModelIds,
    ui: {
      fontSize,
      density,
      recentItemsLimit,
      infoBarLimit,
    },
  };
}

export function loadStoredUserSettings(): UserSettings {
  if (typeof window === "undefined") {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    return normalizeUserSettings(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveStoredUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeUserSettings(settings);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  applyUserTheme(normalized);
}

export function resetStoredUserSettings() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  applyUserTheme(DEFAULT_USER_SETTINGS);
}

function hexToHsl(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) {
    return "194 95% 68%";
  }

  const r = Number.parseInt(match[1], 16) / 255;
  const g = Number.parseInt(match[2], 16) / 255;
  const b = Number.parseInt(match[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case r:
        hue = ((g - b) / delta) % 6;
        break;
      case g:
        hue = (b - r) / delta + 2;
        break;
      default:
        hue = (r - g) / delta + 4;
        break;
    }
  }

  return `${Math.round(hue * 60 + (hue < 0 ? 360 : 0))} ${Math.round(
    saturation * 100,
  )}% ${Math.round(lightness * 100)}%`;
}

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) {
    return { r: 56, g: 189, b: 248 };
  }

  return {
    r: Number.parseInt(match[1], 16),
    g: Number.parseInt(match[2], 16),
    b: Number.parseInt(match[3], 16),
  };
}

function hexToRgba(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHexColors(base: string, overlay: string, overlayRatio: number) {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  const ratio = Math.min(1, Math.max(0, overlayRatio));

  return rgbToHex({
    r: baseRgb.r * (1 - ratio) + overlayRgb.r * ratio,
    g: baseRgb.g * (1 - ratio) + overlayRgb.g * ratio,
    b: baseRgb.b * (1 - ratio) + overlayRgb.b * ratio,
  });
}

function getReadableForeground(background: string) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function setThemeColor(root: HTMLElement, property: string, color: string) {
  root.style.setProperty(property, hexToHsl(color));
}

function setShellGradient(
  root: HTMLElement,
  background: string,
  gradientColor: string,
  primary: string,
  angle: number,
  intensity: number,
) {
  const primaryGlow = hexToRgba(primary, intensity);
  const secondaryGlow = hexToRgba(gradientColor, Math.min(0.42, intensity + 0.04));

  root.style.setProperty("--custom-bg", background);
  root.style.setProperty("--custom-bg-2", gradientColor);
  root.style.setProperty("--custom-gradient-color", gradientColor);
  root.style.setProperty("--custom-gradient-angle", `${angle}deg`);
  root.style.setProperty("--shell-gradient-color", gradientColor);
  root.style.setProperty("--shell-gradient-start", background);
  root.style.setProperty("--shell-gradient-mid", gradientColor);
  root.style.setProperty("--shell-gradient-end", background);
  root.style.setProperty("--shell-accent-glow", primaryGlow);
  root.style.setProperty("--shell-secondary-glow", secondaryGlow);
  root.style.setProperty(
    "--shell-bg",
    [
      `radial-gradient(circle at 18% 0%, ${primaryGlow}, transparent 34%)`,
      `radial-gradient(circle at 86% 12%, ${secondaryGlow}, transparent 32%)`,
      `linear-gradient(${angle}deg, ${background} 0%, ${gradientColor} 52%, ${background} 100%)`,
    ].join(", "),
  );
}

function setElevationTokens(
  root: HTMLElement,
  shadowRgb: string,
  options: {
    panelShadow: string;
    headerShadow: string;
    buttonShadow: string;
  },
) {
  const isLightShadow = shadowRgb === "15, 23, 42";
  const elevationLevel1 = isLightShadow
    ? "0 1px 2px rgba(15, 23, 42, 0.05)"
    : "0 1px 3px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.14)";
  const elevationLevel2 = isLightShadow
    ? "0 2px 6px rgba(15, 23, 42, 0.055)"
    : "0 4px 14px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.18)";
  const elevationLevel3 = isLightShadow
    ? "0 4px 12px rgba(15, 23, 42, 0.065)"
    : "0 10px 26px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18)";

  root.style.setProperty("--shadow-rgb", shadowRgb);
  root.style.setProperty("--mdui-elevation-level0", "none");
  root.style.setProperty("--mdui-elevation-level1", elevationLevel1);
  root.style.setProperty("--mdui-elevation-level2", elevationLevel2);
  root.style.setProperty("--mdui-elevation-level3", elevationLevel3);
  root.style.setProperty("--panel-shadow", options.panelShadow);
  root.style.setProperty("--header-shadow", options.headerShadow);
  root.style.setProperty("--button-shadow", options.buttonShadow);
  root.style.setProperty("--input-shadow", "none");
}

function setCommonThemeVariables(
  root: HTMLElement,
  variant: {
    primary: string;
    foreground: string;
    background: string;
    backgroundSecondary: string;
    surface: string;
    secondary: string;
    muted: string;
    accent: string;
    destructive: string;
    border: string;
    ring: string;
    shellGridOpacity: number;
    gradientColor: string;
    gradientAngle: number;
  },
  mode: AppThemeMode,
) {
  const primaryForeground = getReadableForeground(variant.primary);
  const mutedForeground = mode === "light" ? "#536171" : "#b6c3d5";
  const surfaceContainerLowest = mode === "light" ? variant.surface : variant.background;
  const surfaceContainerLow =
    mode === "light"
      ? mixHexColors(variant.surface, variant.backgroundSecondary, 0.08)
      : mixHexColors(variant.surface, variant.background, 0.18);
  const surfaceContainer =
    mode === "light" ? mixHexColors(variant.surface, variant.secondary, 0.14) : variant.surface;
  const surfaceContainerHigh =
    mode === "light" ? mixHexColors(variant.surface, variant.muted, 0.22) : variant.secondary;
  const surfaceContainerHighest =
    mode === "light" ? mixHexColors(variant.surface, variant.accent, 0.32) : variant.accent;
  const shadowRgb = mode === "light" ? "15, 23, 42" : "0, 0, 0";
  const elevationLevel1 =
    mode === "light"
      ? "0 1px 2px rgba(15, 23, 42, 0.05)"
      : "0 1px 3px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.14)";
  const elevationLevel2 =
    mode === "light"
      ? "0 2px 6px rgba(15, 23, 42, 0.055)"
      : "0 4px 14px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.18)";
  const elevationLevel3 =
    mode === "light"
      ? "0 4px 12px rgba(15, 23, 42, 0.065)"
      : "0 10px 26px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.18)";

  setThemeColor(root, "--background", variant.background);
  setThemeColor(root, "--foreground", variant.foreground);
  setThemeColor(root, "--card", variant.surface);
  setThemeColor(root, "--card-foreground", variant.foreground);
  setThemeColor(root, "--popover", variant.surface);
  setThemeColor(root, "--popover-foreground", variant.foreground);
  setThemeColor(root, "--primary", variant.primary);
  setThemeColor(root, "--primary-foreground", primaryForeground);
  setThemeColor(root, "--secondary", variant.secondary);
  setThemeColor(root, "--secondary-foreground", variant.foreground);
  setThemeColor(root, "--muted", variant.muted);
  setThemeColor(root, "--muted-foreground", mutedForeground);
  setThemeColor(root, "--accent", variant.accent);
  setThemeColor(root, "--accent-foreground", variant.foreground);
  setThemeColor(root, "--destructive", variant.destructive);
  setThemeColor(root, "--destructive-foreground", getReadableForeground(variant.destructive));
  setThemeColor(root, "--border", variant.border);
  setThemeColor(root, "--input", variant.border);
  setThemeColor(root, "--ring", variant.ring);
  setThemeColor(root, "--surface", variant.surface);
  setThemeColor(root, "--surface-variant", variant.secondary);
  setThemeColor(root, "--surface-container-lowest", surfaceContainerLowest);
  setThemeColor(root, "--surface-container-low", surfaceContainerLow);
  setThemeColor(root, "--surface-container", surfaceContainer);
  setThemeColor(root, "--surface-container-high", surfaceContainerHigh);
  setThemeColor(root, "--surface-container-highest", surfaceContainerHighest);
  setThemeColor(root, "--outline", variant.border);
  setThemeColor(root, "--outline-variant", mixHexColors(variant.border, variant.surface, 0.38));
  root.style.setProperty("--shell-grid-opacity", String(variant.shellGridOpacity));
  setElevationTokens(root, shadowRgb, {
    panelShadow: mode === "light" ? elevationLevel1 : elevationLevel2,
    headerShadow: elevationLevel1,
    buttonShadow: mode === "light" ? "none" : elevationLevel1,
  });
  setShellGradient(
    root,
    variant.background,
    variant.backgroundSecondary || variant.gradientColor,
    variant.primary,
    variant.gradientAngle,
    mode === "custom" ? 0.34 : mode === "light" ? 0.16 : 0.18,
  );
}

export function applyUserTheme(settings = loadStoredUserSettings()) {
  if (typeof document === "undefined") {
    return;
  }

  const normalized = normalizeUserSettings(settings);
  const root = document.documentElement;
  root.dataset.theme = normalized.theme;
  root.dataset.themePreset =
    normalized.theme === "light"
      ? normalized.themePreset.light
      : normalized.theme === "dark"
        ? normalized.themePreset.dark
        : normalized.themePreset.custom;
  root.dataset.fontSize = normalized.ui.fontSize;
  root.dataset.density = normalized.ui.density;

  if (normalized.theme === "custom") {
    const customIsLight = getReadableForeground(normalized.customTheme.backgroundColor) === "#0f172a";
    const surfaceBase = customIsLight
      ? mixHexColors(normalized.customTheme.backgroundColor, "#ffffff", 0.88)
      : mixHexColors(normalized.customTheme.backgroundColor, "#020617", 0.56);
    const surfaceContainerLowest = normalized.customTheme.backgroundColor;
    const surfaceContainerLow = mixHexColors(
      surfaceBase,
      normalized.customTheme.backgroundSecondaryColor,
      customIsLight ? 0.08 : 0.14,
    );
    const surfaceContainer = mixHexColors(
      surfaceBase,
      normalized.customTheme.backgroundSecondaryColor,
      customIsLight ? 0.16 : 0.22,
    );
    const surfaceContainerHigh = mixHexColors(
      surfaceBase,
      normalized.customTheme.backgroundSecondaryColor,
      customIsLight ? 0.26 : 0.32,
    );
    const surfaceContainerHighest = mixHexColors(
      surfaceBase,
      normalized.customTheme.backgroundSecondaryColor,
      customIsLight ? 0.36 : 0.42,
    );
    const customShadowRgb = customIsLight ? "15, 23, 42" : "0, 0, 0";
    const customElevationLevel1 = customIsLight
      ? "0 1px 2px rgba(15, 23, 42, 0.05)"
      : "0 1px 3px rgba(0, 0, 0, 0.22), 0 0 1px rgba(0, 0, 0, 0.14)";
    const customElevationLevel2 = customIsLight
      ? "0 2px 6px rgba(15, 23, 42, 0.055)"
      : "0 4px 14px rgba(0, 0, 0, 0.28), 0 1px 3px rgba(0, 0, 0, 0.18)";
    const mutedForeground = mixHexColors(
      normalized.customTheme.foregroundColor,
      normalized.customTheme.backgroundColor,
      customIsLight ? 0.42 : 0.35,
    );

    setThemeColor(root, "--background", normalized.customTheme.backgroundColor);
    setThemeColor(root, "--foreground", normalized.customTheme.foregroundColor);
    setThemeColor(root, "--card", surfaceBase);
    setThemeColor(root, "--card-foreground", normalized.customTheme.foregroundColor);
    setThemeColor(root, "--popover", surfaceBase);
    setThemeColor(root, "--popover-foreground", normalized.customTheme.foregroundColor);
    setThemeColor(root, "--primary", normalized.customColor);
    setThemeColor(root, "--primary-foreground", getReadableForeground(normalized.customColor));
    setThemeColor(root, "--secondary", surfaceContainer);
    setThemeColor(root, "--secondary-foreground", normalized.customTheme.foregroundColor);
    setThemeColor(root, "--muted", surfaceContainerLow);
    setThemeColor(root, "--muted-foreground", mutedForeground);
    setThemeColor(root, "--accent", surfaceContainerHigh);
    setThemeColor(root, "--accent-foreground", normalized.customTheme.foregroundColor);
    setThemeColor(root, "--destructive", "#ef4444");
    setThemeColor(root, "--destructive-foreground", getReadableForeground("#ef4444"));
    setThemeColor(root, "--border", normalized.customTheme.borderColor);
    setThemeColor(root, "--input", normalized.customTheme.borderColor);
    setThemeColor(root, "--ring", normalized.customTheme.ringColor);
    setThemeColor(root, "--surface", surfaceBase);
    setThemeColor(root, "--surface-variant", mixHexColors(surfaceBase, normalized.customTheme.backgroundSecondaryColor, 0.36));
    setThemeColor(root, "--surface-container-lowest", surfaceContainerLowest);
    setThemeColor(root, "--surface-container-low", surfaceContainerLow);
    setThemeColor(root, "--surface-container", surfaceContainer);
    setThemeColor(root, "--surface-container-high", surfaceContainerHigh);
    setThemeColor(root, "--surface-container-highest", surfaceContainerHighest);
    setThemeColor(root, "--outline", normalized.customTheme.borderColor);
    setThemeColor(
      root,
      "--outline-variant",
      mixHexColors(normalized.customTheme.borderColor, surfaceBase, customIsLight ? 0.28 : 0.4),
    );
    root.style.setProperty("--shell-grid-opacity", customIsLight ? "0.1" : "0.14");
    setElevationTokens(root, customShadowRgb, {
      panelShadow: customIsLight ? customElevationLevel1 : customElevationLevel2,
      headerShadow: customElevationLevel1,
      buttonShadow: customElevationLevel1,
    });
    setShellGradient(
      root,
      normalized.customTheme.backgroundColor,
      normalized.customTheme.backgroundSecondaryColor,
      normalized.customColor,
      normalized.customTheme.gradientAngle,
      customIsLight ? 0.24 : 0.3,
    );
    return;
  }

  setCommonThemeVariables(
    root,
    normalized.theme === "light"
      ? LIGHT_THEME_VARIANTS[normalized.themePreset.light]
      : DARK_THEME_VARIANTS[normalized.themePreset.dark],
    normalized.theme,
  );
}
