import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 组装桌面内置服务资源：resources/server/{api,web}
// - api: pnpm deploy 产物（扁平 node_modules + dist + prisma，含 argon2/prisma 原生依赖）
// - web: Vite 构建产物，由 API 进程直接托管

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(desktopRoot, "..", "..");
const serverDir = join(desktopRoot, "resources", "server");
const apiTarget = join(serverDir, "api");
const webTarget = join(serverDir, "web");

function run(command, cwd = repoRoot) {
  console.log(`[prepare-server] ${command}`);
  execSync(command, { cwd, stdio: "inherit" });
}

// 1. 构建 shared / api / web
run("pnpm --filter @yunwu/shared build");
run("pnpm --filter @yunwu/api build");
run("pnpm --filter @yunwu/web build");

const apiDist = join(repoRoot, "apps", "api", "dist", "main.js");
const webDist = join(repoRoot, "apps", "web", "dist", "index.html");
if (!existsSync(apiDist)) throw new Error(`API 构建产物缺失：${apiDist}`);
if (!existsSync(webDist)) throw new Error(`Web 构建产物缺失：${webDist}`);

// 2. 部署 API（生产依赖，扁平化，脱离 workspace 符号链接）
rmSync(serverDir, { recursive: true, force: true });
// node-linker=hoisted：产出扁平、无符号链接的 node_modules。
// pnpm 默认的 .pnpm 链接结构在 electron-builder 打 zip 时会被压成空目录，
// 解压后模块解析直接失败（Cannot find module 'tslib'）。
run(
  `pnpm --filter @yunwu/api --legacy deploy --prod --config.node-linker=hoisted "${apiTarget}"`
);

// 3. 在部署目录内生成 Prisma Client（携带 SQLite 查询引擎）
const deployedSchema = join(apiTarget, "prisma", "schema.prisma");
if (!existsSync(deployedSchema)) throw new Error(`部署目录缺少 schema：${deployedSchema}`);
run(`pnpm --filter @yunwu/api exec prisma generate --schema "${deployedSchema}"`);

// 4. 拷贝 Web 构建产物
cpSync(join(repoRoot, "apps", "web", "dist"), webTarget, { recursive: true });

const serverEntry = join(apiTarget, "dist", "main.js");
if (!existsSync(serverEntry)) throw new Error(`部署产物缺少服务入口：${serverEntry}`);

// 5. 清理开发目录里被 pnpm deploy 一并复制进来的内容。
//    data/ 与 storage/ 是本机运行时产生的（数据库里含真实 API key），
//    src/ 与 test/ 是源码，运行时都用不到，绝不能进分发包。
const prunePaths = ["data", "storage", "src", "test", ".env", ".env.local", ".env.example"];
for (const relative of prunePaths) {
  const target = join(apiTarget, relative);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
    console.log(`[prepare-server] 已移除分发包中的 ${relative}`);
  }
}

const isSecretFile = (name) =>
  /\.(db|db-journal|db-wal|sqlite|sqlite3)$/i.test(name) || /^\.env(\..+)?$/i.test(name);

// 6. 兜底校验：分发包里不允许残留数据库、.env，也不允许有任何符号链接。
//    electron-builder 打 zip 时会把符号链接目录压成空目录，用户解压后模块解析必然失败，
//    所以这里直接让打包失败，而不是产出一个跑不起来的包。
const forbidden = [];
function scanPayload(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      forbidden.push(`${target}（符号链接，zip 后会变成空目录）`);
      continue;
    }
    if (entry.isDirectory()) {
      scanPayload(target);
      continue;
    }
    if (isSecretFile(entry.name)) {
      forbidden.push(`${target}（本机数据/密钥文件）`);
    }
  }
}
scanPayload(serverDir);
if (forbidden.length) {
  throw new Error(
    ["分发包中检测到不应打包的内容，已中止：", ...forbidden.slice(0, 20)].join("\n")
  );
}
console.log("[prepare-server] 分发包校验通过：无符号链接、无数据库/.env 残留");

console.log(`[prepare-server] 完成：${serverDir}`);
