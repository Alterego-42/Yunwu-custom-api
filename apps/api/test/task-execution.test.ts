import assert from "node:assert/strict";
import test from "node:test";
import { TaskExecutionService } from "../src/tasks/task-execution.service";
import {
  OpenAICompatibleService,
  PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
} from "../src/openai-compatible/openai-compatible.service";

const NOW = new Date("2026-04-24T08:00:00.000Z");

test("TaskExecutionService fails user image tasks without API key and does not create assets", async () => {
  const calls = {
    assetCreate: [] as Array<Record<string, unknown>>,
    messageCreate: [] as Array<Record<string, unknown>>,
    taskUpdates: [] as Array<Record<string, unknown>>,
    taskEvents: [] as Array<Record<string, unknown>>,
    published: [] as Array<Record<string, unknown>>,
  };

  const task = {
    id: "task-no-key",
    userId: "user-1",
    conversationId: "conv-1",
    type: "image.generate",
    status: "queued",
    progress: 0,
    input: {
      model: "gpt-image-2",
      prompt: "Draw a fail-closed diagnostic image",
      assetIds: [],
      params: { size: "1024x1024" },
    },
    conversation: { id: "conv-1" },
    assets: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const prisma = {
    task: {
      findUnique: async () => task,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        calls.taskUpdates.push(data);
        return { ...task, ...data };
      },
    },
    asset: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.assetCreate.push(data);
        return { id: "asset-should-not-exist", ...data };
      },
    },
    message: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.messageCreate.push(data);
        return { id: "msg-1", ...data };
      },
    },
    $queryRaw: async () => [],
  };
  const config = {
    get: (key: string) => {
      if (key === "yunwu.apiKey") {
        return "";
      }
      if (key === "yunwu.allowMockImages") {
        return false;
      }
      return undefined;
    },
  };
  const providerConfig = {
    getBaseUrl: async () => "https://yunwu.ai",
  };
  const openaiCompatible = new OpenAICompatibleService(
    config as never,
    providerConfig as never,
  );
  const providerState = {
    persistTestFinished: async () => undefined,
    getState: async () => null,
  };
  const providerAlerts = {
    refreshAlerts: async <T>(value: T) => value,
  };
  const conversationEvents = {
    publishTaskUpdated: (payload: Record<string, unknown>) => {
      calls.published.push(payload);
    },
  };
  const taskEvents = {
    record: async (payload: Record<string, unknown>) => {
      calls.taskEvents.push(payload);
    },
  };
  const service = new TaskExecutionService(
    prisma as never,
    openaiCompatible,
    providerState as never,
    providerAlerts as never,
    conversationEvents as never,
    taskEvents as never,
  );

  await service.execute(task.id);

  assert.equal(calls.assetCreate.length, 0);
  assert.ok(
    calls.taskUpdates.some(
      (update) =>
        update.status === "failed" &&
        update.errorMessage === PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
    ),
  );
  assert.equal(
    calls.messageCreate.at(-1)?.content,
    PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
  );
  assert.ok(
    calls.taskEvents.some(
      (event) =>
        event.eventType === "failed" &&
        event.errorMessage === PROVIDER_API_KEY_NOT_CONFIGURED_MESSAGE,
    ),
  );
  assert.equal(calls.published.at(-1)?.status, "failed");
});

test("TaskExecutionService prefers the user API key over the global key", async () => {
  const calls = {
    requests: [] as Array<Record<string, unknown>>,
    published: [] as Array<Record<string, unknown>>,
  };
  const task = {
    id: "task-user-key",
    userId: "user-1",
    conversationId: "conv-1",
    type: "image.generate",
    status: "queued",
    progress: 0,
    input: {
      model: "gpt-image-2",
      prompt: "Draw a lantern by the lake",
      assetIds: [],
      params: { size: "1024x1024" },
    },
    conversation: { id: "conv-1" },
    assets: [],
    createdAt: NOW,
    updatedAt: NOW,
  };

  const prisma = {
    task: {
      findUnique: async () => task,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...task, ...data }),
    },
    asset: {
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "asset-1", ...data }),
    },
    message: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "msg-1", ...data }),
    },
    $queryRaw: async () => [{ providerApiKey: "sk-user-secret-123456" }],
  };
  const openaiCompatible = {
    getBaseConfig: async () => ({ hasApiKey: false, baseUrl: "https://yunwu.ai" }),
    createImageTask: async (request: Record<string, unknown>) => {
      calls.requests.push(request);
      return {
        url: "https://example.com/generated.png",
        mimeType: "image/png",
        width: 1024,
        height: 1024,
        responseSummary: { mode: "live" },
        mocked: false,
      };
    },
  };
  const providerState = {
    persistTestFinished: async () => undefined,
    getState: async () => null,
  };
  const providerAlerts = {
    refreshAlerts: async <T>(value: T) => value,
  };
  const conversationEvents = {
    publishTaskUpdated: (payload: Record<string, unknown>) => {
      calls.published.push(payload);
    },
  };
  const taskEvents = {
    record: async () => undefined,
  };
  const service = new TaskExecutionService(
    prisma as never,
    openaiCompatible as never,
    providerState as never,
    providerAlerts as never,
    conversationEvents as never,
    taskEvents as never,
  );

  await service.execute(task.id);

  assert.equal(calls.requests[0]?.apiKey, "sk-user-secret-123456");
  assert.equal(calls.requests[0]?.allowMock, false);
  assert.equal(calls.published.at(-1)?.status, "succeeded");
});
