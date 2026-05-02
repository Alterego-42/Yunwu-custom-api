import { app, BrowserWindow, ipcMain, shell } from "electron";
import log from "electron-log/main";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type Phase = "idle" | "checking" | "starting" | "waiting" | "ready" | "error";

type ServiceStatus = {
  name: string;
  status: "pending" | "running" | "healthy" | "error";
  detail?: string;
};

type DesktopStatus = {
  phase: Phase;
  dockerCli: "unknown" | "ok" | "missing";
  dockerDaemon: "unknown" | "ok" | "stopped";
  message: string;
  logs: string[];
  services: ServiceStatus[];
  webUrl: string;
  adminUrl: string;
  userDataPath: string;
  logPath: string;
};

const webPort = 5173;
const apiPort = 3000;
const webUrl = `http://127.0.0.1:${webPort}`;
const adminUrl = `${webUrl}/admin`;
const healthUrl = `http://127.0.0.1:${apiPort}/health`;
const readinessUrl = `http://127.0.0.1:${apiPort}/readiness`;
const webHealthUrl = `${webUrl}/health`;

let mainWindow: BrowserWindow | undefined;
let currentProcess: ChildProcessWithoutNullStreams | undefined;
let isStarting = false;

const status: DesktopStatus = {
  phase: "idle",
  dockerCli: "unknown",
  dockerDaemon: "unknown",
  message: "准备启动本地服务。",
  logs: [],
  services: [
    { name: "Docker CLI", status: "pending" },
    { name: "Docker Daemon", status: "pending" },
    { name: "Compose Stack", status: "pending" },
    { name: "API /health", status: "pending" },
    { name: "API /readiness", status: "pending" },
    { name: "Web /health", status: "pending" }
  ],
  webUrl,
  adminUrl,
  userDataPath: "",
  logPath: ""
};

function setService(name: string, update: Partial<ServiceStatus>) {
  const service = status.services.find((item) => item.name === name);
  if (service) {
    Object.assign(service, update);
  }
}

function pushLog(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  status.logs = [...status.logs, line].slice(-300);
  log.info(message);
  broadcastStatus();
}

function setPhase(phase: Phase, message: string) {
  status.phase = phase;
  status.message = message;
  broadcastStatus();
}

function broadcastStatus() {
  mainWindow?.webContents.send("desktop:status", status);
}

