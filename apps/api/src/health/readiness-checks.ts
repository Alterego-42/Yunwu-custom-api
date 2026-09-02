import type { PrismaClient } from "@prisma/client";

export type DependencyState = "ok" | "error" | "skipped";

export interface DependencyCheckResult {
  name: "database" | "queue" | "storage";
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
  storageMode: string;
}

type PrismaQueryable = Pick<PrismaClient, "$queryRawUnsafe">;

export function createReadinessEnvironmentFromRecord(
  values: Record<string, string | undefined>,
): ReadinessEnvironment {
  return {
    storageMode: values.STORAGE_MODE ?? "local",
  };
}

export async function checkDatabaseReadiness(
  prisma: PrismaQueryable,
): Promise<DependencyCheckResult> {
  return measure("database", async () => {
    await prisma.$queryRawUnsafe("SELECT 1");
    return "SQLite query succeeded.";
  });
}

export function checkQueueReadiness(stats: {
  processorRegistered: boolean;
  pending: number;
  running: number;
}): DependencyCheckResult {
  if (!stats.processorRegistered) {
    return {
      name: "queue",
      status: "skipped",
      latencyMs: 0,
      message: "Task worker disabled; queue processor not registered.",
    };
  }

  return {
    name: "queue",
    status: "ok",
    latencyMs: 0,
    message: `In-process queue ready (pending=${stats.pending}, running=${stats.running}).`,
  };
}

export function checkObjectStorageReadiness(
  environment: ReadinessEnvironment,
): DependencyCheckResult {
  if (environment.storageMode === "local") {
    return skipped("storage", "Local storage mode enabled.");
  }

  return skipped("storage", "Remote object storage probe not configured.");
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
