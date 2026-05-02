import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Asset, Prisma } from "@prisma/client";
import type {
  AssetContentResolution,
  StoreAssetInput,
  StoredAssetLocation,
} from "./asset-storage.types";
import { LocalAssetStorageService } from "./local-asset-storage.service";
import { S3AssetStorageService } from "./s3-asset-storage.service";

@Injectable()
export class AssetStorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly localStorage: LocalAssetStorageService,
    private readonly s3Storage: S3AssetStorageService,
  ) {}

  async store(input: StoreAssetInput): Promise<StoredAssetLocation> {
    if (this.shouldUseS3()) {
      return this.s3Storage.store(input);
    }

    return this.localStorage.store(input);
  }

  async resolveContent(
    asset: Pick<Asset, "storageKey" | "metadata">,
  ): Promise<AssetContentResolution | undefined> {
    if (!asset.storageKey) {
      return undefined;
    }

    const metadata = this.readMetadata(asset.metadata);
    if (metadata.storage === "s3") {
      return this.s3Storage.resolve(asset.storageKey, metadata.objectUrl);
    }

    return this.localStorage.resolve(asset.storageKey);
  }

  getPublicUrl(storageKey: string, stored: StoredAssetLocation) {
    if (stored.kind === "s3" && stored.objectUrl) {
      return stored.objectUrl;
    }

    return this.localStorage.getPublicUrl(storageKey);
  }

  private readMetadata(metadata: Prisma.JsonValue | null | undefined) {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
      return {};
    }

    const record = metadata as Record<string, unknown>;
    return {
      storage: typeof record.storage === "string" ? record.storage : undefined,
      objectUrl: typeof record.objectUrl === "string" ? record.objectUrl : undefined,
    };
  }

  private shouldUseS3() {
    const mode = this.config.get<string>("storage.mode");
    if (mode === "local") {
      return false;
    }

    return this.s3Storage.isEnabled();
  }
}
