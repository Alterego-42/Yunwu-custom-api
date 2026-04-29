import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { ApiService } from "../src/api/api.service";

const NOW = new Date("2026-04-24T08:00:00.000Z");

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    displayName: "User One",
    role: "member",
    ...overrides,
  };
}

function buildConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv-1",
    userId: "user-1",
    title: "Conversation",
    status: "active",
    metadata: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: "asset-1",
    userId: "user-1",
    messageId: null,
    taskId: null,
    type: "upload",
    mimeType: "image/png",
    url: "https://example.com/asset.png",
    storageKey: "asset.png",
    status: "ready",
    metadata: { width: 512, height: 512 },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function buildTaskEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    taskId: "task-1",
    eventType: "failed",
    status: "failed",
    summary: "Task failed.",
    details: {},
    createdAt: NOW,
    ...overrides,
  };
}

function buildTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    userId: "user-1",
    conversationId: "conv-1",
    sourceTaskId: null,
    sourceAction: null,
    type: "image.generate",
    status: "queued",
    progress: 0,
    input: {
      model: "gpt-image-1",
      prompt: "Draw a lantern by the lake",
      assetIds: [],
      params: { size: "1024x1024" },
    },
    output: null,
    errorMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    conversation: null,
    user: buildUser(),
    assets: [],
    events: [],
    ...overrides,
  };
}

function createHarness(
  overrides: Record<string, Record<string, (...args: any[]) => any>> = {},
) {
  const calls = {
    conversationCreate: [] as Array<Record<string, unknown>>,
    taskCreate: [] as Array<Record<string, unknown>>,
    messageCreate: [] as Array<Record<string, unknown>>,
    taskEventCreate: [] as Array<Record<string, unknown>>,
    taskEventCreateMany: [] as Array<Record<string, unknown>>,
    assetUpdate: [] as Array<Record<string, unknown>>,
    assetFindMany: [] as Array<Record<string, unknown>>,
    taskFindMany: [] as Array<Record<string, unknown>>,
    enqueued: [] as Array<{ taskId: string; source?: string }>,
    published: [] as Array<Record<string, unknown>>,
  };

  const prisma: any = {
    modelCapability: {
      findMany: async () => [
        {
          id: "cap-1",
          provider: "openai-compatible",
          model: "gpt-image-1",
          modality: "image",
          capabilities: ["image.generate", "image.edit"],
          enabled: true,
          metadata: { name: "GPT Image 1", type: "image-editing" },
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    },
    conversation: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.conversationCreate.push(data);
        return buildConversation({
          id: `conv-${calls.conversationCreate.length}`,
          title: data.title,
          userId: data.userId,
          metadata: data.metadata ?? null,
        });
      },
    },
    task: {
      findFirst: async () => null,
      findMany: async (args: Record<string, unknown>) => {
        calls.taskFindMany.push(args);
        return [];
      },
      findUnique: async () => null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) =>
        buildTask({ id: where.id }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        return buildTask({
          id: `task-${calls.taskCreate.length}`,
          ...data,
          conversation: null,
          user: buildUser(),
          assets: [],
          events: [],
        });
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        buildTask({ id: where.id, ...data }),
    },
    asset: {
      findMany: async (args: Record<string, unknown>) => {
        calls.assetFindMany.push(args);
        return [];
      },
      findFirst: async () => null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        calls.assetUpdate.push({ where, data });
        return buildAsset({ id: where.id, ...data });
      },
      updateMany: async () => ({ count: 0 }),
    },
    message: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.messageCreate.push(data);
        return { id: `msg-${calls.messageCreate.length}`, ...data };
      },
    },
    taskEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskEventCreate.push(data);
        return buildTaskEvent({ ...data, details: data.details ?? {} });
      },
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        calls.taskEventCreateMany.push({ data });
        return { count: data.length };
      },
      findMany: async () => [],
    },
  };

  prisma.$transaction = async (
    callback: (tx: typeof prisma) => Promise<unknown>,
  ) => callback(prisma);

  for (const [section, methods] of Object.entries(overrides)) {
    Object.assign(prisma[section], methods);
  }

  const taskQueue = {
    enqueueTask: async (taskId: string, source?: string) => {
      calls.enqueued.push({ taskId, source });
    },
  };
  const conversationEvents = {
    publishTaskUpdated: (payload: Record<string, unknown>) => {
      calls.published.push(payload);
    },
  };
  const taskEvents = {
    listForConversation: async () => [],
    listForTask: async () => [],
  };
  const openaiCompatible = {
    getProviderProfile: () => ({ mode: "mock" }),
    getBaseConfig: () => ({ hasApiKey: false }),
    checkProviderModels: async () => ({ remoteModelIds: [] }),
    createImageTask: async () => {
      throw new Error("not used");
    },
  };
  const providerState = {
    getState: async () => null,
    persistCheck: async () => null,
    persistTestQueued: async () => undefined,
    persistTestFinished: async () => undefined,
  };
  const providerAlerts = {
    refreshAlerts: async <T>(value: T) => value,
    acknowledgeAlert: async () => null,
  };

  const service = new ApiService(
    prisma,
    taskQueue as any,
    taskEvents as any,
    conversationEvents as any,
    openaiCompatible as any,
    providerState as any,
    providerAlerts as any,
  );

  return { service, calls };
}

