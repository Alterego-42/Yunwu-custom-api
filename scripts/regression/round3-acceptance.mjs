#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
loadDotEnv(path.join(rootDir, ".env"));

const startedAt = new Date();
const REQUIRED_DEFAULT_MODEL_IDS = [
  "gpt-image-2",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "grok-4.2-image",
  "grok-imagine-image-pro",
];
const DISALLOWED_DEFAULT_MODEL_IDS = ["flux-schnell"];
const ALLOWED_BASE_URLS = ["https://yunwu.ai", "https://api3.wlai.vip"];

const config = {
  apiBaseUrl: stripTrailingSlash(
    process.env.ROUND3_API_BASE_URL ||
      process.env.REGRESSION_BASE_URL ||
      process.env.BASE_URL ||
      "http://127.0.0.1:3000",
  ),
  webBaseUrl: stripTrailingSlash(
    process.env.ROUND3_WEB_BASE_URL ||
      process.env.WEB_BASE_URL ||
      "http://127.0.0.1:5173",
  ),
  userEmail:
    process.env.ROUND3_USER_EMAIL ||
    process.env.REGRESSION_USER_EMAIL ||
    process.env.AUTH_DEMO_EMAIL ||
    "demo@yunwu.local",
  userPassword:
    process.env.ROUND3_USER_PASSWORD ||
    process.env.REGRESSION_USER_PASSWORD ||
    process.env.AUTH_DEMO_PASSWORD ||
    "demo123456",
  model:
    process.env.ROUND3_MODEL ||
    process.env.REGRESSION_MODEL ||
    process.env.YUNWU_DEFAULT_GENERATE_MODEL ||
    "gpt-image-2",
  outputDir: path.join(rootDir, "test-results", "regression"),
};

const cookieJar = new Map();
const summary = {
  startedAt: startedAt.toISOString(),
  apiBaseUrl: config.apiBaseUrl,
  webBaseUrl: config.webBaseUrl,
  matrix: [],
  artifacts: {
    json: path.join(config.outputDir, "round3-acceptance-latest.json"),
    markdown: path.join(config.outputDir, "round3-acceptance-latest.md"),
    screenshotsDir: path.join(config.outputDir, "round3-browser"),
  },
};

main().catch(async (error) => {
  summary.finishedAt = new Date().toISOString();
  summary.ok = false;
  summary.error = error instanceof Error ? error.message : String(error);
  await persistSummary();
  console.error(`✖ ${summary.error}`);
  process.exitCode = 1;
});

