import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";
import { cwd } from "node:process";
import type {
  AssetContentResolution,
  StoreAssetInput,
  StoredAssetLocation,
} from "./asset-storage.types";

@Injectable()
export class LocalAssetStorageService {
  constructor(private readonly config: ConfigService) {}

  async store(input: StoreAssetInput): Promise<StoredAssetLocation> {
    const uploadDir = this.getUploadDir();
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, input.storageKey), input.buffer);

    return { kind: "local" };
  }

  async resolve(storageKey: string): Promise<AssetContentResolution | undefined> {
    const filePath = join(this.getUploadDir(), storageKey);
    const fileStat = await stat(filePath).catch(() => undefined);
    if (!fileStat?.isFile()) {
      return undefined;
    }

    return {
      kind: "local",
      filePath,
      mimeType: this.mimeTypeFromExtension(extname(storageKey)),
    };
  }

  private mimeTypeFromExtension(extension: string) {
    switch (extension.toLowerCase()) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".webp":
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  }

  getPublicUrl(storageKey: string) {
    const publicBaseUrl = this.config.get<string>("storage.local.publicBaseUrl");
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(storageKey)}/content`;
    }

    return `/api/assets/${storageKey}/content`;
  }

  private getUploadDir() {
    const configured = this.config.get<string>("storage.local.path");
    if (!configured) {
      return join(cwd(), "storage");
    }

    return isAbsolute(configured) ? resolve(configured) : join(cwd(), configured);
  }
}
