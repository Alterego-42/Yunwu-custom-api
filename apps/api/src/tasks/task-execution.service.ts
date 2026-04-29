import { Injectable, Logger } from "@nestjs/common";
import { Prisma, type Asset, type TaskStatus } from "@prisma/client";
import { ConversationEventsService } from "../api/conversation-events.service";
import {
  OpenAICompatibleRequestError,
  OpenAICompatibleService,
} from "../openai-compatible/openai-compatible.service";
import { ProviderAlertsService } from "../openai-compatible/provider-alerts.service";
import { ProviderOperationalStateService } from "../openai-compatible/provider-operational-state.service";
import { PrismaService } from "../prisma/prisma.service";
import { TaskEventsService } from "./task-events.service";

type SupportedTaskCapability = "image.generate" | "image.edit";

interface TaskInputShape {
  model?: string;
  prompt?: string;
  assetIds?: string[];
  params?: Record<string, unknown>;
}

@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiCompatible: OpenAICompatibleService,
    private readonly providerState: ProviderOperationalStateService,
    private readonly providerAlerts: ProviderAlertsService,
    private readonly conversationEvents: ConversationEventsService,
    private readonly taskEvents: TaskEventsService,
  ) {}

  async execute(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        conversation: true,
        assets: true,
      },
    });

    if (!task || !task.conversationId || !task.userId || !task.conversation) {
      return;
    }

    if (this.isTerminalStatus(task.status)) {
      return;
    }

    const input = this.asRecord(task.input) as TaskInputShape;
    const capability = this.asSupportedCapability(task.type);

    await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: "submitted",
        progress: Math.max(task.progress, 20),
        errorMessage: null,
      },
    });
    await this.recordTaskEvent(task.id, "submitted", "submitted", {
      summary: "Task submitted.",
      title: "Task submitted",
      detail: "A worker accepted the task and is preparing the image request.",
      progress: Math.max(task.progress, 20),
    });
    this.publishTaskUpdated(task.conversationId, task.id, "submitted");

    try {
      const inputAssets = input.assetIds?.length
        ? await this.prisma.asset.findMany({
            where: {
              id: { in: input.assetIds },
              userId: task.userId,
              status: { in: ["ready", "deleted"] },
              type: { in: ["upload", "generated"] },
            },
          })
        : [];
      const inputAssetsById = new Map(
        inputAssets.map((asset) => [asset.id, asset]),
      );
      const orderedInputAssets = (input.assetIds ?? [])
        .map((assetId) => inputAssetsById.get(assetId))
        .filter((asset): asset is Asset => Boolean(asset));

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: "running",
          progress: 60,
        },
      });
      await this.recordTaskEvent(task.id, "running", "running", {
        summary: "Task running.",
        title: "Task running",
        detail: "The image request is running.",
        progress: 60,
      });
      this.publishTaskUpdated(task.conversationId, task.id, "running");

      const requestSummary = this.buildProviderRequestSummary(
        capability,
        input,
        orderedInputAssets,
      );
      await this.recordTaskEvent(task.id, "provider.request", "running", {
        summary: "Sanitized upstream request summary recorded.",
        details: requestSummary,
      });

      const result = await this.openaiCompatible.createImageTask({
        capability,
        model: input.model ?? "gpt-image-1",
        prompt: input.prompt ?? "",
        inputAssets: orderedInputAssets.map((asset) => ({
          id: asset.id,
          url: asset.url,
          mimeType: asset.mimeType,
          storageKey: asset.storageKey,
        })),
        params: input.params,
      });
      await this.recordTaskEvent(task.id, "provider.response", "running", {
        summary: "Sanitized upstream response summary recorded.",
        details: result.responseSummary,
      });

      const asset = await this.prisma.asset.create({
        data: {
          userId: task.userId,
          taskId: task.id,
          type: "generated",
          mimeType: result.mimeType,
          url: result.url,
          status: "ready",
          metadata: {
            width: result.width,
            height: result.height,
            mocked: result.mocked,
            provider: "openai-compatible",
            responseSummary: result.responseSummary,
          } as Prisma.InputJsonObject,
        },
      });

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: "succeeded",
          progress: 100,
          output: {
            assetIds: [asset.id],
            inputAssetIds: orderedInputAssets.map((item) => item.id),
            mocked: result.mocked,
          },
        },
      });
      await this.recordTaskEvent(task.id, "succeeded", "succeeded", {
        summary: "Task completed.",
        title: "Task completed",
        detail: "The image task completed successfully.",
        progress: 100,
        assetIds: [asset.id],
        details: {
          mocked: result.mocked,
        },
      });

      await this.prisma.message.create({
        data: {
          conversationId: task.conversationId,
          role: "assistant",
          content: "Image task completed.",
          metadata: {
            type: "image_result",
            taskId: task.id,
            assetIds: [asset.id],
            inputAssetIds: orderedInputAssets.map((item) => item.id),
          },
        },
      });
      await this.providerState.persistTestFinished({
        taskId: task.id,
        status: "succeeded",
      });
      await this.providerAlerts.refreshAlerts(await this.providerState.getState());
      this.publishTaskUpdated(task.conversationId, task.id, "succeeded");
    } catch (error) {
      const failure = this.buildFailureSummary(error);
      if (error instanceof OpenAICompatibleRequestError) {
        await this.recordTaskEvent(task.id, "provider.response", "running", {
          summary: "Sanitized upstream failure summary recorded.",
          details: this.sanitizeProviderResponseSummary(error.responseSummary),
        });
      }

      await this.prisma.task.update({
        where: { id: task.id },
        data: {
          status: "failed",
          progress: 100,
          errorMessage: failure.errorMessage,
        },
      });
      await this.recordTaskEvent(task.id, "failed", "failed", {
        summary: "Task failed.",
        title: failure.title,
        detail: failure.detail,
        errorMessage: failure.errorMessage,
        progress: 100,
        details: {
          category: failure.category,
          retryable: failure.retryable,
          statusCode: failure.statusCode,
        },
      });

      await this.prisma.message.create({
        data: {
          conversationId: task.conversationId,
          role: "assistant",
          content: failure.errorMessage,
          metadata: { type: "error_card", taskId: task.id },
        },
      });
      await this.providerState.persistTestFinished({
        taskId: task.id,
        status: "failed",
        error: failure.errorMessage,
      });
      await this.providerAlerts.refreshAlerts(await this.providerState.getState());
      this.publishTaskUpdated(task.conversationId, task.id, "failed");

      this.logger.error(`Task ${task.id} failed: ${failure.errorMessage}`);
    }
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private asSupportedCapability(value: string): SupportedTaskCapability {
    return value === "image.edit" ? "image.edit" : "image.generate";
  }

  private isTerminalStatus(status: TaskStatus) {
    return ["succeeded", "failed", "cancelled", "expired"].includes(status);
  }

  private publishTaskUpdated(
    conversationId: string,
    taskId: string,
    status: TaskStatus,
  ) {
    this.conversationEvents.publishTaskUpdated({
      conversationId,
      taskId,
      status,
    });
  }

  private buildProviderRequestSummary(
    capability: SupportedTaskCapability,
    input: TaskInputShape,
    inputAssets: Asset[],
  ) {
    const baseConfig = this.openaiCompatible.getBaseConfig();
    const prompt = input.prompt ?? "";

    return {
      mode: baseConfig.hasApiKey ? "live" : "mock",
      endpointPath:
        capability === "image.edit"
          ? "/v1/images/edits"
          : "/v1/images/generations",
      model: input.model ?? "gpt-image-1",
      capability,
      promptPreview: this.truncateText(prompt, 180),
      promptLength: prompt.length,
      inputAssetCount: inputAssets.length,
      inputAssetIds: inputAssets.map((asset) => asset.id),
      params: this.summarizeParams(input.params),
    };
  }

  private summarizeParams(params?: Record<string, unknown>) {
    if (!params) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [
        key,
        this.summarizeValue(value),
      ]),
    );
  }

  private summarizeValue(value: unknown): unknown {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      return typeof value === "string" ? this.truncateText(value, 120) : value;
    }

    if (Array.isArray(value)) {
      return {
        type: "array",
        length: value.length,
      };
    }

    if (value && typeof value === "object") {
      return {
        type: "object",
        keys: Object.keys(value).slice(0, 20),
      };
    }

    return typeof value;
  }

  private buildFailureSummary(error: unknown): {
    title: string;
    detail: string;
    errorMessage: string;
    category: string;
    retryable: boolean;
    statusCode?: number;
  } {
    const rawMessage =
      error instanceof Error ? error.message : "Image task failed.";
    const sanitizedMessage =
      this.sanitizeDisplayText(rawMessage, 240) || "Image task failed.";

    if (error instanceof OpenAICompatibleRequestError) {
      const statusCode = this.asNumber(error.responseSummary.statusCode);
      const upstreamMessage =
        this.sanitizeDisplayText(
          this.asString(error.responseSummary.errorMessage) ?? rawMessage,
          240,
        ) || sanitizedMessage;

      if (statusCode === 401 || statusCode === 403) {
        return {
          title: "Provider authentication failed",
          detail:
            "The image provider rejected the request because credentials or permissions are invalid.",
          errorMessage:
            "The image provider is not available because authentication failed.",
          category: "provider_auth",
          retryable: false,
          statusCode,
        };
      }

      if (statusCode === 429) {
        return {
          title: "Provider rate limit reached",
          detail:
            "The image provider is temporarily rate limited. Please retry later.",
          errorMessage:
            "The image provider is rate limited. Please retry later.",
          category: "rate_limited",
          retryable: true,
          statusCode,
        };
      }

      if (statusCode && statusCode >= 500) {
        return {
          title: "Provider unavailable",
          detail:
            "The image provider returned a temporary server error. Please retry later.",
          errorMessage:
            "The image provider is temporarily unavailable. Please retry later.",
          category: "provider_unavailable",
          retryable: true,
          statusCode,
        };
      }

      if (statusCode && statusCode >= 400) {
        return {
          title: "Image request rejected",
          detail:
            "The image provider rejected the request. Check the prompt, model, and input images before retrying.",
          errorMessage: upstreamMessage,
          category: "invalid_request",
          retryable: false,
          statusCode,
        };
      }
    }

    if (
      /timeout|timed out|network|fetch failed|ECONNRESET|ENOTFOUND/i.test(
        rawMessage,
      )
    ) {
      return {
        title: "Provider connection failed",
        detail:
          "The service could not reach the image provider. Please retry later.",
        errorMessage:
          "The service could not reach the image provider. Please retry later.",
        category: "provider_network",
        retryable: true,
      };
    }

    return {
      title: "Image task failed",
      detail: "The image task failed. You can adjust the request or retry it.",
      errorMessage: sanitizedMessage,
      category: "unknown",
      retryable: true,
    };
  }

  private sanitizeProviderResponseSummary(summary: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(summary).map(([key, value]) => [
        key,
        typeof value === "string"
          ? this.sanitizeDisplayText(value, 240)
          : this.summarizeValue(value),
      ]),
    );
  }

  private asString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
  }

  private asNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
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

    return this.truncateText(sanitized.trim(), maxLength);
  }

  private truncateText(value: string, maxLength: number) {
    return value.length > maxLength
      ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
      : value;
  }

  private async recordTaskEvent(
    taskId: string,
    eventType: string,
    status: TaskStatus,
    input: {
      summary: string;
      details?: Record<string, unknown>;
      title?: string;
      detail?: string;
      errorMessage?: string;
      progress?: number;
      assetIds?: string[];
    },
  ) {
    try {
      await this.taskEvents.record({
        taskId,
        eventType,
        status,
        summary: input.summary,
        details: input.details,
        title: input.title,
        detail: input.detail,
        errorMessage: input.errorMessage,
        progress: input.progress,
        assetIds: input.assetIds,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown task event error.";
      this.logger.warn(`Failed to record task event ${eventType}: ${message}`);
    }
  }
}
