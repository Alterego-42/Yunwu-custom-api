import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ApiService } from "../src/api/api.service";
import { ProviderConfigurationService } from "../src/openai-compatible/provider-configuration.service";
import {
  DEFAULT_YUNWU_MODEL_IDS,
  YUNWU_MODEL_DEFINITIONS,
  getYunwuModelDefinition,
} from "../src/openai-compatible/yunwu-model-registry";

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

function buildModelCapability(overrides: Record<string, unknown> = {}) {
  return {
    id: "cap-1",
    provider: "openai-compatible",
    model: "gpt-image-2",
    modality: "image",
    capabilities: ["image.generate", "image.edit"],
    enabled: true,
    metadata: {
      name: "GPT Image 2",
      type: "image-editing",
      taskSupported: true,
    },
    createdAt: NOW,
    updatedAt: NOW,
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
    modelCapabilityUpsert: [] as Array<Record<string, unknown>>,
    userSettingsPersist: [] as Array<unknown>,
  };

  const prisma: any = {
    modelCapability: {
      findMany: async () => [
        buildModelCapability(),
        buildModelCapability({
          id: "cap-legacy",
          model: "gpt-image-1",
          metadata: {
            name: "GPT Image 1",
            type: "image-editing",
            taskSupported: true,
          },
        }),
      ],
      findFirst: async () => buildModelCapability(),
      upsert: async (args: Record<string, unknown>) => {
        calls.modelCapabilityUpsert.push(args);
        return args;
      },
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
  prisma.$queryRaw = async () => [];
  prisma.$executeRaw = async (query: unknown) => {
    calls.userSettingsPersist.push(query);
    return 1;
  };

  for (const [section, methods] of Object.entries(overrides)) {
    if (section === "raw") {
      Object.assign(prisma, methods);
    } else {
      Object.assign(prisma[section], methods);
    }
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
  const providerConfig = {
    updateBaseUrl: async () => ({ baseUrl: "https://yunwu.ai" }),
    getBaseUrl: async () => "https://yunwu.ai",
  };

  const service = new ApiService(
    prisma,
    taskQueue as any,
    taskEvents as any,
    conversationEvents as any,
    openaiCompatible as any,
    providerConfig as any,
    providerState as any,
    providerAlerts as any,
  );

  return { service, calls };
}

test("onModuleInit registers Yunwu models with only the five requested defaults enabled", async () => {
  const { service, calls } = createHarness();

  await service.onModuleInit();

  const creates = calls.modelCapabilityUpsert.map(
    (call) => call.create as Record<string, any>,
  );
  const enabledModels = creates
    .filter((create) => create.enabled)
    .map((create) => create.model)
    .sort();

  assert.deepEqual(enabledModels, [
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
    "gpt-image-2",
    "grok-4.2-image",
    "grok-imagine-image-pro",
  ].sort());
  assert.ok(creates.some((create) => create.model === "flux-schnell"));
  assert.equal(
    creates.find((create) => create.model === "flux-schnell")?.enabled,
    false,
  );
});

test("Yunwu model registry includes all GPT, Gemini, and Grok image models", () => {
  const requiredModelIds = [
    "gpt-image-2",
    "gpt-image-1.5",
    "gpt-image-1.5-all",
    "gpt-image-2-all",
    "gpt-image-1",
    "gpt-image-1-all",
    "gpt-image-1-mini",
    "gpt-4o-image-vip",
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-image-preview",
    "grok-imagine-image",
    "grok-imagine-image-pro",
    "grok-4.2-image",
    "grok-4.1-image",
    "grok-4-image",
    "grok-3-image",
  ];

  assert.deepEqual(DEFAULT_YUNWU_MODEL_IDS, [
    "gpt-image-2",
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
    "grok-4.2-image",
    "grok-imagine-image-pro",
  ]);
  assert.ok(
    requiredModelIds.every((modelId) =>
      YUNWU_MODEL_DEFINITIONS.some((model) => model.id === modelId),
    ),
  );
  assert.equal(
    YUNWU_MODEL_DEFINITIONS.filter((model) => model.defaultEnabled).length,
    5,
  );
  assert.equal(
    getYunwuModelDefinition("gpt-image-2")?.capabilities.includes("image.edit"),
    true,
  );
  assert.equal(
    getYunwuModelDefinition("grok-3-image")?.capabilities.includes("image.edit"),
    true,
  );
  assert.equal(
    getYunwuModelDefinition("grok-4.2-image")?.capabilities.includes("image.edit"),
    true,
  );
  assert.equal(
    getYunwuModelDefinition("gemini-3-pro-image-preview")?.capabilities.includes("image.edit"),
    true,
  );
  assert.equal(
    getYunwuModelDefinition("gemini-2.5-flash-image")?.capabilities.includes("image.edit"),
    true,
  );
  assert.equal(
    getYunwuModelDefinition("gpt-4o-image-vip")?.capabilities.includes("image.edit"),
    false,
  );
});

test("getSettings returns user defaults from global base URL", async () => {
  const { service } = createHarness();

  const response = await service.getSettings(buildUser() as any);

  assert.equal(response.settings.baseUrl, "https://yunwu.ai");
  assert.deepEqual(response.settings.enabledModelIds.sort(), [
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image-preview",
    "gpt-image-2",
    "grok-4.2-image",
    "grok-imagine-image-pro",
  ].sort());
  assert.deepEqual(response.settings.ui, {});
});

test("getSettings masks provider API key and updateSettings can set and clear it", async () => {
  let storedApiKey = "sk-test-secret-123456";
  const { service } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://yunwu.ai",
          providerApiKey: storedApiKey,
          enabledModelIds: ["gpt-image-2"],
          ui: {},
        },
      ],
      $executeRaw: async (query: { values?: unknown[] }) => {
        storedApiKey = String(query.values?.[3] ?? "");
        return 1;
      },
    },
  });

  const response = await service.getSettings(buildUser() as any);

  assert.equal(response.settings.providerApiKey.configured, true);
  assert.notEqual(response.settings.providerApiKey.maskedApiKey, storedApiKey);
  assert.match(response.settings.providerApiKey.maskedApiKey ?? "", /\.\.\./);

  const updated = await service.updateSettings(buildUser() as any, {
    apiKey: "sk-new-secret-abcdef",
  });
  assert.equal(updated.settings.providerApiKey.configured, true);

  const cleared = await service.updateSettings(buildUser() as any, {
    clearApiKey: true,
  });
  assert.equal(cleared.settings.providerApiKey.configured, false);
});

