import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac } from "node:crypto";
import type {
  AssetContentResolution,
  StoreAssetInput,
  StoredAssetLocation,
} from "./asset-storage.types";

interface S3Config {
  endpoint?: string;
  region: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
  forcePathStyle: boolean;
}

@Injectable()
export class S3AssetStorageService {
  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    const s3 = this.getConfig();
    return Boolean(s3.bucket && s3.accessKeyId && s3.secretAccessKey && (s3.endpoint || s3.region));
  }

  async store(input: StoreAssetInput): Promise<StoredAssetLocation> {
    const s3 = this.getConfig();
    if (!this.isEnabled() || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error("S3 storage is not fully configured.");
    }

    const request = this.buildPutRequest(input, s3);
    const response = await fetch(request.url, {
      method: "PUT",
      headers: request.headers,
      body: new Uint8Array(input.buffer),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `S3 upload failed with status ${response.status}${body ? `: ${body}` : ""}`,
      );
    }

    return {
      kind: "s3",
      objectUrl: this.buildPublicObjectUrl(input.storageKey, s3),
    };
  }

  async resolve(
    storageKey: string,
    storedObjectUrl?: string,
  ): Promise<AssetContentResolution> {
    if (storedObjectUrl && !this.isAssetProxyPublicUrl(storedObjectUrl)) {
      return { kind: "redirect", redirectUrl: storedObjectUrl };
    }

    const objectUrl = this.buildPublicObjectUrl(storageKey, this.getConfig());
    if (objectUrl && !this.isAssetProxyPublicUrl(objectUrl)) {
      return { kind: "redirect", redirectUrl: objectUrl };
    }

    const remote = await this.fetchObject(storageKey, this.getConfig());
    if (remote) {
      return remote;
    }

    return {
      kind: "missing-remote-url",
      message:
        "Asset is stored in object storage, but no public URL is configured. Set S3_PUBLIC_BASE_URL or MINIO_PUBLIC_BASE_URL to enable redirects.",
    };
  }

  private buildPutRequest(input: StoreAssetInput, s3: S3Config) {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const host = this.getHost(s3);
    const pathname = this.getObjectPath(input.storageKey, s3);
    const payloadHash = this.sha256Hex(input.buffer);
    const canonicalHeaders =
      `content-length:${input.buffer.length}\n` +
      `content-type:${input.mimeType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-length;content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      "PUT",
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
    const signingKey = this.getSigningKey(s3.secretAccessKey!, dateStamp, s3.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${s3.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      url: this.getRequestUrl(input.storageKey, s3),
      headers: {
        authorization,
        "content-length": input.buffer.length.toString(),
        "content-type": input.mimeType,
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
    };
  }

  private buildPublicObjectUrl(storageKey: string, s3: S3Config) {
    if (s3.publicBaseUrl) {
      const normalized = s3.publicBaseUrl.replace(/\/$/, "");
      const suffix = this.isAssetProxyPublicUrl(normalized) ? "/content" : "";
      return `${normalized}/${encodeURIComponent(storageKey)}${suffix}`;
    }

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

    if (!s3.bucket || !s3.region) {
      return undefined;
    }

    return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${encodeURIComponent(storageKey)}`;
  }

  private getRequestUrl(storageKey: string, s3: S3Config) {
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

    return `https://${s3.bucket}.s3.${s3.region}.amazonaws.com/${encodeURIComponent(storageKey)}`;
  }

  private async fetchObject(
    storageKey: string,
    s3: S3Config,
  ): Promise<AssetContentResolution | undefined> {
    if (!this.isEnabled() || !s3.bucket || !s3.accessKeyId || !s3.secretAccessKey) {
      return undefined;
    }

    const request = this.buildGetRequest(storageKey, s3);
    const response = await fetch(request.url, {
      method: "GET",
      headers: request.headers,
    });
    if (!response.ok) {
      return undefined;
    }

    const contentType =
      response.headers.get("content-type")?.split(";")[0].trim() ??
      "application/octet-stream";
    const bytes = Buffer.from(await response.arrayBuffer());

    return {
      kind: "remote",
      buffer: bytes,
      mimeType: contentType,
    };
  }

  private buildGetRequest(storageKey: string, s3: S3Config) {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const host = this.getHost(s3);
    const payloadHash = this.sha256Hex("");
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      "GET",
      this.getObjectPath(storageKey, s3),
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
    const signingKey = this.getSigningKey(s3.secretAccessKey!, dateStamp, s3.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${s3.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      url: this.getRequestUrl(storageKey, s3),
      headers: {
        authorization,
        host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
      },
    };
  }

  private getObjectPath(storageKey: string, s3: S3Config) {
    const encodedKey = encodeURIComponent(storageKey);
    return s3.forcePathStyle ? `/${s3.bucket}/${encodedKey}` : `/${encodedKey}`;
  }

  private getHost(s3: S3Config) {
    if (s3.endpoint) {
      const endpointUrl = new URL(s3.endpoint);
      return s3.forcePathStyle ? endpointUrl.host : `${s3.bucket}.${endpointUrl.host}`;
    }

    return `${s3.bucket}.s3.${s3.region}.amazonaws.com`;
  }

  private isAssetProxyPublicUrl(value: string) {
    try {
      return this.isAssetProxyPath(new URL(value).pathname);
    } catch {
      return this.isAssetProxyPath(value);
    }
  }

  private isAssetProxyPath(value: string) {
    const normalized = value.replace(/\/$/, "");
    return /\/api\/assets(?:\/.*\/content)?$/i.test(normalized);
  }

  private getConfig(): S3Config {
    return {
      endpoint: this.config.get<string>("storage.s3.endpoint") ?? undefined,
      region: this.config.get<string>("storage.s3.region") ?? "us-east-1",
      bucket: this.config.get<string>("storage.s3.bucket") ?? undefined,
      accessKeyId: this.config.get<string>("storage.s3.accessKeyId") ?? undefined,
      secretAccessKey: this.config.get<string>("storage.s3.secretAccessKey") ?? undefined,
      publicBaseUrl: this.config.get<string>("storage.s3.publicBaseUrl") ?? undefined,
      forcePathStyle: this.config.get<boolean>("storage.s3.forcePathStyle") ?? true,
    };
  }

  private formatAmzDate(value: Date) {
    return value.toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private sha256Hex(value: string | Buffer) {
    return createHash("sha256").update(value).digest("hex");
  }

  private getSigningKey(secretAccessKey: string, date: string, region: string, service: string) {
    const kDate = createHmac("sha256", `AWS4${secretAccessKey}`).update(date).digest();
    const kRegion = createHmac("sha256", kDate).update(region).digest();
    const kService = createHmac("sha256", kRegion).update(service).digest();
    return createHmac("sha256", kService).update("aws4_request").digest();
  }
}
