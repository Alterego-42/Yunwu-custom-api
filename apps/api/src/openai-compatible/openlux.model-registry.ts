import type { CapabilityType } from "@yunwu/shared";
import type { YunwuModelDefinition } from "./yunwu-model-registry";

/**
 * OpenLux（https://api.openlux.ai/v1）图像模型注册表。
 *
 * 端点与 OpenAI Images 兼容：
 *   文生图  POST /v1/images/generations   （application/json）
 *   图生图  POST /v1/images/edits         （multipart/form-data）
 * 因此全部模型归入 openai-images 家族，走 OpenAICompatibleService 的默认路径。
 *
 * 模型清单取自 https://doc.openlux.ai/reference/v1/images/ 中带请求示例的条目。
 * 该站点是中转网关，实际可用模型取决于账号所在分组与 token，
 * 权威列表是 GET /v1/models（用同一把 key 调用）。
 */

export const DEFAULT_OPENLUX_BASE_URL = "https://api.openlux.ai/v1";

export const OPENLUX_PROVIDER = "openlux";

/** 支持文生图 + 图生图（文档中两者都有独立演示）。 */
const OPENLUX_IMAGE_EDIT_MODELS = new Set<string>([
  "gpt-image-1",
  "gpt-image-1.5",
  "gpt-image-2",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "grok-3-image",
]);

/** 仅文生图（文档中只有 Create 演示）。 */
const OPENLUX_GENERATE_ONLY_MODELS = new Set<string>(["dall-e-3"]);

export const OPENLUX_PROVIDER_MODEL_IDS = [
  ...OPENLUX_IMAGE_EDIT_MODELS,
  ...OPENLUX_GENERATE_ONLY_MODELS,
] as const;

export const DEFAULT_OPENLUX_MODEL_IDS = [
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-1.5",
  "gpt-image-2",
  "grok-3-image",
] as const;

function resolveOpenluxModelCapabilities(
  modelId: string,
): CapabilityType[] {
  return OPENLUX_IMAGE_EDIT_MODELS.has(modelId)
    ? ["image.generate", "image.edit"]
    : ["image.generate"];
}

function formatOpenluxModelName(modelId: string) {
  return modelId
    .split(/[/._-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

const OPENLUX_MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-image-1": "OpenAI GPT Image 1：文生图与图生图，OpenAI Images 兼容接口。",
  "gpt-image-1.5": "OpenAI GPT Image 1.5：文生图与图生图，OpenAI Images 兼容接口。",
  "gpt-image-2": "OpenAI GPT Image 2：文生图与图生图，OpenAI Images 兼容接口。",
  "gpt-image-2.5-flare": "GPT Image 2.5 Flare：速度更快，适合日常高频生成。",
  "gpt-image-2.5-sunburst": "GPT Image 2.5 Sunburst：精度更高，适合细化与创意产出。",
  "grok-3-image": "xAI Grok 3 Image：使用 aspect_ratio / resolution 参数，支持图生图。",
  "dall-e-3": "OpenAI DALL·E 3：仅文生图。",
};

export const OPENLUX_MODEL_DEFINITIONS: YunwuModelDefinition[] =
  OPENLUX_PROVIDER_MODEL_IDS.map((id) => {
    const capabilities = resolveOpenluxModelCapabilities(id);

    return {
      id,
      name: formatOpenluxModelName(id),
      family: "openai-images",
      capabilities,
      defaultEnabled: DEFAULT_OPENLUX_MODEL_IDS.includes(
        id as (typeof DEFAULT_OPENLUX_MODEL_IDS)[number],
      ),
      taskSupported: true,
      description:
        OPENLUX_MODEL_DESCRIPTIONS[id] ??
        "OpenLux image model using the documented OpenAI Images endpoint.",
    };
  });

export function getOpenluxModelDefinition(
  modelId: string,
): YunwuModelDefinition | undefined {
  return OPENLUX_MODEL_DEFINITIONS.find((model) => model.id === modelId);
}