test("checkUserApiKey uses the provided key and masks the response", async () => {
  let captured: Record<string, unknown> | undefined;
  const { service, calls } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://api3.wlai.vip",
          providerApiKey: null,
          enabledModelIds: ["gpt-image-2"],
          ui: {},
        },
      ],
    },
  });
  (service as any).openaiCompatible = {
    checkProviderModels: async (input: Record<string, unknown>) => {
      captured = input;
      return {
        baseUrlReachable: true,
        modelsSource: "configured",
      };
    },
  };

  const response = await service.checkUserApiKey(buildUser() as any, {
    apiKey: "sk-check-secret-123456",
  });

  assert.equal(captured?.baseUrl, "https://api3.wlai.vip");
  assert.equal(captured?.apiKey, "sk-check-secret-123456");
  assert.equal(calls.userSettingsPersist.length, 0);
  assert.equal(response.ok, true);
  assert.equal(response.status, "ok");
  assert.equal(response.message, "API key connectivity check succeeded.");
  assert.equal(response.apiKey.configured, true);
  assert.notEqual(response.apiKey.maskedApiKey, "sk-check-secret-123456");
  assert.equal(response.check.baseUrlReachable, true);
});

test("checkUserApiKey uses the saved key when no temporary key is provided", async () => {
  let captured: Record<string, unknown> | undefined;
  const { service, calls } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://yunwu.ai",
          providerApiKey: "sk-saved-secret-abcdef",
          enabledModelIds: ["gpt-image-2"],
          ui: {},
        },
      ],
    },
  });
  (service as any).openaiCompatible = {
    checkProviderModels: async (input: Record<string, unknown>) => {
      captured = input;
      return {
        baseUrlReachable: true,
        modelsSource: "remote",
        remoteModelIds: ["gpt-image-2"],
      };
    },
  };

  const response = await service.checkUserApiKey(buildUser() as any, {});

  assert.equal(captured?.baseUrl, "https://yunwu.ai");
  assert.equal(captured?.apiKey, "sk-saved-secret-abcdef");
  assert.equal(calls.userSettingsPersist.length, 0);
  assert.equal(response.ok, true);
  assert.equal(response.apiKey.configured, true);
  assert.notEqual(response.apiKey.maskedApiKey, "sk-saved-secret-abcdef");
  assert.equal(response.check.modelsSource, "remote");
  assert.equal(response.check.availableModelCount, 1);
});

