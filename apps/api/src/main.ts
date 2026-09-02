import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { AppModule } from "./app.module";
import { AppLoggerService } from "./logging/app-logger.service";
import {
  applySqliteMigrations,
  ensureSqliteDirectory,
} from "./prisma/sqlite-migrations";

// 与 ApiConfigModule 的 envFilePath 保持一致；已存在的进程环境变量优先
function preloadEnvFiles() {
  for (const envPath of [".env.local", ".env", "../../.env.local", "../../.env"]) {
    const fullPath = resolve(process.cwd(), envPath);
    if (existsSync(fullPath)) {
      try {
        loadEnvFile(fullPath);
      } catch {
        // 格式异常的 env 文件交由 ConfigModule 处理
      }
    }
  }
}

function normalizeDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "file:./data/yunwu.db";
  if (!raw.startsWith("file:")) {
    return raw;
  }

  const rawPath = raw.slice("file:".length).split("?")[0];
  const absolutePath = isAbsolute(rawPath)
    ? rawPath
    : resolve(process.cwd(), rawPath);
  const normalized = `file:${absolutePath.replaceAll("\\", "/")}`;
  process.env.DATABASE_URL = normalized;
  return normalized;
}

async function prepareDatabase(logger: Logger) {
  const databaseUrl = normalizeDatabaseUrl();
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  await ensureSqliteDirectory(databaseUrl);
  if ((process.env.RUN_MIGRATIONS_ON_BOOT ?? "true") === "false") {
    return;
  }

  const { applied } = await applySqliteMigrations({
    databaseUrl,
    log: (message) => logger.log(message),
  });
  if (applied.length > 0) {
    logger.log(`Applied ${applied.length} database migration(s).`);
  }
}

function setupWebHosting(app: NestExpressApplication, logger: Logger) {
  const config = app.get(ConfigService);
  const distDir = config.get<string>("web.distDir");
  if (!distDir) {
    return;
  }

  const webRoot = isAbsolute(distDir) ? distDir : resolve(process.cwd(), distDir);
  const indexHtml = join(webRoot, "index.html");
  if (!existsSync(indexHtml)) {
    logger.warn(
      `WEB_DIST_DIR is set but ${indexHtml} does not exist; skipping web hosting.`,
    );
    return;
  }

  app.useStaticAssets(webRoot, {
    index: false,
    setHeaders: (res, path) => {
      // Vite 产物带内容 hash，可长缓存；其余（含 index.html）禁缓存
      if (/[\\/]assets[\\/]/.test(path)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      }
    },
  });

  // SPA fallback：作为中间件注册（静态资源之后、Nest 路由之前生效），
  // Nest 的 404 catch-all 在 init 时挂在最后，晚于它注册的处理器不会被执行
  type SpaRequest = { method: string; path: string };
  type SpaResponse = {
    setHeader: (name: string, value: string) => void;
    sendFile: (path: string) => void;
  };
  app.use((req: SpaRequest, res: SpaResponse, next: () => void) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return next();
    }

    const path = req.path;
    if (
      path === "/api" ||
      path.startsWith("/api/") ||
      path === "/health" ||
      path === "/readiness"
    ) {
      return next();
    }

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(indexHtml);
  });

  logger.log(`Serving web assets from ${webRoot}.`);
}

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  preloadEnvFiles();
  await prepareDatabase(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useLogger(app.get(AppLoggerService));
  const config = app.get(ConfigService);
  const port = config.get<number>("port", 3000);
  const corsOrigins = config.get<string[]>("cors.origins", [
    "http://127.0.0.1:3000",
  ]);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableShutdownHooks();

  setupWebHosting(app, logger);

  // 桌面端把 HOST 设为 127.0.0.1：只监听回环既避免把服务暴露到局域网，
  // 也绕开部分 Windows 机器上 0.0.0.0 绑定返回 listen UNKNOWN 的问题。
  const host = process.env.HOST?.trim() || "0.0.0.0";
  await app.listen(port, host);
  logger.log(`Server listening on http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${port}`);
}

void bootstrap();
