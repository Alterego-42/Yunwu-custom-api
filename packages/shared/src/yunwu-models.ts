import type { CapabilityType } from "./types";

export const YUNWU_BASE_URLS = [
  "https://yunwu.ai",
  "https://api3.wlai.vip",
] as const;

export type YunwuBaseUrl = (typeof YUNWU_BASE_URLS)[number];

export type YunwuModelFamily =
  | "openai-images"
  | "replicate-prediction"
  | "fal-ai"
  | "tencent-vod"
  | "ideogram"
  | "midjourney"
  | "unsupported";

export interface YunwuModelDefinition {
  id: string;
  name: string;
  family: YunwuModelFamily;
  capabilities: CapabilityType[];
  defaultEnabled: boolean;
  taskSupported: boolean;
  description: string;
}

export const DEFAULT_YUNWU_BASE_URL: YunwuBaseUrl = "https://yunwu.ai";

export const DEFAULT_YUNWU_MODEL_IDS = [
  "gpt-image-2",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "grok-4.2-image",
  "grok-imagine-image-pro",
] as const;

const OPENAI_IMAGES_MODELS = new Set<string>([
  ...DEFAULT_YUNWU_MODEL_IDS,
  "grok-imagine-image",
  "gpt-image-1.5",
  "gpt-image-2-all",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "gpt-image-1.5-all",
  "gpt-image-1",
  "gpt-4o-image-vip",
  "gpt-image-1-all",
  "gpt-image-1-mini",
  "grok-4.1-image",
  "grok-3-image",
  "grok-4-image",
]);

const OPENAI_IMAGE_EDIT_MODELS = new Set<string>([
  "gpt-image-2",
  "gpt-image-2-all",
  "gpt-image-1.5",
  "gpt-image-1.5-all",
  "gpt-image-1",
  "gpt-image-1-all",
  "gpt-image-1-mini",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "grok-imagine-image",
  "grok-imagine-image-pro",
  "grok-4.2-image",
  "grok-4.1-image",
  "grok-3-image",
  "grok-4-image",
]);

const REPLICATE_MODELS = new Set<string>([
  "flux-dev",
  "flux-pro",
  "flux-pro-1.1-ultra",
  "flux-pro-max",
  "flux-schnell",
  "flux.1-kontext-pro",
  "flux.1.1-pro",
  "andreasjansson/stable-diffusion-animation",
  "black-forest-labs/flux-1.1-pro",
  "black-forest-labs/flux-1.1-pro-ultra",
  "black-forest-labs/flux-dev",
  "black-forest-labs/flux-fill-dev",
  "black-forest-labs/flux-fill-pro",
  "black-forest-labs/flux-kontext-dev",
  "black-forest-labs/flux-kontext-max",
  "black-forest-labs/flux-kontext-pro",
  "black-forest-labs/flux-pro",
  "black-forest-labs/flux-schnell",
  "flux-kontext-apps/multi-image-kontext-max",
  "flux-kontext-apps/multi-image-kontext-pro",
  "google/imagen-4",
  "google/imagen-4-fast",
  "google/imagen-4-ultra",
  "ideogram-ai/ideogram-v2-turbo",
  "lucataco/animate-diff",
  "lucataco/flux-schnell-lora",
  "lucataco/remove-bg",
  "recraft-ai/recraft-v3",
  "recraft-ai/recraft-v3-svg",
  "stability-ai/sdxl",
  "stability-ai/stable-diffusion",
  "stability-ai/stable-diffusion-img2img",
  "stability-ai/stable-diffusion-inpainting",
  "sujaykhandekar/object-removal",
]);

const FAL_AI_MODELS = new Set<string>(["fal-ai/nano-banana"]);

const TENCENT_VOD_MODELS = new Set<string>([
  "qwen-image-max",
  "qwen-image-max-2025-12-30",
  "z-image-turbo",
  "qwen-image-edit-2509",
]);