test("checkUserApiKey returns an explicit failure when no key is available", async () => {
  let checkCalled = false;
  const { service } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://api3.wlai.vip",
          providerApiKey: null,
          enabledModelIds: ["gpt-image-2"],
          ui: {},
        },
      ],
    },
  });
  (service as any).openaiCompatible = {
    checkProviderModels: async () => {
      checkCalled = true;
      throw new Error("should not probe without a user API key");
    },
  };

  const response = await service.checkUserApiKey(buildUser() as any, {});

  assert.equal(checkCalled, false);
  assert.equal(response.ok, false);
  assert.equal(response.status, "error");
  assert.equal(response.apiKey.configured, false);
  assert.equal(response.apiKey.maskedApiKey, undefined);
  assert.equal(response.check.baseUrlReachable, false);
  assert.equal(response.check.modelsSource, "unavailable");
  assert.equal(response.check.error?.category, "missing_api_key");
  assert.match(response.message, /No API key is configured/);
});

test("checkUserApiKey does not leak invalid keys in failed check responses", async () => {
  const rawKey = "sk-invalid-secret-1234567890";
  const { service } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://yunwu.ai",
          providerApiKey: null,
          enabledModelIds: ["gpt-image-2"],
          ui: {},
        },
      ],
    },
  });
  (service as any).openaiCompatible = {
    checkProviderModels: async () => ({
      baseUrlReachable: true,
      modelsSource: "unavailable",
      error: {
        category: "provider_auth",
        message: "Provider rejected [redacted-api-key].",
        retryable: false,
        statusCode: 401,
      },
    }),
  };

  const response = await service.checkUserApiKey(buildUser() as any, {
    apiKey: rawKey,
  });
  const serialized = JSON.stringify(response);

  assert.equal(response.ok, false);
  assert.equal(response.status, "error");
  assert.equal(response.check.error?.statusCode, 401);
  assert.doesNotMatch(serialized, new RegExp(rawKey));
  assert.match(response.apiKey.maskedApiKey ?? "", /^.{4}\.\.\..{4}$/);
});

test("updateSettings persists user baseUrl, enabled models, and ui payload", async () => {
  let persistedValues: unknown[] = [];
  const { service } = createHarness({
    raw: {
      $executeRaw: async (query: { values?: unknown[] }) => {
        persistedValues = query.values ?? [];
        return 1;
      },
    },
  });

  const response = await service.updateSettings(buildUser() as any, {
    baseUrl: "https://api3.wlai.vip/",
    enabledModelIds: ["gpt-image-1"],
    ui: { density: "compact" },
  });

  assert.equal(response.settings.baseUrl, "https://api3.wlai.vip");
  assert.ok(response.settings.enabledModelIds.includes("gpt-image-1"));
  assert.ok(response.settings.enabledModelIds.includes("gpt-image-2"));
  assert.deepEqual(response.settings.ui, { density: "compact" });
  assert.ok(persistedValues.includes("https://api3.wlai.vip"));
});

test("updateSettings rejects unsupported baseUrl and unknown models", async () => {
  const { service } = createHarness();

  await assert.rejects(
    () =>
      service.updateSettings(buildUser() as any, {
        baseUrl: "https://example.com",
      }),
    (error: unknown) => {
      assert(error instanceof BadRequestException);
      assert.match((error as Error).message, /Unsupported Yunwu base_url/);
      return true;
    },
  );

  await assert.rejects(
    () =>
      service.updateSettings(buildUser() as any, {
        enabledModelIds: ["unknown-model"],
      }),
    (error: unknown) => {
      assert(error instanceof BadRequestException);
      assert.match((error as Error).message, /Unknown Yunwu model id/);
      return true;
    },
  );
});

