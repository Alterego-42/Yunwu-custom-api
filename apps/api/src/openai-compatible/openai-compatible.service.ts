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
import { ProviderConfigurationService } from "./provider-configuration.service";

export interface OpenAICompatibleImageRequest {
  model: string;
  prompt: string;
  capability: "image.generate" | "image.edit";
  baseUrl?: string;
  apiKey?: string;
  allowMock?: boolean;
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

interface ExtractedImageResult {
  url?: string;
  b64_json?: string;
  mimeType?: string;
}

const RESERVED_IMAGE_REQUEST_PARAM_KEYS = new Set([
  "model",
  "prompt",
  "image",
  "images",
  "image_url",
  "image_urls",
  "assetId",
  "assetIds",
  "inputAssets",
  "baseUrl",
  "providerBaseUrl",
]);

export const PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE =
  "Provider API key is not configured; real image generation is unavailable.";

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
  constructor(
    private readonly config: ConfigService,
    private readonly providerConfig: ProviderConfigurationService,
  ) {}

  async getProviderProfile(): Promise<OpenAICompatibleProviderProfile> {
    const apiKey = this.getApiKey();

    return {
      type: "openai-compatible",
      name:
        this.config.get<string>("yunwu.providerName") ?? "OpenAI-compatible",
      baseUrl: await this.getResolvedBaseUrl(),
      apiKeyConfigured: Boolean(apiKey),
      ...(apiKey ? { maskedApiKey: this.maskSecret(apiKey) } : {}),
      mode: apiKey ? "real" : "mock",
    };
  }

  async getBaseConfig() {
    const profile = await this.getProviderProfile();

    return {
      baseUrl: profile.baseUrl,
      hasApiKey: profile.apiKeyConfigured,
    };
  }

