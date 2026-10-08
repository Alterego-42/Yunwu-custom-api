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

type OpenluxModelSpec = {
  id: string;
  /** 是否支持图生图（文档中两者都有独立演示时才为 true）。 */
  edit: boolean;
  defaultEnabled: boolean;
  description: string;
  /** 覆盖自动生成的显示名（版本号等需要保留原文时使用）。 */
  displayName?: string;
};

const OPENLUX_MODEL_SPECS: OpenluxModelSpec[] = [
  {
    id: "gpt-image-1",
    edit: true,
    defaultEnabled: false,
    displayName: "GPT Image 1",
    description: "OpenAI GPT Image 1：文生图与图生图，OpenAI Images 兼容接口。",
  },
  {
    id: "gpt-image-1.5",
    edit: true,
    defaultEnabled: true,
    displayName: "GPT Image 1.5",
    description: "OpenAI GPT Image 1.5：文生图与图生图，OpenAI Images 兼容接口。",
  },
  {
    id: "gpt-image-2",
    edit: true,
    defaultEnabled: true,
    displayName: "GPT Image 2",
    description: "OpenAI GPT Image 2：文生图与图生图，OpenAI Images 兼容接口。",
  },
  {
    id: "gpt-image-2.5-flare",
    edit: true,
    defaultEnabled: true,
    displayName: "GPT Image 2.5 Flare",
    description: "GPT Image 2.5 Flare：速度更快，适合日常高频生成。",
  },
  {
    id: "gpt-image-2.5-sunburst",
    edit: true,
    defaultEnabled: true,
    displayName: "GPT Image 2.5 Sunburst",
    description: "GPT Image 2.5 Sunburst：精度更高，适合细化与创意产出。",
  },
  {
    id: "grok-3-image",
    edit: true,
    defaultEnabled: true,
    description: "xAI Grok 3 Image：使用 aspect_ratio / resolution 参数，支持图生图。",
  },
  {
    id: "grok-imagine-image",
    edit: true,
    defaultEnabled: true,
    description: "xAI Grok Imagine Image：基础版，使用 aspect_ratio / resolution 参数。",
  },
  {
    id: "grok-imagine-image-2.0",
    edit: true,
    defaultEnabled: true,
    displayName: "Grok Imagine Image 2.0",
    description: "xAI Grok Imagine Image 2.0：新一代版本，使用 aspect_ratio / resolution 参数。",
  },
  {
    id: "grok-imagine-image-quality",
    edit: true,
    defaultEnabled: true,
    description: "xAI Grok Imagine Image Quality：更高画质，使用 aspect_ratio / resolution 参数。",
  },
  {
    id: "dall-e-3",
    edit: false,
    defaultEnabled: false,
    displayName: "DALL·E 3",
    description: "OpenAI DALL·E 3：仅文生图。",
  },
];

export const OPENLUX_PROVIDER_MODEL_IDS = OPENLUX_MODEL_SPECS.map(
  (spec) => spec.id,
) as readonly string[];

export const DEFAULT_OPENLUX_MODEL_IDS = OPENLUX_MODEL_SPECS.filter(
  (spec) => spec.defaultEnabled,
).map((spec) => spec.id) as readonly string[];

function resolveOpenluxModelCapabilities(edit: boolean): CapabilityType[] {
  return edit ? ["image.generate", "image.edit"] : ["image.generate"];
}

function formatOpenluxModelName(modelId: string) {
  // 不做点号切分，保留 gpt-image-1.5 / grok-imagine-image-2.0 这类版本号。
  return modelId
    .split(/[/_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export const OPENLUX_MODEL_DEFINITIONS: YunwuModelDefinition[] =
  OPENLUX_MODEL_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.displayName ?? formatOpenluxModelName(spec.id),
    family: "openai-images",
    capabilities: resolveOpenluxModelCapabilities(spec.edit),
    defaultEnabled: spec.defaultEnabled,
    taskSupported: true,
    description: spec.description,
  }));

export function getOpenluxModelDefinition(
  modelId: string,
): YunwuModelDefinition | undefined {
  return OPENLUX_MODEL_DEFINITIONS.find((model) => model.id === modelId);
}
