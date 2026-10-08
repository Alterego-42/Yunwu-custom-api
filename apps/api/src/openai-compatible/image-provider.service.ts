import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APIXO_PROVIDER } from "./apixo.model-registry";
import { ApixoService } from "./apixo.service";
import {
  OpenAICompatibleImageRequest,
  OpenAICompatibleService,
} from "./openai-compatible.service";
import {
  getProviderRoute,
  isProviderRouteId,
  type ProviderRouteId,
} from "./provider-route-registry";

export type ImageProviderType = "apixo" | "openai-compatible";

export const OPENAI_COMPATIBLE_PROVIDER = "openai-compatible";

@Injectable()
export class ImageProviderService {
  constructor(
    private readonly config: ConfigService,
    private readonly openaiCompatible: OpenAICompatibleService,
    private readonly apixo: ApixoService,
  ) {}

  private route(routeId?: ProviderRouteId) {
    return getProviderRoute(routeId ?? this.defaultRouteId());
  }

  private defaultRouteId(): ProviderRouteId {
    const configured = this.config.get<string>("provider.type")?.trim().toLowerCase();
    if (isProviderRouteId(configured)) {
      return configured;
    }
    return configured === "openai-compatible" || configured === "yunwu" ? "anyaigc" : "apixo";
  }

  get providerType(): ImageProviderType {
    return this.route().providerType;
  }

  get providerId(): string {
    return this.route().providerId;
  }

  get modelDefinitions() {
    return this.route().modelDefinitions;
  }

  get defaultModelIds() {
    return this.route().defaultModelIds;
  }

  getModelDefinition(modelId: string) {
    return this.route().modelDefinitions.find((model) => model.id === modelId);
  }

  get baseUrlConfigurable() {
    return false;
  }

  async getProviderProfile(routeId?: ProviderRouteId) {
    const route = this.route(routeId);
    return route.providerType === "apixo"
      ? { ...this.apixo.getProviderProfile(), baseUrl: route.baseUrl }
      : { ...this.openaiCompatible.getProviderProfile(), baseUrl: route.baseUrl };
  }

  async getBaseConfig(routeId?: ProviderRouteId) {
    const route = this.route(routeId);
    return route.providerType === "apixo"
      ? { ...this.apixo.getBaseConfig(), baseUrl: route.baseUrl }
      : { ...this.openaiCompatible.getBaseConfig(), baseUrl: route.baseUrl };
  }

  async checkProviderModels(
    routeOrInput: ProviderRouteId | { baseUrl?: string; apiKey?: string | null } = this.defaultRouteId(),
    input?: { apiKey?: string | null },
  ) {
    const routeId = typeof routeOrInput === "string" ? routeOrInput : this.defaultRouteId();
    const effectiveInput = typeof routeOrInput === "string" ? input : routeOrInput;
    const route = this.route(routeId);
    const apiKey =
      effectiveInput?.apiKey === undefined
        ? (this.getServerApiKey(route.serverApiKeyConfigKey) ?? null)
        : effectiveInput.apiKey;
    return route.providerType === "apixo"
      ? this.apixo.checkProviderModels({ ...effectiveInput, apiKey })
      : this.openaiCompatible.checkProviderModels({ ...effectiveInput, apiKey, baseUrl: route.baseUrl });
  }

  async createImageTask(
    routeOrRequest: ProviderRouteId | OpenAICompatibleImageRequest,
    maybeRequest?: OpenAICompatibleImageRequest,
  ) {
    const routeId = typeof routeOrRequest === "string" ? routeOrRequest : this.defaultRouteId();
    const request = typeof routeOrRequest === "string" ? maybeRequest! : routeOrRequest;
    const route = this.route(routeId);
    // 未自带 key 时用该线路自己的服务端兜底 key，
    // 而不是让所有线路共用 yunwu.apiKey。
    const fallbackKey = this.getServerApiKey(route.serverApiKeyConfigKey);
    const apiKey = request.apiKey ?? fallbackKey;
    return route.providerType === "apixo"
      ? this.apixo.createImageTask({ ...request, apiKey })
      : this.openaiCompatible.createImageTask({ ...request, apiKey, baseUrl: route.baseUrl });
  }

  private getServerApiKey(configKey: string) {
    return this.config.get<string>(configKey)?.trim() || undefined;
  }
}
