import { net } from "electron";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ensureAllowedDownloadUrl, type PortableAsset, type UpdateStage } from "./release-updates";

/**
 * 端内更新（免安装 portable 分发）。
 *
 * 流程：下载 Release zip → 校验 sha256 → 解压到临时目录 → 写替换脚本
 * → 退出主进程后由脚本覆盖安装目录并重新拉起程序。
 *
 * 之所以不用 electron-updater：它在 Windows 上只支持 NSIS/AppImage 目标，
 * 而本项目分发的是免安装 zip，用户解压即用。
 */

export type InstallProgress = {
  stage: UpdateStage;
  downloadedBytes?: number;
  totalBytes?: number;
  message: string;
};

export type StagedUpdate = {
  version: string;
  sourceDir: string;
  installDir: string;
  scriptPath: string;
};

const downloadTimeoutMs = 15 * 60 * 1000;

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 安装目录：portable 包解压后的程序目录。 */
export function getInstallDir(exePath: string) {
  return dirname(exePath);
}

/** 只有安装目录可写才能端内更新（例如放在 Program Files 下就不行）。 */
export async function isInstallDirWritable(installDir: string) {
  const probe = join(installDir, `.yunwu-update-probe-${process.pid}`);
  try {
    await access(installDir, fsConstants.W_OK);
    await writeFile(probe, "probe", "utf8");
    return true;
  } catch {
    return false;
  } finally {
    await rm(probe, { force: true }).catch(() => undefined);
  }
}

