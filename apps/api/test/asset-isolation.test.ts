import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { AssetUploadService } from "../src/api/asset-upload.service";

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-a",
    email: "a@example.com",
    displayName: "User A",
    role: "member",
    ...overrides,
  };
}

test("AssetUploadService scopes storageKey downloads to the current user", async () => {
  const calls = {
    assetFindFirst: [] as Array<Record<string, unknown>>,
    resolved: [] as Array<Record<string, unknown>>,
  };
  const asset = {
    storageKey: "asset.png",
    userId: "user-a",
    metadata: { storage: "local" },
  };
  const prisma = {
    asset: {
      findFirst: async (args: Record<string, unknown>) => {
        calls.assetFindFirst.push(args);
        return asset;
      },
    },
  };
  const storage = {
    resolveContent: async (input: Record<string, unknown>) => {
      calls.resolved.push(input);
      return { kind: "local", filePath: "asset.png", mimeType: "image/png" };
    },
  };
  const service = new AssetUploadService(prisma as never, storage as never);

  const result = await service.getAssetContent(createUser() as never, "asset.png");

  assert.equal(result?.kind, "local");
  assert.deepEqual(calls.assetFindFirst[0]?.where, {
    storageKey: "asset.png",
    userId: "user-a",
  });
});

test("AssetUploadService lets admin resolve storageKey globally", async () => {
  const calls = {
    assetFindFirst: [] as Array<Record<string, unknown>>,
  };
  const prisma = {
    asset: {
      findFirst: async (args: Record<string, unknown>) => {
        calls.assetFindFirst.push(args);
        return {
          storageKey: "asset.png",
          userId: "user-a",
          metadata: { storage: "local" },
        };
      },
    },
  };
  const storage = {
    resolveContent: async () => ({ kind: "local", filePath: "asset.png", mimeType: "image/png" }),
  };
  const service = new AssetUploadService(prisma as never, storage as never);

  await service.getAssetContent(
    createUser({ id: "admin-1", role: "admin" }) as never,
    "asset.png",
  );

  assert.deepEqual(calls.assetFindFirst[0]?.where, {
    storageKey: "asset.png",
  });
});

test("AssetUploadService rejects invalid storage keys before lookup", async () => {
  const service = new AssetUploadService({} as never, {} as never);

  await assert.rejects(
    () => service.getAssetContent(createUser() as never, "../asset.png"),
    BadRequestException,
  );
});
