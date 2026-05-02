#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
loadDotEnv(path.join(rootDir, ".env"));

const startedAt = new Date();
const config = {
  baseUrl: stripTrailingSlash(
    process.env.REGRESSION_BASE_URL ||
      process.env.BASE_URL ||
      "http://localhost:3000",
  ),
  adminEmail:
    process.env.REGRESSION_ADMIN_EMAIL ||
    process.env.AUTH_ADMIN_EMAIL ||
    "admin@yunwu.local",
  adminPassword:
    process.env.REGRESSION_ADMIN_PASSWORD ||
    process.env.AUTH_ADMIN_PASSWORD ||
    "admin123456",
  businessModel:
    process.env.REGRESSION_MODEL ||
    process.env.YUNWU_DEFAULT_GENERATE_MODEL ||
    "gpt-image-2",
  taskTimeoutMs: toNumber(process.env.REGRESSION_TASK_TIMEOUT_MS, 120000),
  taskPollMs: toNumber(process.env.REGRESSION_TASK_POLL_MS, 3000),
  providerPrompt:
    process.env.REGRESSION_PROVIDER_PROMPT ||
    "Provider regression smoke test image.",
  outputDir: path.join(rootDir, "test-results", "regression"),
};

const cookieJar = new Map();
const summary = {
  startedAt: startedAt.toISOString(),
  baseUrl: config.baseUrl,
  checks: [],
};

main().catch(async (error) => {
  summary.finishedAt = new Date().toISOString();
  summary.ok = false;
  summary.error = {
    message: error instanceof Error ? error.message : String(error),
  };
  await persistSummary();
  console.error(`✖ ${summary.error.message}`);
  process.exitCode = 1;
});

async function main() {
  console.log(`Starting local regression against ${config.baseUrl}`);

  const health = await step("health", async () => {
    const response = await requestJson("GET", "/health");
    assert(response.body.status === "ok", "health.status must be ok");
    return response.body;
  });

  const login = await step("login", async () => {
    const response = await requestJson("POST", "/api/auth/login", {
      email: config.adminEmail,
      password: config.adminPassword,
    });
    assert(response.body.user?.role === "admin", "login user role must be admin");
    return {
      email: response.body.user.email,
      role: response.body.user.role,
      displayName: response.body.user.displayName,
    };
  });

  await step("auth.me", async () => {
    const response = await requestJson("GET", "/api/auth/me");
    assert(response.body?.user?.email === login.email, "auth.me must match login user");
    return {
      email: response.body.user.email,
      role: response.body.user.role,
    };
  });

  await step("admin.provider", async () => {
    const response = await requestJson("GET", "/api/admin/provider");
    const provider = response.body.provider;
    assert(Boolean(provider?.mode), "provider.mode is required");
    assert(typeof provider?.apiKeyConfigured === "boolean", "provider.apiKeyConfigured is required");
    return {
      status: provider.status,
      mode: provider.mode,
      baseUrl: provider.baseUrl,
      apiKeyConfigured: provider.apiKeyConfigured,
      maskedApiKey: provider.maskedApiKey ?? null,
      alerts: provider.summary?.warningCount ?? 0,
    };
  });

  const providerCheck = await step("admin.provider.check", async () => {
    const response = await requestJson("POST", "/api/admin/provider/check");
    const check = response.body.check;
    assert(["ok", "degraded", "error"].includes(check?.status), "provider check status is invalid");
    assert(typeof check?.apiKeyConfigured === "boolean", "provider check apiKeyConfigured missing");
    return {
      status: check.status,
      mode: check.mode,
      modelsSource: check.modelsSource,
      latencyMs: check.latencyMs,
      apiKeyConfigured: check.apiKeyConfigured,
      baseUrlReachable: check.baseUrlReachable,
    };
  });

  const conversation = await step("business.createConversation", async () => {
    const response = await requestJson("POST", "/api/conversations", {
      title: `regression smoke ${formatTimestampForTitle(startedAt)}`,
    });
    assert(Boolean(response.body.conversation?.id), "conversation id is required");
    return {
      id: response.body.conversation.id,
      title: response.body.conversation.title,
      status: response.body.conversation.status,
    };
  });

  const businessTask = await step("business.createTask", async () => {
    const response = await requestJson("POST", "/api/tasks", {
      conversationId: conversation.id,
      capability: "image.generate",
      model: config.businessModel,
      prompt: "Local regression smoke task.",
    });
    const task = response.body.task;
    assert(Boolean(task?.id), "business task id is required");
    assert(
      ["queued", "submitted", "running", "succeeded"].includes(task.status),
      "business task status is invalid",
    );
    return {
      id: task.id,
      status: task.status,
      model: task.modelId,
      capability: task.capability,
    };
  });

  const businessTaskFinal = await step("business.pollTask", async () => {
    const result = await pollTask(businessTask.id, config.taskTimeoutMs, config.taskPollMs);
    assert(result.status === "succeeded", "business task must succeed");
    return result;
  });

  const providerTest = await step("admin.provider.testGenerate", async () => {
    const response = await requestJson("POST", "/api/admin/provider/test-generate", {
      prompt: config.providerPrompt,
    });
    const task = response.body.task;
    const test = response.body.test;
    assert(Boolean(task?.id), "provider test task id is required");
    assert(test?.capability === "image.generate", "provider test capability must be image.generate");
    return {
      id: task.id,
      status: task.status,
      model: test.model,
      capability: test.capability,
      queuedAt: test.queuedAt,
    };
  });

  const providerTaskFinal = await step("admin.provider.pollTask", async () => {
    const result = await pollTask(providerTest.id, config.taskTimeoutMs, config.taskPollMs);
    assert(result.status === "succeeded", "provider test task must succeed");
    return result;
  });

  summary.ok = true;
  summary.finishedAt = new Date().toISOString();
  summary.result = {
    health,
    login,
    providerCheck,
    conversationId: conversation.id,
    businessTaskId: businessTask.id,
    businessTaskStatus: businessTaskFinal.status,
    providerTaskId: providerTest.id,
    providerTaskStatus: providerTaskFinal.status,
  };

  await persistSummary();

  console.log("✔ Regression smoke passed");
  console.log(`- conversation: ${conversation.id}`);
  console.log(`- business task: ${businessTaskFinal.id} (${businessTaskFinal.status})`);
  console.log(`- provider task: ${providerTaskFinal.id} (${providerTaskFinal.status})`);
  console.log(`- summary: ${path.join(config.outputDir, "local-smoke-latest.json")}`);
}

