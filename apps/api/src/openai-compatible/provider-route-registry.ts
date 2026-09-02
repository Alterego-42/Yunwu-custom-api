import {
  APIXO_MODEL_DEFINITIONS,
  APIXO_PROVIDER,
  DEFAULT_APIXO_BASE_URL,
  DEFAULT_APIXO_MODEL_IDS,
} from "./apixo.model-registry";
import {
  DEFAULT_YUNWU_MODEL_IDS,
  YUNWU_MODEL_DEFINITIONS,
  type YunwuModelDefinition,
} from "./yunwu-model-registry";

export type ProviderRouteId = "yunwu" | "anyaigc" | "apixo";
export type ProviderAdapterType = "openai-compatible" | "apixo";

export interface ProviderRouteDefinition {
  id: ProviderRouteId;
  label: string;
  providerType: ProviderAdapterType;
  providerId: string;
  baseUrl: string;
  modelDefinitions: YunwuModelDefinition[];
  defaultModelIds: readonly string[];
}

export const PROVIDER_ROUTES: readonly ProviderRouteDefinition[] = [
  {
    id: "yunwu",
    label: "Yunwu",
    providerType: "openai-compatible",
    providerId: "openai-compatible",
    baseUrl: "https://yunwu.ai",
    modelDefinitions: YUNWU_MODEL_DEFINITIONS,
    defaultModelIds: DEFAULT_YUNWU_MODEL_IDS,
  },
  {
    id: "anyaigc",
    label: "AnyAIGC",
    providerType: "openai-compatible",
    providerId: "openai-compatible",
    baseUrl: "https://anyaigc.com",
    modelDefinitions: YUNWU_MODEL_DEFINITIONS,
    defaultModelIds: DEFAULT_YUNWU_MODEL_IDS,
  },
  {
    id: "apixo",
    label: "APIXO",
    providerType: "apixo",
    providerId: APIXO_PROVIDER,
    baseUrl: DEFAULT_APIXO_BASE_URL,
    modelDefinitions: APIXO_MODEL_DEFINITIONS,
    defaultModelIds: DEFAULT_APIXO_MODEL_IDS,
  },
] as const;

export function isProviderRouteId(value: unknown): value is ProviderRouteId {
  return PROVIDER_ROUTES.some((route) => route.id === value);
}

export function getProviderRoute(routeId: ProviderRouteId) {
  return PROVIDER_ROUTES.find((route) => route.id === routeId)!;
}

export function providerRouteIdFromLegacyBaseUrl(
  baseUrl: string | undefined,
): ProviderRouteId | undefined {
  const normalized = baseUrl?.trim().replace(/\/+$/, "");
  if (normalized === "https://yunwu.ai" || normalized === "https://api3.wlai.vip") {
    return "yunwu";
  }
  if (normalized === "https://anyaigc.com") {
    return "anyaigc";
  }
  if (normalized === "https://api.apixo.ai/api/v1") {
    return "apixo";
  }
  return undefined;
}
