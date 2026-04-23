import { Injectable } from "@nestjs/common";
import { Prisma, type TaskStatus } from "@prisma/client";
import type {
  ProviderAlert,
  ProviderAdminError,
  ProviderHealthCheck,
  ProviderModelsSource,
} from "@yunwu/shared";
import { PrismaService } from "../prisma/prisma.service";

export const PROVIDER_OPERATIONAL_STATE_ID = "singleton";

export interface ProviderOperationalStateRecord {
  id: string;
  lastCheckStatus: string | null;
  lastCheckAt: Date | null;
  lastCheckLatencyMs: number | null;
  lastCheckError: unknown | null;
  modelsSource: string | null;
  remoteModelsSnapshot: unknown | null;
  lastTestTaskId: string | null;
  lastTestStatus: TaskStatus | null;
  lastTestAt: Date | null;
  lastTestError: string | null;
  activeAlerts: unknown | null;
  lastAcknowledgedAt: Date | null;
  updatedAt: Date;
}

export interface PersistProviderCheckInput {
  check: ProviderHealthCheck;
  latencyMs: number;
  remoteModelIds?: string[];
}

export interface PersistProviderTestQueuedInput {
  taskId: string;
  testedAt: Date;
}

export interface PersistProviderTestFinishedInput {
  taskId: string;
  status: TaskStatus;
  error?: string | null;
}

@Injectable()
export class ProviderOperationalStateService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(): Promise<ProviderOperationalStateRecord | null> {
    const rows = await this.prisma.$queryRaw<ProviderOperationalStateRecord[]>(
      Prisma.sql`
        SELECT
          "id",
          "last_check_status" AS "lastCheckStatus",
          "last_check_at" AS "lastCheckAt",
          "last_check_latency_ms" AS "lastCheckLatencyMs",
          "last_check_error" AS "lastCheckError",
          "models_source" AS "modelsSource",
          "remote_models_snapshot" AS "remoteModelsSnapshot",
          "last_test_task_id" AS "lastTestTaskId",
          "last_test_status" AS "lastTestStatus",
          "last_test_at" AS "lastTestAt",
          "last_test_error" AS "lastTestError",
          "active_alerts" AS "activeAlerts",
          "last_acknowledged_at" AS "lastAcknowledgedAt",
          "updated_at" AS "updatedAt"
        FROM "provider_operational_state"
        WHERE "id" = ${PROVIDER_OPERATIONAL_STATE_ID}
        LIMIT 1
      `,
    );

