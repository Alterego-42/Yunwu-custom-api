import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import {
  Prisma,
  type Asset,
  type Conversation,
  type Message,
  type ModelCapability,
  type Task,
  type TaskEvent,
  type User,
} from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import type {
  AdminModelCapabilitiesResponse,
  AdminModelCapabilityRecord,
  AdminModelCapabilityResponse,
  ArchiveConversationResponse,
  AssetRecord,
  CapabilityType,
  CapabilitiesResponse,
  ConversationDetail,
  ConversationResponse,
  ConversationSummary,
  ConversationTaskEventRecord,
  ConversationTaskEventsResponse,
  ConversationsResponse,
  CreateTaskResponse,
  DeleteConversationResponse,
  DeleteLibraryAssetResponse,
  HistoryResponse,
  HomeResponse,
  LibraryItemRecord,
  LibraryResponse,
  ModelRecord,
  ModelsResponse,
  ProviderAdminResponse,
  ProviderAlert,
  ProviderAlertSummary,
  ProviderModelAvailability,
  ProviderLastTest,
  ProviderCheckResponse,
  ProviderHealthCheck,
  ProviderModelSummary,
  ProviderWarning,
  ProviderTestGenerateResponse,
  RetryTaskResponse,
  TaskEventRecord,
  TaskEventsResponse,
  TaskFailureRecord,
  TaskMessage,
  TaskRecord,
  TasksResponse,
  TaskResponse,
  UserApiKeyCheckResponse,
  UserSettingsResponse,
} from "./api.types";
import {
  OpenAICompatibleService,
  type OpenAICompatibleProviderProbeResult,
} from "../openai-compatible/openai-compatible.service";
import { ProviderAlertsService } from "../openai-compatible/provider-alerts.service";
import { ProviderConfigurationService } from "../openai-compatible/provider-configuration.service";
import {
  ProviderOperationalStateService,
  type ProviderOperationalStateRecord,
} from "../openai-compatible/provider-operational-state.service";
import {
  DEFAULT_YUNWU_MODEL_IDS,
  getYunwuModelDefinition,
  YUNWU_BASE_URLS,
  YUNWU_MODEL_DEFINITIONS,
  type YunwuModelDefinition,
} from "../openai-compatible/yunwu-model-registry";
import { PrismaService } from "../prisma/prisma.service";
import {
  TaskEventsService,
  type ConversationTaskEvent,
} from "../tasks/task-events.service";
import { TaskQueueService } from "../tasks/task-queue.service";
import { ConversationEventsService } from "./conversation-events.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { TestGenerateProviderDto } from "./dto/test-generate-provider.dto";
import { CheckUserApiKeyDto } from "./dto/check-user-api-key.dto";
import { UpdateModelCapabilityDto } from "./dto/update-model-capability.dto";
import { UpdateProviderConfigDto } from "./dto/update-provider-config.dto";
import { UpdateUserSettingsDto } from "./dto/update-user-settings.dto";

export const OPENAI_COMPATIBLE_PROVIDER = "openai-compatible";
type SupportedTaskCapability = "image.generate" | "image.edit";
type SupportedTaskSourceAction = "retry" | "edit" | "variant" | "fork";
const SUPPORTED_TASK_CAPABILITIES: SupportedTaskCapability[] = [
  "image.generate",
  "image.edit",
];
const CAPABILITY_NAMES: Record<string, string> = {
  "image.generate": "Image generation",
  "image.edit": "Image editing",
};

interface TaskInputShape {
  model?: string;
  prompt?: string;
  assetIds?: string[];
  params?: Record<string, unknown>;
  providerBaseUrl?: string;
}

interface ResolvedUserSettings {
  baseUrl: string;
  providerApiKey?: string;
  enabledModelIds: string[];
  ui: Record<string, unknown>;
}

type TaskRecordEntity = Task & {
  conversation?: Conversation | null;
  user?: User | null;
  events?: TaskEvent[];
};