async function main() {
  console.log(`Starting Round 3 acceptance against API ${config.apiBaseUrl}`);

  await check("API health", "P0", "基础服务可用", async () => {
    const response = await requestJson("GET", "/health", undefined, { apiRoot: false });
    assert(response.body.status === "ok", "health.status must be ok");
    return response.body;
  });

  await check("User login", "P0", "普通用户登录态可访问创作与 /settings", async () => {
    const response = await requestJson("POST", "/auth/login", {
      email: config.userEmail,
      password: config.userPassword,
    });
    assert(Boolean(response.body.user?.email), "login user email is required");
    return {
      email: response.body.user.email,
      role: response.body.user.role,
    };
  });

  await check("Web route shells", "P1", "真实浏览器 smoke 前的页面入口可达性", async () => {
    const routes = ["/", "/create", "/history", "/library", "/settings"];
    const results = [];
    for (const route of routes) {
      const response = await fetchWithTimeout(`${config.webBaseUrl}${route}`, {
        headers: { Accept: "text/html" },
      });
      results.push({ route, status: response.status });
      assert(response.ok, `${route} returned ${response.status}`);
    }
    return { routes: results };
  });

  const modelsResult = await check("Model default list", "P0", "默认模型必须为 Round 3 指定模型集合且 flux-schnell 不默认启用", async () => {
    const response = await requestJson("GET", "/models");
    const models = response.body.models ?? response.body;
    assert(Array.isArray(models), "models response must be a list");
    assert(models.length > 0, "models list must not be empty");
    const modelIds = models.map((item) => item.id ?? item.model).filter(Boolean);
    const enabled = models.filter((item) => item.enabled !== false);
    const enabledIds = enabled.map((item) => item.id ?? item.model).filter(Boolean);
    for (const modelId of REQUIRED_DEFAULT_MODEL_IDS) {
      assert(modelIds.includes(modelId), `models must include ${modelId}`);
      assert(enabledIds.includes(modelId), `default enabled models must include ${modelId}`);
    }
    for (const modelId of DISALLOWED_DEFAULT_MODEL_IDS) {
      assert(!enabledIds.includes(modelId), `${modelId} must not be default enabled`);
    }
    assert(
      enabledIds.every((modelId) => REQUIRED_DEFAULT_MODEL_IDS.includes(modelId)),
      `default enabled models must be limited to: ${REQUIRED_DEFAULT_MODEL_IDS.join(", ")}`,
    );
    assert(enabled.length > 0, "at least one model must be enabled");
    return {
      count: models.length,
      enabledCount: enabled.length,
      requiredModels: REQUIRED_DEFAULT_MODEL_IDS,
      enabledModels: enabledIds,
      firstModel: enabledIds.includes(config.model) ? config.model : enabledIds[0] ?? modelIds[0],
    };
  });

  await check("User settings GET/PATCH base_url", "P1", "普通用户 /settings 可读取并切换指定 base_url 候选", async () => {
    const response = await requestJson("GET", "/settings");
    const settings = extractSettings(response.body);
    assert(settings, "settings payload is required");
    assert(ALLOWED_BASE_URLS.includes(settings.baseUrl), `baseUrl must be one of: ${ALLOWED_BASE_URLS.join(", ")}`);
    assert(!settings.baseUrl.endsWith("/v1"), "baseUrl must not include /v1");
    const enabledModelIds = getSettingsModelIds(settings);
    assertExactModelSet(enabledModelIds, "settings.enabledModelIds");

    const nextBaseUrl = ALLOWED_BASE_URLS.find((item) => item !== settings.baseUrl) ?? ALLOWED_BASE_URLS[0];
    const patchBody = {
      baseUrl: nextBaseUrl,
      enabledModelIds: REQUIRED_DEFAULT_MODEL_IDS,
      ui: settings.ui ?? {},
    };
    const patchResponse = await requestJson("PATCH", "/settings", patchBody);
    const patchedSettings = extractSettings(patchResponse.body);
    assert(patchedSettings?.baseUrl === nextBaseUrl, "PATCH /settings must persist selected baseUrl");
    assertExactModelSet(getSettingsModelIds(patchedSettings), "patched enabledModelIds");

    if (settings.baseUrl !== nextBaseUrl) {
      await requestJson("PATCH", "/settings", {
        baseUrl: settings.baseUrl,
        enabledModelIds,
        ui: settings.ui ?? {},
      });
    }

    return {
      originalBaseUrl: settings.baseUrl,
      patchedBaseUrl: nextBaseUrl,
      allowedBaseUrls: ALLOWED_BASE_URLS,
      enabledModelIds: getSettingsModelIds(patchedSettings),
    };
  });

  const createResult = await check("Create page submit API", "P0", "首次提交应懒创建会话并返回工作台 id", async () => {
    const response = await requestJson("POST", "/tasks", {
      capability: "image.generate",
      model: modelsResult.detail.firstModel ?? config.model,
      prompt: `Round 3 create submit ${formatTimestampForTitle(startedAt)}`,
    });
    const task = response.body.task;
    const conversation = response.body.conversation;
    assert(Boolean(task?.id), "task id is required");
    assert(Boolean(conversation?.id), "conversation id is required");
    assert(task.conversationId === conversation.id, "task must belong to returned conversation");
    return {
      taskId: task.id,
      status: task.status,
      conversationId: conversation.id,
      workspacePath: `/workspace/${conversation.id}`,
    };
  });

  const uploadResult = await check("Upload edit submit API", "P0", "上传图后应按 image.edit 提交", async () => {
    const upload = await uploadTinyPng();
    const asset = upload.body.asset;
    assert(Boolean(asset?.id), "uploaded asset id is required");
    const response = await requestJson("POST", "/tasks", {
      capability: "image.edit",
      model: modelsResult.detail.firstModel ?? config.model,
      prompt: "Round 3 upload edit smoke",
      assetIds: [asset.id],
    });
    const task = response.body.task;
    assert(task.capability === "image.edit", "upload edit task capability must be image.edit");
    return {
      assetId: asset.id,
      taskId: task.id,
      status: task.status,
      conversationId: response.body.conversation?.id,
    };
  });

  await check("Source image re-edit API", "P0", "来源任务再编辑应携带 sourceTaskId/sourceAction", async () => {
    const response = await requestJson("POST", "/tasks", {
      conversationId: uploadResult.detail.conversationId,
      capability: "image.edit",
      model: modelsResult.detail.firstModel ?? config.model,
      prompt: "Round 3 source image re-edit smoke",
      assetIds: [uploadResult.detail.assetId],
      sourceTaskId: uploadResult.detail.taskId,
      sourceAction: "edit",
    });
    const task = response.body.task;
    assert(task.sourceTaskId === uploadResult.detail.taskId, "sourceTaskId must be persisted");
    assert(task.sourceAction === "edit", "sourceAction must be edit");
    return {
      taskId: task.id,
      sourceTaskId: task.sourceTaskId,
      sourceAction: task.sourceAction,
      conversationId: task.conversationId,
    };
  });

  await check("Workspace session management API", "P0", "工作台即会话管理：列表和详情一致", async () => {
    const list = await requestJson("GET", "/conversations");
    const conversations = list.body.conversations ?? list.body;
    assert(Array.isArray(conversations), "conversations must be a list");
    assert(
      conversations.some((item) => item.id === createResult.detail.conversationId),
      "created conversation must appear in session list",
    );
    const detail = await requestJson("GET", `/conversations/${createResult.detail.conversationId}`);
    assert(detail.body.conversation?.id === createResult.detail.conversationId, "conversation detail id mismatch");
    return {
      count: conversations.length,
      checkedConversationId: createResult.detail.conversationId,
      taskCount: detail.body.conversation?.tasks?.length ?? 0,
    };
  });

  await check("Home recent items API", "P1", "首页最近会话/最近任务应包含本轮提交", async () => {
    const response = await requestJson("GET", "/home");
    const home = response.body;
    assert(Array.isArray(home.recentConversations), "recentConversations must be a list");
    assert(Array.isArray(home.recentTasks), "recentTasks must be a list");
    assert(
      home.recentConversations.some((item) => item.id === createResult.detail.conversationId),
      "home recentConversations must include created conversation",
    );
    return {
      recentConversations: home.recentConversations.length,
      recentTasks: home.recentTasks.length,
      recentAssets: home.recentAssets?.length ?? 0,
      recoveryTasks: home.recoveryTasks?.length ?? 0,
    };
  });

  await check("History preview API", "P1", "历史列表应能预览本轮任务", async () => {
    const response = await requestJson("GET", "/history");
    const items = response.body.items ?? [];
    assert(Array.isArray(items), "history items must be a list");
    assert(items.some((item) => item.id === createResult.detail.taskId), "history must include created task");
    return {
      count: items.length,
      checkedTaskId: createResult.detail.taskId,
    };
  });

  await check("Library management API", "P2", "作品管理接口可达；有成功作品时可继续真实浏览器删除验证", async () => {
    const response = await requestJson("GET", "/library");
    const items = response.body.items ?? [];
    assert(Array.isArray(items), "library items must be a list");
    return {
      count: items.length,
      note: items.length === 0 ? "No succeeded output assets yet; browser delete smoke is manual/conditional." : "Library has assets.",
    };
  });

  summary.ok = summary.matrix.every((item) => item.ok || item.severity === "P2");
  summary.finishedAt = new Date().toISOString();
  await persistSummary();

  if (!summary.ok) {
    throw new Error("Round 3 acceptance has blocking failures.");
  }

  console.log("✔ Round 3 acceptance matrix completed");
  console.log(`- JSON: ${summary.artifacts.json}`);
  console.log(`- Markdown: ${summary.artifacts.markdown}`);
  console.log(`- Browser screenshots dir: ${summary.artifacts.screenshotsDir}`);
}

