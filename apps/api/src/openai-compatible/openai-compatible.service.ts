import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  ProviderAdminError,
  ProviderMode,
  ProviderModelsSource,
} from "@yunwu/shared";
import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { cwd } from "node:process";

export interface OpenAICompatibleImageRequest {
  model: string;
  prompt: string;
  capability: "image.generate" | "image.edit";
  inputAssets?: OpenAICompatibleInputAsset[];
  params?: Record<string, unknown>;
}

export interface OpenAICompatibleInputAsset {
  id: string;
  url?: string | null;
  mimeType?: string | null;
  storageKey?: string | null;
}

export interface OpenAICompatibleImageResult {
  url: string;
  mimeType?: string;
  width?: number;
  height?: number;
  responseSummary: Record<string, unknown>;
  mocked: boolean;
}

export interface OpenAICompatibleProviderProfile {
  type: "openai-compatible";
  name: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  maskedApiKey?: string;
  mode: ProviderMode;
}

export interface OpenAICompatibleProviderProbeResult {
  baseUrlReachable: boolean;
  modelsSource: ProviderModelsSource;
  remoteModelIds?: string[];
  error?: ProviderAdminError;
}

interface S3ReadConfig {
  endpoint?: string;
  region: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
}

export class OpenAICompatibleRequestError extends Error {
  constructor(
    message: string,
    readonly responseSummary: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OpenAICompatibleRequestError";
  }
}

@Injectable()
export class OpenAICompatibleService {
  constructor(private readonly config: ConfigService) {}

  getProviderProfile(): OpenAICompatibleProviderProfile {
    const apiKey = this.getApiKey();

    return {
      type: "openai-compatible",
      name:
        this.config.get<string>("yunwu.providerName") ?? "OpenAI-compatible",
      baseUrl: this.getResolvedBaseUrl(),
      apiKeyConfigured: Boolean(apiKey),
      ...(apiKey ? { maskedApiKey: this.maskSecret(apiKey) } : {}),
      mode: apiKey ? "real" : "mock",
    };
  }

  getBaseConfig() {
    const profile = this.getProviderProfile();

    return {
      baseUrl: profile.baseUrl,
      hasApiKey: profile.apiKeyConfigured,
    };
  }

  async checkProviderModels(): Promise<OpenAICompatibleProviderProbeResult> {
    const baseUrl = this.getResolvedBaseUrl();
    const apiKey = this.getApiKey();
    const baseProbe = await this.probeBaseUrl(baseUrl);

    if (!baseProbe.baseUrlReachable) {
      return {
        baseUrlReachable: false,
        modelsSource: "unavailable",
        error: baseProbe.error,
      };
    }

    if (!apiKey) {
      return {
        baseUrlReachable: true,
        modelsSource: "configured",
        error: {
          category: "missing_api_key",
          message: "Provider API key is not configured; mock mode is active.",
          retryable: false,
        },
      };
    }

    return {
      baseUrlReachable: true,
      ...(await this.probeModelList(baseUrl, apiKey)),
    };
  }