test("createTask lazily creates a conversation and queues the task", async () => {
  const user = buildUser();
  const upload = buildAsset({ id: "upload-1", type: "upload" });
  const lazyConversation = buildConversation({ id: "conv-lazy", title: "Draw a lantern by the lake" });
  let createdTaskInput: Record<string, unknown> | undefined;

  const { service, calls } = createHarness({
    conversation: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.conversationCreate.push(data);
        return buildConversation({
          ...lazyConversation,
          title: data.title,
          userId: data.userId,
          metadata: data.metadata ?? null,
        });
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === lazyConversation.id
          ? {
              ...lazyConversation,
              messages: [],
              tasks: [
                buildTask({
                  id: "task-lazy",
                  conversationId: lazyConversation.id,
                  conversation: lazyConversation,
                  assets: [],
                  events: [],
                  input: createdTaskInput,
                }),
              ],
            }
          : null,
    },
    asset: {
      findMany: async () => [upload],
    },
    task: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        createdTaskInput = data.input as Record<string, unknown>;
        return buildTask({
          id: "task-lazy",
          ...data,
          conversation: lazyConversation,
          assets: [],
          events: [],
        });
      },
      findUniqueOrThrow: async () =>
        buildTask({
          id: "task-lazy",
          conversationId: lazyConversation.id,
          conversation: lazyConversation,
          assets: [],
          events: [],
          input: createdTaskInput,
        }),
    },
  });

  const response = await service.createTask(user as any, {
    capability: "image.generate",
    model: "gpt-image-1",
    prompt: "Draw a lantern by the lake",
    assetIds: [upload.id],
  });

  assert.equal(calls.conversationCreate.length, 1);
  assert.equal(calls.taskCreate[0]?.conversationId, lazyConversation.id);
  assert.deepEqual(
    (calls.taskCreate[0]?.input as Record<string, unknown>).assetIds,
    [upload.id],
  );
  assert.equal(response.conversation.id, lazyConversation.id);
  assert.equal(response.task.conversationId, lazyConversation.id);
  assert.deepEqual(response.task.assetIds, [upload.id]);
  assert.deepEqual(calls.enqueued, [{ taskId: "task-lazy", source: undefined }]);
});

test("createTask forks into a new conversation and preserves source chain", async () => {
  const user = buildUser();
  const sourceConversation = buildConversation({ id: "conv-root", title: "Root conversation" });
  const forkConversation = buildConversation({ id: "conv-fork", title: "Root conversation" });
  const sourceAsset = buildAsset({
    id: "generated-1",
    type: "generated",
    taskId: "task-source",
  });
  const sourceTask = buildTask({
    id: "task-source",
    status: "succeeded",
    conversationId: sourceConversation.id,
    conversation: sourceConversation,
    assets: [sourceAsset],
  });
  let createdTaskInput: Record<string, unknown> | undefined;

  const { service, calls } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === sourceTask.id ? sourceTask : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        createdTaskInput = data.input as Record<string, unknown>;
        return buildTask({
          id: "task-fork",
          ...data,
          conversation: forkConversation,
          assets: [],
          events: [],
        });
      },
      findUniqueOrThrow: async () =>
        buildTask({
          id: "task-fork",
          conversationId: forkConversation.id,
          sourceTaskId: sourceTask.id,
          sourceAction: "fork",
          conversation: forkConversation,
          assets: [],
          events: [],
          input: createdTaskInput,
        }),
    },
    conversation: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.conversationCreate.push(data);
        return buildConversation({
          ...forkConversation,
          title: data.title,
          userId: data.userId,
          metadata: data.metadata ?? null,
        });
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === forkConversation.id
          ? {
              ...forkConversation,
              metadata: {
                forkedFromConversationId: sourceConversation.id,
                forkedFromTaskId: sourceTask.id,
              },
              messages: [],
              tasks: [
                buildTask({
                  id: "task-fork",
                  conversationId: forkConversation.id,
                  sourceTaskId: sourceTask.id,
                  sourceAction: "fork",
                  conversation: forkConversation,
                  assets: [],
                  events: [],
                  input: createdTaskInput,
                }),
              ],
            }
          : null,
    },
    asset: {
      findMany: async () => [sourceAsset],
    },
  });

  const response = await service.createTask(user as any, {
    capability: "image.edit",
    model: "gpt-image-1",
    prompt: "Fork and refine the composition",
    sourceTaskId: sourceTask.id,
    sourceAction: "fork",
    fork: true,
  });

  assert.equal(calls.conversationCreate.length, 1);
  assert.deepEqual(calls.conversationCreate[0]?.metadata, {
    forkedFromConversationId: sourceConversation.id,
    forkedFromTaskId: sourceTask.id,
  });
  assert.equal(calls.taskCreate[0]?.conversationId, forkConversation.id);
  assert.equal(calls.taskCreate[0]?.sourceTaskId, sourceTask.id);
  assert.equal(calls.taskCreate[0]?.sourceAction, "fork");
  assert.deepEqual(
    (calls.taskCreate[0]?.input as Record<string, unknown>).assetIds,
    [sourceAsset.id],
  );
  assert.equal(response.conversation.id, forkConversation.id);
  assert.deepEqual(response.conversation.metadata, {
    forkedFromConversationId: sourceConversation.id,
    forkedFromTaskId: sourceTask.id,
  });
  assert.equal(response.task.sourceTaskId, sourceTask.id);
  assert.equal(response.task.sourceAction, "fork");
  assert.deepEqual(response.task.assetIds, [sourceAsset.id]);
});

