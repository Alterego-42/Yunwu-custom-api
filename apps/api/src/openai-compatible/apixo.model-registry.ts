import type { CapabilityType } from "@yunwu/shared";
import type { YunwuModelDefinition } from "./yunwu-model-registry";

/**
 * APIXO Generation API（https://apixo.ai/docs）图像模型注册表。
 * 所有模型走统一的 generateTask/statusTask 异步任务流。
 */

export const DEFAULT_APIXO_BASE_URL = "https://api.apixo.ai/api/v1";

export const APIXO_PROVIDER = "apixo";

interface ApixoModelSpec {
  id: string;
  name: string;
  editSupported: boolean;
  defaultEnabled: boolean;
  description: string;
}

const APIXO_MODEL_SPECS: ApixoModelSpec[] = [
  {
    id: "nano-banana",
    name: "Nano Banana",
    editSupported: true,
    defaultEnabled: true,
    description: "Google 快速图像生成与参考图编辑模型。",
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    editSupported: true,
    defaultEnabled: true,
    description: "Google 专业图像模型，支持 4K 输出与多参考图编辑。",
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    editSupported: true,
    defaultEnabled: true,
    description: "Google 新一代图像生成与编辑模型。",
  },
  {
    id: "gpt-image-1",
    name: "GPT Image 1",
    editSupported: true,
    defaultEnabled: true,
    description: "OpenAI 图像生成与参考图引导创作模型。",
  },
  {
    id: "gpt-image-2",
    name: "GPT Image 2",
    editSupported: true,
    defaultEnabled: true,
    description: "OpenAI 图像生成与图生图模型。",
  },
  {
    id: "grok-image",
    name: "Grok Image",
    editSupported: true,
    defaultEnabled: true,
    description: "xAI 图像生成与图生图模型。",
  },
  {
    id: "flux-2",
    name: "Flux 2",
    editSupported: true,
    defaultEnabled: true,
    description: "Black Forest Labs 图像生成与图生图模型。",
  },
  {
    id: "flux-kontext",
    name: "Flux Kontext",
    editSupported: true,
    defaultEnabled: false,
    description: "Black Forest Labs 上下文感知图像生成与编辑模型。",
  },
  {
    id: "midjourney",
    name: "Midjourney",
    editSupported: true,
    defaultEnabled: false,
    description: "Midjourney 高级图像生成，支持文生图与图生图工作流。",
  },
  {
    id: "minimax-image-01",
    name: "MiniMax Image 01",
    editSupported: true,
    defaultEnabled: false,
    description: "MiniMax 图像生成与图生图模型。",
  },
  {
    id: "runway-gen4-image",
    name: "Runway Gen4 Image",
    editSupported: true,
    defaultEnabled: false,
    description: "Runway Gen4 图像生成与参考图引导模型。",
  },
  {
    id: "runway-gen4-image-turbo",
    name: "Runway Gen4 Image Turbo",
    editSupported: true,
    defaultEnabled: false,
    description: "Runway Gen4 快速图像生成模型。",
  },
  {
    id: "seedream-4-0",
    name: "Seedream 4.0",
    editSupported: true,
    defaultEnabled: true,
    description: "字节跳动 Seedream 4.0，支持 1K/2K/4K 输出预设。",
  },
  {
    id: "seedream-4-5",
    name: "Seedream 4.5",
    editSupported: true,
    defaultEnabled: false,
    description: "字节跳动 Seedream 4.5 高分辨率、多参考图模型。",
  },
  {
    id: "seedream-5-0",
    name: "Seedream 5.0",
    editSupported: true,
    defaultEnabled: false,
    description: "字节跳动 Seedream 5.0 图像生成与图生图模型。",
  },
  {
    id: "seedream-5-0-pro",
    name: "Seedream 5.0 Pro",
    editSupported: true,
    defaultEnabled: false,
    description: "字节跳动 Seedream 5.0 Pro 单图文生图与图生图模型。",
  },
  {
    id: "qwen-image",
    name: "Qwen Image",
    editSupported: true,
    defaultEnabled: false,
    description: "阿里 Qwen 图像生成模型。",
  },
  {
    id: "qwen-2-image",
    name: "Qwen 2 Image",
    editSupported: true,
    defaultEnabled: false,
    description: "阿里 Qwen 2 文生图模型，支持 standard/pro 模式。",
  },
  {
    id: "wan-2-5-image",
    name: "Wan 2.5 Image",
    editSupported: true,
    defaultEnabled: false,
    description: "阿里 Wan 2.5 图像模型。",
  },
];

export const DEFAULT_APIXO_MODEL_IDS = APIXO_MODEL_SPECS.filter(
  (model) => model.defaultEnabled,
).map((model) => model.id);

export const APIXO_MODEL_DEFINITIONS: YunwuModelDefinition[] =
  APIXO_MODEL_SPECS.map((model) => {
    const capabilities: CapabilityType[] = model.editSupported
      ? ["image.generate", "image.edit"]
      : ["image.generate"];

    return {
      id: model.id,
      name: model.name,
      family: "openai-images",
      capabilities,
      defaultEnabled: model.defaultEnabled,
      taskSupported: true,
      description: model.description,
    };
  });

export function getApixoModelDefinition(
  modelId: string,
): YunwuModelDefinition | undefined {
  return APIXO_MODEL_DEFINITIONS.find((model) => model.id === modelId);
}

/** 通用 size（如 1024x1024）/比例字符串 → APIXO aspect_ratio。 */
const APIXO_ASPECT_RATIOS = new Set([
  "1:1",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "auto",
]);

export function resolveApixoAspectRatio(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (APIXO_ASPECT_RATIOS.has(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return undefined;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) {
    return undefined;
  }

  const divisor = greatestCommonDivisor(width, height);
  const ratio = `${width / divisor}:${height / divisor}`;
  return APIXO_ASPECT_RATIOS.has(ratio) ? ratio : undefined;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}
