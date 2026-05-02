export type AssetStorageKind = "local" | "s3";

export interface StoreAssetInput {
  buffer: Buffer;
  storageKey: string;
  mimeType: string;
}

export interface StoredAssetLocation {
  kind: AssetStorageKind;
  objectUrl?: string;
}

export interface LocalAssetContent {
  kind: "local";
  filePath: string;
  mimeType: string;
}

export interface RedirectAssetContent {
  kind: "redirect";
  redirectUrl: string;
}

export interface RemoteAssetContent {
  kind: "remote";
  buffer: Buffer;
  mimeType: string;
}

export interface MissingRemoteAssetContent {
  kind: "missing-remote-url";
  message: string;
}

export type AssetContentResolution =
  | LocalAssetContent
  | RedirectAssetContent
  | RemoteAssetContent
  | MissingRemoteAssetContent;