async function downloadAsset(
  asset: PortableAsset,
  targetPath: string,
  onProgress: (progress: InstallProgress) => void
) {
  const url = ensureAllowedDownloadUrl(asset.downloadUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);

  try {
    const response = await net.fetch(url, {
      headers: { "User-Agent": "Yunwu-Desktop-Updater" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`下载失败，HTTP ${response.status}。`);
    }
    if (!response.body) {
      throw new Error("下载失败：响应没有内容。");
    }

    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
    const totalBytes = Number.isInteger(declaredLength) && declaredLength > 0
      ? declaredLength
      : asset.size;

    let downloadedBytes = 0;
    let lastReported = 0;
    const hash = createHash("sha256");
    const target = createWriteStream(targetPath);
    const source = Readable.fromWeb(response.body as never);

    source.on("data", (chunk: Buffer) => {
      hash.update(chunk);
      downloadedBytes += chunk.byteLength;
      // 每 2 MB 上报一次，避免刷爆 IPC。
      if (downloadedBytes - lastReported >= 2 * 1024 * 1024) {
        lastReported = downloadedBytes;
        onProgress({
          stage: "download",
          downloadedBytes,
          totalBytes,
          message: `正在下载更新包 ${formatBytes(downloadedBytes)}${
            totalBytes ? ` / ${formatBytes(totalBytes)}` : ""
          }。`
        });
      }
    });

    await pipeline(source, target);

    return { digest: hash.digest("hex"), downloadedBytes, totalBytes };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 解压 zip。优先用 Windows 自带的 tar（bsdtar，速度快），
 * 不可用时回退到 PowerShell 的 Expand-Archive。
 */
async function extractZip(zipPath: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });

  const tarPath = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  const hasTar = await access(tarPath, fsConstants.X_OK).then(
    () => true,
    () => false
  );

  if (hasTar) {
    await runCommand(tarPath, ["-xf", zipPath, "-C", targetDir]);
    return;
  }

  await runCommand("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Expand-Archive -LiteralPath ${quotePowerShell(zipPath)} -DestinationPath ${quotePowerShell(
      targetDir
    )} -Force`
  ]);
}

function quotePowerShell(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(
        new Error(`${basename(command)} 退出码 ${code}${stderr.trim() ? `：${stderr.trim()}` : "。"}`)
      );
    });
  });
}

/**
 * zip 内可能是「直接铺开的程序文件」也可能套了一层目录，
 * 这里找出真正包含可执行文件的目录。
 */
async function resolvePayloadDir(extractedDir: string, exeName: string) {
  const hasExe = async (dir: string) =>
    access(join(dir, exeName), fsConstants.F_OK).then(
      () => true,
      () => false
    );

  if (await hasExe(extractedDir)) {
    return extractedDir;
  }

  const entries = await readdir(extractedDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(extractedDir, entry.name);
    if (await hasExe(candidate)) {
      return candidate;
    }
  }

  throw new Error(`更新包里没有找到 ${exeName}，已中止更新。`);
}

/**
 * 替换脚本：等主进程退出 → robocopy 覆盖安装目录 → 重新启动程序。
 *
 * 用 /E（覆盖式复制，不删除多余文件）而不是 /MIR：用户可能把 portable
 * 目录和自己的文件放在一起，镜像模式会误删。
 */
function buildSwapScript(input: {
  pid: number;
  payloadDir: string;
  installDir: string;
  exePath: string;
  logPath: string;
}) {
  return `# Yunwu Desktop 端内更新替换脚本（由应用自动生成）
$ErrorActionPreference = 'Stop'
$log = ${quotePowerShell(input.logPath)}
function Write-Log($message) {
  "$(Get-Date -Format o) $message" | Out-File -FilePath $log -Append -Encoding utf8
}

try {
  Write-Log "等待主进程 ${input.pid} 退出"
  for ($i = 0; $i -lt 120; $i++) {
    if (-not (Get-Process -Id ${input.pid} -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
  }
  if (Get-Process -Id ${input.pid} -ErrorAction SilentlyContinue) {
    Write-Log "主进程未退出，放弃替换"
    exit 1
  }

  Write-Log "开始复制 ${input.payloadDir} -> ${input.installDir}"
  $robocopy = Join-Path $env:SystemRoot 'System32\\robocopy.exe'
  & $robocopy ${quotePowerShell(input.payloadDir)} ${quotePowerShell(
    input.installDir
  )} /E /R:3 /W:2 /NFL /NDL /NJH /NJS | Out-Null
  # robocopy 的 0-7 都算成功
  if ($LASTEXITCODE -ge 8) {
    Write-Log "robocopy 失败，退出码 $LASTEXITCODE"
    exit $LASTEXITCODE
  }

  Write-Log "替换完成，重新启动"
  Start-Process -FilePath ${quotePowerShell(input.exePath)}
  Write-Log "已拉起新版本"
} catch {
  Write-Log "替换失败：$($_.Exception.Message)"
  exit 1
}
`;
}

/**
 * 下载 → 校验 → 解压 → 生成替换脚本。返回待执行的替换信息；
 * 真正的目录覆盖发生在主进程退出之后。
 */
export async function stageDesktopUpdate(input: {
  asset: PortableAsset;
  version: string;
  exePath: string;
  workDir: string;
  onProgress: (progress: InstallProgress) => void;
}): Promise<StagedUpdate> {
  const installDir = getInstallDir(input.exePath);
  if (!(await isInstallDirWritable(installDir))) {
    throw new Error(
      `安装目录不可写（${installDir}），请把程序移动到有写入权限的目录，或手动下载新版本。`
    );
  }

  await mkdir(input.workDir, { recursive: true });
  const stagingDir = await mkdtemp(join(input.workDir, `update-${input.version}-`));
  const zipPath = join(stagingDir, input.asset.name);

  try {
    input.onProgress({
      stage: "download",
      totalBytes: input.asset.size,
      message: "正在下载更新包。"
    });
    const { digest, downloadedBytes } = await downloadAsset(input.asset, zipPath, input.onProgress);

    input.onProgress({
      stage: "verify",
      downloadedBytes,
      totalBytes: downloadedBytes,
      message: "正在校验更新包完整性。"
    });
    if (digest.toLowerCase() !== input.asset.sha256.toLowerCase()) {
      throw new Error("更新包校验失败（sha256 不一致），已丢弃下载内容。");
    }
    const downloaded = await stat(zipPath);
    if (input.asset.size > 0 && downloaded.size !== input.asset.size) {
      throw new Error("更新包大小与发布清单不一致，已丢弃下载内容。");
    }

    input.onProgress({ stage: "extract", message: "正在解压更新包。" });
    const extractedDir = join(stagingDir, "extracted");
    await extractZip(zipPath, extractedDir);
    const payloadDir = await resolvePayloadDir(extractedDir, basename(input.exePath));

    input.onProgress({ stage: "stage", message: "正在准备替换程序文件。" });
    const scriptPath = join(stagingDir, "apply-update.ps1");
    await writeFile(
      scriptPath,
      buildSwapScript({
        pid: process.pid,
        payloadDir: resolve(payloadDir),
        installDir: resolve(installDir),
        exePath: resolve(input.exePath),
        logPath: join(stagingDir, "apply-update.log")
      }),
      "utf8"
    );

    // zip 已经解压完，删掉省磁盘。
    await rm(zipPath, { force: true });

    return {
      version: input.version,
      sourceDir: resolve(payloadDir),
      installDir: resolve(installDir),
      scriptPath
    };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

/** 拉起替换脚本（detached，脚本会等本进程退出）。 */
export function launchSwapScript(staged: StagedUpdate) {
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-WindowStyle",
      "Hidden",
      "-File",
      staged.scriptPath
    ],
    { detached: true, stdio: "ignore", windowsHide: true, cwd: tmpdir() }
  );
  child.unref();
}

/** 清理历史遗留的临时更新目录。 */
export async function cleanupStagingDirs(workDir: string, keepPath?: string) {
  const entries = await readdir(workDir, { withFileTypes: true }).catch(() => []);
  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("update-"))
      .map((entry) => join(workDir, entry.name))
      .filter((path) => path !== keepPath)
      .map((path) => rm(path, { recursive: true, force: true }).catch(() => undefined))
  );
}