test("getModels follows user enabledModelIds and marks unsupported families", async () => {
  const { service } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://api3.wlai.vip",
          enabledModelIds: [
            "gpt-image-2",
            "gpt-image-1",
            "black-forest-labs/flux-kontext-dev",
          ],
          ui: {},
        },
      ],
    },
    modelCapability: {
      findMany: async () => [
        buildModelCapability({
          id: "cap-default",
          model: "gpt-image-2",
          enabled: true,
          metadata: { name: "GPT Image 2", taskSupported: true },
        }),
        buildModelCapability({
          id: "cap-manual",
          model: "gpt-image-1",
          enabled: true,
          metadata: { name: "GPT Image 1", taskSupported: true },
        }),
        buildModelCapability({
          id: "cap-async",
          model: "black-forest-labs/flux-kontext-dev",
          enabled: true,
          metadata: {
            name: "Flux Kontext Dev",
            family: "replicate-prediction",
            taskSupported: false,
          },
        }),
      ],
    },
  });

  const response = await service.getModels(buildUser() as any);

  assert.deepEqual(
    response.models.map((model) => model.id).sort(),
    ["black-forest-labs/flux-kontext-dev", "gpt-image-1", "gpt-image-2"],
  );
  assert.equal(
    response.models.find((model) => model.id === "black-forest-labs/flux-kontext-dev")
      ?.taskSupported,
    false,
  );
  assert.equal(
    response.models.find((model) => model.id === "black-forest-labs/flux-kontext-dev")
      ?.status,
    "unsupported",
  );
});

test("createTask rejects enabled models whose Yunwu API family is not implemented", async () => {
  const user = buildUser();
  const { service } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://yunwu.ai",
          enabledModelIds: ["black-forest-labs/flux-kontext-dev"],
          ui: {},
        },
      ],
    },
    modelCapability: {
      findMany: async () => [
        buildModelCapability({
          model: "black-forest-labs/flux-kontext-dev",
          enabled: true,
          capabilities: ["image.generate"],
          metadata: {
            family: "replicate-prediction",
            taskSupported: false,
          },
        }),
      ],
      findFirst: async () =>
        buildModelCapability({
          model: "black-forest-labs/flux-kontext-dev",
          enabled: true,
          capabilities: ["image.generate"],
          metadata: {
            family: "replicate-prediction",
            taskSupported: false,
          },
        }),
    },
  });

  await assert.rejects(
    () =>
      service.createTask(user as any, {
        capability: "image.generate",
        model: "black-forest-labs/flux-kontext-dev",
        prompt: "Draw a mountain",
      }),
    (error: unknown) => {
      assert(error instanceof BadRequestException);
      assert.match((error as Error).message, /does not support its Yunwu API family/i);
      return true;
    },
  );
});

test("ProviderConfigurationService reads the default base URL and persists supported switches", async () => {
  let persisted: string | undefined;
  const prisma = {
    $queryRaw: async () =>
      persisted ? [{ baseUrl: persisted }] : [],
    $executeRaw: async (query: unknown) => {
      persisted = String((query as { values?: unknown[] }).values?.[1]);
      return 1;
    },
  };
  const config = {
    get: (key: string) =>
      key === "yunwu.baseUrl" ? "https://api3.wlai.vip/" : undefined,
  };
  const service = new ProviderConfigurationService(prisma as any, config as any);

  assert.equal(await service.getBaseUrl(), "https://api3.wlai.vip");
  await service.updateBaseUrl("https://yunwu.ai/");
  assert.equal(await service.getBaseUrl(), "https://yunwu.ai");

  await assert.rejects(
    () => service.updateBaseUrl("https://example.com"),
    (error: unknown) => {
      assert(error instanceof BadRequestException);
      assert.match((error as Error).message, /Unsupported Yunwu base_url/);
      return true;
    },
  );
});

