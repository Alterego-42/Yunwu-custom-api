import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { LibraryDownloadService } from "../src/api/library/library-download.service";

const OWNER = "user-owner";
const OTHER = "user-other";

function createAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    userId: OWNER,
    storageKey: "1760000000000-abc-photo.png",
    mimeType: "image/png",
    createdAt: new Date("2026-10-09T08:30:00.000Z"),
    ...overrides,
  };
}

/** 用真实文件系统承载本地资产，确保走的是读文件分支。 */
async function createHarness(assets: Array<Record<string, unknown>>) {
  const dir = await mkdtemp(join(tmpdir(), "yunwu-lib-download-"));
  const files = new Map<string, Buffer>();

  for (const [index, asset] of assets.entries()) {
    const content = Buffer.from(`payload-${index}`, "utf8");
    files.set(String(asset.storageKey), content);
    await writeFile(join(dir, String(asset.storageKey)), content);
  }

  const prisma = {
    asset: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        assets.filter((asset) => where.id.in.includes(String(asset.id))),
    },
  };

  const assetStorage = {
    resolveContent: async (asset: { storageKey: string }) => {
      const content = files.get(asset.storageKey);
      if (!content) return undefined;
      return {
        kind: "local" as const,
        filePath: join(dir, asset.storageKey),
        mimeType: "image/png",
      };
    },
  };

  const service = new LibraryDownloadService(
    prisma as never,
    assetStorage as never,
  );

  return { service, dir };
}

async function collect(stream: AsyncGenerator<Buffer>) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

test("批量下载产出可用 zip，文件名是日期 + 哈希前几位", async () => {
  const assets = [
    createAsset(),
    createAsset({ id: "asset-2", storageKey: "1760000000001-def-pic.webp", mimeType: "image/webp" }),
  ];
  const { service, dir } = await createHarness(assets);

  try {
    const plan = await service.planDownload({ id: OWNER, role: "member" }, [
      "asset-1",
      "asset-2",
    ]);
    assert.deepEqual(plan.map((entry) => entry.fileName), [
      "2026-10-09_1c49a083.png",
      "2026-10-09_846f3dbe.webp",
    ]);

    const zip = await collect(
      service.streamDownload({ id: OWNER, role: "member" }, ["asset-1", "asset-2"]),
    );
    assert.ok(zip.subarray(0, 4).equals(Buffer.from("504b0304", "hex")), "应是 zip 魔数");

    const zipPath = join(dir, "out.zip");
    await writeFile(zipPath, zip);
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)(
      "python",
      [
        "-I",
        "-c",
        [
          "import json,sys,zipfile",
          "z=zipfile.ZipFile(sys.argv[1])",
          "print(json.dumps({'names':z.namelist(),'bad':z.testzip()}))",
        ].join("\n"),
        zipPath,
      ],
    );
    const report = JSON.parse(stdout);
    assert.equal(report.bad, null);
    assert.deepEqual(report.names, plan.map((entry) => entry.fileName));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("文件名对同一资产的同一日期稳定可复现", async () => {
  const { service, dir } = await createHarness([createAsset()]);

  try {
    const first = await service.planDownload({ id: OWNER, role: "member" }, ["asset-1"]);
    const second = await service.planDownload({ id: OWNER, role: "member" }, ["asset-1"]);
    assert.equal(first[0].fileName, second[0].fileName);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("别人家的作品拒绝下载", async () => {
  const { service, dir } = await createHarness([createAsset()]);

  try {
    await assert.rejects(
      () =>
        collect(
          service.streamDownload({ id: OTHER, role: "member" }, ["asset-1"]),
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("管理员可以下载任意用户的作品", async () => {
  const { service, dir } = await createHarness([createAsset()]);

  try {
    const zip = await collect(
      service.streamDownload({ id: "admin-1", role: "admin" }, ["asset-1"]),
    );
    assert.ok(zip.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("空选择与超量选择都被拒绝", async () => {
  const { service, dir } = await createHarness([createAsset()]);

  try {
    await assert.rejects(
      () => collect(service.streamDownload({ id: OWNER, role: "member" }, [])),
      (error: unknown) => error instanceof BadRequestException,
    );

    const tooMany = Array.from({ length: 201 }, (_, index) => `asset-${index}`);
    await assert.rejects(
      () => collect(service.streamDownload({ id: OWNER, role: "member" }, tooMany)),
      (error: unknown) => error instanceof BadRequestException,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("读不到的作品不会让整包失败，并附说明文件", async () => {
  const dir = await mkdtemp(join(tmpdir(), "yunwu-lib-download-"));
  const good = createAsset();
  await writeFile(join(dir, String(good.storageKey)), Buffer.from("ok-bytes", "utf8"));

  const prisma = {
    asset: {
      findMany: async () => [
        good,
        createAsset({ id: "asset-missing", storageKey: "not-on-disk.png" }),
      ],
    },
  };
  const assetStorage = {
    resolveContent: async (asset: { storageKey: string }) => ({
      kind: "local" as const,
      filePath: join(dir, asset.storageKey),
      mimeType: "image/png",
    }),
  };

  const service = new LibraryDownloadService(prisma as never, assetStorage as never);

  try {
    const zip = await collect(
      service.streamDownload({ id: OWNER, role: "member" }, ["asset-1", "asset-missing"]),
    );
    const zipPath = join(dir, "out.zip");
    await writeFile(zipPath, zip);

    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)(
      "python",
      [
        "-I",
        "-c",
        [
          "import json,sys,zipfile",
          "z=zipfile.ZipFile(sys.argv[1])",
          "print(json.dumps({'names':z.namelist(),'readme':z.read('README.txt').decode('utf8')}))",
        ].join("\n"),
        zipPath,
      ],
    );
    const report = JSON.parse(stdout);
    assert.equal(report.names.length, 2, "一个作品 + 一个说明文件");
    assert.ok(report.names.includes("README.txt"));
    assert.match(report.readme, /1 个作品读取失败/);
    assert.ok(report.names.includes("2026-10-09_1c49a083.png"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