test("retryFailedTask only allows retryable failures and writes retry source chain", async () => {
  const user = buildUser();
  const conversation = buildConversation({ id: "conv-retry" });
  const failedTask = buildTask({
    id: "task-failed",
    status: "failed",
    conversationId: conversation.id,
    conversation,
    events: [
      buildTaskEvent({
        taskId: "task-failed",
        details: {
          category: "provider_network",
          retryable: true,
          title: "Provider connection failed",
          detail: "The service could not reach the provider.",
        },
      }),
    ],
    errorMessage: "network timeout",
  });

  const { service, calls } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === failedTask.id ? failedTask : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        return buildTask({
          id: "task-retried",
          ...data,
          conversation,
          assets: [],
          events: [],
        });
      },
      findUniqueOrThrow: async () =>
        buildTask({
          id: "task-retried",
          conversationId: conversation.id,
          sourceTaskId: failedTask.id,
          sourceAction: "retry",
          conversation,
          assets: [],
          events: [],
          input: failedTask.input,
        }),
    },
  });

  const response = await service.retryFailedTask(user as any, failedTask.id);

  assert.equal(calls.taskCreate[0]?.sourceTaskId, failedTask.id);
  assert.equal(calls.taskCreate[0]?.sourceAction, "retry");
  assert.deepEqual(calls.enqueued, [{ taskId: "task-retried", source: "user-retry" }]);
  assert.equal(response.retriedFromTaskId, failedTask.id);
  assert.equal(response.task.sourceTaskId, failedTask.id);
  assert.equal(response.task.sourceAction, "retry");
  assert.equal(response.task.canRetry, false);
});

test("retryFailedTask rejects non-retryable content failures", async () => {
  const user = buildUser();
  const failedTask = buildTask({
    id: "task-invalid",
    status: "failed",
    events: [
      buildTaskEvent({
        taskId: "task-invalid",
        details: {
          category: "invalid_request",
          retryable: false,
          title: "Image request rejected",
          detail: "Prompt violates content policy.",
        },
      }),
    ],
    errorMessage: "Prompt violates content policy.",
  });

  const { service } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === failedTask.id ? failedTask : null,
    },
  });

  await assert.rejects(
    () => service.retryFailedTask(user as any, failedTask.id),
    (error: unknown) => {
      assert(error instanceof BadRequestException);
      assert.match(
        (error as Error).message,
        /retryable failed tasks can be retried from the client/i,
      );
      return true;
    },
  );
});