  async checkProviderModels(input?: {
    baseUrl?: string;
    apiKey?: string | null;
  }): Promise<OpenAICompatibleProviderProbeResult> {
    const baseUrl = await this.getResolvedBaseUrl(input?.baseUrl);
    const apiKey = this.getApiKey(input?.apiKey);
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
          message: PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
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
    const apiKey = this.getApiKey(request.apiKey);

    if (!apiKey) {
      if (!(request.allowMock ?? this.allowMockImages())) {
        throw new Error(PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE);
      }

      return this.createMockImageResult(request);
    }

    const baseUrl = await this.getResolvedBaseUrl(request.baseUrl);
    const usesGeminiImageEdit = this.isGeminiImageEditRequest(request);
    const endpointPath = this.resolveImageEndpointPath(request);
    const endpoint = `${baseUrl}${endpointPath}`;

    const response =
      usesGeminiImageEdit
        ? await this.submitGeminiImageEditRequest(endpoint, apiKey, request)
        : request.capability === "image.edit"
        ? await this.submitImageEditRequest(endpoint, apiKey, request)
        : await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...this.sanitizeImageRequestParams(request.params),
              model: request.model,
              prompt: request.prompt,
            }),
          });

    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const responseSummary = this.toResponseSummary(
      "live",
      endpointPath,
      response.status,
      payload,
    );

    if (!response.ok) {
      const error = this.asRecord(payload.error);
      const errorMessage = this.asString(error?.message);

      throw new OpenAICompatibleRequestError(
        errorMessage ??
          `OpenAI-compatible image request failed with ${response.status}`,
        responseSummary,
      );
    }

    const firstImage = this.extractImageResult(payload);
    if (!firstImage?.url && !firstImage?.b64_json) {
      throw new OpenAICompatibleRequestError(
        `OpenAI-compatible image response did not include data. Response shape: ${JSON.stringify(
          responseSummary.shapeHints,
        )}`,
        responseSummary,
      );
    }

    return {
      url:
        firstImage.url ??
        `data:${firstImage.mimeType ?? "image/png"};base64,${firstImage.b64_json}`,
      mimeType: firstImage.mimeType ?? "image/png",
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
    this.appendFormDataParams(
      formData,
      this.sanitizeImageRequestParams(request.params),
    );

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

  private async submitGeminiImageEditRequest(
    endpoint: string,
    apiKey: string,
    request: OpenAICompatibleImageRequest,
  ) {
    const inputAssets = request.inputAssets ?? [];
    if (inputAssets.length === 0) {
      throw new Error("Gemini image edit requires at least one input asset.");
    }

    const imageFiles = await Promise.all(
      inputAssets.map((asset, index) => this.loadInputAssetFile(asset, index)),
    );
    const imageContents = await Promise.all(
      imageFiles.map(async (imageFile) => ({
        type: "image_url",
        image_url: {
          url: await this.fileToDataUrl(imageFile),
        },
      })),
    );

    return fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...this.sanitizeImageRequestParams(request.params),
        model: request.model,
        messages: [
          {
            role: "user",
            // Yunwu Gemini image edit converts through Gemini multimodal chat;
            // the Images multipart edit endpoint fails provider conversion.
            content: [
              {
                type: "text",
                text: request.prompt,
              },
              ...imageContents,
            ],
          },
        ],
      }),
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
        endpointPath: this.resolveImageEndpointPath(request),
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
    payload: Record<string, unknown>,
  ) {
    const data = this.asRecordArray(payload.data);
    const firstImage = this.extractImageResult(payload);
    const error = this.asRecord(payload.error);

    return {
      mode,
      endpointPath,
      statusCode,
      resultCount: data?.length ?? (firstImage ? 1 : 0),
      hasUrl: Boolean(firstImage?.url),
      hasBase64: Boolean(firstImage?.b64_json),
      errorMessage: this.asString(error?.message),
      shapeHints: firstImage ? undefined : this.buildResponseShapeHints(payload),
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

  private sanitizeImageRequestParams(params?: Record<string, unknown>) {
    if (!params) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(params).filter(
        ([key, value]) =>
          !RESERVED_IMAGE_REQUEST_PARAM_KEYS.has(key) &&
          value !== undefined &&
          value !== null,
      ),
    );
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

  private async fileToDataUrl(file: File) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || this.mimeTypeFromFileName(file.name);

    return `data:${mimeType};base64,${bytes.toString("base64")}`;
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

  private getApiKey(override?: string | null) {
    const apiKey =
      override === undefined ? this.config.get<string>("yunwu.apiKey") : override;
    return apiKey?.trim() || undefined;
  }

  private allowMockImages() {
    return this.config.get<boolean>("yunwu.allowMockImages") === true;
  }

  private getResolvedBaseUrl(baseUrlOverride?: string) {
    const normalizedOverride = this.normalizeBaseUrl(baseUrlOverride);
    if (normalizedOverride) {
      return normalizedOverride;
    }

    return this.providerConfig.getBaseUrl();
  }

  private normalizeBaseUrl(baseUrl?: string) {
    const normalized = baseUrl?.trim().replace(/\/+$/, "");
    if (!normalized) {
      return undefined;
    }

    return normalized.replace(/\/v1$/i, "");
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

  private isGeminiImageEditRequest(request: OpenAICompatibleImageRequest) {
    return request.capability === "image.edit" && request.model.startsWith("gemini-");
  }

  private resolveImageEndpointPath(request: OpenAICompatibleImageRequest) {
    if (this.isGeminiImageEditRequest(request)) {
      return "/v1/chat/completions";
    }

    return request.capability === "image.edit"
      ? "/v1/images/edits"
      : "/v1/images/generations";
  }

  private extractImageResult(payload: unknown): ExtractedImageResult | undefined {
    const direct = this.extractImageFromValue(payload);
    if (direct) {
      return direct;
    }

    const record = this.asRecord(payload);
    const choices = this.asRecordArray(record?.choices);
    for (const choice of choices ?? []) {
      const messageImage = this.extractImageFromValue(choice.message);
      if (messageImage) {
        return messageImage;
      }

      const deltaImage = this.extractImageFromValue(choice.delta);
      if (deltaImage) {
        return deltaImage;
      }
    }

    return undefined;
  }

  private extractImageFromValue(value: unknown): ExtractedImageResult | undefined {
    if (typeof value === "string") {
      return this.extractImageFromString(value);
    }

    const record = this.asRecord(value);
    if (!record) {
      return undefined;
    }

    const inlineData =
      this.asRecord(record.inline_data) ?? this.asRecord(record.inlineData);
    if (inlineData) {
      const image = this.extractGeminiInlineData(inlineData);
      if (image) {
        return image;
      }
    }

    const fileData =
      this.asRecord(record.file_data) ?? this.asRecord(record.fileData);
    if (fileData) {
      const image = this.extractGeminiFileData(fileData);
      if (image) {
        return image;
      }
    }

    const mimeType =
      this.asString(record.mimeType) ??
      this.asString(record.mime_type) ??
      this.asString(record.type);
    const url =
      this.asString(record.url) ??
      this.asString(record.uri) ??
      this.asString(record.file_uri) ??
      this.asString(record.fileUri) ??
      this.asString(record.imageUrl) ??
      this.extractImageUrlValue(record.image_url) ??
      this.extractImageUrlValue(record.input_image) ??
      this.extractImageUrlValue(record.output_image) ??
      this.extractImageUrlValue(record.image);
    const b64_json =
      this.asString(record.b64_json) ??
      this.asString(record.base64) ??
      this.asImageBase64(record.data, mimeType);
    const resolvedMimeType =
      (mimeType?.startsWith("image/") ? mimeType : undefined) ??
      this.extractDataUrlMimeType(url);
    if (url || b64_json) {
      return {
        ...(url ? { url } : {}),
        ...(b64_json ? { b64_json } : {}),
        ...(resolvedMimeType ? { mimeType: resolvedMimeType } : {}),
      };
    }

    const source = this.asRecord(record.source);
    const sourceData = this.asString(source?.data);
    if (sourceData) {
      return {
        b64_json: sourceData,
        mimeType: this.asString(source?.media_type) ?? "image/png",
      };
    }

    for (const key of ["data", "images", "content", "output", "parts"]) {
      const image = this.extractImageFromArray(record[key]);
      if (image) {
        return image;
      }

      if (key !== "data") {
        const nestedImage = this.extractImageFromValue(record[key]);
        if (nestedImage) {
          return nestedImage;
        }
      }
    }

    return undefined;
  }

  private extractImageFromArray(value: unknown): ExtractedImageResult | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    for (const item of value) {
      const image = this.extractImageFromValue(item);
      if (image) {
        return image;
      }
    }

    return undefined;
  }

  private extractImageUrlValue(value: unknown): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    const record = this.asRecord(value);
    if (!record) {
      return undefined;
    }

    return (
      this.asString(record.url) ??
      this.asString(record.uri) ??
      this.asString(record.file_uri) ??
      this.asString(record.fileUri) ??
      this.asString(record.imageUrl)
    );
  }

  private extractImageFromString(value: string): ExtractedImageResult | undefined {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return this.extractImageFromValue(JSON.parse(trimmed));
      } catch {
        return undefined;
      }
    }

    const dataUrl = trimmed.match(
      /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=_-]+/i,
    )?.[0];
    if (dataUrl) {
      return {
        url: dataUrl,
        mimeType: this.extractDataUrlMimeType(dataUrl),
      };
    }

    const url = trimmed.match(/https?:\/\/[^\s"'<>),]+/i)?.[0];
    return url ? { url } : undefined;
  }

  private extractGeminiInlineData(
    record: Record<string, unknown>,
  ): ExtractedImageResult | undefined {
    const mimeType =
      this.asString(record.mime_type) ?? this.asString(record.mimeType);
    const data = this.asImageBase64(record.data, mimeType);

    return data
      ? {
          b64_json: data,
          mimeType: mimeType?.startsWith("image/") ? mimeType : "image/png",
        }
      : undefined;
  }

  private extractGeminiFileData(
    record: Record<string, unknown>,
  ): ExtractedImageResult | undefined {
    const url =
      this.asString(record.file_uri) ??
      this.asString(record.fileUri) ??
      this.asString(record.url) ??
      this.asString(record.uri) ??
      this.asString(record.imageUrl);
    const mimeType =
      this.asString(record.mime_type) ?? this.asString(record.mimeType);

    return url
      ? {
          url,
          ...(mimeType?.startsWith("image/") ? { mimeType } : {}),
        }
      : undefined;
  }

  private asImageBase64(
    value: unknown,
    mimeType?: string,
  ): string | undefined {
    const text = this.asString(value)?.trim();
    if (!text) {
      return undefined;
    }

    if (mimeType?.startsWith("image/")) {
      return text;
    }

    if (
      text.length >= 96 &&
      text.length % 4 === 0 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(text)
    ) {
      return text;
    }

    return undefined;
  }

  private extractDataUrlMimeType(value?: string) {
    return value?.match(/^data:([^;,]+)[;,]/)?.[1];
  }

  private buildResponseShapeHints(payload: Record<string, unknown>) {
    const choices = this.asRecordArray(payload.choices);
    const firstChoice = choices?.[0];
    const message = this.asRecord(firstChoice?.message);
    const content = message?.content;
    const output = Array.isArray(payload.output) ? payload.output : undefined;
    const directContent = Array.isArray(payload.content)
      ? payload.content
      : undefined;

    return {
      topLevelKeys: Object.keys(payload).slice(0, 20),
      choiceCount: choices?.length ?? 0,
      firstChoiceKeys: firstChoice ? Object.keys(firstChoice).slice(0, 20) : [],
      messageKeys: message ? Object.keys(message).slice(0, 20) : [],
      messageContentType: this.describeValueType(content),
      messageContentItemTypes: Array.isArray(content)
        ? content.slice(0, 5).map((item) => this.describeContentItem(item))
        : undefined,
      hasMessageText:
        typeof content === "string"
          ? content.trim().length > 0
          : Array.isArray(content)
          ? content.some((item) => typeof this.asRecord(item)?.text === "string")
          : false,
      outputCount: output?.length ?? 0,
      outputContentItemTypes: output
        ?.slice(0, 3)
        .map((item) => this.describeNestedContentTypes(item)),
      contentItemTypes: directContent
        ?.slice(0, 5)
        .map((item) => this.describeContentItem(item)),
    };
  }

  private describeNestedContentTypes(value: unknown) {
    const record = this.asRecord(value);
    const content = record?.content;
    return {
      keys: record ? Object.keys(record).slice(0, 20) : [],
      contentType: this.describeValueType(content),
      contentItemTypes: Array.isArray(content)
        ? content.slice(0, 5).map((item) => this.describeContentItem(item))
        : undefined,
    };
  }

  private describeContentItem(value: unknown) {
    const record = this.asRecord(value);
    if (!record) {
      return this.describeValueType(value);
    }

    return {
      type: this.asString(record.type),
      keys: Object.keys(record).slice(0, 20),
      hasText: typeof record.text === "string" && record.text.length > 0,
    };
  }

  private describeValueType(value: unknown) {
    if (Array.isArray(value)) {
      return "array";
    }

    if (value === null) {
      return "null";
    }

    return typeof value;
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private asRecordArray(value: unknown): Record<string, unknown>[] | undefined {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> =>
          Boolean(this.asRecord(item)),
        )
      : undefined;
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
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