    return rows[0] ?? null;
  }

  async persistCheck(input: PersistProviderCheckInput) {
    const errorJson = input.check.error ? JSON.stringify(input.check.error) : null;
    const remoteModelsSnapshotJson =
      input.remoteModelIds !== undefined
        ? JSON.stringify({ modelIds: input.remoteModelIds })
        : null;

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "provider_operational_state" (
          "id",
          "last_check_status",
          "last_check_at",
          "last_check_latency_ms",
          "last_check_error",
          "models_source",
          "remote_models_snapshot",
          "updated_at"
        )
        VALUES (
          ${PROVIDER_OPERATIONAL_STATE_ID},
          ${input.check.status},
          ${new Date(input.check.checkedAt)},
          ${input.latencyMs},
          CAST(${errorJson} AS JSONB),
          ${input.check.modelsSource},
          CAST(${remoteModelsSnapshotJson} AS JSONB),
          NOW()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "last_check_status" = EXCLUDED."last_check_status",
          "last_check_at" = EXCLUDED."last_check_at",
          "last_check_latency_ms" = EXCLUDED."last_check_latency_ms",
          "last_check_error" = EXCLUDED."last_check_error",
          "models_source" = EXCLUDED."models_source",
          "remote_models_snapshot" = EXCLUDED."remote_models_snapshot",
          "updated_at" = NOW()
      `,
    );

    return this.getState();
  }

  async persistTestQueued(input: PersistProviderTestQueuedInput) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "provider_operational_state" (
          "id",
          "last_test_task_id",
          "last_test_status",
          "last_test_at",
          "last_test_error",
          "updated_at"
        )
        VALUES (
          ${PROVIDER_OPERATIONAL_STATE_ID},
          ${input.taskId},
          CAST(${"queued"} AS "TaskStatus"),
          ${input.testedAt},
          NULL,
          NOW()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "last_test_task_id" = EXCLUDED."last_test_task_id",
          "last_test_status" = EXCLUDED."last_test_status",
          "last_test_at" = EXCLUDED."last_test_at",
          "last_test_error" = NULL,
          "updated_at" = NOW()
      `,
    );

    return this.getState();
  }

  async persistTestFinished(input: PersistProviderTestFinishedInput) {
    const rows = await this.prisma.$queryRaw<Array<{ matched: number }>>(
      Prisma.sql`
        UPDATE "provider_operational_state"
        SET
          "last_test_status" = CAST(${input.status} AS "TaskStatus"),
          "last_test_error" = ${input.error ?? null},
          "updated_at" = NOW()
        WHERE
          "id" = ${PROVIDER_OPERATIONAL_STATE_ID}
          AND "last_test_task_id" = ${input.taskId}
        RETURNING 1 AS "matched"
      `,
    );

    return rows.length > 0;
  }

  async persistAlerts(
    alerts: ProviderAlert[],
    input: { lastAcknowledgedAt?: Date | null } = {},
  ) {
    const alertsJson = JSON.stringify(alerts);

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "provider_operational_state" (
          "id",
          "active_alerts",
          "last_acknowledged_at",
          "updated_at"
        )
        VALUES (
          ${PROVIDER_OPERATIONAL_STATE_ID},
          CAST(${alertsJson} AS JSONB),
          ${input.lastAcknowledgedAt ?? null},
          NOW()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "active_alerts" = EXCLUDED."active_alerts",
          "last_acknowledged_at" = COALESCE(
            EXCLUDED."last_acknowledged_at",
            "provider_operational_state"."last_acknowledged_at"
          ),
          "updated_at" = NOW()
      `,
    );

    return this.getState();
  }

  async acknowledgeAlert(alertId: string) {
    const state = await this.getState();
    if (!state) {
      return null;
    }

    const alerts = this.getAlerts(state);
    const matched = alerts.find((alert) => alert.id === alertId);
    if (!matched) {
      return null;
    }

    if (matched.acknowledgedAt) {
      return state;
    }

    const acknowledgedAt = new Date();
    const nextAlerts = alerts.map((alert) =>
      alert.id === alertId
        ? { ...alert, acknowledgedAt: acknowledgedAt.toISOString() }
        : alert,
    );

    return this.persistAlerts(nextAlerts, { lastAcknowledgedAt: acknowledgedAt });
  }

  toPersistedHealthCheck(
    state: ProviderOperationalStateRecord | null,
    fallback: Omit<ProviderHealthCheck, "checkedAt" | "status" | "modelsSource">,
  ): ProviderHealthCheck | undefined {
    if (!state?.lastCheckAt || !state.lastCheckStatus || !state.modelsSource) {
      return undefined;
    }

    return {
      ...fallback,
      checkedAt: state.lastCheckAt.toISOString(),
      status: this.asHealthStatus(state.lastCheckStatus),
      modelsSource: this.asModelsSource(state.modelsSource),
      ...(typeof state.lastCheckLatencyMs === "number"
        ? { latencyMs: state.lastCheckLatencyMs }
        : {}),
      ...(this.asProviderAdminError(state.lastCheckError)
        ? { error: this.asProviderAdminError(state.lastCheckError) }
        : {}),
    } as ProviderHealthCheck;
  }

  getRemoteModelIds(
    state: ProviderOperationalStateRecord | null,
  ): string[] | undefined {
    const snapshot = this.asRecord(state?.remoteModelsSnapshot);
    const modelIds = snapshot.modelIds;

    return Array.isArray(modelIds)
      ? modelIds.filter((item): item is string => typeof item === "string")
      : undefined;
  }

  getAlerts(state: ProviderOperationalStateRecord | null): ProviderAlert[] {
    if (!Array.isArray(state?.activeAlerts)) {
      return [];
    }

    return state.activeAlerts
      .map((item) => this.asProviderAlert(item))
      .filter((item): item is ProviderAlert => Boolean(item));
  }

  private asHealthStatus(value: string) {
    return value === "ok" || value === "degraded" || value === "error"
      ? value
      : "error";
  }

  private asModelsSource(value: string): ProviderModelsSource {
    return value === "configured" ||
      value === "remote" ||
      value === "unavailable"
      ? value
      : "unavailable";
  }

  private asProviderAdminError(value: unknown): ProviderAdminError | undefined {
    const record = this.asRecord(value);
    return typeof record.category === "string" &&
      typeof record.message === "string" &&
      typeof record.retryable === "boolean"
      ? ({
          category: record.category,
          message: record.message,
          retryable: record.retryable,
          ...(typeof record.statusCode === "number"
            ? { statusCode: record.statusCode }
            : {}),
        } as ProviderAdminError)
      : undefined;
  }

  private asProviderAlert(value: unknown): ProviderAlert | undefined {
    const record = this.asRecord(value);
    return typeof record.id === "string" &&
      (record.level === "critical" || record.level === "warning") &&
      typeof record.kind === "string" &&
      typeof record.title === "string" &&
      typeof record.message === "string" &&
      typeof record.createdAt === "string"
      ? ({
          id: record.id,
          level: record.level,
          kind: record.kind,
          title: record.title,
          message: record.message,
          createdAt: record.createdAt,
          ...(typeof record.relatedTaskId === "string"
            ? { relatedTaskId: record.relatedTaskId }
            : {}),
          ...(typeof record.acknowledgedAt === "string"
            ? { acknowledgedAt: record.acknowledgedAt }
            : {}),
        } as ProviderAlert)
      : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