test("getTask exposes refill fields and structured failure details", async () => {
  const user = buildUser();
  const conversation = buildConversation({ id: "conv-detail" });
  const task = buildTask({
    id: "task-detail",
    status: "failed",
    conversationId: conversation.id,
    conversation,
    sourceTaskId: "task-prev",
    sourceAction: "variant",
    input: {
      model: "gpt-image-1",
      prompt: "Refine the skyline reflections",
      assetIds: ["generated-source"],
      params: { size: "1536x1024", style: "cinematic" },
    },
    events: [
      buildTaskEvent({
        taskId: "task-detail",
        details: {
          category: "invalid_request",
          retryable: false,
          title: "Image request rejected",
          detail: "Mask area is empty.",
          statusCode: 400,
        },
      }),
    ],
    errorMessage: "Mask area is empty.",
  });

  const { service } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === task.id ? task : null,
    },
  });

  const response = await service.getTask(user as any, task.id);

  assert.deepEqual(response.task.assetIds, ["generated-source"]);
  assert.deepEqual(response.task.params, {
    size: "1536x1024",
    style: "cinematic",
  });
  assert.equal(response.task.sourceTaskId, "task-prev");
  assert.equal(response.task.sourceAction, "variant");
  assert.deepEqual(response.task.failure, {
    category: "invalid_request",
    retryable: false,
    title: "Image request rejected",
    detail: "Mask area is empty.",
    statusCode: 400,
  });
  assert.equal(response.task.canRetry, false);
});

test("home/library exclude deleted assets while history still preserves deleted outputs", async () => {
  const user = buildUser();
  const conversation = buildConversation({ id: "conv-home", title: "Home thread" });
  const liveAsset = buildAsset({
    id: "asset-live",
    type: "generated",
    taskId: "task-live",
    status: "ready",
  });
  const deletedAsset = buildAsset({
    id: "asset-deleted",
    type: "generated",
    taskId: "task-history",
    status: "deleted",
    metadata: { width: 1024, height: 1024, deletedAt: NOW.toISOString() },
  });
  const successfulTask = buildTask({
    id: "task-live",
    status: "succeeded",
    conversationId: conversation.id,
    conversation,
    assets: [liveAsset],
    input: {
      model: "gpt-image-1",
      prompt: "Recent home artwork",
      assetIds: [],
      params: {},
    },
    output: {
      assetIds: [liveAsset.id],
      inputAssetIds: [],
    },
  });
  const historyTask = buildTask({
    id: "task-history",
    status: "succeeded",
    conversationId: conversation.id,
    conversation,
    assets: [deletedAsset],
    input: {
      model: "gpt-image-1",
      prompt: "Historical result",
      assetIds: [],
      params: {},
    },
    output: {
      assetIds: [deletedAsset.id],
      inputAssetIds: [],
    },
  });
  const failedTask = buildTask({
    id: "task-recovery",
    status: "failed",
    conversationId: conversation.id,
    conversation,
    events: [
      buildTaskEvent({
        taskId: "task-recovery",
        details: {
          category: "provider_unavailable",
          retryable: true,
          title: "Provider unavailable",
          detail: "Temporary upstream outage.",
        },
      }),
    ],
    errorMessage: "Temporary upstream outage.",
  });

  let libraryAssetState = buildAsset({
    ...liveAsset,
    status: "ready",
  });

  const { service, calls } = createHarness({
    conversation: {
      findMany: async () => [conversation],
    },
    task: {
      findMany: async (args: Record<string, any>) => {
        calls.taskFindMany.push(args);
        if (args.where?.status === "failed") {
          return [failedTask];
        }

        return [historyTask];
      },
    },
    asset: {
      findMany: async (args: Record<string, any>) => {
        calls.assetFindMany.push(args);
        return libraryAssetState.status === "deleted"
          ? []
          : [
              {
                ...libraryAssetState,
                task: {
                  ...successfulTask,
                  assets: [libraryAssetState],
                },
              },
            ];
      },
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === libraryAssetState.id ? libraryAssetState : null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        calls.assetUpdate.push({ where, data });
        libraryAssetState = buildAsset({
          ...libraryAssetState,
          id: where.id,
          status: data.status,
          metadata: data.metadata,
        });
        return libraryAssetState;
      },
    },
  });

  const home = await service.getHome(user as any);
  assert.equal(home.recentAssets.length, 1);
  assert.equal(home.recoveryTasks[0]?.canRetry, true);
  assert.equal(
    calls.assetFindMany[0]?.where?.status?.not,
    "deleted",
  );

  const deleted = await service.deleteLibraryAsset(user as any, libraryAssetState.id);
  assert.equal(deleted.asset.id, libraryAssetState.id);
  assert.equal(calls.assetUpdate.length, 1);
  assert.equal(calls.assetUpdate[0]?.data?.status, "deleted");
  assert.match(
    String(calls.assetUpdate[0]?.data?.metadata?.deletedAt ?? ""),
    /^\d{4}-\d{2}-\d{2}T/,
  );

  const library = await service.getLibrary(user as any);
  assert.equal(library.items.length, 0);

  const history = await service.getHistory(user as any);
  assert.deepEqual(
    (history.items[0]?.outputSummary as { generatedAssetIds?: string[] })?.generatedAssetIds,
    [deletedAsset.id],
  );
});
