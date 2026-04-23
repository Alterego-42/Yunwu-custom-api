import { Injectable } from "@nestjs/common";
import type { ModelCapability } from "@prisma/client";
import type { ProviderAlert } from "@yunwu/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  ProviderOperationalStateRecord,
  ProviderOperationalStateService,
} from "./provider-operational-state.service";

const OPENAI_COMPATIBLE_PROVIDER = "openai-compatible";
const MAX_FAILED_TASK_ALERTS = 5;
const SUPPORTED_FAILURE_TYPES = ["image.generate", "image.edit"] as const;

@Injectable()
export class ProviderAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerState: ProviderOperationalStateService,
  ) {}

  async refreshAlerts(
    inputState?: ProviderOperationalStateRecord | null,
  ): Promise<ProviderOperationalStateRecord | null> {
    const state = inputState ?? (await this.providerState.getState());
    const existingAlerts = this.providerState.getAlerts(state);
    const nextAlerts = await this.buildAlerts(state, existingAlerts);

    return this.providerState.persistAlerts(nextAlerts);
  }

  async acknowledgeAlert(
    alertId: string,
  ): Promise<ProviderOperationalStateRecord | null> {
    return this.providerState.acknowledgeAlert(alertId);
  }

  private async buildAlerts(
    state: ProviderOperationalStateRecord | null,
    existingAlerts: ProviderAlert[],
  ): Promise<ProviderAlert[]> {
    const enabledModels = await this.prisma.modelCapability.findMany({
      where: {
        provider: OPENAI_COMPATIBLE_PROVIDER,
        enabled: true,
      },
      orderBy: [{ model: "asc" }, { modality: "asc" }],
    });
    const failedTasks = await this.prisma.task.findMany({
      where: {
        status: "failed",
        type: { in: [...SUPPORTED_FAILURE_TYPES] },
      },
      include: {
        conversation: {
          select: {
            metadata: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: MAX_FAILED_TASK_ALERTS + 3,
    });

    const alerts: ProviderAlert[] = [];
    const checkAlert = this.buildCheckFailedAlert(state);
    if (checkAlert) {
      alerts.push(checkAlert);
    }

    const testAlert = this.buildTestFailedAlert(state);
    if (testAlert) {
      alerts.push(testAlert);
    }

    const modelsAlert = this.buildMissingModelsAlert(state, enabledModels);
    if (modelsAlert) {
      alerts.push(modelsAlert);
    }

    const failedTaskAlerts = failedTasks
      .filter((task) => task.id !== state?.lastTestTaskId)
      .filter((task) => !this.isProviderTestConversation(task.conversation?.metadata))
      .slice(0, MAX_FAILED_TASK_ALERTS)
      .map((task) => ({
        id: `task-failed:${task.id}`,
        level: "warning" as const,
        kind: "task.failed",
        title:
          task.type === "image.edit" ? "最近图片编辑任务失败" : "最近图片生成任务失败",
        message:
          this.sanitizeDisplayText(task.errorMessage ?? "", 240) ||
          "最近一次图片任务失败，请检查任务详情。",
        createdAt: task.updatedAt.toISOString(),
        relatedTaskId: task.id,
      }));
    alerts.push(...failedTaskAlerts);

    const existingById = new Map(existingAlerts.map((alert) => [alert.id, alert]));
    return alerts
      .map((alert) => this.mergeAcknowledgement(alert, existingById.get(alert.id)))
      .sort((left, right) => {
        if (Boolean(left.acknowledgedAt) !== Boolean(right.acknowledgedAt)) {
          return left.acknowledgedAt ? 1 : -1;
        }
        if (left.level !== right.level) {
          return left.level === "critical" ? -1 : 1;
        }
        return right.createdAt.localeCompare(left.createdAt);
      });
  }

  private buildCheckFailedAlert(
    state: ProviderOperationalStateRecord | null,
  ): ProviderAlert | null {
    if (!state?.lastCheckAt || state.lastCheckStatus !== "error") {
      return null;
    }

    const error = this.asRecord(state.lastCheckError);
    return {
      id: "provider-check-failed",
      level: "critical",
      kind: "provider.check_failed",
      title: "Provider 健康检查失败",
      message:
        this.sanitizeDisplayText(
          typeof error.message === "string" ? error.message : "",
          240,
        ) || "最近一次 provider 健康检查失败，请检查上游连通性与配置。",
      createdAt: state.lastCheckAt.toISOString(),
    };
  }

  private buildTestFailedAlert(
    state: ProviderOperationalStateRecord | null,
  ): ProviderAlert | null {
    if (!state?.lastTestAt || state.lastTestStatus !== "failed") {
      return null;
    }

    return {
      id: "provider-test-failed",
      level: "critical",
      kind: "provider.test_failed",
      title: "Provider 测试生成失败",
      message:
        this.sanitizeDisplayText(state.lastTestError ?? "", 240) ||
        "最近一次 provider 测试生成失败。",
      createdAt: state.lastTestAt.toISOString(),
      ...(state.lastTestTaskId ? { relatedTaskId: state.lastTestTaskId } : {}),
    };
  }

  private buildMissingModelsAlert(
    state: ProviderOperationalStateRecord | null,
    enabledModels: ModelCapability[],
  ): ProviderAlert | null {
    if (state?.modelsSource !== "remote" || !state.lastCheckAt) {
      return null;
    }

    const remoteModelIds = new Set(this.providerState.getRemoteModelIds(state) ?? []);
    const enabledModelIds = [
      ...new Set(enabledModels.map((row) => row.model)),
    ];
    const missingModels = enabledModelIds.filter((model) => !remoteModelIds.has(model));

    if (missingModels.length === 0) {
      return null;
    }

    const preview = missingModels.slice(0, 5).join("、");
    return {
      id: "provider-models-missing",
      level:
        missingModels.length === enabledModelIds.length ? "critical" : "warning",
      kind: "provider.models_unavailable",
      title: "已启用模型未在远端返回",
      message:
        missingModels.length === 1
          ? `已启用模型 ${preview} 未出现在远端模型列表中。`
          : `有 ${missingModels.length} 个已启用模型未出现在远端模型列表中：${preview}。`,
      createdAt: state.lastCheckAt.toISOString(),
    };
  }

  private mergeAcknowledgement(
    alert: ProviderAlert,
    existing?: ProviderAlert,
  ): ProviderAlert {
    if (
      existing?.acknowledgedAt &&
      existing.createdAt === alert.createdAt &&
      existing.kind === alert.kind
    ) {
      return {
        ...alert,
        acknowledgedAt: existing.acknowledgedAt,
      };
    }

    return alert;
  }

  private isProviderTestConversation(value: unknown) {
    const metadata = this.asRecord(value);
    return metadata.type === "provider_test";
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private sanitizeDisplayText(value: string, maxLength: number) {
    const sanitized = value
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
      .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-api-key]")
      .replace(
        /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
        "[redacted-token]",
      )
      .replace(
        /\b(api[_-]?key|token|authorization|password|secret)=([^&\s]+)/gi,
        "$1=[redacted]",
      )
      .replace(/[A-Za-z0-9+/=_-]{64,}/g, "[redacted-token]");

    return sanitized.length > maxLength
      ? `${sanitized.slice(0, Math.max(0, maxLength - 3))}...`
      : sanitized.trim();
  }
}
