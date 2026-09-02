import { PrismaClient } from "@prisma/client";
import { createHash, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Client as PgClient } from "pg";
import {
  applySqliteMigrations,
  ensureSqliteDirectory,
} from "../prisma/sqlite-migrations";
import {
  getProviderRoute,
  providerRouteIdFromLegacyBaseUrl,
} from "../openai-compatible/provider-route-registry";

/**
 * v0.6.1 → v0.7.0 旧数据导入工具。
 *
 * 从旧版 Docker 栈（PostgreSQL + MinIO）读取全部业务数据，
 * 写入新版 SQLite 数据库与本地资产目录。由桌面壳在检测到旧数据卷时调用，
 * 也可手动运行（需先将旧容器端口映射到本机）。
 *
 * 必需环境变量：
 *   LEGACY_DATABASE_URL   旧 PostgreSQL 连接串
 *   DATABASE_URL          目标 SQLite（file:...）
 *   LOCAL_STORAGE_PATH    目标资产目录
 * 可选（缺省则跳过对象迁移）：
 *   LEGACY_MINIO_ENDPOINT / LEGACY_MINIO_PORT / LEGACY_MINIO_ACCESS_KEY /
 *   LEGACY_MINIO_SECRET_KEY / LEGACY_MINIO_BUCKET
 *   FORCE_WIPE=true       目标库已有业务数据时仍强制清空导入
 */

type Row = Record<string, unknown>;