test("createTask lazily creates a conversation and queues the task", async () => {
  const user = buildUser();
  const upload = buildAsset({ id: "upload-1", type: "upload" });
  const lazyConversation = buildConversation({ id: "conv-lazy", title: "Draw a lantern by the lake" });
  let createdTaskInput: Record<string, unknown> | undefined;

  const { service, calls } = createHarness({
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://api3.wlai.vip",
          enabledModelIds: ["gpt-image-1"],
          ui: {},
        },
      ],
    },
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
  assert.equal(
    (calls.taskCreate[0]?.input as Record<string, unknown>).providerBaseUrl,
    "https://api3.wlai.vip",
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
    raw: {
      $queryRaw: async () => [
        {
          baseUrl: "https://yunwu.ai",
          enabledModelIds: ["gpt-image-1"],
          ui: {},
        },
      ],
    },
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

test("retryTask retries failed tasks and writes retry source chain", async () => {
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

  const response = await service.retryTask(user as any, failedTask.id);

  assert.equal(calls.taskCreate[0]?.sourceTaskId, failedTask.id);
  assert.equal(calls.taskCreate[0]?.sourceAction, "retry");
  assert.deepEqual(calls.enqueued, [{ taskId: "task-retried", source: "user-retry" }]);
  assert.equal(response.retriedFromTaskId, failedTask.id);
  assert.equal(response.task.sourceTaskId, failedTask.id);
  assert.equal(response.task.sourceAction, "retry");
  assert.equal(response.task.canRetry, false);
});

test("retryTask retries succeeded tasks by copying original input", async () => {
  const user = buildUser();
  const conversation = buildConversation({ id: "conv-success-retry" });
  const succeededTask = buildTask({
    id: "task-succeeded",
    status: "succeeded",
    conversationId: conversation.id,
    conversation,
    type: "image.edit",
    input: {
      model: "gpt-image-2",
      prompt: "Retouch the product photo",
      assetIds: ["asset-input-1"],
      params: { size: "1024x1024", quality: "high" },
      providerBaseUrl: "https://api3.wlai.vip",
    },
    output: {
      assetIds: ["generated-1"],
    },
    assets: [buildAsset({ id: "generated-1", type: "generated" })],
  });

  const { service, calls } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === succeededTask.id ? succeededTask : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        return buildTask({
          id: "task-retried-success",
          ...data,
          conversation,
          assets: [],
          events: [],
        });
      },
      findUniqueOrThrow: async () =>
        buildTask({
          id: "task-retried-success",
          conversationId: conversation.id,
          sourceTaskId: succeededTask.id,
          sourceAction: "retry",
          type: "image.edit",
          status: "queued",
          conversation,
          assets: [],
          events: [],
          input: succeededTask.input,
        }),
    },
  });

  const response = await service.retryTask(user as any, succeededTask.id);

  assert.equal(calls.taskCreate[0]?.userId, user.id);
  assert.equal(calls.taskCreate[0]?.conversationId, conversation.id);
  assert.equal(calls.taskCreate[0]?.sourceTaskId, succeededTask.id);
  assert.equal(calls.taskCreate[0]?.sourceAction, "retry");
  assert.equal(calls.taskCreate[0]?.type, "image.edit");
  assert.deepEqual(calls.taskCreate[0]?.input, succeededTask.input);
  assert.deepEqual(calls.enqueued, [
    { taskId: "task-retried-success", source: "user-retry" },
  ]);
  assert.equal(response.retriedFromTaskId, succeededTask.id);
  assert.equal(response.task.sourceTaskId, succeededTask.id);
  assert.equal(response.task.sourceAction, "retry");
});

test("retryTask retries failed tasks even when failure details are non-retryable", async () => {
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

  const { service, calls } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === failedTask.id ? failedTask : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        return buildTask({
          id: "task-invalid-retry",
          ...data,
          assets: [],
          events: [],
        });
      },
      findUniqueOrThrow: async () =>
        buildTask({
          id: "task-invalid-retry",
          conversationId: failedTask.conversationId,
          sourceTaskId: failedTask.id,
          sourceAction: "retry",
          status: "queued",
          assets: [],
          events: [],
          input: failedTask.input,
        }),
    },
  });

  const response = await service.retryTask(user as any, failedTask.id);

  assert.equal(calls.taskCreate[0]?.sourceTaskId, failedTask.id);
  assert.equal(response.retriedFromTaskId, failedTask.id);
});