async function step(name, action) {
  const stepStartedAt = Date.now();
  try {
    const detail = await action();
    const record = {
      name,
      ok: true,
      durationMs: Date.now() - stepStartedAt,
      detail,
    };
    summary.checks.push(record);
    console.log(`✔ ${name}`);
    return detail;
  } catch (error) {
    const record = {
      name,
      ok: false,
      durationMs: Date.now() - stepStartedAt,
      error: error instanceof Error ? error.message : String(error),
    };
    summary.checks.push(record);
    throw new Error(`${name} failed: ${record.error}`);
  }
}

async function pollTask(taskId, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let lastTask = null;

  while (Date.now() < deadline) {
    const response = await requestJson("GET", `/api/tasks/${taskId}`);
    const task = response.body.task;
    assert(Boolean(task?.id), "task lookup must return task");
    lastTask = {
      id: task.id,
      status: task.status,
      model: task.modelId,
      capability: task.capability,
      errorMessage: task.errorMessage ?? null,
      outputAssetCount: Array.isArray(task.outputAssets) ? task.outputAssets.length : undefined,
      updatedAt: task.updatedAt,
    };

    if (["succeeded", "failed", "cancelled", "expired"].includes(task.status)) {
      return lastTask;
    }

    await sleep(intervalMs);
  }

  throw new Error(
    `task ${taskId} did not reach terminal state in ${timeoutMs}ms; last status: ${lastTask?.status ?? "unknown"}`,
  );
}

async function requestJson(method, urlPath, body) {
  const headers = {
    Accept: "application/json",
  };
  const cookieHeader = serializeCookies();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${config.baseUrl}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  captureCookies(response);

  const rawText = await response.text();
  const parsed = rawText ? tryParseJson(rawText) : null;

  if (!response.ok) {
    const message =
      parsed?.message ||
      parsed?.error ||
      `${method} ${urlPath} returned ${response.status}`;
    throw new Error(message);
  }

  if (parsed === null) {
    throw new Error(`${method} ${urlPath} did not return JSON`);
  }

  return {
    status: response.status,
    body: parsed,
  };
}

async function persistSummary() {
  await mkdir(config.outputDir, { recursive: true });
  await writeFile(
    path.join(config.outputDir, "local-smoke-latest.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
}

function captureCookies(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookieHeader(response.headers.get("set-cookie"));

  for (const item of setCookies) {
    if (!item) {
      continue;
    }
    const firstPart = item.split(";", 1)[0];
    const separator = firstPart.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const name = firstPart.slice(0, separator).trim();
    const value = firstPart.slice(separator + 1).trim();
    cookieJar.set(name, value);
  }
}

function serializeCookies() {
  if (cookieJar.size === 0) {
    return "";
  }
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function splitSetCookieHeader(value) {
  if (!value) {
    return [];
  }
  return value.split(/,(?=[^;]+=[^;]+)/g);
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimestampForTitle(value) {
  const parts = [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0"),
    String(value.getSeconds()).padStart(2, "0"),
  ];
  return parts.join("");
}