const IDEOGRAM_MODELS = new Set<string>([
  "ideogram_describe",
  "ideogram_edit_V_3_DEFAULT",
  "ideogram_edit_V_3_QUALITY",
  "ideogram_edit_V_3_TURBO",
  "ideogram_generate_V_1",
  "ideogram_generate_V_1_TURBO",
  "ideogram_generate_V_2",
  "ideogram_generate_V_2_TURBO",
  "ideogram_generate_V_3_DEFAULT",
  "ideogram_generate_V_3_QUALITY",
  "ideogram_generate_V_3_TURBO",
  "ideogram_reframe_V_3_DEFAULT",
  "ideogram_reframe_V_3_QUALITY",
  "ideogram_reframe_V_3_TURBO",
  "ideogram_remix_V_1",
  "ideogram_remix_V_1_TURBO",
  "ideogram_remix_V_2",
  "ideogram_remix_V_2_TURBO",
  "ideogram_remix_V_3_DEFAULT",
  "ideogram_remix_V_3_QUALITY",
  "ideogram_remix_V_3_TURBO",
  "ideogram_replace_background_V_3_DEFAULT",
  "ideogram_replace_background_V_3_QUALITY",
  "ideogram_replace_background_V_3_TURBO",
  "ideogram_upscale",
]);

const MIDJOURNEY_MODELS = new Set<string>([
  "mj_imagine",
  "mj_blend",
  "mj_custom_zoom",
  "mj_describe",
  "mj_high_variation",
  "mj_inpaint",
  "mj_low_variation",
  "mj_modal",
  "mj_pan",
  "mj_reroll",
  "mj_upscale",
  "mj_variation",
  "mj_zoom",
]);

export const YUNWU_PROVIDER_MODEL_IDS = [
  "gpt-image-2",
  "grok-imagine-image",
  "grok-imagine-image-pro",
  "gemini-3.1-flash-image-preview",
  "doubao-seedream-5-0-260128",
  "gemini-3-pro-image-preview",
  "gpt-image-1.5",
  "gpt-image-2-all",
  "gemini-2.5-flash-image",
  "gemini-2.5-flash-image-preview",
  "gpt-image-1.5-all",
  "gpt-image-1",
  "gpt-4o-image-vip",
  "gpt-image-1-all",
  "gpt-image-1-mini",
  "qwen-image-edit-2509",
  "qwen-image-max",
  "qwen-image-max-2025-12-30",
  "z-image-turbo",
  "doubao-seedream-4-0-250828",
  "doubao-seedream-4-5-251128",
  "grok-4.2-image",
  "flux-1.1-pro",
  "grok-4.1-image",
  "mj_imagine",
  "grok-3-image",
  "grok-4-image",
  "mj_blend",
  "mj_custom_zoom",
  "mj_describe",
  "mj_high_variation",
  "mj_inpaint",
  "mj_low_variation",
  "mj_modal",
  "mj_pan",
  "mj_reroll",
  "mj_upscale",
  "mj_variation",
  "mj_zoom",
  "doubao-seedream-3-0-t2i-250415",
  "flux-dev",
  "flux-pro",
  "flux-pro-1.1-ultra",
  "flux-pro-max",
  "flux-schnell",
  "flux.1-kontext-pro",
  "flux.1.1-pro",
  "andreasjansson/stable-diffusion-animation",
  "black-forest-labs/flux-1.1-pro",
  "black-forest-labs/flux-1.1-pro-ultra",
  "black-forest-labs/flux-dev",
  "black-forest-labs/flux-fill-dev",
  "black-forest-labs/flux-fill-pro",
  "black-forest-labs/flux-kontext-dev",
  "black-forest-labs/flux-kontext-max",
  "black-forest-labs/flux-kontext-pro",
  "black-forest-labs/flux-pro",
  "black-forest-labs/flux-schnell",
  "cjwbw/rembg",
  "flux-kontext-apps/multi-image-kontext-max",
  "flux-kontext-apps/multi-image-kontext-pro",
  "google/imagen-4",
  "google/imagen-4-fast",
  "google/imagen-4-ultra",
  "ideogram_describe",
  "ideogram_edit_V_3_DEFAULT",
  "ideogram_edit_V_3_QUALITY",
  "ideogram_edit_V_3_TURBO",
  "ideogram_generate_V_1",
  "ideogram_generate_V_1_TURBO",
  "ideogram_generate_V_2",
  "ideogram_generate_V_2_TURBO",
  "ideogram_generate_V_3_DEFAULT",
  "ideogram_generate_V_3_QUALITY",
  "ideogram_generate_V_3_TURBO",
  "ideogram_reframe_V_3_DEFAULT",
  "ideogram_reframe_V_3_QUALITY",
  "ideogram_reframe_V_3_TURBO",
  "ideogram_remix_V_1",
  "ideogram_remix_V_1_TURBO",
  "ideogram_remix_V_2",
  "ideogram_remix_V_2_TURBO",
  "ideogram_remix_V_3_DEFAULT",
  "ideogram_remix_V_3_QUALITY",
  "ideogram_remix_V_3_TURBO",
  "ideogram_replace_background_V_3_DEFAULT",
  "ideogram_replace_background_V_3_QUALITY",
  "ideogram_replace_background_V_3_TURBO",
  "ideogram_upscale",
  "ideogram-ai/ideogram-v2-turbo",
  "kling-image",
  "kling-image-recognize",
  "kling-omni-image",
  "lucataco/animate-diff",
  "lucataco/flux-schnell-lora",
  "lucataco/remove-bg",
  "recraft-ai/recraft-v3",
  "recraft-ai/recraft-v3-svg",
  "stability-ai/sdxl",
  "stability-ai/stable-diffusion",
  "stability-ai/stable-diffusion-img2img",
  "stability-ai/stable-diffusion-inpainting",
  "sujaykhandekar/object-removal",
] as const;

