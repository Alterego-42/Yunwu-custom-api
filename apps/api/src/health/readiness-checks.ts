import type { PrismaClient } from "@prisma/client";
import IORedis from "ioredis";

export type DependencyState = "ok" | "error" | "skipped";

export interface DependencyCheckResult {
  name: "postgres" | "redis" | "storage";
  status: DependencyState;
  latencyMs: number;
  message: string;
}

export interface ReadinessReport {
  status: "ok" | "error";
  service: string;
  timestamp: string;
  checks: Record<string, DependencyCheckResult>;
}

export interface ReadinessEnvironment {
  redisUrl?: string;
  storageMode: string;
  minioEndpoint?: string;
  minioPort: number;
  minioUseSsl: boolean;
}

type PrismaQueryable = Pick<PrismaClient, "$queryRawUnsafe">;

export function createReadinessEnvironmentFromRecord(
  values: Record<string, string | undefined>,
): ReadinessEnvironment {
  return {
    redisUrl: values.REDIS_URL,
    storageMode: values.STORAGE_MODE ?? "local",
    minioEndpoint: values.MINIO_ENDPOINT,
    minioPort: Number(values.MINIO_PORT ?? 9000),
    minioUseSsl: values.MINIO_USE_SSL === "true",
  };
}

export async function checkDatabaseReadiness(
  prisma: PrismaQueryable,
): Promise<DependencyCheckResult> {
  return measure("postgres", async () => {
    await prisma.$queryRawUnsafe("SELECT 1");
    return "PostgreSQL query succeeded.";
  });
}

export async function checkRedisReadiness(
  redisUrl?: string,
): Promise<DependencyCheckResult> {
  if (!redisUrl) {
    return {
      name: "redis",
      status: "error",
      latencyMs: 0,
      message: "REDIS_URL is not configured.",
    };
  }

  const client = new IORedis(redisUrl, {
    connectTimeout: 2_000,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  try {
    return await measure("redis", async () => {
      await client.connect();
      const response = await client.ping();
      if (response !== "PONG") {
        throw new Error(`Unexpected Redis ping response: ${response}`);
      }

      return "Redis ping succeeded.";
    });
  } finally {
    client.disconnect();
  }
}

export async function checkObjectStorageReadiness(
  environment: ReadinessEnvironment,
): Promise<DependencyCheckResult> {
  if (environment.storageMode === "local") {
    return skipped("storage", "Local storage mode enabled.");
  }

  if (!environment.minioEndpoint) {
    return skipped("storage", "Remote S3 probe not configured.");
  }

  const probeUrl = buildMinioHealthUrl(environment);
  return measure("storage", async () => {
    const response = await fetch(probeUrl, {
      signal: AbortSignal.timeout(2_000),
    });

    if (!response.ok) {
      throw new Error(`Object storage health responded with ${response.status}.`);
    }

    return `Object storage probe succeeded at ${probeUrl}.`;
  });
}

export function createReadinessReport(
  service: string,
  checks: DependencyCheckResult[],
): ReadinessReport {
  return {
    status: checks.some((check) => check.status === "error") ? "error" : "ok",
    service,
    timestamp: new Date().toISOString(),
    checks: Object.fromEntries(checks.map((check) => [check.name, check])),
  };
}

async function measure(
  name: DependencyCheckResult["name"],
  check: () => Promise<string>,
): Promise<DependencyCheckResult> {
  const startedAt = Date.now();

  try {
    const message = await check();
    return {
      name,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      message,
    };
  } catch (error) {
    return {
      name,
      status: "error",
      latencyMs: Date.now() - startedAt,
      message: getErrorMessage(error),
    };
  }
}

function skipped(
  name: DependencyCheckResult["name"],
  message: string,
): DependencyCheckResult {
  return {
    name,
    status: "skipped",
    latencyMs: 0,
    message,
  };
}

function buildMinioHealthUrl(environment: ReadinessEnvironment) {
  const protocol = environment.minioUseSsl ? "https" : "http";
  const endpoint = environment.minioEndpoint ?? "127.0.0.1";

  if (/^https?:\/\//.test(endpoint)) {
    const url = new URL(endpoint);
    if (!url.port) {
      url.port = environment.minioPort.toString();
    }
    url.pathname = "/minio/health/live";
    url.search = "";
    return url.toString();
  }

  const host = endpoint.includes(":")
    ? endpoint
    : `${endpoint}:${environment.minioPort}`;
  return `${protocol}://${host}/minio/health/live`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
