import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ZipWriter } from "../src/api/library/zip-writer";

async function readZipWithPython(zipPath: string) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const script = [
    "import json, sys, zipfile",
    "z = zipfile.ZipFile(sys.argv[1])",
    "bad = z.testzip()",
    "print(json.dumps({",
    "  'names': z.namelist(),",
    "  'bad': bad,",
    "  'sizes': {i.filename: i.file_size for i in z.infolist()},",
    "  'methods': {i.filename: i.compress_type for i in z.infolist()},",
    "}))",
  ].join("\n");

  const { stdout } = await run("python", ["-I", "-c", script, zipPath]);
  return JSON.parse(stdout);
}

async function writeZip(entries: Array<{ name: string; data: Buffer }>) {
  const writer = new ZipWriter();
  for (const entry of entries) {
    writer.add(entry.name, entry.data, new Date("2026-10-09T08:30:00.000Z"));
  }
  writer.finish();

  const dir = await mkdtemp(join(tmpdir(), "yunwu-zip-test-"));
  const zipPath = join(dir, "out.zip");
  await writeFile(zipPath, Buffer.concat(writer.drain()));
  return { zipPath, dir };
}

test("ZipWriter 产出的包能被标准解压工具读取", async () => {
  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4",
    "hex",
  );
  const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");

  const { zipPath, dir } = await writeZip([
    { name: "2026-10-09_a1b2c3d4.png", data: png },
    { name: "2026-10-09_ffffffff.jpeg", data: jpeg },
  ]);

  try {
    const report = await readZipWithPython(zipPath);
    assert.equal(report.bad, null, "zipfile.testzip() 应报告无损坏");
    assert.deepEqual(report.names, [
      "2026-10-09_a1b2c3d4.png",
      "2026-10-09_ffffffff.jpeg",
    ]);
    assert.deepEqual(report.sizes, {
      "2026-10-09_a1b2c3d4.png": png.length,
      "2026-10-09_ffffffff.jpeg": jpeg.length,
    });
    // 0 = STORED
    for (const method of Object.values(report.methods)) {
      assert.equal(method, 0);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ZipWriter 让内容字节原样保留", async () => {
  const payload = Buffer.from("hello-yunwu-binary-é中", "utf8");
  const { zipPath, dir } = await writeZip([{ name: "note.txt", data: payload }]);

  try {
    const extracted = await readFile(zipPath);
    // 文件名与内容都必须能在包里按原字节找到。
    assert.ok(extracted.includes(Buffer.from("note.txt", "utf8")));
    assert.ok(extracted.includes(payload));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("ZipWriter 对同名文件追加序号而不是互相覆盖", async () => {
  const writer = new ZipWriter();
  const first = writer.add("same.png", Buffer.from("first"));
  const second = writer.add("same.png", Buffer.from("second"));

  assert.equal(first, "same.png");
  assert.equal(second, "same-2.png");
  assert.equal(writer.fileCount, 2);
});
