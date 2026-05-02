import assert from "node:assert/strict";
import test from "node:test";
import { S3AssetStorageService } from "../src/api/storage/s3-asset-storage.service";

function createConfig(publicBaseUrl: string) {
  return {
    get(key: string) {
      const values: Record<string, unknown> = {
        "storage.s3.endpoint": "http://minio:9000",
        "storage.s3.region": "us-east-1",
        "storage.s3.bucket": "yunwu-assets",
        "storage.s3.accessKeyId": "minioadmin",
        "storage.s3.secretAccessKey": "minioadmin",
        "storage.s3.publicBaseUrl": publicBaseUrl,
        "storage.s3.forcePathStyle": true,
      };

      return values[key];
    },
  };
}

test("S3AssetStorageService keeps ordinary public bucket URLs", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = (async (url: string) => {
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => "",
    } as Response;
  }) as typeof fetch;

  try {
    const storage = new S3AssetStorageService(
      createConfig("http://127.0.0.1:19000/yunwu-assets") as never,
    );
    const result = await storage.store({
      buffer: Buffer.from("png"),
      storageKey: "asset.png",
      mimeType: "image/png",
    });

    assert.equal(requestedUrl, "http://minio:9000/yunwu-assets/asset.png");
    assert.equal(result.objectUrl, "http://127.0.0.1:19000/yunwu-assets/asset.png");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("S3AssetStorageService turns API asset proxy base URLs into content URLs", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: true,
      status: 200,
      text: async () => "",
    }) as Response) as typeof fetch;

  try {
    const storage = new S3AssetStorageService(
      createConfig("http://127.0.0.1:5173/api/assets") as never,
    );
    const result = await storage.store({
      buffer: Buffer.from("png"),
      storageKey: "asset.png",
      mimeType: "image/png",
    });

    assert.equal(
      result.objectUrl,
      "http://127.0.0.1:5173/api/assets/asset.png/content",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("S3AssetStorageService resolves asset proxy URLs by reading object storage", async () => {
  const originalFetch = globalThis.fetch;
  let method = "";
  let requestedUrl = "";
  const bytes = Buffer.from("png");
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    method = String(init?.method ?? "GET");
    requestedUrl = url;
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as Response;
  }) as typeof fetch;

  try {
    const storage = new S3AssetStorageService(
      createConfig("http://127.0.0.1:5173/api/assets") as never,
    );
    const result = await storage.resolve(
      "asset.png",
      "http://127.0.0.1:5173/api/assets/asset.png/content",
    );

    assert.equal(method, "GET");
    assert.equal(requestedUrl, "http://minio:9000/yunwu-assets/asset.png");
    assert.equal(result.kind, "remote");
    if (result.kind === "remote") {
      assert.equal(result.mimeType, "image/png");
      assert.equal(result.buffer.toString(), "png");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("S3AssetStorageService still redirects non-proxy stored public URLs", async () => {
  const storage = new S3AssetStorageService(
    createConfig("http://127.0.0.1:5173/api/assets") as never,
  );
  const result = await storage.resolve(
    "asset.png",
    "http://127.0.0.1:19000/yunwu-assets/asset.png",
  );

  assert.deepEqual(result, {
    kind: "redirect",
    redirectUrl: "http://127.0.0.1:19000/yunwu-assets/asset.png",
  });
});
