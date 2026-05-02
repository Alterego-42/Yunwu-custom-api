import { app, BrowserWindow, ipcMain, shell } from "electron";
import log from "electron-log/main";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
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

function getPortEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : fallback;
}

type RuntimePorts = {
  web: number;
  api: number;
  postgres: number;
  redis: number;
  minio: number;
  minioConsole: number;
};

type RuntimeUrls = {
  webUrl: string;
  adminUrl: string;
  healthUrl: string;
  readinessUrl: string;
  webHealthUrl: string;
};

const preferredPorts = {
  web: getPortEnv("YUNWU_DESKTOP_WEB_PORT", 5173),
  api: getPortEnv("YUNWU_DESKTOP_API_PORT", 3000),
  postgres: getPortEnv("YUNWU_DESKTOP_POSTGRES_PORT", 5432),
  redis: getPortEnv("YUNWU_DESKTOP_REDIS_PORT", 6379),
  minio: getPortEnv("YUNWU_DESKTOP_MINIO_PORT", 9000),
  minioConsole: getPortEnv("YUNWU_DESKTOP_MINIO_CONSOLE_PORT", 9001)
} satisfies RuntimePorts;

let runtimePorts: RuntimePorts = { ...preferredPorts };

function getRuntimeUrls(): RuntimeUrls {
  const webUrl = `http://127.0.0.1:${runtimePorts.web}`;
  return {
    webUrl,
    adminUrl: `${webUrl}/admin`,
    healthUrl: `http://127.0.0.1:${runtimePorts.api}/health`,
    readinessUrl: `http://127.0.0.1:${runtimePorts.api}/readiness`,
    webHealthUrl: `${webUrl}/health`
  };
}

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
  webUrl: getRuntimeUrls().webUrl,
  adminUrl: getRuntimeUrls().adminUrl,
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

function checkPort(port: number) {
  return new Promise<boolean>((resolvePromise) => {
    const server = createServer();
    server.unref();
    server.on("error", () => resolvePromise(false));
    server.listen({ port, host: "0.0.0.0", exclusive: true }, () => {
      server.close(() => resolvePromise(true));
    });
  });
}

async function getEphemeralPort(excludedPorts: Set<number>) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await new Promise<number>((resolvePromise, reject) => {
      const server = createServer();
      server.unref();
      server.on("error", reject);
      server.listen({ port: 0, host: "0.0.0.0", exclusive: true }, () => {
        const address = server.address();
        server.close(() => {
          if (address && typeof address === "object") {
            resolvePromise(address.port);
          } else {
            reject(new Error("Failed to allocate an ephemeral port."));
          }
        });
      });
    });

    if (!excludedPorts.has(port)) {
      return port;
    }
  }

  throw new Error("Failed to allocate a unique ephemeral port after 20 attempts.");
}

async function selectPort(name: string, preferredPort: number, selectedPorts: Set<number>) {
  if (!selectedPorts.has(preferredPort) && (await checkPort(preferredPort))) {
    selectedPorts.add(preferredPort);
    pushLog(`${name} host port selected: ${preferredPort}.`);
    return preferredPort;
  }

  const port = await getEphemeralPort(selectedPorts);
  selectedPorts.add(port);
  pushLog(`${name} preferred host port ${preferredPort} is unavailable; selected ${port}.`);
  return port;
}

async function selectRuntimePorts() {
  setPhase("checking", "正在探测本机可用端口。");
  const selectedPorts = new Set<number>();
  runtimePorts = {
    web: await selectPort("Web", preferredPorts.web, selectedPorts),
    api: await selectPort("API", preferredPorts.api, selectedPorts),
    postgres: await selectPort("Postgres", preferredPorts.postgres, selectedPorts),
    redis: await selectPort("Redis", preferredPorts.redis, selectedPorts),
    minio: await selectPort("MinIO", preferredPorts.minio, selectedPorts),
    minioConsole: await selectPort("MinIO Console", preferredPorts.minioConsole, selectedPorts)
  };

  const urls = getRuntimeUrls();
  status.webUrl = urls.webUrl;
  status.adminUrl = urls.adminUrl;
  broadcastStatus();
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
    `PORT=${runtimePorts.api}`,
    `WEB_PORT=${runtimePorts.web}`,
    "POSTGRES_DB=yunwu_platform",
    "POSTGRES_USER=postgres",
    "POSTGRES_PASSWORD=postgres",
    `POSTGRES_PORT=${runtimePorts.postgres}`,
    `REDIS_PORT=${runtimePorts.redis}`,
    `MINIO_PORT=${runtimePorts.minio}`,
    `MINIO_CONSOLE_PORT=${runtimePorts.minioConsole}`,
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
    `CORS_ORIGIN=http://127.0.0.1:${runtimePorts.web},http://localhost:${runtimePorts.web}`,
    `WEB_ORIGIN=http://127.0.0.1:${runtimePorts.web}`,
    `MINIO_PUBLIC_BASE_URL=http://127.0.0.1:${runtimePorts.minio}/yunwu-assets`,
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

function isPortAllocatedMessage(message: string) {
  return /port is already allocated|bind:|Ports are not available/i.test(message);
}

function runComposeProcess(args: string[], detail: string) {
  return new Promise<void>((resolvePromise, reject) => {
    pushLog(`Running docker ${args.join(" ")}`);
    setService("Compose Stack", { status: "running", detail });
    currentProcess = spawn("docker", args, { windowsHide: true });
    let output = "";

    currentProcess.stdout.on("data", (chunk) => {
      const line = chunk.toString().trim();
      output += `${line}\n`;
      pushLog(line);
    });
    currentProcess.stderr.on("data", (chunk) => {
      const line = chunk.toString().trim();
      output += `${line}\n`;
      pushLog(line);
      if (isPortAllocatedMessage(line)) {
        setService("Compose Stack", { status: "error", detail: "端口冲突：将重新探测端口并重试；如仍失败，请点击重试。" });
      }
    });
    currentProcess.on("error", reject);
    currentProcess.on("close", (code) => {
      currentProcess = undefined;
      if (code === 0) {
        setService("Compose Stack", { status: "healthy", detail: "Compose 服务栈已启动" });
        resolvePromise();
      } else {
        reject(new Error(`docker compose exited with ${code}.\n${output}`));
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
  const urls = getRuntimeUrls();
  const checks = [
    { name: "API /health", url: urls.healthUrl },
    { name: "API /readiness", url: urls.readinessUrl },
    { name: "Web /health", url: urls.webHealthUrl }
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
    await selectRuntimePorts();
    let { envPath, overridePath } = await writeRuntimeFiles();
    setPhase("starting", "正在启动 Docker Compose 服务栈。");
    try {
      await startCompose(envPath, overridePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isPortAllocatedMessage(message)) {
        throw error;
      }

      pushLog("Docker reported a host port allocation conflict. Re-probing ports and retrying once; if it fails again, click retry.");
      setService("Compose Stack", { status: "running", detail: "端口冲突，正在重新探测端口并重试一次。" });
      await selectRuntimePorts();
      ({ envPath, overridePath } = await writeRuntimeFiles());
      await startCompose(envPath, overridePath);
    }
    await waitForHealth();
    setPhase("ready", "服务已就绪，正在打开工作台。");
    await mainWindow?.loadURL(getRuntimeUrls().webUrl);
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
  await mainWindow?.loadURL(getRuntimeUrls().webUrl);
});
ipcMain.handle("desktop:open-admin", async () => {
  await mainWindow?.loadURL(getRuntimeUrls().adminUrl);
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