export const YUNWU_MODEL_DEFINITIONS: YunwuModelDefinition[] =
  YUNWU_PROVIDER_MODEL_IDS.map((id) => {
    const defaultEnabled = DEFAULT_YUNWU_MODEL_IDS.includes(
      id as (typeof DEFAULT_YUNWU_MODEL_IDS)[number],
    );
    const family = resolveYunwuModelFamily(id);
    const capabilities = resolveYunwuModelCapabilities(id, family);
    const taskSupported = family === "openai-images";

    return {
      id,
      name: formatYunwuModelName(id),
      family,
      capabilities,
      defaultEnabled,
      taskSupported,
      description: taskSupported
        ? "Yunwu image model using the documented OpenAI Images endpoint."
        : `Registered from test_provider.txt; ${family} calls are not implemented in this backend yet.`,
    };
  });

export function getYunwuModelDefinition(
  modelId: string,
): YunwuModelDefinition | undefined {
  return YUNWU_MODEL_DEFINITIONS.find((model) => model.id === modelId);
}

export function isSupportedYunwuBaseUrl(value: string): value is YunwuBaseUrl {
  return YUNWU_BASE_URLS.includes(value.replace(/\/$/, "") as YunwuBaseUrl);
}

function resolveYunwuModelFamily(modelId: string): YunwuModelFamily {
  if (OPENAI_IMAGES_MODELS.has(modelId) || modelId.startsWith("doubao-seedream-")) {
    return "openai-images";
  }

  if (REPLICATE_MODELS.has(modelId)) {
    return "replicate-prediction";
  }

  if (FAL_AI_MODELS.has(modelId)) {
    return "fal-ai";
  }

  if (TENCENT_VOD_MODELS.has(modelId)) {
    return "tencent-vod";
  }

  if (IDEOGRAM_MODELS.has(modelId)) {
    return "ideogram";
  }

  if (MIDJOURNEY_MODELS.has(modelId)) {
    return "midjourney";
  }

  return "unsupported";
}

function resolveYunwuModelCapabilities(
  modelId: string,
  family: YunwuModelFamily,
): CapabilityType[] {
  if (family === "openai-images") {
    return OPENAI_IMAGE_EDIT_MODELS.has(modelId)
      ? ["image.generate", "image.edit"]
      : ["image.generate"];
  }

  if (family === "midjourney") {
    return modelId === "mj_describe"
      ? ["image.describe"]
      : ["midjourney.action"];
  }

  if (family === "ideogram") {
    if (modelId.includes("describe")) {
      return ["image.describe"];
    }
    if (modelId.includes("upscale")) {
      return ["image.upscale"];
    }
    if (modelId.includes("replace_background")) {
      return ["image.background_replace"];
    }
    return modelId.includes("edit") ||
      modelId.includes("remix") ||
      modelId.includes("reframe")
      ? ["image.edit"]
      : ["image.generate"];
  }

  return ["image.generate"];
}

function formatYunwuModelName(modelId: string) {
  return modelId
    .split(/[/._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}