function runCommand(command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill();
          reject(new Error(`${command} ${args.join(" ")} timed out.`));
        }, options.timeoutMs)
      : undefined;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}.\n${stderr || stdout}`));
      }
    });
  });
}

function getResourcePath(...parts: string[]) {
  const packaged = join(process.resourcesPath, ...parts);
  if (app.isPackaged && existsSync(packaged)) {
    return packaged;
  }

  const repoRoot = resolve(app.getAppPath(), "..", "..");
  const fallbackMap: Record<string, string> = {
    infra: join(repoRoot, "infra"),
    "app-source": repoRoot
  };
  const [first, ...rest] = parts;
  const fallbackRoot = fallbackMap[first] ?? join(repoRoot, first);
  return join(fallbackRoot, ...rest);
}

async function writeRuntimeFiles() {
  const userData = app.getPath("userData");
  const runtimeDir = join(userData, "runtime");
  await mkdir(runtimeDir, { recursive: true });

  const envPath = join(runtimeDir, ".env");
  const overridePath = join(runtimeDir, "docker-compose.override.yml");
  const appSourceDir = (process.env.YUNWU_DESKTOP_APP_SOURCE_DIR ?? getResourcePath("app-source")).replaceAll("\\", "/");
  const sessionSecret = randomBytes(24).toString("hex");

  const env = [
    "COMPOSE_PROJECT_NAME=yunwu-desktop",
    "NODE_ENV=production",
    `PORT=${apiPort}`,
    `WEB_PORT=${webPort}`,
    "POSTGRES_DB=yunwu_platform",
    "POSTGRES_USER=postgres",
    "POSTGRES_PASSWORD=postgres",
    "REDIS_PORT=6379",
    "MINIO_PORT=9000",
    "MINIO_CONSOLE_PORT=9001",
    "MINIO_ROOT_USER=minioadmin",
    "MINIO_ROOT_PASSWORD=minioadmin",
    "MINIO_BUCKET=yunwu-assets",
    "MINIO_USE_SSL=false",
    "TASK_QUEUE_NAME=yunwu-image-tasks",
    "TASK_WORKER_ENABLED=true",
    "TASK_WORKER_CONCURRENCY=2",
    "YUNWU_BASE_URL=https://yunwu.ai",
    "YUNWU_API_KEY=",
    "AUTH_ADMIN_EMAIL=admin@yunwu.local",
    "AUTH_ADMIN_PASSWORD=admin123456",
    "AUTH_ADMIN_DISPLAY_NAME=Administrator",
    "AUTH_DEMO_EMAIL=demo@yunwu.local",
    "AUTH_DEMO_PASSWORD=demo123456",
    "AUTH_DEMO_DISPLAY_NAME=Demo User",
    `AUTH_SESSION_SECRET=${sessionSecret}`,
    "AUTH_COOKIE_NAME=yunwu_session",
    "AUTH_SESSION_TTL_HOURS=168",
    "AUTH_COOKIE_SECURE=false",
    `CORS_ORIGIN=http://127.0.0.1:${webPort},http://localhost:${webPort}`,
    `WEB_ORIGIN=http://127.0.0.1:${webPort}`,
    `MINIO_PUBLIC_BASE_URL=http://127.0.0.1:9000/yunwu-assets`,
    "YUNWU_IMAGE_REGISTRY=ghcr.io/alterego-42",
    "YUNWU_IMAGE_TAG=v0.4.0",
    `DESKTOP_APP_SOURCE_DIR=${appSourceDir}`
  ].join("\n");

  const override = [
    "services:",
    "  api:",
    "    labels:",
    "      ai.yunwu.desktop.runtime: \"true\"",
    "  web:",
    "    labels:",
    "      ai.yunwu.desktop.runtime: \"true\"",
    "  worker:",
    "    labels:",
    "      ai.yunwu.desktop.runtime: \"true\""
  ].join("\n");

  await writeFile(envPath, `${env}\n`, "utf8");
  await writeFile(overridePath, `${override}\n`, "utf8");

  status.userDataPath = userData;
  status.logPath = log.transports.file.getFile().path;
  return { envPath, overridePath };
}

async function checkDocker() {
  setPhase("checking", "正在检测 Docker。");
  try {
    await runCommand("docker", ["--version"], { timeoutMs: 8000 });
    status.dockerCli = "ok";
    setService("Docker CLI", { status: "healthy", detail: "docker 命令可用" });
    pushLog("Docker CLI is available.");
  } catch (error) {
    status.dockerCli = "missing";
    setService("Docker CLI", { status: "error", detail: "未找到 docker 命令，请安装 Docker Desktop 并加入 PATH。" });
    throw error;
  }

  try {
    await runCommand("docker", ["info"], { timeoutMs: 10000 });
    status.dockerDaemon = "ok";
    setService("Docker Daemon", { status: "healthy", detail: "Docker daemon 已启动" });
    pushLog("Docker daemon is reachable.");
  } catch (error) {
    status.dockerDaemon = "stopped";
    setService("Docker Daemon", { status: "error", detail: "Docker Desktop 未启动或 daemon 不可用，请启动后重试。" });
    throw error;
  }
}

function shouldBuildImages() {
  return !app.isPackaged || process.env.YUNWU_DESKTOP_BUILD === "1";
}

function runComposeProcess(args: string[], detail: string) {
  return new Promise<void>((resolvePromise, reject) => {
    pushLog(`Running docker ${args.join(" ")}`);
    setService("Compose Stack", { status: "running", detail });
    currentProcess = spawn("docker", args, { windowsHide: true });

    currentProcess.stdout.on("data", (chunk) => pushLog(chunk.toString().trim()));
    currentProcess.stderr.on("data", (chunk) => {
      const line = chunk.toString().trim();
      pushLog(line);
      if (/port is already allocated|bind:/.test(line)) {
        setService("Compose Stack", { status: "error", detail: "端口冲突：请释放 3000/5173/5432/6379/9000/9001 后重试。" });
      }
    });
    currentProcess.on("error", reject);
    currentProcess.on("close", (code) => {
      currentProcess = undefined;
      if (code === 0) {
        setService("Compose Stack", { status: "healthy", detail: "Compose 服务栈已启动" });
        resolvePromise();
      } else {
        reject(new Error(`docker compose exited with ${code}.`));
      }
    });
  });
}