async function check(name, severity, acceptance, action) {
  const started = Date.now();
  try {
    const detail = await action();
    const record = {
      name,
      severity,
      acceptance,
      ok: true,
      durationMs: Date.now() - started,
      detail,
    };
    summary.matrix.push(record);
    console.log(`✔ ${name}`);
    return record;
  } catch (error) {
    const record = {
      name,
      severity,
      acceptance,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
    summary.matrix.push(record);
    console.error(`✖ ${name}: ${record.error}`);
    if (severity === "P0") {
      throw new Error(`${name} failed: ${record.error}`);
    }
    return record;
  }
}

async function requestJson(method, urlPath, body, options = {}) {
  const headers = { Accept: "application/json" };
  const cookieHeader = serializeCookies();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const prefix = options.apiRoot === false ? "" : "/api";
  const response = await fetchWithTimeout(`${config.apiBaseUrl}${prefix}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  captureCookies(response);
  const rawText = await response.text();
  const parsed = rawText ? tryParseJson(rawText) : null;

  if (!response.ok) {
    const message = parsed?.message || parsed?.error || `${method} ${urlPath} returned ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join("; ") : message);
  }

  if (parsed === null) {
    throw new Error(`${method} ${urlPath} did not return JSON`);
  }

  return { status: response.status, body: parsed };
}

