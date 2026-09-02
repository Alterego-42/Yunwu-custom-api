import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ProviderAdminError, ProviderModelsSource } from "@yunwu/shared";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { cwd } from "node:process";
import {
  DEFAULT_APIXO_BASE_URL,
  resolveApixoAspectRatio,
} from "./apixo.model-registry";
import {
  OpenAICompatibleImageRequest,
  OpenAICompatibleImageResult,
  OpenAICompatibleInputAsset,
  OpenAICompatibleRequestError,
  PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
} from "./openai-compatible.service";

/**
 * APIXO Generation API 上游（https://apixo.ai/docs/api-reference）。
 * 请求流：POST /generateTask/{model} → 轮询 GET /statusTask/{model}?taskId=...
 * 对外保持与 OpenAICompatibleService.createImageTask 相同的同步结果契约，
 * 轮询在服务内部完成。
 */

interface ApixoTaskStatus {
  taskId?: string;
  state?: string;
  resultJson?: string;
  failCode?: string;
  failMsg?: string;
  costTime?: number;
}

const POLL_INTERVAL_MS = 3_000;
const DEFAULT_POLL_TIMEOUT_MS = 600_000;
const SUBMIT_TIMEOUT_MS = 60_000;
const STATUS_TIMEOUT_MS = 30_000;
const MAX_REFERENCE_IMAGES = 5;

@Injectable()
export class ApixoService {
  private readonly logger = new Logger(ApixoService.name);

  constructor(private readonly config: ConfigService) {}

  getProviderProfile() {
    const apiKey = this.getApiKey();

    return {
      type: "apixo" as const,
      name: this.config.get<string>("apixo.providerName") ?? "APIXO",
      baseUrl: this.getBaseUrl(),
      apiKeyConfigured: Boolean(apiKey),
      ...(apiKey ? { maskedApiKey: this.maskSecret(apiKey) } : {}),
      mode: (apiKey ? "real" : "mock") as "real" | "mock",
    };
  }

  getBaseConfig() {
    const profile = this.getProviderProfile();

    return {
      baseUrl: profile.baseUrl,
      hasApiKey: profile.apiKeyConfigured,
    };
  }

  async checkProviderModels(input?: {
    baseUrl?: string;
    apiKey?: string | null;
  }): Promise<{
    baseUrlReachable: boolean;
    modelsSource: ProviderModelsSource;
    remoteModelIds?: string[];
    error?: ProviderAdminError;
  }> {
    // APIXO 无模型列表端点；用余额端点验证连通性与凭据。
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey(input?.apiKey);

    if (!apiKey) {
      const reachable = await this.probeBaseUrl(baseUrl);
      return {
        baseUrlReachable: reachable.ok,
        modelsSource: reachable.ok ? "configured" : "unavailable",
        error: reachable.ok
          ? {
              category: "missing_api_key",
              message: PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
              retryable: false,
            }
          : reachable.error,
      };
    }

    try {
      const response = await fetch(`${baseUrl}/apikeys/current-balance`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status === 401 || response.status === 403) {
        return {
          baseUrlReachable: true,
          modelsSource: "unavailable",
          error: {
            category: "provider_auth",
            message: "APIXO rejected the configured API key.",
            retryable: false,
            statusCode: response.status,
          },
        };
      }

      if (!response.ok && response.status !== 404) {
        return {
          baseUrlReachable: true,
          modelsSource: "unavailable",
          error: {
            category: "provider_unavailable",
            message: `APIXO balance check failed with HTTP ${response.status}.`,
            retryable: true,
            statusCode: response.status,
          },
        };
      }

      return { baseUrlReachable: true, modelsSource: "configured" };
    } catch (error) {
      return {
        baseUrlReachable: false,
        modelsSource: "unavailable",
        error: this.normalizeNetworkError(error),
      };
    }
  }

  async createImageTask(
    request: OpenAICompatibleImageRequest,
  ): Promise<OpenAICompatibleImageResult> {
    const apiKey = this.getApiKey(request.apiKey);

    if (!apiKey) {
      if (!(request.allowMock ?? this.allowMockImages())) {
        throw new Error(PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE);
      }

      return this.createMockImageResult(request);
    }

    const baseUrl = this.getBaseUrl();
    const input = await this.buildTaskInput(request);
    const taskId = await this.submitTask(baseUrl, apiKey, request.model, input);
    const status = await this.pollTask(baseUrl, apiKey, request.model, taskId);
    const resultUrls = this.parseResultUrls(status);
    const firstUrl = resultUrls[0];

    const responseSummary: Record<string, unknown> = {
      mode: "live",
      provider: "apixo",
      endpointPath: `/generateTask/${request.model}`,
      apixoTaskId: taskId,
      state: status.state,
      resultCount: resultUrls.length,
      hasUrl: Boolean(firstUrl),
      hasBase64: false,
      ...(status.costTime !== undefined ? { costTimeMs: status.costTime } : {}),
    };

    if (!firstUrl) {
      throw new OpenAICompatibleRequestError(
        "APIXO task succeeded but returned no result URLs.",
        { ...responseSummary, stage: "response_unparseable" },
      );
    }

    return {
      url: firstUrl,
      mimeType: this.mimeTypeFromUrl(firstUrl),
      width: 1024,
      height: 1024,
      responseSummary,
      mocked: false,
    };
  }