function log(level: "info" | "warn" | "error", message: string) {
  process.stdout.write(`${JSON.stringify({ level, message })}\n`);
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function asJson(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value as object;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function chunked<T>(
  items: T[],
  size: number,
  handler: (batch: T[]) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += size) {
    await handler(items.slice(index, index + size));
  }
}

// ---------------------------------------------------------------------------
// MinIO（S3 兼容）对象下载：自包含 SigV4 实现，不依赖 Nest DI
// ---------------------------------------------------------------------------

interface MinioConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function signingKey(secret: string, date: string) {
  const kDate = createHmac("sha256", `AWS4${secret}`).update(date).digest();
  const kRegion = createHmac("sha256", kDate).update("us-east-1").digest();
  const kService = createHmac("sha256", kRegion).update("s3").digest();
  return createHmac("sha256", kService).update("aws4_request").digest();
}

function signedS3Request(
  config: MinioConfig,
  path: string,
  query: Record<string, string>,
) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const host = `${config.endpoint}:${config.port}`;
  const payloadHash = sha256Hex("");
  const canonicalQuery = Object.keys(query)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
    )
    .join("&");
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    "GET",
    path,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/us-east-1/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretKey, dateStamp))
    .update(stringToSign)
    .digest("hex");

  return {
    url: `http://${host}${path}${canonicalQuery ? `?${canonicalQuery}` : ""}`,
    headers: {
      authorization:
        `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  };
}

async function listMinioObjects(config: MinioConfig): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const query: Record<string, string> = { "list-type": "2" };
    if (continuationToken) {
      query["continuation-token"] = continuationToken;
    }
    const request = signedS3Request(config, `/${config.bucket}`, query);
    const response = await fetch(request.url, { headers: request.headers });
    if (!response.ok) {
      throw new Error(`MinIO list failed with status ${response.status}`);
    }

    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
      keys.push(decodeXmlEntities(match[1]));
    }
    const tokenMatch = xml.match(
      /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/,
    );
    continuationToken = tokenMatch ? decodeXmlEntities(tokenMatch[1]) : undefined;
  } while (continuationToken);

  return keys;
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

async function downloadMinioObject(config: MinioConfig, key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const request = signedS3Request(config, `/${config.bucket}/${encodedKey}`, {});
  const response = await fetch(request.url, { headers: request.headers });
  if (!response.ok) {
    throw new Error(`MinIO get ${key} failed with status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// ---------------------------------------------------------------------------
// 导入主流程
// ---------------------------------------------------------------------------

async function fetchAll(pg: PgClient, table: string): Promise<Row[]> {
  const result = await pg.query(`SELECT * FROM "${table}" ORDER BY 1`);
  return result.rows as Row[];
}

async function assertTargetIsFresh(prisma: PrismaClient) {
  if ((process.env.FORCE_WIPE ?? "false") === "true") {
    return;
  }

  const [conversations, tasks, assets] = await Promise.all([
    prisma.conversation.count(),
    prisma.task.count(),
    prisma.asset.count(),
  ]);
  if (conversations > 0 || tasks > 0 || assets > 0) {
    throw new Error(
      "Target database already contains user data. Set FORCE_WIPE=true to overwrite.",
    );
  }
}

async function wipeTarget(prisma: PrismaClient) {
  // FK 逆序清空；缺省数据（内置账号）会在下次 API 启动时按 email upsert 恢复
  await prisma.taskEvent.deleteMany();
  await prisma.taskBatchItem.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.task.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.modelCapability.deleteMany();
  await prisma.providerOperationalState.deleteMany();
  await prisma.providerConfiguration.deleteMany();
}

function rewriteAssetUrl(row: Row): string | null {
  const storageKey = asString(row.storage_key);
  const url = asString(row.url);
  if (!storageKey) {
    return url;
  }

  // 旧版 url 指向 MinIO 代理或旧端口；统一改写为同源相对路径
  return `/api/assets/${storageKey}/content`;
}

function rewriteAssetMetadata(row: Row) {
  const metadata = asJson(row.metadata);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }

  const record = { ...(metadata as Record<string, unknown>) };
  if (record.storage === "s3" || record.storage === "minio") {
    record.storage = "local";
    delete record.objectUrl;
  }
  return record;
}

async function importDatabase(pg: PgClient, prisma: PrismaClient) {
  const users = await fetchAll(pg, "users");
  await chunked(users, 200, async (batch) => {
    await prisma.user.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        email: asString(row.email)?.trim().toLowerCase() ?? null,
        displayName: asString(row.display_name),
        avatarUrl: asString(row.avatar_url),
        role: asString(row.role) ?? "member",
        passwordHash: asString(row.password_hash),
        passwordUpdatedAt: asDate(row.password_updated_at),
        metadata: asJson(row.metadata),
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${users.length} user(s).`);

  const userSettings = await fetchAll(pg, "user_settings");
  await chunked(userSettings, 200, async (batch) => {
    await prisma.userSettings.createMany({
      data: batch.map((row) => {
        const baseUrl = asString(row.base_url) ?? "https://yunwu.ai";
        const routeId = providerRouteIdFromLegacyBaseUrl(baseUrl) ?? "apixo";
        return {
          id: String(row.id),
          userId: String(row.user_id),
          baseUrl: getProviderRoute(routeId).baseUrl,
          activeRouteId: routeId,
          // 密钥改由 user_provider_credentials 按线路保存，旧列不再写入。
          providerApiKey: null,
          enabledModelIds: asJson(row.enabled_model_ids) ?? [],
          enabledModelIdsByRoute: {
            [routeId]: asJson(row.enabled_model_ids) ?? [],
          },
          ui: asJson(row.ui),
          createdAt: asDate(row.created_at) ?? new Date(),
          updatedAt: asDate(row.updated_at) ?? new Date(),
        };
      }),
    });
  });
  log("info", `Imported ${userSettings.length} user settings row(s).`);

  // 旧密钥归属它当时使用的线路，其余两条线路保持未配置。
  const legacyCredentials = userSettings
    .map((row) => {
      const apiKey = asString(row.provider_api_key)?.trim();
      if (!apiKey) return undefined;
      const routeId =
        providerRouteIdFromLegacyBaseUrl(asString(row.base_url) ?? "") ?? "apixo";
      return {
        userId: String(row.user_id),
        providerRouteId: routeId,
        apiKey,
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (legacyCredentials.length) {
    await chunked(legacyCredentials, 200, async (batch) => {
      await prisma.userProviderCredential.createMany({ data: batch });
    });
  }
  log("info", `Imported ${legacyCredentials.length} provider credential(s).`);

  const conversations = await fetchAll(pg, "conversations");
  await chunked(conversations, 200, async (batch) => {
    await prisma.conversation.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        title: asString(row.title),
        status: asString(row.status) ?? "active",
        metadata: asJson(row.metadata),
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${conversations.length} conversation(s).`);

  const messages = await fetchAll(pg, "messages");
  await chunked(messages, 200, async (batch) => {
    await prisma.message.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        conversationId: String(row.conversation_id),
        userId: asString(row.user_id),
        role: asString(row.role) ?? "user",
        content: asString(row.content) ?? "",
        metadata: asJson(row.metadata),
        createdAt: asDate(row.created_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${messages.length} message(s).`);

  // tasks 存在自引用（source_task_id）：先插入基础行，再补写引用
  const tasks = await fetchAll(pg, "tasks");
  await chunked(tasks, 200, async (batch) => {
    await prisma.task.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        userId: asString(row.user_id),
        conversationId: asString(row.conversation_id),
        sourceTaskId: null,
        sourceAction: asString(row.source_action),
        type: asString(row.type) ?? "image.generate",
        status: asString(row.status) ?? "queued",
        progress: asNumber(row.progress),
        input: asJson(row.input),
        output: asJson(row.output),
        errorMessage: asString(row.error_message),
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      })),
    });
  });
  const taskIds = new Set(tasks.map((row) => String(row.id)));
  for (const row of tasks) {
    const sourceTaskId = asString(row.source_task_id);
    if (sourceTaskId && taskIds.has(sourceTaskId)) {
      await prisma.task.update({
        where: { id: String(row.id) },
        data: { sourceTaskId },
      });
    }
  }
  log("info", `Imported ${tasks.length} task(s).`);

  const assets = await fetchAll(pg, "assets");
  await chunked(assets, 200, async (batch) => {
    await prisma.asset.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        userId: asString(row.user_id),
        messageId: asString(row.message_id),
        taskId: asString(row.task_id),
        type: asString(row.type) ?? "generated",
        mimeType: asString(row.mime_type),
        url: rewriteAssetUrl(row),
        storageKey: asString(row.storage_key),
        status: asString(row.status) ?? "ready",
        metadata: rewriteAssetMetadata(row),
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${assets.length} asset(s).`);

  const batchItems = await fetchAll(pg, "task_batch_items");
  await chunked(batchItems, 200, async (batch) => {
    await prisma.taskBatchItem.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        taskId: String(row.task_id),
        batchIndex: asNumber(row.batch_index),
        status: asString(row.status) ?? "queued",
        progress: asNumber(row.progress),
        assetId: asString(row.asset_id),
        errorMessage: asString(row.error_message),
        attempt: asNumber(row.attempt),
        providerSummary: asJson(row.provider_summary),
        output: asJson(row.output),
        startedAt: asDate(row.started_at),
        completedAt: asDate(row.completed_at),
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${batchItems.length} task batch item(s).`);

  const taskEvents = await fetchAll(pg, "task_events");
  await chunked(taskEvents, 500, async (batch) => {
    await prisma.taskEvent.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        taskId: String(row.task_id),
        eventType: asString(row.event_type) ?? "unknown",
        status: asString(row.status),
        summary: asString(row.summary) ?? "",
        details: asJson(row.details),
        createdAt: asDate(row.created_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${taskEvents.length} task event(s).`);

  const capabilities = await fetchAll(pg, "model_capabilities");
  await chunked(capabilities, 200, async (batch) => {
    await prisma.modelCapability.createMany({
      data: batch.map((row) => ({
        id: String(row.id),
        provider: asString(row.provider) ?? "yunwu",
        model: asString(row.model) ?? "",
        modality: asString(row.modality) ?? "",
        capabilities: asJson(row.capabilities) ?? {},
        enabled: row.enabled !== false,
        metadata: asJson(row.metadata),
        createdAt: asDate(row.created_at) ?? new Date(),
        updatedAt: asDate(row.updated_at) ?? new Date(),
      })),
    });
  });
  log("info", `Imported ${capabilities.length} model capability row(s).`);

  const operationalStates = await fetchAll(pg, "provider_operational_state");
  for (const row of operationalStates) {
    await prisma.providerOperationalState.create({
      data: {
        id: String(row.id),
        lastCheckStatus: asString(row.last_check_status),
        lastCheckAt: asDate(row.last_check_at),
        lastCheckLatencyMs:
          row.last_check_latency_ms === null
            ? null
            : asNumber(row.last_check_latency_ms),
        lastCheckError: asJson(row.last_check_error),
        modelsSource: asString(row.models_source),
        remoteModelsSnapshot: asJson(row.remote_models_snapshot),
        lastTestTaskId: asString(row.last_test_task_id),
        lastTestStatus: asString(row.last_test_status),
        lastTestAt: asDate(row.last_test_at),
        lastTestError: asString(row.last_test_error),
        activeAlerts: asJson(row.active_alerts),
        lastAcknowledgedAt: asDate(row.last_acknowledged_at),
      },
    });
  }
  log("info", `Imported ${operationalStates.length} provider state row(s).`);

  const providerConfigurations = await fetchAll(pg, "provider_configuration");
  for (const row of providerConfigurations) {
    await prisma.providerConfiguration.create({
      data: {
        id: String(row.id),
        baseUrl: asString(row.base_url) ?? "https://yunwu.ai",
      },
    });
  }
  log("info", `Imported ${providerConfigurations.length} provider config row(s).`);
}

async function importMinioObjects(storagePath: string) {
  const endpoint = process.env.LEGACY_MINIO_ENDPOINT;
  const bucket = process.env.LEGACY_MINIO_BUCKET;
  if (!endpoint || !bucket) {
    log("info", "LEGACY_MINIO_* not configured; skipping object import.");
    return;
  }

  const config: MinioConfig = {
    endpoint,
    port: Number(process.env.LEGACY_MINIO_PORT ?? 9000),
    accessKey: process.env.LEGACY_MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.LEGACY_MINIO_SECRET_KEY ?? "minioadmin",
    bucket,
  };

  const keys = await listMinioObjects(config);
  log("info", `Found ${keys.length} object(s) in legacy bucket.`);

  let done = 0;
  let failed = 0;
  for (const key of keys) {
    try {
      const buffer = await downloadMinioObject(config, key);
      const target = join(storagePath, key);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, buffer);
      done += 1;
      if (done % 50 === 0) {
        log("info", `Downloaded ${done}/${keys.length} objects.`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      log("warn", `Object ${key} download failed: ${message}`);
    }
  }
  log("info", `Object import finished: ${done} ok, ${failed} failed.`);
}

async function main() {
  const legacyDatabaseUrl = process.env.LEGACY_DATABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;
  const storagePath = process.env.LOCAL_STORAGE_PATH;
  if (!legacyDatabaseUrl || !databaseUrl || !storagePath) {
    throw new Error(
      "LEGACY_DATABASE_URL, DATABASE_URL and LOCAL_STORAGE_PATH are required.",
    );
  }

  await ensureSqliteDirectory(databaseUrl);
  await applySqliteMigrations({
    databaseUrl,
    log: (message) => log("info", message),
  });
  await mkdir(storagePath, { recursive: true });

  const pg = new PgClient({ connectionString: legacyDatabaseUrl });
  await pg.connect();
  log("info", "Connected to legacy PostgreSQL.");

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  try {
    await assertTargetIsFresh(prisma);
    await wipeTarget(prisma);
    await importDatabase(pg, prisma);
    await importMinioObjects(storagePath);
    log("info", "Legacy import completed successfully.");
  } finally {
    await prisma.$disconnect();
    await pg.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  log("error", `Legacy import failed: ${message}`);
  process.exit(1);
});