test("retryTask rejects in-progress tasks with a user-readable error", async () => {
  const user = buildUser();
  const runningTask = buildTask({
    id: "task-running",
    status: "running",
    conversationId: "conv-running",
  });
  const { service, calls } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string } }) =>
        where.id === runningTask.id ? runningTask : null,
    },
  });

  await assert.rejects(
    () => service.retryTask(user as any, runningTask.id),
    (error: unknown) => {
      assert(error instanceof BadRequestException);
      assert.match(
        (error as Error).message,
        /still in progress and cannot be retried yet/i,
      );
      return true;
    },
  );
  assert.equal(calls.taskCreate.length, 0);
});

test("retryTask keeps member retry access isolated to owned tasks", async () => {
  const ownerTask = buildTask({
    id: "task-owned-by-other",
    userId: "user-2",
    status: "succeeded",
  });
  const { service, calls } = createHarness({
    task: {
      findFirst: async ({ where }: { where: { id?: string; userId?: string } }) =>
        where.id === ownerTask.id &&
        (!where.userId || where.userId === ownerTask.userId)
          ? ownerTask
          : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskCreate.push(data);
        return buildTask({
          id: "task-admin-retry",
          ...data,
          assets: [],
          events: [],
        });
      },
      findUniqueOrThrow: async () =>
        buildTask({
          id: "task-admin-retry",
          userId: ownerTask.userId,
          conversationId: ownerTask.conversationId,
          sourceTaskId: ownerTask.id,
          sourceAction: "retry",
          status: "queued",
          assets: [],
          events: [],
          input: ownerTask.input,
        }),
    },
  });

  await assert.rejects(
    () => service.retryTask(buildUser({ id: "user-1" }) as any, ownerTask.id),
    (error: unknown) => {
      assert(error instanceof NotFoundException);
      assert.match((error as Error).message, /Task not found/);
      return true;
    },
  );
  assert.equal(calls.taskCreate.length, 0);

  const adminResponse = await service.retryTask(
    buildUser({ id: "admin-1", role: "admin" }) as any,
    ownerTask.id,
  );

  assert.equal(calls.taskCreate[0]?.userId, ownerTask.userId);
  assert.equal(adminResponse.retriedFromTaskId, ownerTask.id);
});

test("archiveConversation and deleteConversation only mutate owned conversations", async () => {
  const owner = buildUser();
  const outsider = buildUser({ id: "user-2" });
  const conversation = buildConversation({ id: "conv-mut", userId: owner.id });
  let updatedStatus: string | undefined;

  const { service } = createHarness({
    conversation: {
      findFirst: async ({ where }: { where: { id?: string; userId?: string } }) =>
        where.id === conversation.id &&
        (!where.userId || where.userId === owner.id)
          ? conversation
          : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedStatus = String(data.status);
        return buildConversation({
          ...conversation,
          status: data.status,
          metadata: data.metadata ?? null,
        });
      },
    },
  });

  await assert.rejects(() => service.archiveConversation(outsider as any, conversation.id));
  await service.archiveConversation(owner as any, conversation.id);
  assert.equal(updatedStatus, "archived");
  await service.deleteConversation(owner as any, conversation.id);
  assert.equal(updatedStatus, "deleted");
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
  assert.equal(response.task.canRetry, true);
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
    (calls.assetFindMany[0] as any)?.where?.status?.not,
    "deleted",
  );

  const deleted = await service.deleteLibraryAsset(
    user as any,
    (libraryAssetState as any).id,
  );
  assert.equal(deleted.asset.id, (libraryAssetState as any).id);
  assert.equal(calls.assetUpdate.length, 1);
  assert.equal((calls.assetUpdate[0] as any)?.data?.status, "deleted");
  assert.match(
    String((calls.assetUpdate[0] as any)?.data?.metadata?.deletedAt ?? ""),
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