async function uploadTinyPng() {
  const pngBytes = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
    0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
    120, 156, 99, 248, 207, 192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29,
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
  const formData = new FormData();
  formData.append("file", new Blob([pngBytes], { type: "image/png" }), "round3-smoke.png");

  const headers = { Accept: "application/json" };
  const cookieHeader = serializeCookies();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const response = await fetchWithTimeout(`${config.apiBaseUrl}/api/assets/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  captureCookies(response);
  const rawText = await response.text();
  const parsed = rawText ? tryParseJson(rawText) : null;
  if (!response.ok) {
    throw new Error(parsed?.message || parsed?.error || `upload returned ${response.status}`);
  }
  return { status: response.status, body: parsed };
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${url} fetch failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function persistSummary() {
  await mkdir(config.outputDir, { recursive: true });
  await mkdir(summary.artifacts.screenshotsDir, { recursive: true });
  await writeFile(summary.artifacts.json, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(summary.artifacts.markdown, renderMarkdownSummary(), "utf8");
}

function renderMarkdownSummary() {
  const rows = summary.matrix
    .map((item) => {
      const status = item.ok ? "PASS" : "FAIL";
      const detail = item.ok
        ? summarizeDetail(item.detail)
        : `${item.error} | 建议：按验收项复现，先修 P0/P1，再补浏览器截图。`;
      return `| ${item.name} | ${item.severity} | ${status} | ${escapeTable(item.acceptance)} | ${escapeTable(detail)} |`;
    })
    .join("\n");

  return `# Round 3 Acceptance Result

- Started: ${summary.startedAt}
- Finished: ${summary.finishedAt ?? ""}
- API: ${summary.apiBaseUrl}
- Web: ${summary.webBaseUrl}
- Overall: ${summary.ok === undefined ? "IN_PROGRESS" : summary.ok ? "PASS" : "FAIL"}
- Browser screenshots: ${summary.artifacts.screenshotsDir}

| Item | Severity | Result | Acceptance | Detail |
| --- | --- | --- | --- | --- |
${rows}

## Real Browser Smoke Slots

截图建议保存到 \`${summary.artifacts.screenshotsDir}\`，命名为：

- \`01-create-submit.png\`
- \`02-upload-edit.png\`
- \`03-source-reedit.png\`
- \`04-model-default-list.png\`
- \`05-settings-base-url-switch.png\`
- \`06-settings-visual.png\`
- \`07-home-recent.png\`
- \`08-history-preview.png\`
- \`09-library-management.png\`
- \`10-workspace-session-management.png\`
`;
}

function summarizeDetail(detail) {
  if (!detail || typeof detail !== "object") {
    return String(detail ?? "");
  }
  return Object.entries(detail)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join("; ");
}

function extractSettings(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const settings = "settings" in payload ? payload.settings : payload;
  return settings && typeof settings === "object" ? settings : null;
}

function getSettingsModelIds(settings) {
  if (!settings || typeof settings !== "object") {
    return [];
  }
  if (Array.isArray(settings.enabledModelIds)) {
    return settings.enabledModelIds;
  }
  if (Array.isArray(settings.availableModelIds)) {
    return settings.availableModelIds;
  }
  return [];
}

function assertExactModelSet(modelIds, label) {
  assert(Array.isArray(modelIds), `${label} must be a list`);
  const actual = [...new Set(modelIds)].sort();
  const expected = [...REQUIRED_DEFAULT_MODEL_IDS].sort();
  assert(actual.length === expected.length, `${label} must contain exactly ${expected.join(", ")}`);
  for (const modelId of expected) {
    assert(actual.includes(modelId), `${label} must include ${modelId}`);
  }
  for (const modelId of DISALLOWED_DEFAULT_MODEL_IDS) {
    assert(!actual.includes(modelId), `${label} must not include ${modelId}`);
  }
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
    cookieJar.set(firstPart.slice(0, separator).trim(), firstPart.slice(separator + 1).trim());
  }
}

function serializeCookies() {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function splitSetCookieHeader(value) {
  return value ? value.split(/,(?=[^;]+=[^;]+)/g) : [];
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatTimestampForTitle(value) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0"),
    String(value.getSeconds()).padStart(2, "0"),
  ].join("");
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}