async function startCompose(envPath: string, overridePath: string) {
  const infraCompose = getResourcePath("infra", "docker-compose.yml");
  const desktopCompose = getResourcePath("infra", "docker-compose.desktop.yml");
  const composeFiles = ["--env-file", envPath, "-f", infraCompose, "-f", desktopCompose, "-f", overridePath];
  const buildImages = shouldBuildImages();

  if (!buildImages) {
    try {
      await runComposeProcess(
        ["compose", ...composeFiles, "pull"],
        "正在拉取 GHCR 镜像，若本机已有镜像则可失败继续。"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushLog(`docker compose pull failed, continuing with local images: ${message}`);
    }
  }

  const upArgs = ["compose", ...composeFiles, "up", "-d"];
  if (buildImages) {
    upArgs.push("--build");
  }

  await runComposeProcess(
    upArgs,
    buildImages ? "开发/显式构建模式：正在执行 docker compose up -d --build" : "正在执行 docker compose up -d"
  );
}

async function probe(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHealth() {
  setPhase("waiting", "服务启动中，正在等待健康检查。");
  const checks = [
    { name: "API /health", url: healthUrl },
    { name: "API /readiness", url: readinessUrl },
    { name: "Web /health", url: webHealthUrl }
  ];
  const deadline = Date.now() + 180_000;

  while (Date.now() < deadline) {
    let allHealthy = true;
    for (const check of checks) {
      try {
        const ok = await probe(check.url);
        setService(check.name, {
          status: ok ? "healthy" : "running",
          detail: ok ? `${check.url} OK` : `等待 ${check.url}`
        });
        allHealthy &&= ok;
      } catch (error) {
        allHealthy = false;
        setService(check.name, {
          status: "running",
          detail: error instanceof Error ? error.message : `等待 ${check.url}`
        });
      }
    }
    broadcastStatus();
    if (allHealthy) {
      pushLog("All health checks passed.");
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 3000));
  }

  for (const check of checks) {
    const service = status.services.find((item) => item.name === check.name);
    if (service?.status !== "healthy") {
      setService(check.name, { status: "error", detail: "健康检查超时，请查看日志后重试。" });
    }
  }
  throw new Error("Health check timed out after 180 seconds.");
}

async function startStack() {
  if (isStarting) return;
  isStarting = true;
  status.logs = [];
  status.services.forEach((service) => {
    service.status = "pending";
    service.detail = undefined;
  });

  try {
    await checkDocker();
    const { envPath, overridePath } = await writeRuntimeFiles();
    setPhase("starting", "正在启动 Docker Compose 服务栈。");
    await startCompose(envPath, overridePath);
    await waitForHealth();
    setPhase("ready", "服务已就绪，正在打开工作台。");
    await mainWindow?.loadURL(webUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushLog(message);
    setPhase("error", message);
  } finally {
    isStarting = false;
  }
}

async function createWindow() {
  status.userDataPath = app.getPath("userData");
  log.initialize();
  log.transports.file.resolvePathFn = () => join(app.getPath("userData"), "desktop.log");
  status.logPath = log.transports.file.getFile().path;

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    title: "Yunwu Desktop",
    webPreferences: {
      preload: join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  await mainWindow.loadFile(join(__dirname, "..", "renderer", "index.html"));
  void startStack();
}

ipcMain.handle("desktop:get-status", () => status);
ipcMain.handle("desktop:retry", async () => {
  await mainWindow?.loadFile(join(__dirname, "..", "renderer", "index.html"));
  void startStack();
});
ipcMain.handle("desktop:open-workbench", async () => {
  await mainWindow?.loadURL(webUrl);
});
ipcMain.handle("desktop:open-admin", async () => {
  await mainWindow?.loadURL(adminUrl);
});
ipcMain.handle("desktop:open-user-data", async () => {
  await shell.openPath(app.getPath("userData"));
});

app.whenReady().then(createWindow).catch((error) => {
  log.error(error);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  currentProcess?.kill();
});