  async createImageTask(
    request: OpenAICompatibleImageRequest,
  ): Promise<OpenAICompatibleImageResult> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      return this.createMockImageResult(request);
    }

    const baseUrl = this.getResolvedBaseUrl();
    const endpointPath =
      request.capability === "image.edit"
        ? "/v1/images/edits"
        : "/v1/images/generations";
    const endpoint = `${baseUrl}${endpointPath}`;

    const response =
      request.capability === "image.edit"
        ? await this.submitImageEditRequest(endpoint, apiKey, request)
        : await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: request.model,
              prompt: request.prompt,
              ...request.params,
            }),
          });

    const payload = (await response.json().catch(() => ({}))) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    };
    const responseSummary = this.toResponseSummary(
      "live",
      endpointPath,
      response.status,
      payload,
    );

    if (!response.ok) {
      throw new OpenAICompatibleRequestError(
        payload.error?.message ??
          `OpenAI-compatible image request failed with ${response.status}`,
        responseSummary,
      );
    }

    const firstImage = payload.data?.[0];
    if (!firstImage?.url && !firstImage?.b64_json) {
      throw new Error("OpenAI-compatible image response did not include data.");
    }

    return {
      url: firstImage.url ?? `data:image/png;base64,${firstImage.b64_json}`,
      mimeType: "image/png",
      width: this.resolveImageDimension(request.params, "width") ?? 1024,
      height: this.resolveImageDimension(request.params, "height") ?? 1024,
      responseSummary,
      mocked: false,
    };
  }

  private async submitImageEditRequest(
    endpoint: string,
    apiKey: string,
    request: OpenAICompatibleImageRequest,
  ) {
    const formData = new FormData();

    formData.append("model", request.model);
    formData.append("prompt", request.prompt);
    this.appendFormDataParams(formData, request.params);

    const inputAssets = request.inputAssets ?? [];
    if (inputAssets.length === 0) {
      throw new Error("OpenAI-compatible image edit requires at least one input asset.");
    }

    const imageFiles = await Promise.all(
      inputAssets.map((asset, index) => this.loadInputAssetFile(asset, index)),
    );
    for (const imageFile of imageFiles) {
      formData.append("image", imageFile, imageFile.name);
    }

    return fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });
  }

  private async probeBaseUrl(baseUrl: string): Promise<{
    baseUrlReachable: boolean;
    error?: ProviderAdminError;
  }> {
    try {
      await fetch(baseUrl, {
        method: "GET",
        signal: AbortSignal.timeout(5_000),
      });

      return { baseUrlReachable: true };
    } catch (error) {
      return {
        baseUrlReachable: false,
        error: this.normalizeProviderError(error, "provider_network"),
      };
    }
  }

  private async probeModelList(
    baseUrl: string,
    apiKey: string,
  ): Promise<Omit<OpenAICompatibleProviderProbeResult, "baseUrlReachable">> {
    const endpoint = `${baseUrl}/v1/models`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5_000),
      });

      if (response.status === 404 || response.status === 405) {
        return { modelsSource: "configured" };
      }

      const payload = (await response.json().catch(() => ({}))) as {
        data?: Array<{ id?: unknown }>;
        error?: { message?: unknown };
      };

      if (!response.ok) {
        return {
          modelsSource: "unavailable",
          error: this.normalizeProviderHttpError(response.status, payload),
        };
      }

      if (!Array.isArray(payload.data)) {
        return {
          modelsSource: "unavailable",
          error: {
            category: "invalid_response",
            message: "Provider model list response was not recognized.",
            retryable: true,
            statusCode: response.status,
          },
        };
      }

      return {
        modelsSource: "remote",
        remoteModelIds: payload.data
          .map((model) => model.id)
          .filter((id): id is string => typeof id === "string"),
      };
    } catch (error) {
      return {
        modelsSource: "unavailable",
        error: this.normalizeProviderError(error, "provider_network"),
      };
    }
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
        endpointPath:
          request.capability === "image.edit"
            ? "/v1/images/edits"
            : "/v1/images/generations",
        statusCode: 200,
        mocked: true,
        resultCount: 1,
        hasUrl: true,
        hasBase64: false,
      },
      mocked: true,
    };
  }

  private toResponseSummary(
    mode: "live" | "mock",
    endpointPath: string,
    statusCode: number,
    payload: { data?: Array<{ url?: string; b64_json?: string }>; error?: { message?: string } },
  ) {
    const firstImage = payload.data?.[0];

    return {
      mode,
      endpointPath,
      statusCode,
      resultCount: payload.data?.length ?? 0,
      hasUrl: Boolean(firstImage?.url),
      hasBase64: Boolean(firstImage?.b64_json),
      errorMessage: payload.error?.message,
    };
  }

  private appendFormDataParams(
    formData: FormData,
    params?: Record<string, unknown>,
  ) {
    if (!params) {
      return;
    }

    for (const [key, value] of Object.entries(params)) {
      if (
        value === undefined ||
        value === null ||
        key === "image" ||
        key === "image_urls" ||
        key === "assetIds"
      ) {
        continue;
      }

      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        formData.append(key, String(value));
      }
    }
  }

  private async loadInputAssetFile(
    asset: OpenAICompatibleInputAsset,
    index: number,
  ): Promise<File> {
    const fileName = this.buildInputAssetFileName(asset, index);

    if (asset.url) {
      const remoteFile = await this.fetchRemoteFile(asset.url, fileName).catch(
        () => undefined,
      );
      if (remoteFile) {
        return remoteFile;
      }
    }

    if (asset.storageKey && this.config.get<string>("storage.mode") === "local") {
      const localPath = join(this.getLocalStoragePath(), asset.storageKey);
      const buffer = await readFile(localPath);

      return new File([buffer], fileName, {
        type: asset.mimeType ?? this.mimeTypeFromFileName(fileName),
      });
    }

    if (asset.storageKey) {
      const s3File = await this.fetchS3Object(asset.storageKey, fileName).catch(
        () => undefined,
      );
      if (s3File) {
        return s3File;
      }
    }

    throw new Error(
      `Input asset ${asset.id} could not be resolved for multipart image edit.`,
    );
  }

  private async fetchRemoteFile(url: string, fileName: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch input asset from ${response.status}.`);
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0].trim() ??
      this.mimeTypeFromFileName(fileName);
    const bytes = await response.arrayBuffer();

    return new File([bytes], fileName, {
      type: contentType,
    });
  }

  private buildInputAssetFileName(
    asset: OpenAICompatibleInputAsset,
    index: number,
  ) {
    const storageKeyName = asset.storageKey?.split("/").pop();
    if (storageKeyName) {
      return storageKeyName;
    }

    const extension = this.extensionFromMimeType(asset.mimeType);
    return `input-${index + 1}.${extension}`;
  }

  private getLocalStoragePath() {
    const configured = this.config.get<string>("storage.local.path");
    if (!configured) {
      return join(cwd(), "storage");
    }

    return isAbsolute(configured) ? resolve(configured) : join(cwd(), configured);
  }

  private getApiKey() {
    const apiKey = this.config.get<string>("yunwu.apiKey");
    return apiKey?.trim() || undefined;
  }

  private getResolvedBaseUrl() {
    return (
      this.config.get<string>("yunwu.baseUrl")?.replace(/\/$/, "") ??
      "https://api.openai.com"
    );
  }

  private maskSecret(value: string) {
    if (value.length <= 8) {
      return "****";
    }

    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  private normalizeProviderHttpError(
    statusCode: number,
    payload: { error?: { message?: unknown } },
  ): ProviderAdminError {
    const upstreamMessage =
      typeof payload.error?.message === "string"
        ? this.sanitizeDisplayText(payload.error.message, 240)
        : undefined;

    if (statusCode === 401 || statusCode === 403) {
      return {
        category: "provider_auth",
        message:
          upstreamMessage ??
          "Provider rejected the configured credentials or permissions.",
        retryable: false,
        statusCode,
      };
    }

    if (statusCode === 429) {
      return {
        category: "provider_unavailable",
        message: "Provider is rate limited. Please retry later.",
        retryable: true,
        statusCode,
      };
    }

    if (statusCode >= 500) {
      return {
        category: "provider_unavailable",
        message: "Provider returned a temporary server error.",
        retryable: true,
        statusCode,
      };
    }

    return {
      category: "invalid_response",
      message:
        upstreamMessage ??
        `Provider model check failed with HTTP ${statusCode}.`,
      retryable: false,
      statusCode,
    };
  }

  private normalizeProviderError(
    error: unknown,
    fallbackCategory: ProviderAdminError["category"],
  ): ProviderAdminError {
    const rawMessage =
      error instanceof Error ? error.message : "Provider check failed.";

    return {
      category: /timeout|timed out|network|fetch failed|ECONNRESET|ENOTFOUND/i.test(
        rawMessage,
      )
        ? "provider_network"
        : fallbackCategory,
      message:
        this.sanitizeDisplayText(rawMessage, 240) ||
        "Provider check failed.",
      retryable: true,
    };
  }

  private async fetchS3Object(storageKey: string, fileName: string) {
    const s3 = this.getS3Config();
    if (!this.isS3Configured(s3)) {
      return undefined;
    }

    const request = this.buildS3GetRequest(storageKey, s3);
    const response = await fetch(request.url, {
      method: "GET",
      headers: request.headers,
    });
    if (!response.ok) {
      throw new Error(`S3 asset read failed with status ${response.status}.`);
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0].trim() ??
      this.mimeTypeFromFileName(fileName);
    const bytes = await response.arrayBuffer();

    return new File([bytes], fileName, {
      type: contentType,
    });
  }

  private buildS3GetRequest(storageKey: string, s3: S3ReadConfig) {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const host = this.getS3Host(s3);
    const pathname = this.getS3ObjectPath(storageKey, s3);
    const payloadHash = this.sha256Hex("");
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      "GET",
      pathname,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const credentialScope = `${dateStamp}/${s3.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join("\n");
    const signingKey = this.getSigningKey(
      s3.secretAccessKey!,
      dateStamp,
      s3.region,
      "s3",
    );
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign)
      .digest("hex");
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${s3.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      url: this.getS3RequestUrl(storageKey, s3),
      headers: {
        authorization,
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
    };
  }

  private getS3Config(): S3ReadConfig {
    return {
      endpoint: this.config.get<string>("storage.s3.endpoint") ?? undefined,
      region: this.config.get<string>("storage.s3.region") ?? "us-east-1",
      bucket: this.config.get<string>("storage.s3.bucket") ?? undefined,
      accessKeyId:
        this.config.get<string>("storage.s3.accessKeyId") ?? undefined,
      secretAccessKey:
        this.config.get<string>("storage.s3.secretAccessKey") ?? undefined,
      forcePathStyle:
        this.config.get<boolean>("storage.s3.forcePathStyle") ?? true,
    };
  }

  private isS3Configured(s3: S3ReadConfig) {
    return Boolean(
      s3.bucket &&
        s3.accessKeyId &&
        s3.secretAccessKey &&
        (s3.endpoint || s3.region),
    );
  }

  private getS3RequestUrl(storageKey: string, s3: S3ReadConfig) {
    if (s3.endpoint) {
      const normalized = s3.endpoint.replace(/\/$/, "");
      if (s3.forcePathStyle) {
        return `${normalized}/${s3.bucket}/${encodeURIComponent(storageKey)}`;
      }

      const endpointUrl = new URL(normalized);
      return `${endpointUrl.protocol}//${s3.bucket}.${endpointUrl.host}/${encodeURIComponent(
        storageKey,
      )}`;
    }

    return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${encodeURIComponent(
      storageKey,
    )}`;
  }

  private getS3ObjectPath(storageKey: string, s3: S3ReadConfig) {
    const encodedKey = encodeURIComponent(storageKey);
    return s3.forcePathStyle ? `/${s3.bucket}/${encodedKey}` : `/${encodedKey}`;
  }

  private getS3Host(s3: S3ReadConfig) {
    if (s3.endpoint) {
      const endpointUrl = new URL(s3.endpoint);
      return s3.forcePathStyle
        ? endpointUrl.host
        : `${s3.bucket}.${endpointUrl.host}`;
    }

    return `${s3.bucket}.s3.${s3.region}.amazonaws.com`;
  }

  private formatAmzDate(value: Date) {
    return value.toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private sha256Hex(value: string | Buffer) {
    return createHash("sha256").update(value).digest("hex");
  }

  private getSigningKey(
    secretAccessKey: string,
    date: string,
    region: string,
    service: string,
  ) {
    const kDate = createHmac("sha256", `AWS4${secretAccessKey}`)
      .update(date)
      .digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update(service).digest();
    return createHmac("sha256", kService).update("aws4_request").digest();
  }

  private resolveImageDimension(
    params: Record<string, unknown> | undefined,
    key: "width" | "height",
  ) {
    const direct = this.asNumber(params?.[key]);
    if (direct) {
      return direct;
    }

    const size = typeof params?.size === "string" ? params.size : undefined;
    if (!size) {
      return undefined;
    }

    const match = size.match(/^(\d+)x(\d+)$/i);
    if (!match) {
      return undefined;
    }

    return Number(key === "width" ? match[1] : match[2]);
  }

  private extensionFromMimeType(mimeType?: string | null) {
    switch (mimeType) {
      case "image/jpeg":
        return "jpg";
      case "image/webp":
        return "webp";
      case "image/gif":
        return "gif";
      default:
        return "png";
    }
  }

  private mimeTypeFromFileName(fileName: string) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (lowerName.endsWith(".webp")) {
      return "image/webp";
    }
    if (lowerName.endsWith(".gif")) {
      return "image/gif";
    }

    return "image/png";
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === "number" ? value : undefined;
  }

  private sanitizeDisplayText(value: string, maxLength: number) {
    const sanitized = value
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-api-key]")
      .replace(
        /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        "[redacted-token]",
      )
      .replace(
        /\b(api[_-]?key|token|authorization|password|secret)=([^&\s]+)/gi,
        "$1=[redacted]",
      )
      .replace(/[A-Za-z0-9+/=_-]{64,}/g, "[redacted-token]");

    return this.truncateText(sanitized.trim(), maxLength);
  }

  private truncateText(value: string, maxLength: number) {
    return value.length > maxLength
      ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
      : value;
  }
}