@Injectable()
export class ApiService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskQueue: TaskQueueService,
    private readonly taskEvents: TaskEventsService,
    private readonly conversationEvents: ConversationEventsService,
    private readonly openaiCompatible: OpenAICompatibleService,
    private readonly providerConfig: ProviderConfigurationService,
    private readonly providerState: ProviderOperationalStateService,
    private readonly providerAlerts: ProviderAlertsService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultModels();
  }

  async getCapabilities(user: AuthenticatedUser): Promise<CapabilitiesResponse> {
    const settings = await this.resolveUserSettings(user.id);
    const rows = await this.prisma.modelCapability.findMany({
      where: {
        provider: OPENAI_COMPATIBLE_PROVIDER,
        model: { in: settings.enabledModelIds },
      },
    });
    const capabilities = [
      ...new Set(
        rows
          .filter((row) => this.isTaskSupportedModel(row))
          .flatMap((row) => this.capabilitiesOf(row)),
      ),
    ]
      .filter((capability) => this.isSupportedCapability(capability))
      .map((key) => ({
        key,
        name: CAPABILITY_NAMES[key] ?? key,
      }));

    return { capabilities };
  }

  async getModels(user: AuthenticatedUser): Promise<ModelsResponse> {
    const settings = await this.resolveUserSettings(user.id);
    const rows = await this.prisma.modelCapability.findMany({
      where: {
        provider: OPENAI_COMPATIBLE_PROVIDER,
        model: { in: settings.enabledModelIds },
      },
      orderBy: [{ provider: "asc" }, { model: "asc" }],
    });

    return {
      models: rows
        .map((row) => this.toModelRecord(row)),
    };
  }

  async getSettings(user: AuthenticatedUser): Promise<UserSettingsResponse> {
    return {
      settings: await this.toUserSettingsResponse(
        await this.resolveUserSettings(user.id),
      ),
    };
  }

  async updateSettings(
    user: AuthenticatedUser,
    input: UpdateUserSettingsDto,
  ): Promise<UserSettingsResponse> {
    const current = await this.resolveUserSettings(user.id);
    const baseUrl =
      input.baseUrl === undefined
        ? current.baseUrl
        : this.normalizeSupportedBaseUrl(input.baseUrl);
    const enabledModelIds =
      input.enabledModelIds === undefined
        ? current.enabledModelIds
        : this.normalizeEnabledModelIds(input.enabledModelIds);
    const ui =
      input.ui === undefined ? current.ui : this.toJsonRecord(input.ui);
    const providerApiKey =
      input.clearApiKey === true
        ? undefined
        : input.apiKey === undefined
          ? current.providerApiKey
          : this.normalizeApiKey(input.apiKey);

    const settings = { baseUrl, providerApiKey, enabledModelIds, ui };
    await this.persistUserSettings(user.id, settings);

    return { settings: await this.toUserSettingsResponse(settings) };
  }

  async checkUserApiKey(
    user: AuthenticatedUser,
    input: CheckUserApiKeyDto = {},
  ): Promise<UserApiKeyCheckResponse> {
    const current = await this.resolveUserSettings(user.id);
    const temporaryApiKey =
      typeof input.apiKey === "string" && input.apiKey.trim()
        ? this.normalizeApiKey(input.apiKey)
        : undefined;
    const apiKey =
      temporaryApiKey !== undefined
        ? temporaryApiKey
        : current.providerApiKey?.trim() || undefined;
    const check = apiKey
      ? await this.openaiCompatible.checkProviderModels({
          baseUrl: current.baseUrl,
          apiKey,
        })
      : {
          baseUrlReachable: false,
          modelsSource: "unavailable" as const,
          error: {
            category: "missing_api_key" as const,
            message: "No API key is configured. Enter an API key or save one first.",
            retryable: false,
          },
        };
    const healthCheck = this.toProviderHealthCheckForUserCheck(
      check,
      Boolean(apiKey),
    );
    const ok = healthCheck.status === "ok";

    return {
      ok,
      status: healthCheck.status,
      message: ok
        ? "API key connectivity check succeeded."
        : (healthCheck.error?.message ?? "API key connectivity check failed."),
      apiKey: {
        configured: Boolean(apiKey),
        ...(apiKey ? { maskedApiKey: this.maskSecret(apiKey) } : {}),
      },
      check: healthCheck,
    };
  }

  async getConversations(
    user: AuthenticatedUser,
  ): Promise<ConversationsResponse> {
    const conversations = await this.prisma.conversation.findMany({
      where:
        user.role === "admin"
          ? { status: "active" }
          : { userId: user.id, status: "active" },
      include: {
        tasks: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return {
      conversations: conversations.map((conversation) =>
        this.toConversationSummary(conversation),
      ),
    };
  }

  async createConversation(
    user: AuthenticatedUser,
    input: CreateConversationDto,
  ): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.create({
      data: {
        userId: user.id,
        title: input.title?.trim() || "New conversation",
      },
    });

    return {
      conversation: await this.getConversationDetail(user, conversation.id),
    };
  }

  async getConversation(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ConversationResponse> {
    return { conversation: await this.getConversationDetail(user, id) };
  }

  async archiveConversation(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ArchiveConversationResponse> {
    const conversation = await this.assertMutableConversation(user, id);
    const archived = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "archived",
        metadata: {
          ...this.asRecord(conversation.metadata),
          archivedAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      },
    });

    return { conversation: this.toConversationSummary(archived) };
  }

  async deleteConversation(
    user: AuthenticatedUser,
    id: string,
  ): Promise<DeleteConversationResponse> {
    const conversation = await this.assertMutableConversation(user, id);
    const deleted = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: "deleted",
        metadata: {
          ...this.asRecord(conversation.metadata),
          deletedAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      },
    });

    return { conversation: this.toConversationSummary(deleted) };
  }

  async getConversationTaskEvents(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ConversationTaskEventsResponse> {
    await this.assertConversationAccess(user, id);

    const events = await this.taskEvents.listForConversation(id);
    return {
      events: events
        .map((event) => this.toConversationTaskEventRecord(event))
        .filter((event): event is ConversationTaskEventRecord =>
          Boolean(event),
        ),
    };
  }

  async createTask(
    user: AuthenticatedUser,
    input: CreateTaskDto,
  ): Promise<CreateTaskResponse> {
    const capability = input.capability;
    if (!this.isSupportedCapability(capability)) {
      throw new BadRequestException(
        `Unsupported task capability: ${capability}`,
      );
    }

    const userSettings = await this.resolveUserSettings(user.id);
    if (!userSettings.enabledModelIds.includes(input.model)) {
      throw new BadRequestException(
        `Model ${input.model} is not enabled in your settings.`,
      );
    }

    const model = await this.findEnabledModel(input.model, capability);
    if (!model) {
      const configuredModel = await this.findConfiguredModel(input.model);
      if (configuredModel && !this.isTaskSupportedModel(configuredModel)) {
        throw new BadRequestException(
          `Model ${input.model} is registered but this backend does not support its Yunwu API family yet. Enable only models marked taskSupported for user tasks.`,
        );
      }

      throw new BadRequestException(
        `Model ${input.model} does not support ${capability}.`,
      );
    }

    if (input.sourceAction && !input.sourceTaskId) {
      throw new BadRequestException(
        "sourceTaskId is required when sourceAction is provided.",
      );
    }

    const shouldFork = Boolean(input.fork || input.sourceAction === "fork");
    const sourceTask = input.sourceTaskId
      ? await this.prisma.task.findFirst({
          where:
            user.role === "admin"
              ? { id: input.sourceTaskId }
              : { id: input.sourceTaskId, userId: user.id },
          include: { conversation: true, assets: true, events: true },
        })
      : null;
    if (input.sourceTaskId && !sourceTask) {
      throw new NotFoundException("Source task not found.");
    }
    if (shouldFork && !sourceTask) {
      throw new BadRequestException("Fork requires a valid sourceTaskId.");
    }
    if (
      sourceTask?.conversationId &&
      input.conversationId &&
      !shouldFork &&
      sourceTask.conversationId !== input.conversationId
    ) {
      throw new BadRequestException(
        "Source task must continue in its original conversation unless fork is enabled.",
      );
    }

    const normalizedSourceAction: SupportedTaskSourceAction | undefined =
      shouldFork
        ? "fork"
        : this.asSupportedSourceAction(input.sourceAction);
    const requestedAssetIds = this.normalizeAssetIds(
      input.assetIds?.length
        ? input.assetIds
        : this.defaultSourceAssetIds(sourceTask, normalizedSourceAction),
    );
    const inputAssets = await this.loadInputAssets(user.id, requestedAssetIds);
    if (inputAssets.length !== requestedAssetIds.length) {
      throw new BadRequestException("One or more assetIds are invalid.");
    }

    const conversation = await this.resolveTaskConversation(user, {
      conversationId: input.conversationId,
      prompt: input.prompt,
      shouldFork,
      sourceTask,
    });
    const { task } = await this.prisma.$transaction(async (tx) => {
      const userMessage = await tx.message.create({
        data: {
          conversationId: conversation.id,
          userId: user.id,
          role: "user",
          content: input.prompt,
          metadata: {
            type: requestedAssetIds.length > 0 ? "upload_card" : "text",
            assetIds: requestedAssetIds,
            sourceTaskId: sourceTask?.id,
            sourceAction: normalizedSourceAction,
          },
        },
      });

      const task = await tx.task.create({
        data: {
          userId: user.id,
          conversationId: conversation.id,
          sourceTaskId: sourceTask?.id,
          sourceAction: normalizedSourceAction,
          type: capability,
          status: "queued",
          progress: 0,
          input: {
            model: input.model,
            prompt: input.prompt,
            assetIds: requestedAssetIds,
            providerBaseUrl: userSettings.baseUrl,
            params: this.toJsonRecord(input.params),
          } satisfies Prisma.InputJsonObject,
        },
      });
      await tx.taskEvent.create({
        data: {
          taskId: task.id,
          eventType: "queued",
          status: "queued",
          summary: "Task queued.",
          details: {
            title: "Task queued",
            detail:
              "Your image task has been queued and will start as soon as a worker is available.",
            progress: 0,
            ...this.buildInputSummary({
              model: input.model,
              prompt: input.prompt,
              assetIds: requestedAssetIds,
              providerBaseUrl: userSettings.baseUrl,
              params: this.toJsonRecord(input.params),
            }),
            ...(sourceTask?.id ? { sourceTaskId: sourceTask.id } : {}),
            ...(normalizedSourceAction
              ? { sourceAction: normalizedSourceAction }
              : {}),
          } as Prisma.InputJsonObject,
        },
      });

      if (requestedAssetIds.length > 0) {
        await tx.asset.updateMany({
          where: {
            id: { in: requestedAssetIds },
            userId: user.id,
            type: "upload",
            messageId: null,
          },
          data: { messageId: userMessage.id },
        });
      }

      return { task };
    });

    const updatedTask = await this.prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: {
        assets: true,
        conversation: true,
        user: true,
        events: this.latestFailedEventArgs(),
      },
    });
    const conversationDetail = await this.getConversationDetail(
      user,
      conversation.id,
    );

    await this.taskQueue.enqueueTask(task.id);
    this.conversationEvents.publishTaskUpdated({
      conversationId: conversation.id,
      taskId: task.id,
      status: updatedTask.status,
    });

    return {
      task: this.toTaskRecord(updatedTask, updatedTask.assets),
      conversation: conversationDetail,
    };
  }

  async getHome(user: AuthenticatedUser): Promise<HomeResponse> {
    const userScopedWhere = user.role === "admin" ? {} : { userId: user.id };
    const generatedAssetWhere =
      user.role === "admin"
        ? {
            type: "generated" as const,
            status: { not: "deleted" as const },
            task: {
              is: {
                status: "succeeded" as const,
              },
            },
          }
        : {
            userId: user.id,
            type: "generated" as const,
            status: { not: "deleted" as const },
            task: {
              is: {
                userId: user.id,
                status: "succeeded" as const,
              },
            },
          };
    const [conversations, recentTasks, recentAssets, recoveryTasks] =
      await Promise.all([
        this.prisma.conversation.findMany({
          where: { ...userScopedWhere, status: "active" },
          include: {
            tasks: {
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
        }),
        this.prisma.task.findMany({
          where: userScopedWhere,
          orderBy: { updatedAt: "desc" },
          include: {
            assets: true,
            conversation: true,
            user: true,
            events: this.latestFailedEventArgs(),
          },
          take: 8,
        }),
        this.prisma.asset.findMany({
          where: generatedAssetWhere,
          include: {
            task: {
              include: {
                assets: true,
                conversation: true,
                user: true,
                events: this.latestFailedEventArgs(),
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
        this.prisma.task.findMany({
          where: { ...userScopedWhere, status: "failed" },
          orderBy: { updatedAt: "desc" },
          include: {
            assets: true,
            conversation: true,
            user: true,
            events: this.latestFailedEventArgs(),
          },
          take: 8,
        }),
      ]);

    return {
      recentConversations: conversations.map((conversation) =>
        this.toConversationSummary(conversation),
      ),
      recentTasks: recentTasks.map((task) => this.toTaskRecord(task, task.assets)),
      recentAssets: recentAssets
        .map((asset) => this.toLibraryItemRecord(asset))
        .filter((item): item is LibraryItemRecord => Boolean(item)),
      recoveryTasks: recoveryTasks
        .map((task) => this.toTaskRecord(task, task.assets))
        .filter((task) => Boolean(task.failure)),
    };
  }

  async getHistory(user: AuthenticatedUser): Promise<HistoryResponse> {
    const tasks = await this.prisma.task.findMany({
      where: user.role === "admin" ? undefined : { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        assets: true,
        conversation: true,
        user: true,
        events: this.latestFailedEventArgs(),
      },
      take: 50,
    });

    return {
      items: tasks.map((task) => this.toTaskRecord(task, task.assets)),
    };
  }

  async getLibrary(user: AuthenticatedUser): Promise<LibraryResponse> {
    const assets = await this.prisma.asset.findMany({
      where:
        user.role === "admin"
          ? {
              type: "generated",
              status: { not: "deleted" },
              task: {
                is: {
                  status: "succeeded",
                },
              },
            }
          : {
              userId: user.id,
              type: "generated",
              status: { not: "deleted" },
              task: {
                is: {
                  userId: user.id,
                  status: "succeeded",
                },
              },
            },
      include: {
        task: {
          include: {
            assets: true,
            conversation: true,
            user: true,
            events: this.latestFailedEventArgs(),
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      items: assets
        .map((asset) => this.toLibraryItemRecord(asset))
        .filter((item): item is LibraryItemRecord => Boolean(item)),
    };
  }

  async deleteLibraryAsset(
    user: AuthenticatedUser,
    id: string,
  ): Promise<DeleteLibraryAssetResponse> {
    const existing = await this.prisma.asset.findFirst({
      where: { id, userId: user.id, type: "generated" },
    });
    if (!existing) {
      throw new NotFoundException("Library asset not found.");
    }

    const asset =
      existing.status === "deleted"
        ? existing
        : await this.prisma.asset.update({
            where: { id: existing.id },
            data: {
              status: "deleted",
              metadata: {
                ...this.asRecord(existing.metadata),
                deletedAt: new Date().toISOString(),
              } as Prisma.InputJsonObject,
            },
          });

    return { asset: this.toAssetRecord(asset) };
  }

  async getTask(user: AuthenticatedUser, id: string): Promise<TaskResponse> {
    const task = await this.prisma.task.findFirst({
      where: user.role === "admin" ? { id } : { id, userId: user.id },
      include: {
        assets: true,
        conversation: true,
        user: true,
        events: this.latestFailedEventArgs(),
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found.");
    }

    return { task: this.toTaskRecord(task, task.assets) };
  }

  async getTasks(user: AuthenticatedUser): Promise<TasksResponse> {
    const tasks = await this.prisma.task.findMany({
      where: user.role === "admin" ? undefined : { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        assets: true,
        conversation: true,
        user: true,
        events: this.latestFailedEventArgs(),
      },
      take: 50,
    });

    return {
      tasks: tasks.map((task) => this.toTaskRecord(task, task.assets)),
    };
  }

  async getTaskEvents(id: string): Promise<TaskEventsResponse> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException("Task not found.");
    }

    const events = await this.taskEvents.listForTask(id);
    return { events: events.map((event) => this.toTaskEventRecord(event)) };
  }

  async retryTask(
    user: AuthenticatedUser,
    id: string,
  ): Promise<RetryTaskResponse> {
    const task = await this.prisma.task.findFirst({
      where: user.role === "admin" ? { id } : { id, userId: user.id },
      include: {
        assets: true,
        conversation: true,
        user: true,
        events: this.latestFailedEventArgs(),
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found.");
    }
    if (!task.userId || !task.conversationId) {
      throw new BadRequestException(
        "Task cannot be retried because user or conversation context is missing.",
      );
    }
    if (!this.isRetryableTaskStatus(task.status)) {
      throw new BadRequestException(
        this.getTaskRetryBlockedMessage(task.status),
      );
    }

    const previousError = this.sanitizeDisplayText(
      task.errorMessage ?? "",
      240,
    );
    const retryTask = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          userId: task.userId,
          conversationId: task.conversationId,
          sourceTaskId: task.id,
          sourceAction: "retry",
          type: task.type,
          status: "queued",
          progress: 0,
          input:
            task.input === null
              ? Prisma.JsonNull
              : (task.input as Prisma.InputJsonValue),
        },
      });
      await tx.taskEvent.createMany({
        data: [
          {
            taskId: task.id,
            eventType: "retry_requested",
            status: task.status,
            summary: "Retry requested.",
            details: {
              title: "Retry requested",
              detail:
                "A retry was requested for this task and a new task was queued.",
              retryTaskId: created.id,
              previousStatus: task.status,
              ...(previousError ? { errorMessage: previousError } : {}),
            },
          },
          {
            taskId: created.id,
            eventType: "retried",
            status: "queued",
            summary: "Retry task created.",
            details: {
              title: "Retry task created",
              detail: "This task was created from a previous task.",
              retryOfTaskId: task.id,
              ...(previousError ? { errorMessage: previousError } : {}),
            },
          },
          {
            taskId: created.id,
            eventType: "queued",
            status: "queued",
            summary: "Retry task queued.",
            details: {
              title: "Task queued",
              detail:
                "The retry task has been queued and will start as soon as a worker is available.",
              progress: 0,
              retryOfTaskId: task.id,
              ...this.buildInputSummary(
                this.asRecord(task.input) as TaskInputShape,
              ),
            } as Prisma.InputJsonObject,
          },
        ],
      });

      return created;
    });
    await this.taskQueue.enqueueTask(retryTask.id, "user-retry");
    this.conversationEvents.publishTaskUpdated({
      conversationId: task.conversationId,
      taskId: retryTask.id,
      status: retryTask.status,
    });

    const hydrated = await this.prisma.task.findUniqueOrThrow({
      where: { id: retryTask.id },
      include: {
        assets: true,
        conversation: true,
        user: true,
        events: this.latestFailedEventArgs(),
      },
    });

    return {
      task: this.toTaskRecord(hydrated, hydrated.assets),
      retriedFromTaskId: task.id,
    };
  }

  async retryFailedTask(
    user: AuthenticatedUser,
    id: string,
  ): Promise<RetryTaskResponse> {
    return this.retryTask(user, id);
  }

  async getAdminModelCapabilities(): Promise<AdminModelCapabilitiesResponse> {
    const rows = await this.prisma.modelCapability.findMany({
      orderBy: [{ provider: "asc" }, { model: "asc" }, { modality: "asc" }],
    });

    return {
      modelCapabilities: rows.map((row) =>
        this.toAdminModelCapabilityRecord(row),
      ),
    };
  }

  async updateAdminModelCapability(
    id: string,
    input: UpdateModelCapabilityDto,
  ): Promise<AdminModelCapabilityResponse> {
    const row = await this.prisma.modelCapability
      .update({
        where: { id },
        data: { enabled: input.enabled },
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new NotFoundException("Model capability not found.");
        }

        throw error;
      });

    await this.providerAlerts.refreshAlerts(await this.providerState.getState());

    return { modelCapability: this.toAdminModelCapabilityRecord(row) };
  }

  async getAdminProvider(): Promise<ProviderAdminResponse> {
    const rows = await this.getProviderModelCapabilities();
    const state = await this.providerAlerts.refreshAlerts(
      await this.providerState.getState(),
    );

    return { provider: await this.buildProviderStatus(rows, { state }) };
  }

  async checkAdminProvider(): Promise<ProviderCheckResponse> {
    const rows = await this.getProviderModelCapabilities();
    const startedAt = Date.now();
    const probe = await this.openaiCompatible.checkProviderModels();
    const check = await this.buildProviderHealthCheck(rows, probe, {
      latencyMs: Date.now() - startedAt,
    });
    const state = await this.providerState.persistCheck({
      check,
      latencyMs: check.latencyMs ?? Date.now() - startedAt,
      remoteModelIds: probe.remoteModelIds,
    });
    const refreshedState = await this.providerAlerts.refreshAlerts(state);

    return {
      provider: await this.buildProviderStatus(rows, {
        check,
        probe,
        state: refreshedState,
      }),
      check,
    };
  }

  async testGenerateAdminProvider(
    user: AuthenticatedUser,
    input: TestGenerateProviderDto,
  ): Promise<ProviderTestGenerateResponse> {
    const rows = await this.getProviderModelCapabilities();
    const model =
      input.model?.trim() ||
      this.resolveDefaultModels(rows)["image.generate"];

    if (!model) {
      throw new BadRequestException(
        "No enabled image generation model is configured for provider testing.",
      );
    }

    const hasGenerationCapability = rows.some(
      (row) =>
        row.enabled &&
        row.model === model &&
        this.capabilitiesOf(row).includes("image.generate"),
    );
    if (!hasGenerationCapability) {
      throw new BadRequestException(
        `Model ${model} is not enabled for image generation.`,
      );
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        userId: user.id,
        title: `Provider test ${new Date().toISOString()}`,
        metadata: {
          type: "provider_test",
          provider: OPENAI_COMPATIBLE_PROVIDER,
        },
      },
    });
    const taskResponse = await this.createTask(user, {
      conversationId: conversation.id,
      capability: "image.generate",
      model,
      prompt:
        input.prompt?.trim() ||
        "Provider smoke test: generate a simple diagnostic image.",
      params: {
        size: "auto",
        n: 1,
        ...this.toJsonRecord(input.params),
      },
    });
    const queuedAt = new Date(taskResponse.task.createdAt);
    await this.providerState.persistTestQueued({
      taskId: taskResponse.task.id,
      testedAt: queuedAt,
    });
    const state = await this.providerState.getState();

    return {
      ...taskResponse,
      test: {
        capability: "image.generate",
        model,
        mode: (await this.openaiCompatible.getProviderProfile()).mode,
        queuedAt: queuedAt.toISOString(),
        lastTest: this.toProviderLastTest(state),
      },
    };
  }

  async acknowledgeAdminProviderAlert(
    id: string,
  ): Promise<ProviderAdminResponse> {
    const state = await this.providerAlerts.acknowledgeAlert(id);
    if (!state) {
      throw new NotFoundException("Provider alert not found.");
    }

    const rows = await this.getProviderModelCapabilities();
    return { provider: await this.buildProviderStatus(rows, { state }) };
  }

  async updateAdminProviderConfig(
    input: UpdateProviderConfigDto,
  ): Promise<ProviderAdminResponse> {
    await this.providerConfig.updateBaseUrl(input.baseUrl);
    const rows = await this.getProviderModelCapabilities();
    const state = await this.providerAlerts.refreshAlerts(
      await this.providerState.getState(),
    );

    return { provider: await this.buildProviderStatus(rows, { state }) };
  }

  async assertConversationAccess(user: AuthenticatedUser, id: string) {
    await this.getConversationDetail(user, id);
  }

  private async assertMutableConversation(user: AuthenticatedUser, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: user.role === "admin" ? { id } : { id, userId: user.id },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    return conversation;
  }

  private async resolveUserSettings(
    userId: string,
  ): Promise<ResolvedUserSettings> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        baseUrl: string;
        providerApiKey: string | null;
        enabledModelIds: unknown;
        ui: unknown;
      }>
    >(
      Prisma.sql`
        SELECT
          "base_url" AS "baseUrl",
          "provider_api_key" AS "providerApiKey",
          "enabled_model_ids" AS "enabledModelIds",
          "ui"
        FROM "user_settings"
        WHERE "user_id" = ${userId}
        LIMIT 1
      `,
    );
    const row = rows[0];

    if (!row) {
      return {
        baseUrl: await this.providerConfig.getBaseUrl(),
        enabledModelIds: [...DEFAULT_YUNWU_MODEL_IDS],
        ui: {},
      };
    }

    return {
      baseUrl: this.normalizeSupportedBaseUrl(row.baseUrl),
      providerApiKey: row.providerApiKey?.trim() || undefined,
      enabledModelIds: this.normalizeEnabledModelIds(
        this.asStringArray(row.enabledModelIds) ?? [],
      ),
      ui: this.asRecord(row.ui),
    };
  }

  private async persistUserSettings(
    userId: string,
    settings: ResolvedUserSettings,
  ) {
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "user_settings" (
          "id",
          "user_id",
          "base_url",
          "provider_api_key",
          "enabled_model_ids",
          "ui",
          "created_at",
          "updated_at"
        )
        VALUES (
          ${userId},
          ${userId},
          ${settings.baseUrl},
          ${settings.providerApiKey ?? null},
          CAST(${JSON.stringify(settings.enabledModelIds)} AS JSONB),
          CAST(${JSON.stringify(settings.ui)} AS JSONB),
          NOW(),
          NOW()
        )
        ON CONFLICT ("user_id") DO UPDATE SET
          "base_url" = EXCLUDED."base_url",
          "provider_api_key" = EXCLUDED."provider_api_key",
          "enabled_model_ids" = EXCLUDED."enabled_model_ids",
          "ui" = EXCLUDED."ui",
          "updated_at" = NOW()
      `,
    );
  }

  private async toUserSettingsResponse(settings: ResolvedUserSettings) {
    return {
      baseUrl: settings.baseUrl,
      supportedBaseUrls: [...YUNWU_BASE_URLS],
      enabledModelIds: settings.enabledModelIds,
      providerApiKey: {
        configured: Boolean(settings.providerApiKey),
        ...(settings.providerApiKey
          ? { maskedApiKey: this.maskSecret(settings.providerApiKey) }
          : {}),
      },
      ui: settings.ui,
    };
  }

  private toProviderHealthCheckForUserCheck(
    check: Awaited<ReturnType<OpenAICompatibleService["checkProviderModels"]>>,
    apiKeyConfigured: boolean,
  ) {
    return {
      checkedAt: new Date().toISOString(),
      status: check.error ? ("error" as const) : ("ok" as const),
      mode: apiKeyConfigured ? ("real" as const) : ("mock" as const),
      baseUrlReachable: check.baseUrlReachable,
      apiKeyConfigured,
      modelsSource: check.modelsSource,
      configuredModelCount: 0,
      enabledModelCount: 0,
      supportedCapabilities: [],
      defaultModels: {},
      ...(check.error ? { error: check.error } : {}),
      ...(check.remoteModelIds
        ? { availableModelCount: check.remoteModelIds.length }
        : {}),
    };
  }

  private normalizeApiKey(apiKey: string | null) {
    if (apiKey === null) {
      return undefined;
    }

    const normalized = apiKey.trim();
    if (!normalized) {
      throw new BadRequestException("provider API key cannot be empty.");
    }

    return normalized;
  }

  private maskSecret(value: string) {
    if (value.length <= 8) {
      return "****";
    }

    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  private normalizeSupportedBaseUrl(baseUrl: string) {
    const normalized = baseUrl.trim().replace(/\/$/, "");
    if (!YUNWU_BASE_URLS.includes(normalized as never)) {
      throw new BadRequestException(
        `Unsupported Yunwu base_url. Use one of: ${YUNWU_BASE_URLS.join(", ")}.`,
      );
    }

    return normalized;
  }

  private normalizeEnabledModelIds(modelIds: string[]) {
    const knownModelIds = new Set(YUNWU_MODEL_DEFINITIONS.map((model) => model.id));
    const invalidModel = modelIds.find((modelId) => !knownModelIds.has(modelId));
    if (invalidModel) {
      throw new BadRequestException(
        `Unknown Yunwu model id in enabledModelIds: ${invalidModel}.`,
      );
    }

    return [
      ...new Set([
        ...DEFAULT_YUNWU_MODEL_IDS,
        ...modelIds.filter((modelId) => knownModelIds.has(modelId)),
      ]),
    ];
  }

  private async getProviderModelCapabilities() {
    return this.prisma.modelCapability.findMany({
      where: { provider: OPENAI_COMPATIBLE_PROVIDER },
      orderBy: [{ model: "asc" }, { modality: "asc" }],
    });
  }

  private async buildProviderStatus(
    rows: ModelCapability[],
    input: {
      check?: ProviderHealthCheck;
      probe?: OpenAICompatibleProviderProbeResult;
      state?: ProviderOperationalStateRecord | null;
    } = {},
  ) {
    const profile = await this.openaiCompatible.getProviderProfile();
    const remoteModelIds =
      input.probe?.remoteModelIds ??
      this.providerState.getRemoteModelIds(input.state ?? null);
    const check =
      input.check ??
      (await this.toPersistedProviderHealthCheck(rows, input.state ?? null));
    const models = this.toProviderModelSummaries(rows, remoteModelIds);
    const modelAvailability = this.buildModelAvailability(
      models,
      check?.modelsSource,
      remoteModelIds,
    );
    const lastTest = this.toProviderLastTest(input.state ?? null);
    const alerts = this.providerState.getAlerts(input.state ?? null);

    return {
      ...profile,
      supportedBaseUrls: [...YUNWU_BASE_URLS],
      supportedCapabilities: this.supportedCapabilitiesFrom(rows),
      defaultModels: this.resolveDefaultModels(rows),
      models,
      lastCheck: check ?? null,
      lastTest: lastTest ?? null,
      modelAvailability,
      warnings: this.buildProviderWarnings({
        mode: profile.mode,
        check,
        lastTest,
        modelAvailability,
      }),
      alerts,
      summary: this.buildProviderAlertSummary(alerts),
    };
  }

  private async buildProviderHealthCheck(
    rows: ModelCapability[],
    probe: OpenAICompatibleProviderProbeResult,
    input: { latencyMs?: number } = {},
  ): Promise<ProviderHealthCheck> {
    const profile = await this.openaiCompatible.getProviderProfile();
    const models = this.toProviderModelSummaries(rows, probe.remoteModelIds);
    const configuredModelCount = models.length;
    const enabledModelCount = models.filter((model) => model.enabled).length;
    const availableModelCount =
      probe.modelsSource === "remote"
        ? models.filter((model) => model.enabled && model.remoteAvailable)
            .length
        : enabledModelCount;
    const supportedCapabilities = this.supportedCapabilitiesFrom(rows);
    const defaultModels = this.resolveDefaultModels(rows);
    const configurationError =
      enabledModelCount === 0
        ? {
            category: "invalid_configuration" as const,
            message: "No enabled provider models are configured.",
            retryable: false,
          }
        : undefined;
    const availabilityError =
      probe.modelsSource === "remote" && availableModelCount === 0
        ? {
            category: "invalid_configuration" as const,
            message:
              "Provider model list did not include any enabled configured model.",
            retryable: false,
          }
        : undefined;
    const error = configurationError ?? probe.error ?? availabilityError;
    const status =
      configurationError ||
      availabilityError ||
      !probe.baseUrlReachable ||
      (probe.error && probe.error.category !== "missing_api_key")
        ? "error"
        : profile.apiKeyConfigured
          ? "ok"
          : "degraded";

    return {
      checkedAt: new Date().toISOString(),
      status,
      ...(typeof input.latencyMs === "number" ? { latencyMs: input.latencyMs } : {}),
      mode: profile.mode,
      baseUrlReachable: probe.baseUrlReachable,
      apiKeyConfigured: profile.apiKeyConfigured,
      modelsSource: probe.modelsSource,
      configuredModelCount,
      enabledModelCount,
      ...(probe.modelsSource === "remote" ? { availableModelCount } : {}),
      supportedCapabilities,
      defaultModels,
      ...(error ? { error } : {}),
    };
  }

  private async toPersistedProviderHealthCheck(
    rows: ModelCapability[],
    state: ProviderOperationalStateRecord | null,
  ): Promise<ProviderHealthCheck | undefined> {
    const remoteModelIds = this.providerState.getRemoteModelIds(state);
    const profile = await this.openaiCompatible.getProviderProfile();
    const models = this.toProviderModelSummaries(rows, remoteModelIds);
    const enabledModelCount = models.filter((model) => model.enabled).length;
    const modelsSource =
      state?.modelsSource === "configured" ||
      state?.modelsSource === "remote" ||
      state?.modelsSource === "unavailable"
        ? state.modelsSource
        : undefined;

    return this.providerState.toPersistedHealthCheck(state, {
      mode: profile.mode,
      baseUrlReachable:
        this.asOptionalString(this.asRecord(state?.lastCheckError).category) !==
        "provider_network",
      apiKeyConfigured: profile.apiKeyConfigured,
      configuredModelCount: models.length,
      enabledModelCount,
      ...(modelsSource === "remote"
        ? {
            availableModelCount: models.filter(
              (model) => model.enabled && model.remoteAvailable,
            ).length,
          }
        : {}),
      supportedCapabilities: this.supportedCapabilitiesFrom(rows),
      defaultModels: this.resolveDefaultModels(rows),
    });
  }

  private toProviderLastTest(
    state: ProviderOperationalStateRecord | null,
  ): ProviderLastTest | undefined {
    if (!state?.lastTestTaskId && !state?.lastTestStatus && !state?.lastTestAt) {
      return undefined;
    }

    return {
      ...(state.lastTestTaskId ? { taskId: state.lastTestTaskId } : {}),
      ...(state.lastTestStatus ? { status: state.lastTestStatus } : {}),
      ...(state.lastTestAt ? { testedAt: state.lastTestAt.toISOString() } : {}),
      ...(state.lastTestError ? { error: state.lastTestError } : {}),
    };
  }

  private buildModelAvailability(
    models: ProviderModelSummary[],
    modelsSource: ProviderHealthCheck["modelsSource"] | undefined,
    remoteModelIds?: string[],
  ): ProviderModelAvailability[] {
    const remoteModels = remoteModelIds ? new Set(remoteModelIds) : undefined;

    return models
      .filter((model) => model.enabled)
      .map((model) => {
        if (modelsSource !== "remote" || !remoteModels) {
          return {
            id: model.id,
            name: model.name,
            capabilityTypes: model.capabilityTypes,
            status: "unknown",
            message:
              modelsSource === "configured"
                ? "上游未提供远端模型列表，当前仅按本地启用配置判断。"
                : "请先执行健康检查以确认远端模型可用性。",
          };
        }

        const available = remoteModels.has(model.id);
        return {
          id: model.id,
          name: model.name,
          capabilityTypes: model.capabilityTypes,
          status: available ? "available" : "missing",
          message: available
            ? "已启用模型存在于远端模型列表中。"
            : "已启用模型未出现在远端模型列表中。",
        };
      });
  }

  private buildProviderWarnings(input: {
    mode: "mock" | "real";
    check?: ProviderHealthCheck;
    lastTest?: ProviderLastTest;
    modelAvailability: ProviderModelAvailability[];
  }): ProviderWarning[] {
    const warnings: ProviderWarning[] = [
      {
        code: `provider_mode_${input.mode}`,
        severity: input.mode === "mock" ? "warning" : "info",
        message:
          input.mode === "mock"
            ? "当前 provider 处于 mock 模式，未配置真实 API Key。"
            : "当前 provider 处于 real 模式，将调用真实上游服务。",
      },
    ];

    if (!input.check) {
      warnings.push({
        code: "provider_check_missing",
        severity: "warning",
        message: "尚未执行健康检查，模型可用性仍未知。",
      });
    } else if (input.check.status === "error") {
      warnings.push({
        code: "provider_check_failed",
        severity: "error",
        message: input.check.error?.message
          ? `最近一次健康检查失败：${input.check.error.message}`
          : "最近一次健康检查失败，请检查 provider 配置。",
      });
    } else if (input.check.status === "degraded") {
      warnings.push({
        code: "provider_check_degraded",
        severity: "warning",
        message: "最近一次健康检查降级通过，请确认 API Key 和模型配置。",
      });
    }

    if (
      input.modelAvailability.some((model) => model.status === "missing")
    ) {
      warnings.push({
        code: "enabled_models_missing_remote",
        severity: "error",
        message: "远端未返回一个或多个已启用模型，请检查模型名称或上游权限。",
      });
    } else if (
      input.modelAvailability.some((model) => model.status === "unknown")
    ) {
      warnings.push({
        code: "enabled_models_unknown_remote",
        severity: "warning",
        message: "远端模型列表不可用，已启用模型只能按本地配置展示。",
      });
    }

    if (!input.lastTest) {
      warnings.push({
        code: "provider_test_missing",
        severity: "warning",
        message: "尚未执行 provider 测试生成任务。",
      });
    } else if (input.lastTest.status === "failed") {
      warnings.push({
        code: "provider_test_failed",
        severity: "error",
        message: input.lastTest.error
          ? `最近一次测试生成失败：${input.lastTest.error}`
          : "最近一次测试生成失败。",
      });
    }

    return warnings;
  }

  private buildProviderAlertSummary(alerts: ProviderAlert[]): ProviderAlertSummary {
    const activeAlerts = alerts.filter((alert) => !alert.acknowledgedAt);

    return {
      hasActiveAlerts: activeAlerts.length > 0,
      criticalCount: activeAlerts.filter((alert) => alert.level === "critical")
        .length,
      warningCount: activeAlerts.filter((alert) => alert.level === "warning")
        .length,
    };
  }

  private toProviderModelSummaries(
    rows: ModelCapability[],
    remoteModelIds?: string[],
  ): ProviderModelSummary[] {
    const remoteModels = remoteModelIds ? new Set(remoteModelIds) : undefined;
    const summaries = new Map<string, ProviderModelSummary>();

    for (const row of rows) {
      const metadata = this.asRecord(row.metadata);
      const existing = summaries.get(row.model);
      const capabilityTypes = [
        ...new Set([
          ...(existing?.capabilityTypes ?? []),
          ...this.capabilitiesOf(row),
        ]),
      ];

      summaries.set(row.model, {
        id: row.model,
        name:
          existing?.name ??
          (typeof metadata.name === "string" ? metadata.name : row.model),
        enabled: Boolean(existing?.enabled || row.enabled),
        capabilityTypes,
        ...(remoteModels ? { remoteAvailable: remoteModels.has(row.model) } : {}),
      });
    }

    return [...summaries.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }

  private supportedCapabilitiesFrom(rows: ModelCapability[]): CapabilityType[] {
    return [
      ...new Set(
        rows
          .filter((row) => row.enabled)
          .filter((row) => this.isTaskSupportedModel(row))
          .flatMap((row) => this.capabilitiesOf(row)),
      ),
    ];
  }

  private resolveDefaultModels(
    rows: ModelCapability[],
  ): Partial<Record<CapabilityType, string>> {
    const imageGenerate = this.findPreferredModel(rows, "image.generate", [
      ...DEFAULT_YUNWU_MODEL_IDS,
    ]);
    const imageEdit = this.findPreferredModel(rows, "image.edit", [
      "gpt-image-2",
    ]);

    return {
      ...(imageGenerate ? { "image.generate": imageGenerate } : {}),
      ...(imageEdit ? { "image.edit": imageEdit } : {}),
    };
  }

  private findPreferredModel(
    rows: ModelCapability[],
    capability: CapabilityType,
    preferredModels: string[],
  ) {
    const candidates = rows
      .filter(
        (row) =>
          row.enabled &&
          this.isTaskSupportedModel(row) &&
          this.capabilitiesOf(row).includes(capability),
      )
      .map((row) => row.model);

    return (
      preferredModels.find((model) => candidates.includes(model)) ??
      candidates[0]
    );
  }

  private async ensureDefaultModels() {
    await Promise.all(
      YUNWU_MODEL_DEFINITIONS.map((model) =>
        this.prisma.modelCapability.upsert({
          where: {
            provider_model_modality: {
              provider: OPENAI_COMPATIBLE_PROVIDER,
              model: model.id,
              modality: "image",
            },
          },
          update: {
            capabilities: model.capabilities,
            metadata: this.toModelMetadata(model),
          },
          create: {
            provider: OPENAI_COMPATIBLE_PROVIDER,
            model: model.id,
            modality: "image",
            capabilities: model.capabilities,
            enabled: model.defaultEnabled,
            metadata: this.toModelMetadata(model),
          },
        }),
      ),
    );
  }

  private async findEnabledModel(model: string, capability: CapabilityType) {
    const rows = await this.prisma.modelCapability.findMany({
      where: {
        provider: OPENAI_COMPATIBLE_PROVIDER,
        model,
      },
    });

    return rows.find(
      (row) =>
        this.isTaskSupportedModel(row) &&
        this.capabilitiesOf(row).includes(capability),
    );
  }

  private async findConfiguredModel(model: string) {
    return this.prisma.modelCapability.findFirst({
      where: {
        provider: OPENAI_COMPATIBLE_PROVIDER,
        model,
      },
    });
  }

  private async getConversationDetail(
    user: AuthenticatedUser,
    id: string,
  ): Promise<ConversationDetail> {
    const conversation = await this.prisma.conversation.findFirst({
      where:
        user.role === "admin"
          ? { id }
          : { id, userId: user.id, status: { not: "deleted" } },
      include: {
        messages: { include: { assets: true }, orderBy: { createdAt: "asc" } },
        tasks: {
          include: {
            assets: true,
            events: this.latestFailedEventArgs(),
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    const taskAssets = conversation.tasks.flatMap((task) => task.assets);
    const messageAssets = conversation.messages.flatMap(
      (message) => message.assets,
    );
    const referencedInputAssetIds = this.normalizeAssetIds(
      conversation.tasks.flatMap((task) =>
        this.asStringArray(this.asRecord(task.input).assetIds) ?? [],
      ),
    );
    const assetsById = new Map(
      [...taskAssets, ...messageAssets].map((asset) => [asset.id, asset]),
    );
    const missingInputAssetIds = referencedInputAssetIds.filter(
      (assetId) => !assetsById.has(assetId),
    );
    if (missingInputAssetIds.length > 0) {
      const referencedAssets = await this.prisma.asset.findMany({
        where:
          user.role === "admin"
            ? { id: { in: missingInputAssetIds } }
            : { id: { in: missingInputAssetIds }, userId: user.id },
      });
      referencedAssets.forEach((asset) => assetsById.set(asset.id, asset));
    }

    return {
      ...this.toConversationSummary(conversation),
      messages: conversation.messages.map((message) =>
        this.toTaskMessage(message),
      ),
      tasks: conversation.tasks.map((task) =>
        this.toTaskRecord(task, task.assets),
      ),
      assets: [...assetsById.values()].map((asset) =>
        this.toAssetRecord(asset),
      ),
    };
  }

  private toConversationSummary(
    conversation: Conversation & {
      tasks?: Array<{
        input?: unknown;
        updatedAt?: Date;
        createdAt?: Date;
      }>;
    },
  ): ConversationSummary {
    const metadata = this.asRecord(conversation.metadata);
    const latestTask = this.getLatestConversationTask(conversation.tasks ?? []);
    const latestTaskModelId = latestTask
      ? this.asOptionalString(this.asRecord(latestTask.input).model)
      : undefined;

    return {
      id: conversation.id,
      title: conversation.title ?? "Untitled conversation",
      status: conversation.status,
      ...(latestTaskModelId ? { latestTaskModelId } : {}),
      metadata:
        Object.keys(metadata).length > 0
          ? (metadata as ConversationSummary["metadata"])
          : undefined,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toTaskMessage(message: Message): TaskMessage {
    const metadata = this.asRecord(message.metadata);
    const type =
      typeof metadata.type === "string"
        ? metadata.type
        : this.defaultMessageType(message);

    return {
      id: message.id,
      type: this.isKnownMessageType(type) ? type : "text",
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toTaskRecord(
    task: TaskRecordEntity,
    assets: Asset[] = [],
  ): TaskRecord {
    const input = this.asRecord(task.input) as TaskInputShape;
    const output = this.asRecord(task.output);
    const inputAssetIds = this.asStringArray(input.assetIds) ?? [];
    const outputAssetIds = Array.isArray(output.assetIds)
      ? output.assetIds.filter((id): id is string => typeof id === "string")
      : [];
    const failure = this.toTaskFailureRecord(task);

    return {
      id: task.id,
      capability: this.isSupportedCapability(task.type)
        ? task.type
        : "image.generate",
      status: task.status,
      modelId: input.model ?? "gpt-image-1",
      prompt: input.prompt ?? "",
      params: this.asRecord(input.params),
      sourceTaskId: task.sourceTaskId ?? undefined,
      sourceAction: task.sourceAction ?? undefined,
      failure: failure ?? undefined,
      canRetry: this.isRetryableTaskStatus(task.status),
      progress: task.progress,
      conversationId: task.conversationId ?? undefined,
      conversationTitle: task.conversation?.title ?? undefined,
      userId: task.userId ?? undefined,
      userEmail: task.user?.email ?? undefined,
      userDisplayName: task.user?.displayName ?? undefined,
      inputSummary: this.buildInputSummary(input),
      outputSummary: this.buildOutputSummary(output, assets),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      errorMessage: task.errorMessage ?? undefined,
      assetIds: inputAssetIds.length > 0 ? inputAssetIds : outputAssetIds,
    };
  }

  private toTaskEventRecord(event: TaskEvent): TaskEventRecord {
    return {
      id: event.id,
      taskId: event.taskId,
      eventType: event.eventType,
      status: event.status ?? undefined,
      summary: event.summary,
      details: this.asRecord(event.details),
      createdAt: event.createdAt.toISOString(),
    };
  }

  private toConversationTaskEventRecord(
    event: ConversationTaskEvent,
  ): ConversationTaskEventRecord | null {
    const eventType = this.toPublicTaskEventType(event.eventType);
    if (!eventType) {
      return null;
    }

    const details = this.asRecord(event.details);
    const output = this.asRecord(event.task.output);
    const assetIds =
      this.asStringArray(details.assetIds) ??
      this.asStringArray(output.assetIds) ??
      [];
    const errorMessage =
      this.asOptionalString(details.errorMessage) ??
      (eventType === "failed"
        ? this.sanitizeDisplayText(event.task.errorMessage ?? "", 240) || null
        : null);
    const retryOfTaskId =
      this.asOptionalString(details.retryOfTaskId) ??
      this.asOptionalString(details.retriedFromTaskId);
    const retryTaskId =
      this.asOptionalString(details.retryTaskId) ??
      this.asOptionalString(details.retriedTaskId);
    const title =
      this.asOptionalString(details.title) ??
      this.defaultTaskEventTitle(eventType);
    const detail =
      this.asOptionalString(details.detail) ??
      this.defaultTaskEventDetail(eventType, {
        assetCount: assetIds.length,
        errorMessage,
        retryOfTaskId,
        retryTaskId,
      });

    return {
      id: event.id,
      taskId: event.taskId,
      conversationId: event.task.conversationId ?? "",
      eventType,
      status: event.status ?? event.task.status,
      title,
      detail,
      errorMessage,
      progress:
        this.asNumber(details.progress) ?? this.progressForTaskEvent(eventType),
      assetIds,
      createdAt: event.createdAt.toISOString(),
      ...(retryOfTaskId ? { retryOfTaskId } : {}),
      ...(retryTaskId ? { retryTaskId } : {}),
    };
  }

  private toModelRecord(row: ModelCapability): ModelRecord {
    const metadata = this.asRecord(row.metadata);
    const capabilities = this.capabilitiesOf(row);
    const taskSupported = this.isTaskSupportedModel(row);

    return {
      id: row.model,
      name: typeof metadata.name === "string" ? metadata.name : row.model,
      type:
        metadata.type === "image-editing" || capabilities.includes("image.edit")
          ? "image-editing"
          : "image-generation",
      capabilityTypes: capabilities,
      enabled: true,
      taskSupported,
      status: taskSupported ? "available" : "unsupported",
      statusMessage: taskSupported
        ? undefined
        : "This model is registered but its Yunwu API family is not implemented for task submission yet.",
      provider: row.provider,
      description:
        typeof metadata.description === "string"
          ? metadata.description
          : undefined,
    };
  }

  private getLatestConversationTask(
    tasks: Array<{
      input?: unknown;
      updatedAt?: Date;
      createdAt?: Date;
    }>,
  ) {
    return tasks
      .slice()
      .sort((a, b) => {
        const aTime = a.updatedAt?.getTime?.() ?? a.createdAt?.getTime?.() ?? 0;
        const bTime = b.updatedAt?.getTime?.() ?? b.createdAt?.getTime?.() ?? 0;
        return bTime - aTime;
      })[0];
  }

  private toModelMetadata(model: YunwuModelDefinition): Prisma.InputJsonObject {
    return {
      name: model.name,
      type: model.capabilities.includes("image.edit")
        ? "image-editing"
        : "image-generation",
      description: model.description,
      family: model.family,
      taskSupported: model.taskSupported,
      defaultEnabled: model.defaultEnabled,
      source: "test_provider.txt",
    };
  }

  private isTaskSupportedModel(row: ModelCapability) {
    const metadata = this.asRecord(row.metadata);
    if (metadata.taskSupported === true) {
      return true;
    }

    const definition = getYunwuModelDefinition(row.model);
    return Boolean(definition?.taskSupported);
  }

  private toAssetRecord(asset: Asset): AssetRecord {
    const metadata = this.asRecord(asset.metadata);

    return {
      id: asset.id,
      taskId: asset.taskId ?? "",
      type: asset.type === "upload" ? "upload" : "generated",
      url: asset.url ?? "",
      storageKey: asset.storageKey ?? undefined,
      mimeType: asset.mimeType ?? undefined,
      width: typeof metadata.width === "number" ? metadata.width : undefined,
      height: typeof metadata.height === "number" ? metadata.height : undefined,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private toLibraryItemRecord(
    asset: Asset & {
      task?:
        | (TaskRecordEntity & {
            assets: Asset[];
            conversation?: Conversation | null;
          })
        | null;
    },
  ): LibraryItemRecord | null {
    if (!asset.task) {
      return null;
    }

    return {
      asset: this.toAssetRecord(asset),
      task: this.toTaskRecord(asset.task, asset.task.assets ?? []),
      conversation: asset.task.conversation
        ? this.toConversationSummary(asset.task.conversation)
        : undefined,
    };
  }

  private toAdminModelCapabilityRecord(
    row: ModelCapability,
  ): AdminModelCapabilityRecord {
    const metadata = this.asRecord(row.metadata);

    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      modality: row.modality,
      name: typeof metadata.name === "string" ? metadata.name : row.model,
      description:
        typeof metadata.description === "string"
          ? metadata.description
          : undefined,
      capabilityTypes: this.capabilitiesOf(row),
      enabled: row.enabled,
      metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private buildInputSummary(input: TaskInputShape): Record<string, unknown> {
    const prompt = input.prompt ?? "";

    return {
      model: input.model ?? "gpt-image-1",
      promptPreview: this.truncateText(prompt, 240),
      promptLength: prompt.length,
      assetCount: input.assetIds?.length ?? 0,
      assetIds: input.assetIds ?? [],
      providerBaseUrl: input.providerBaseUrl,
      params: this.summarizeParams(input.params),
    };
  }

  private buildOutputSummary(
    output: Record<string, unknown>,
    assets: Asset[],
  ): Record<string, unknown> | undefined {
    const generatedAssets = assets.filter(
      (asset) => asset.type === "generated",
    );
    const outputAssetIds = Array.isArray(output.assetIds)
      ? output.assetIds.filter((id): id is string => typeof id === "string")
      : [];

    if (generatedAssets.length === 0 && outputAssetIds.length === 0) {
      return undefined;
    }

    return {
      generatedAssetCount: generatedAssets.length || outputAssetIds.length,
      generatedAssetIds:
        generatedAssets.length > 0
          ? generatedAssets.map((asset) => asset.id)
          : outputAssetIds,
      mocked: typeof output.mocked === "boolean" ? output.mocked : undefined,
      inputAssetIds: Array.isArray(output.inputAssetIds)
        ? output.inputAssetIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
      assets: generatedAssets.map((asset) => {
        const metadata = this.asRecord(asset.metadata);

        return {
          id: asset.id,
          url: asset.url ?? "",
          storageKey: asset.storageKey ?? undefined,
          mimeType: asset.mimeType,
          width:
            typeof metadata.width === "number" ? metadata.width : undefined,
          height:
            typeof metadata.height === "number" ? metadata.height : undefined,
        };
      }),
    };
  }

  private latestFailedEventArgs() {
    return {
      where: { eventType: "failed" },
      orderBy: { createdAt: "desc" as const },
      take: 1,
    };
  }

  private normalizeAssetIds(assetIds?: string[]) {
    return [...new Set((assetIds ?? []).filter((assetId) => Boolean(assetId)))];
  }

  private async loadInputAssets(userId: string, assetIds: string[]) {
    if (assetIds.length === 0) {
      return [];
    }

    const assets = await this.prisma.asset.findMany({
      where: {
        id: { in: assetIds },
        userId,
        type: { in: ["upload", "generated"] },
        status: { in: ["ready", "deleted"] },
      },
    });
    const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

    return assetIds
      .map((assetId) => assetsById.get(assetId))
      .filter((asset): asset is Asset => Boolean(asset));
  }

  private defaultSourceAssetIds(
    sourceTask: (TaskRecordEntity & { assets?: Asset[] }) | null,
    sourceAction?: SupportedTaskSourceAction,
  ) {
    if (
      !sourceTask ||
      (sourceAction !== "edit" &&
        sourceAction !== "variant" &&
        sourceAction !== "fork")
    ) {
      return [];
    }

    return sourceTask.assets
      ?.filter((asset) => asset.type === "generated")
      .map((asset) => asset.id) ?? [];
  }

  private async resolveTaskConversation(
    user: AuthenticatedUser,
    input: {
      conversationId?: string;
      prompt: string;
      shouldFork: boolean;
      sourceTask: (TaskRecordEntity & { conversation?: Conversation | null }) | null;
    },
  ) {
    if (input.shouldFork) {
      return this.prisma.conversation.create({
        data: {
          userId: user.id,
          title: this.buildConversationTitle(
            input.prompt,
            input.sourceTask?.conversation?.title,
          ),
          metadata: this.buildForkConversationMetadata(input.sourceTask),
        },
      });
    }

    if (input.conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where:
          user.role === "admin"
            ? { id: input.conversationId, status: "active" }
            : { id: input.conversationId, userId: user.id, status: "active" },
      });
      if (!conversation) {
        throw new NotFoundException("Conversation not found.");
      }

      return conversation;
    }

    return this.prisma.conversation.create({
      data: {
        userId: user.id,
        title: this.buildConversationTitle(input.prompt),
      },
    });
  }

  private buildConversationTitle(prompt: string, fallbackTitle?: string | null) {
    const normalizedPrompt = prompt.trim();
    if (fallbackTitle?.trim()) {
      return fallbackTitle.trim();
    }

    return normalizedPrompt
      ? this.truncateText(normalizedPrompt, 80)
      : "New conversation";
  }

  private buildForkConversationMetadata(
    sourceTask: (TaskRecordEntity & { conversation?: Conversation | null }) | null,
  ): Prisma.InputJsonObject {
    return {
      ...(sourceTask?.conversationId
        ? { forkedFromConversationId: sourceTask.conversationId }
        : {}),
      ...(sourceTask?.id ? { forkedFromTaskId: sourceTask.id } : {}),
    };
  }

  private asSupportedSourceAction(
    value: unknown,
  ): SupportedTaskSourceAction | undefined {
    return ["retry", "edit", "variant", "fork"].includes(String(value))
      ? (value as SupportedTaskSourceAction)
      : undefined;
  }

  private toTaskFailureRecord(task: TaskRecordEntity): TaskFailureRecord | null {
    const details = this.asRecord(task.events?.[0]?.details);
    if (Object.keys(details).length === 0 && !task.errorMessage) {
      return null;
    }

    const category = this.asOptionalString(details.category) ?? "unknown";
    const retryable = Boolean(details.retryable ?? category === "unknown");
    const title =
      this.asOptionalString(details.title) ??
      (task.status === "failed" ? "Image task failed" : undefined);
    const detail = this.asOptionalString(details.detail);
    const statusCode = this.asNumber(details.statusCode);

    return {
      category,
      retryable,
      ...(title ? { title } : {}),
      ...(detail ? { detail } : {}),
      ...(statusCode !== undefined ? { statusCode } : {}),
    };
  }

  private isRetryableTaskStatus(status: string) {
    return status === "succeeded" || status === "failed";
  }

  private getTaskRetryBlockedMessage(status: string) {
    if (status === "queued" || status === "submitted" || status === "running") {
      return "This task is still in progress and cannot be retried yet.";
    }

    return `Only completed or failed tasks can be retried. Current status: ${status}.`;
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
      return { type: "array", length: value.length };
    }

    if (value && typeof value === "object") {
      return { type: "object", keys: Object.keys(value).slice(0, 20) };
    }

    return typeof value;
  }

  private toPublicTaskEventType(value: string): string | null {
    const eventType = value.startsWith("status.") ? value.slice(7) : value;
    const aliases: Record<string, string> = {
      "admin.retry_requested": "retry_requested",
      "admin.retry_created": "retried",
    };
    const normalized = aliases[eventType] ?? eventType;

    return [
      "queued",
      "submitted",
      "running",
      "succeeded",
      "failed",
      "retry_requested",
      "retried",
    ].includes(normalized)
      ? normalized
      : null;
  }

  private defaultTaskEventTitle(eventType: string) {
    const titles: Record<string, string> = {
      queued: "Task queued",
      submitted: "Task submitted",
      running: "Task running",
      succeeded: "Task completed",
      failed: "Task failed",
      retry_requested: "Retry requested",
      retried: "Retry task created",
    };

    return titles[eventType] ?? "Task event";
  }

  private defaultTaskEventDetail(
    eventType: string,
    context: {
      assetCount: number;
      errorMessage: string | null;
      retryOfTaskId?: string;
      retryTaskId?: string;
    },
  ) {
    switch (eventType) {
      case "queued":
        return "Your image task has been queued and will start soon.";
      case "submitted":
        return "A worker accepted the task and is preparing the image request.";
      case "running":
        return "The image request is running.";
      case "succeeded":
        return context.assetCount > 0
          ? `Generated ${context.assetCount} asset(s) and added them to this conversation.`
          : "The image task completed successfully.";
      case "failed":
        return context.errorMessage
          ? `The image task failed: ${context.errorMessage}`
          : "The image task failed. You can adjust the request or retry it.";
      case "retry_requested":
        return context.retryTaskId
          ? `A retry was requested and task ${context.retryTaskId} was queued.`
          : "A retry was requested for this failed task.";
      case "retried":
        return context.retryOfTaskId
          ? `This task was created as a retry of task ${context.retryOfTaskId}.`
          : "This task was created as a retry.";
      default:
        return "The task history was updated.";
    }
  }

  private progressForTaskEvent(eventType: string): number | null {
    const progress: Record<string, number> = {
      queued: 0,
      submitted: 20,
      running: 60,
      succeeded: 100,
      failed: 100,
      retried: 0,
    };

    return progress[eventType] ?? null;
  }

  private asStringArray(value: unknown): string[] | undefined {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : undefined;
  }

  private asOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
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

  private capabilitiesOf(row: ModelCapability): CapabilityType[] {
    return Array.isArray(row.capabilities)
      ? row.capabilities.filter(
          (capability): capability is CapabilityType =>
            typeof capability === "string" &&
            this.isSupportedCapability(capability),
        )
      : [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private isSupportedCapability(
    value: string,
  ): value is SupportedTaskCapability {
    return SUPPORTED_TASK_CAPABILITIES.includes(
      value as SupportedTaskCapability,
    );
  }

  private toJsonRecord(value: unknown): Prisma.InputJsonObject {
    return this.asRecord(value) as Prisma.InputJsonObject;
  }

  private isKnownMessageType(value: string): value is TaskMessage["type"] {
    return [
      "text",
      "image_result",
      "image_grid",
      "task_card",
      "upload_card",
      "action_card",
      "error_card",
      "system_notice",
    ].includes(value);
  }

  private defaultMessageType(message: Message): TaskMessage["type"] {
    if (message.role === "system") {
      return "system_notice";
    }

    return message.role === "assistant" ? "task_card" : "text";
  }
}