  private async buildTaskInput(request: OpenAICompatibleImageRequest) {
    const params = request.params ?? {};
    const aspectRatio =
      resolveApixoAspectRatio(params.aspect_ratio) ??
      resolveApixoAspectRatio(params.size);
    const outputFormat =
      typeof params.output_format === "string" &&
      ["png", "jpeg"].includes(params.output_format)
        ? params.output_format
        : undefined;

    const input: Record<string, unknown> = {
      mode: request.capability === "image.edit" ? "image-to-image" : "text-to-image",
      prompt: request.prompt,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...(outputFormat ? { output_format: outputFormat } : {}),
    };

    if (request.capability === "image.edit") {
      const assets = (request.inputAssets ?? []).slice(0, MAX_REFERENCE_IMAGES);
      if (assets.length === 0) {
        throw new Error("APIXO image edit requires at least one input asset.");
      }

      input.image_urls = await Promise.all(
        assets.map((asset, index) => this.resolveImageUrl(asset, index)),
      );
    }

    return input;
  }

  /**
   * image-to-image 参考图：优先使用可公开访问的 http(s) URL；
   * 本地存储资产降级为 data URL 内联传输。
   */
  private async resolveImageUrl(
    asset: OpenAICompatibleInputAsset,
    index: number,
  ): Promise<string> {
    if (asset.url && /^https?:\/\//i.test(asset.url) && !this.isLoopbackUrl(asset.url)) {
      return asset.url;
    }

    if (asset.storageKey && this.config.get<string>("storage.mode") === "local") {
      const localPath = join(this.getLocalStoragePath(), asset.storageKey);
      const buffer = await readFile(localPath);
      const mimeType = asset.mimeType ?? "image/png";
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    if (asset.url) {
      // 回环地址（桌面本机资产）：拉取后转 data URL。
      const response = await fetch(asset.url).catch(() => undefined);
      if (response?.ok) {
        const bytes = Buffer.from(await response.arrayBuffer());
        const mimeType =
          response.headers.get("content-type")?.split(";")[0].trim() ??
          asset.mimeType ??
          "image/png";
        return `data:${mimeType};base64,${bytes.toString("base64")}`;
      }
    }

    throw new Error(
      `Input asset ${asset.id || index + 1} could not be resolved for APIXO image edit.`,
    );
  }

  private async submitTask(
    baseUrl: string,
    apiKey: string,
    model: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const endpointPath = `/generateTask/${model}`;
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${endpointPath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_type: "async", input }),
        signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new OpenAICompatibleRequestError(
        `APIXO task submission failed before a response was received: ${this.errorMessage(error)}`,
        { mode: "live", provider: "apixo", endpointPath, stage: "request" },
      );
    }

    const payload = await this.readJson(response);
    if (!response.ok || typeof payload?.code !== "number" || payload.code !== 200) {
      const message =
        this.asString(payload?.message) ??
        `APIXO task submission failed with HTTP ${response.status}.`;
      throw new OpenAICompatibleRequestError(message, {
        mode: "live",
        provider: "apixo",
        endpointPath,
        statusCode: response.status,
        stage: "response_status",
      });
    }

    const taskId = this.asString(
      (payload.data as Record<string, unknown> | undefined)?.taskId,
    );
    if (!taskId) {
      throw new OpenAICompatibleRequestError(
        "APIXO task submission response did not include a taskId.",
        {
          mode: "live",
          provider: "apixo",
          endpointPath,
          statusCode: response.status,
          stage: "response_unparseable",
        },
      );
    }

    return taskId;
  }

  private async pollTask(
    baseUrl: string,
    apiKey: string,
    model: string,
    taskId: string,
  ): Promise<ApixoTaskStatus> {
    const endpointPath = `/statusTask/${model}`;
    const timeoutMs =
      this.config.get<number>("apixo.pollTimeoutMs") ?? DEFAULT_POLL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let consecutiveErrors = 0;

    while (Date.now() < deadline) {
      await this.delay(POLL_INTERVAL_MS);

      let status: ApixoTaskStatus | undefined;
      try {
        const response = await fetch(
          `${baseUrl}${endpointPath}?taskId=${encodeURIComponent(taskId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
          },
        );
        const payload = await this.readJson(response);
        if (!response.ok) {
          throw new Error(
            this.asString(payload?.message) ??
              `status poll failed with HTTP ${response.status}`,
          );
        }
        status = (payload?.data ?? undefined) as ApixoTaskStatus | undefined;
        consecutiveErrors = 0;
      } catch (error) {
        // 轮询期间的瞬时网络错误容忍重试，连续失败才判定任务失败。
        consecutiveErrors += 1;
        this.logger.warn(
          `APIXO status poll error (${consecutiveErrors}) for ${taskId}: ${this.errorMessage(error)}`,
        );
        if (consecutiveErrors >= 5) {
          throw new OpenAICompatibleRequestError(
            `APIXO task status polling failed repeatedly: ${this.errorMessage(error)}`,
            { mode: "live", provider: "apixo", endpointPath, stage: "request" },
          );
        }
        continue;
      }

      if (!status) {
        continue;
      }

      if (status.state === "success") {
        return status;
      }

      if (status.state === "failed") {
        const failMessage = status.failMsg
          ? `${status.failCode ?? "FAILED"}: ${status.failMsg}`
          : `APIXO task ${taskId} failed.`;
        throw new OpenAICompatibleRequestError(failMessage, {
          mode: "live",
          provider: "apixo",
          endpointPath,
          stage: "response_status",
          apixoTaskId: taskId,
          apixoFailCode: status.failCode,
        });
      }
    }

    throw new OpenAICompatibleRequestError(
      `APIXO task ${taskId} did not complete within ${Math.round(timeoutMs / 1000)}s.`,
      { mode: "live", provider: "apixo", endpointPath, stage: "request", errorKind: "timeout" },
    );
  }

  private parseResultUrls(status: ApixoTaskStatus): string[] {
    if (!status.resultJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(status.resultJson) as {
        resultUrls?: unknown;
      };
      if (Array.isArray(parsed.resultUrls)) {
        return parsed.resultUrls.filter(
          (url): url is string => typeof url === "string" && url.length > 0,
        );
      }
    } catch {
      this.logger.warn(`APIXO resultJson could not be parsed for ${status.taskId}.`);
    }

    return [];
  }

  private createMockImageResult(
    request: OpenAICompatibleImageRequest,
  ): OpenAICompatibleImageResult {
    const seed = encodeURIComponent(`${request.model}:${request.prompt}`);

    return {
      url: `https://picsum.photos/seed/${seed}/1024/1024`,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
      responseSummary: {
        mode: "mock",
        provider: "apixo",
        endpointPath: `/generateTask/${request.model}`,
        statusCode: 200,
        mocked: true,
        resultCount: 1,
        hasUrl: true,
        hasBase64: false,
      },
      mocked: true,
    };
  }

  private async probeBaseUrl(baseUrl: string): Promise<{
    ok: boolean;
    error?: ProviderAdminError;
  }> {
    try {
      await fetch(baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.normalizeNetworkError(error) };
    }
  }

  private normalizeNetworkError(error: unknown): ProviderAdminError {
    return {
      category: "provider_network",
      message: this.errorMessage(error) || "APIXO provider check failed.",
      retryable: true,
    };
  }

  private async readJson(
    response: Response,
  ): Promise<Record<string, unknown> | undefined> {
    try {
      const text = await response.text();
      return text.trim()
        ? (JSON.parse(text) as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  }

  private getBaseUrl() {
    const configured = this.config.get<string>("apixo.baseUrl")?.trim();
    return (configured || DEFAULT_APIXO_BASE_URL).replace(/\/+$/, "");
  }

  private getApiKey(override?: string | null) {
    const apiKey =
      override === undefined ? this.config.get<string>("apixo.apiKey") : override;
    return apiKey?.trim() || undefined;
  }

  private allowMockImages() {
    return this.config.get<boolean>("yunwu.allowMockImages") === true;
  }

  private getLocalStoragePath() {
    const configured = this.config.get<string>("storage.local.path");
    if (!configured) {
      return join(cwd(), "storage");
    }

    return isAbsolute(configured) ? resolve(configured) : join(cwd(), configured);
  }

  private isLoopbackUrl(url: string) {
    try {
      const { hostname } = new URL(url);
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.")
      );
    } catch {
      return true;
    }
  }

  private mimeTypeFromUrl(url: string) {
    const lower = url.split("?")[0].toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (lower.endsWith(".webp")) {
      return "image/webp";
    }
    return "image/png";
  }

  private maskSecret(value: string) {
    if (value.length <= 8) {
      return "****";
    }
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error ?? "");
  }

  private delay(ms: number) {
    return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
  }
}
