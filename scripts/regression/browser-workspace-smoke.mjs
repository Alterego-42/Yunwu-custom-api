#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const rootDir = process.cwd();
const requireFromHere = createRequire(import.meta.url);
loadDotEnv(path.join(rootDir, ".env"));

const startedAt = new Date();
const config = {
  webBaseUrl: stripTrailingSlash(
    process.env.WEB_BASE_URL ||
      process.env.ROUND3_WEB_BASE_URL ||
      "http://127.0.0.1:5173",
  ),
  apiBaseUrl: stripTrailingSlash(
    process.env.API_BASE_URL ||
      process.env.ROUND3_API_BASE_URL ||
      process.env.REGRESSION_BASE_URL ||
      process.env.BASE_URL ||
      "http://127.0.0.1:3000",
  ),
  email:
    process.env.BROWSER_SMOKE_EMAIL ||
    process.env.ROUND3_USER_EMAIL ||
    process.env.REGRESSION_USER_EMAIL ||
    process.env.AUTH_DEMO_EMAIL ||
    "demo@yunwu.local",
  password:
    process.env.BROWSER_SMOKE_PASSWORD ||
    process.env.ROUND3_USER_PASSWORD ||
    process.env.REGRESSION_USER_PASSWORD ||
    process.env.AUTH_DEMO_PASSWORD ||
    "demo123456",
  outputDir: path.resolve(
    rootDir,
    process.env.BROWSER_SMOKE_OUTPUT_DIR ||
      path.join("test-results", "regression", "browser-workspace-smoke"),
  ),
  headless: parseBoolean(process.env.BROWSER_SMOKE_HEADLESS ?? process.env.HEADLESS, true),
  sessionId:
    process.env.BROWSER_SMOKE_SESSION_ID ||
    process.env.WORKSPACE_SESSION_ID ||
    process.env.ROUND3_SESSION_ID ||
    "",
  autoStart: parseBoolean(process.env.BROWSER_SMOKE_AUTO_START, true),
  startupTimeoutMs: toNumber(process.env.BROWSER_SMOKE_STARTUP_TIMEOUT_MS, 90000),
  actionTimeoutMs: toNumber(process.env.BROWSER_SMOKE_ACTION_TIMEOUT_MS, 15000),
  screenshotTimeoutMs: toNumber(process.env.BROWSER_SMOKE_SCREENSHOT_TIMEOUT_MS, 30000),
  slowMoMs: toNumber(process.env.BROWSER_SMOKE_SLOW_MO_MS, 0),
  testInvalidApiKey: parseBoolean(process.env.BROWSER_SMOKE_TEST_INVALID_API_KEY, false),
};

const artifacts = {
  json: path.join(config.outputDir, "latest.json"),
  markdown: path.join(config.outputDir, "latest.md"),
  screenshotsDir: path.join(config.outputDir, "screenshots"),
};

const summary = {
  name: "browser-workspace-smoke",
  startedAt: startedAt.toISOString(),
  webBaseUrl: config.webBaseUrl,
  apiBaseUrl: config.apiBaseUrl,
  headless: config.headless,
  sessionId: config.sessionId || null,
  artifacts,
  checks: [],
  screenshots: [],
  notes: [],
};

main().catch(async (error) => {
  summary.ok = false;
  summary.finishedAt = new Date().toISOString();
  summary.error = error instanceof Error ? error.message : String(error);
  await persistSummary();
  console.error(`✖ ${summary.error}`);
  process.exitCode = 1;
});

async function main() {
  await ensureOutputDirs();

  const runtime = await resolveBrowserRuntime();
  await ensureServicesReady();

  if (runtime.kind === "playwright") {
    await runStructuredSmoke(runtime.playwright, runtime.source);
    return;
  }

  await runBrowserUseScreenshotFallback(runtime);
}

async function runStructuredSmoke(playwright, source) {
  summary.runtimeMode = "playwright-structured";
  await step("Browser runtime", "P0", "使用可解析 Playwright 运行结构化浏览器断言", async () => ({
    mode: summary.runtimeMode,
    source: source ?? "unknown",
  }));

  const browser = await playwright.chromium.launch({
    headless: config.headless,
    slowMo: config.slowMoMs,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    baseURL: config.webBaseUrl,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(config.actionTimeoutMs);
  page.setDefaultNavigationTimeout(config.screenshotTimeoutMs);

  try {
    await login(page);
    const targetWorkspace = await resolveWorkspaceTarget(page);

    if (!targetWorkspace) {
      await capturePage(page, "00-no-workspace-data", "No existing workspace data; redirected to /create.");
      await step("Workspace data", "P1", "无会话时应打开 /create 并在报告中标记无数据", async () => {
        await expectUrlContains(page, "/create");
        return { route: page.url(), note: "No conversation available." };
      });
    } else {
      await openWorkspace(page, targetWorkspace);
      await coverWorkspace(page, targetWorkspace);
    }

    await coverCreateComposerSubmissionParams(page);
    await coverSettings(page);

    summary.ok = summary.checks.every((item) => item.ok || item.severity === "P2");
    summary.finishedAt = new Date().toISOString();
    await persistSummary();

    if (!summary.ok) {
      throw new Error("Browser workspace smoke has blocking failures.");
    }

    console.log("✔ Browser workspace smoke completed");
    console.log(`- JSON: ${artifacts.json}`);
    console.log(`- Markdown: ${artifacts.markdown}`);
    console.log(`- Screenshots: ${artifacts.screenshotsDir}`);
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function resolveBrowserRuntime() {
  const playwright = await loadPlaywrightFromKnownLocations();
  if (playwright) {
    return { kind: "playwright", ...playwright };
  }

  const browserUse = await findBrowserUseRuntime();
  if (browserUse) {
    summary.runtimeMode = "browser-use-screenshot-fallback";
    summary.notes.push("Playwright module was not resolvable; falling back to browser-use screenshot mode.");
    return { kind: "browser-use", browserUse };
  }

  summary.runtimeMode = "unavailable";
  summary.notes.push("Playwright module was not resolvable and browser-use CLI was not found.");
  return { kind: "unavailable" };
}

async function loadPlaywrightFromKnownLocations() {
  const attempts = [];
  const candidates = [
    {
      label: "node resolution from workspace",
      load: async () => await import("playwright"),
    },
    {
      label: "PLAYWRIGHT_MODULE_PATH",
      skip: !process.env.PLAYWRIGHT_MODULE_PATH,
      load: async () => await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href),
    },
  ];

  const moduleRoots = await collectNodeModuleRoots();
  for (const moduleRoot of moduleRoots) {
    candidates.push({
      label: moduleRoot,
      load: async () => await import(pathToFileURL(requireFromHere.resolve("playwright", { paths: [path.dirname(moduleRoot)] })).href),
    });
  }

  for (const candidate of candidates) {
    if (candidate.skip) {
      continue;
    }
    try {
      const loaded = await candidate.load();
      const playwright = loaded?.chromium ? loaded : loaded?.default;
      if (!playwright?.chromium) {
        throw new Error("resolved module does not expose chromium");
      }
      return { playwright, source: candidate.label };
    } catch (error) {
      attempts.push(`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  summary.notes.push(`Playwright structured mode unavailable. Attempts: ${attempts.map(sanitizeApiKeyText).join(" | ")}`);
  return null;
}

async function collectNodeModuleRoots() {
  const roots = new Set([
    path.join(rootDir, "node_modules"),
    path.join(path.dirname(rootDir), "node_modules"),
    path.join(process.env.APPDATA || "", "npm", "node_modules"),
    path.join(process.env.LOCALAPPDATA || "", "pnpm", "global", "5", "node_modules"),
  ].filter(Boolean));

  for (const command of [
    "npm root -g",
    "pnpm root -g",
  ]) {
    const result = await runShellLine(command, { timeoutMs: 10000, sanitizeOutput: false });
    if (result.ok && result.stdout.trim()) {
      roots.add(result.stdout.trim().split(/\r?\n/)[0]);
    }
  }

  return [...roots].filter((item) => existsSync(item));
}

async function findBrowserUseRuntime() {
  const candidates = [
    { label: "uvx browser-use", cmd: "uvx", prefixArgs: ["browser-use"] },
    { label: "browser-use", cmd: "browser-use", prefixArgs: [] },
  ];

  for (const candidate of candidates) {
    const result = await runCommand(candidate.cmd, [...candidate.prefixArgs, "--help"], { timeoutMs: 20000 });
    if (result.ok) {
      return candidate;
    }
  }

  return null;
}

async function runBrowserUseScreenshotFallback(runtime) {
  if (runtime.kind !== "browser-use") {
    await step("Browser runtime", "P0", "需要 Playwright structured mode 或 browser-use screenshot fallback", async () => {
      throw new Error("No browser runtime is available. Install project Playwright, global Playwright, or browser-use/uvx.");
    });
    return;
  }

  await step("Browser runtime", "P0", "Playwright 不可用时使用 browser-use 截图兜底", async () => ({
    mode: "browser-use-screenshot-fallback",
    command: runtime.browserUse.label,
  }));

  const session = `yunwu-smoke-${Date.now()}`;
  const targets = [
    { name: "bu-00-home", label: "browser-use 首页截图", url: config.webBaseUrl },
    { name: "bu-01-login", label: "browser-use 登录页截图", url: `${config.webBaseUrl}/login` },
    { name: "bu-02-create", label: "browser-use 创建页截图", url: `${config.webBaseUrl}/create` },
    { name: "bu-03-settings", label: "browser-use 配置页截图", url: `${config.webBaseUrl}/settings` },
  ];
  if (config.sessionId) {
    targets.push({
      name: "bu-04-workspace",
      label: "browser-use 指定工作台截图",
      url: `${config.webBaseUrl}/workspace/${encodeURIComponent(config.sessionId)}`,
    });
  }

  try {
    for (const target of targets) {
      await step(`Screenshot fallback: ${target.name}`, "P1", "browser-use 可打开页面并保存关键截图", async () => {
        await runBrowserUse(runtime.browserUse, session, ["open", target.url]);
        const filePath = path.join(artifacts.screenshotsDir, `${target.name}.png`);
        await runBrowserUse(runtime.browserUse, session, ["screenshot", filePath]);
        summary.screenshots.push({ name: target.name, label: target.label, path: filePath });
        return { url: redactUrl(target.url), screenshot: path.relative(rootDir, filePath) };
      });
    }
  } finally {
    await runBrowserUse(runtime.browserUse, session, ["close"]).catch(() => {});
  }

  summary.ok = summary.checks.every((item) => item.ok || item.severity === "P2");
  summary.finishedAt = new Date().toISOString();
  await persistSummary();

  if (!summary.ok) {
    throw new Error("Browser-use screenshot fallback has blocking failures.");
  }

  console.log("✔ Browser workspace screenshot fallback completed");
  console.log(`- JSON: ${artifacts.json}`);
  console.log(`- Markdown: ${artifacts.markdown}`);
  console.log(`- Screenshots: ${artifacts.screenshotsDir}`);
}

async function runBrowserUse(browserUse, session, args) {
  const result = await runCommand(browserUse.cmd, [...browserUse.prefixArgs, "--session", session, ...args], {
    timeoutMs: config.screenshotTimeoutMs,
  });
  if (!result.ok) {
    throw new Error(`${browserUse.label} ${args[0]} failed: ${sanitizeCommandOutput(result.stderr || result.stdout)}`);
  }
  return result;
}

async function ensureServicesReady() {
  const before = await probeServices();
  if (before.api?.ok && before.web?.ok) {
    await step("Connect local services", "P0", "API 与 Web 已可访问", async () => before);
    return;
  }

  if (!config.autoStart || !isLoopbackUrl(config.webBaseUrl) || !isLoopbackUrl(config.apiBaseUrl)) {
    await step("Connect local services", "P0", "连接本地 API/Web 或报告服务未启动", async () => {
      throw new Error(formatProbeFailure(before));
    });
    return;
  }

  summary.notes.push("Local services were not ready; attempted `pnpm local:start`.");
  spawn("pnpm", ["local:start"], {
    cwd: rootDir,
    shell: true,
    detached: true,
    stdio: "ignore",
  }).unref();

  const after = await waitForServices(config.startupTimeoutMs);
  await step("Auto-start local services", "P0", "本地 API/Web 自动启动或连接成功", async () => {
    if (!after.api || !after.web) {
      throw new Error(formatProbeFailure(after));
    }
    return after;
  });
}

async function probeServices() {
  const [api, web] = await Promise.all([
    probeUrl(`${config.apiBaseUrl}/health`, "application/json"),
    probeUrl(config.webBaseUrl, "text/html"),
  ]);
  return { api, web };
}

async function waitForServices(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = await probeServices();
  while (Date.now() < deadline) {
    if (last.api?.ok && last.web?.ok) {
      return last;
    }
    await sleep(1500);
    last = await probeServices();
  }
  return last;
}

async function probeUrl(url, accept) {
  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: accept },
    }, 5000);
    return response.ok ? { ok: true, status: response.status, url } : { ok: false, status: response.status, url };
  } catch (error) {
    return { ok: false, url, error: error instanceof Error ? error.message : String(error) };
  }
}

async function login(page) {
  await step("Login", "P0", "使用普通用户或 env 覆盖账号完成登录", async () => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("邮箱").fill(config.email);
    await page.getByLabel("密码").fill(config.password);
    await Promise.all([
      page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: config.screenshotTimeoutMs }),
      page.getByRole("button", { name: /登录/ }).click(),
    ]);
    return { email: config.email, route: redactUrl(page.url()) };
  });
}

async function resolveWorkspaceTarget(page) {
  if (config.sessionId) {
    return config.sessionId;
  }

  return await step("Resolve workspace target", "P1", "优先打开最近工作台；无会话则进入 /create", async () => {
    const conversations = await listConversationsInBrowser(page);
    const detailedConversations = [];
    for (const conversation of conversations.slice(0, 10)) {
      const detail = await page.evaluate(async ({ apiBaseUrl, id }) => {
        const response = await fetch(`${apiBaseUrl}/api/conversations/${encodeURIComponent(id)}`, {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          return null;
        }
        const body = await response.json();
        return body.conversation ?? null;
      }, { apiBaseUrl: config.apiBaseUrl, id: conversation.id });

      if (detail) {
        detailedConversations.push(detail);
      }
    }

    const preferredConversation =
      detailedConversations.find((conversation) => {
        const tasks = Array.isArray(conversation?.tasks) ? conversation.tasks : [];
        return tasks.some((task) => task?.sourceAction === "retry");
      }) ??
      detailedConversations.find((conversation) => {
        const tasks = Array.isArray(conversation?.tasks) ? conversation.tasks : [];
        return tasks.some((task) => task?.sourceAction === "edit");
      }) ??
      detailedConversations.find((conversation) => {
        const assets = Array.isArray(conversation?.assets) ? conversation.assets : [];
        const hasGenerated = assets.some((asset) => asset?.type === "generated" && asset?.status !== "deleted");
        const hasUpload = assets.some((asset) => asset?.type === "upload" && asset?.status !== "deleted");
        return hasGenerated && hasUpload;
      }) ??
      conversations[0];

    const firstId = preferredConversation?.id;
    if (!firstId) {
      await page.goto("/create", { waitUntil: "domcontentloaded" });
      return null;
    }
    return firstId;
  });
}

async function openWorkspace(page, conversationId) {
  await step("Open workspace", "P0", "打开 /workspace/:id 并等待工作台 shell", async () => {
    await page.goto(`/workspace/${encodeURIComponent(conversationId)}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("workspace-page-shell").waitFor();
    return { conversationId, route: redactUrl(page.url()) };
  });
}

async function coverWorkspace(page, conversationId) {
  await capturePage(page, "01-workspace-full-page", "工作台全页");

  await step("Session search exists", "P0", "左侧会话列表搜索框存在", async () => {
    const search = page.getByLabel("搜索会话");
    await search.waitFor();
    return await locatorBox(search);
  });

  await captureLocator(page, page.getByTestId("session-list"), "02-session-list-normal", "左侧会话列表常态");

  await step("Archive/delete actions visible", "P1", "归档/删除按钮或入口可见", async () => {
    const archiveCount = await page.getByLabel(/^归档 /).count();
    const deleteCount = await page.getByLabel(/^删除 /).count();
    assert(archiveCount > 0, "archive entry is not visible");
    assert(deleteCount > 0, "delete entry is not visible");
    return { archiveCount, deleteCount };
  });

  await step("Search filter", "P1", "搜索过滤后左侧列表仍保持可用", async () => {
    const search = page.getByLabel("搜索会话");
    await search.fill("__browser_smoke_no_match__");
    await expectText(page.getByTestId("session-list"), /没有匹配的会话|暂无工作台/);
    await captureLocator(page, page.getByTestId("session-list"), "03-session-list-search-filtered", "搜索过滤后");
    await search.fill("");
    return { query: "__browser_smoke_no_match__" };
  });

  await coverComposer(page);
  await ensureRetryLineage(page, conversationId);
  await coverTaskCards(page, conversationId);
  await coverSessionSwitch(page);
}

async function coverSessionSwitch(page) {
  await step("Switch conversation", "P1", "切换会话时 loading/切换后状态可观察", async () => {
    const sessionButtons = page.getByTestId("session-list").locator("button").filter({ hasText: /.+/ });
    const count = await sessionButtons.count();
    if (count < 2) {
      return { skipped: true, reason: "Only one or zero sessions are available." };
    }

    await sessionButtons.nth(1).click();
    const overlay = page.getByTestId("workspace-detail-loading-overlay");
    if (await overlay.isVisible().catch(() => false)) {
      await captureLocator(page, overlay, "04-session-switch-loading", "切换会话 loading");
    }
    await page.getByTestId("workspace-page-shell").waitFor();
    await page.waitForLoadState("networkidle").catch(() => {});
    await capturePage(page, "05-session-switch-after", "切换会话后工作台");
    return { switched: true, route: redactUrl(page.url()) };
  });
}

async function coverComposer(page) {
  const composer = page.locator("textarea").locator("..").locator("..");
  await captureLocator(page, composer, "06-composer-area", "composer 区域");

  await step("Composer viewport", "P0", "composer 在 viewport 内", async () => {
    const box = await page.locator("textarea").boundingBox();
    assert(box, "composer textarea is missing");
    const viewport = page.viewportSize();
    assert(viewport, "viewport is unavailable");
    assert(box.y >= 0 && box.y < viewport.height, `composer y=${box.y} is outside viewport height=${viewport.height}`);
    return { box, viewport };
  });

  await step("Message bubble width", "P1", "消息气泡宽度不应全屏", async () => {
    const measurement = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("div"))
        .filter((node) => {
          const style = window.getComputedStyle(node);
          return style.display === "inline-block" && node.textContent && node.textContent.trim().length > 0;
        })
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { width: rect.width, viewportWidth: window.innerWidth, text: node.textContent?.slice(0, 40) ?? "" };
        })
        .filter((item) => item.width > 80);
      return candidates[0] ?? null;
    });
    if (!measurement) {
      return { skipped: true, reason: "No message bubble rendered in current conversation." };
    }
    assert(measurement.width < measurement.viewportWidth * 0.86, `bubble width ${measurement.width} is too wide`);
    return measurement;
  });
}

async function coverTaskCards(page, conversationId) {
  await step("Task card controls", "P1", "任务卡轮次/重试区域可检查", async () => {
    const taskCards = page.locator("text=/任务已|排队中|已提交|执行中|失败|已完成/").first();
    if (!(await taskCards.isVisible().catch(() => false))) {
      return { skipped: true, reason: "No task card text found." };
    }

    await capturePage(page, "07-task-card-round-retry", "任务卡轮次/重试区域");
    const roundSwitchers = await page.getByTestId("task-round-switcher").count();
    const retryButtons = await page.getByRole("button", { name: /重试|一键重试/ }).count();
    return { roundSwitchers, retryButtons };
  });

  await step("Round switcher locator", "P2", "有多轮任务时轮次控件存在", async () => {
    const count = await page.getByTestId("task-round-switcher").count();
    return count > 0 ? { count } : { skipped: true, reason: "Current session has no multi-round task." };
  });

  await step("Re-edit remains separate task card", "P1", "再编辑任务保留为新任务卡，不并入 retry 轮次", async () => {
    const conversation = await page.evaluate(async ({ apiBaseUrl, id }) => {
      const response = await fetch(`${apiBaseUrl}/api/conversations/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
      return body.conversation ?? null;
    }, { apiBaseUrl: config.apiBaseUrl, id: conversationId });

    const tasks = Array.isArray(conversation?.tasks) ? conversation.tasks : [];
    const editTasks = tasks.filter((task) => task?.sourceAction === "edit");
    const retryTasks = tasks.filter((task) => task?.sourceAction === "retry");
    assert(editTasks.length > 0, "No re-edit task was found in the current conversation.");
    assert(retryTasks.length > 0, "Retry lineage is required for comparison.");
    return {
      editTasks: editTasks.map((task) => task.id),
      retryTasks: retryTasks.map((task) => task.id),
    };
  });

  await step("Retry round switching", "P1", "重试轮次切换显示同一逻辑任务的不同 attempt", async () => {
    const switcher = page.getByTestId("task-round-switcher").first();
    if (!(await switcher.isVisible().catch(() => false))) {
      return { skipped: true, reason: "Current session has no retry lineage." };
    }

    const before = await switcher.textContent();
    const next = switcher.getByRole("button", { name: "下一重试轮次" });
    const previous = switcher.getByRole("button", { name: "上一重试轮次" });
    const control = !(await next.isDisabled()) ? next : !(await previous.isDisabled()) ? previous : null;
    if (!control) {
      return { skipped: true, reason: "Retry switcher is present but no adjacent attempt is available." };
    }

    await control.click();
    await page.waitForTimeout(300);
    await capturePage(page, "12-task-retry-next-attempt", "切换到相邻 retry attempt");
    const after = await page.getByTestId("task-round-switcher").first().textContent();
    assert(before !== after, `retry attempt label did not change: ${before}`);
    return { before, after };
  });

  await step("Task asset lightbox preview", "P1", "任务卡结果图/参考图可打开站内预览弹窗并截图", async () => {
    const opened = [];

    const resultButtons = page.getByRole("button", { name: /^预览素材 / });
    if ((await resultButtons.count()) > 0) {
      await resultButtons.first().click();
      const lightbox = page.getByTestId("task-asset-lightbox");
      await lightbox.waitFor();
      await captureLocator(page, lightbox, "10-task-result-lightbox", "结果图预览弹窗");
      opened.push("result");
      await page.getByLabel("关闭图片预览").click();
    }

    const inputButtons = page.getByRole("button", { name: /^预览参考素材 / });
    if ((await inputButtons.count()) > 0) {
      await inputButtons.first().click();
      const lightbox = page.getByTestId("task-asset-lightbox");
      await lightbox.waitFor();
      await captureLocator(page, lightbox, "11-task-reference-lightbox", "参考图预览弹窗");
      opened.push("reference");
      await page.getByLabel("关闭图片预览").click();
    }

    return opened.length > 0
      ? { opened }
      : { skipped: true, reason: "Current session has no previewable result/reference assets." };
  });
}

async function ensureRetryLineage(page, conversationId) {
  await step("Seed retry lineage", "P1", "必要时通过现有 API 创建 retry 轮次，确保可验证同一逻辑任务的不同 attempt", async () => {
    const taskDetails = await page.evaluate(async ({ apiBaseUrl, id }) => {
      const response = await fetch(`${apiBaseUrl}/api/conversations/${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return null;
      }
      const body = await response.json();
      return body.conversation ?? null;
    }, { apiBaseUrl: config.apiBaseUrl, id: conversationId });

    const tasks = Array.isArray(taskDetails?.tasks) ? taskDetails.tasks : [];
    const retrySourceTask = tasks.find(
      (task) =>
        task &&
        (task.status === "succeeded" || task.status === "failed") &&
        task.sourceAction !== "retry" &&
        task.id,
    );

    if (!retrySourceTask) {
      return { skipped: true, reason: "No suitable task exists to seed a retry lineage." };
    }

    if (tasks.some((task) => task.sourceAction === "retry")) {
      return { existingRetryTasks: tasks.filter((task) => task.sourceAction === "retry").map((task) => task.id) };
    }

    const response = await page.evaluate(async ({ apiBaseUrl, taskId }) => {
      const retryResponse = await fetch(`${apiBaseUrl}/api/tasks/${encodeURIComponent(taskId)}/retry`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const body = await retryResponse.json().catch(() => null);
      return {
        ok: retryResponse.ok,
        body,
        status: retryResponse.status,
      };
    }, { apiBaseUrl: config.apiBaseUrl, taskId: retrySourceTask.id });

    if (!response.ok) {
      throw new Error(`retry creation failed with status ${response.status}`);
    }

    await page.goto(`/workspace/${encodeURIComponent(conversationId)}`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("workspace-page-shell").waitFor();
    await page.waitForLoadState("networkidle").catch(() => {});
    return {
      retrySourceTaskId: retrySourceTask.id,
      createdTaskId: response.body?.taskId ?? response.body?.task?.id ?? null,
    };
  });
}

async function coverCreateComposerSubmissionParams(page) {
  await step("Composer size submit params", "P0", "尺寸下拉存在；非默认尺寸透传；auto 不作为字符串传给后端", async () => {
    await page.goto("/create", { waitUntil: "domcontentloaded" });
    await page.getByLabel("尺寸").waitFor();
    await page.getByLabel("模型").waitFor();

    const capturedBodies = [];
    const routeHandler = async (route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.fallback();
        return;
      }

      capturedBodies.push(request.postDataJSON());
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          task: {
            id: `browser-size-task-${capturedBodies.length}`,
            conversationId: `browser-size-conv-${capturedBodies.length}`,
            status: "queued",
          },
          conversation: {
            id: `browser-size-conv-${capturedBodies.length}`,
            title: "Browser size smoke",
          },
        }),
      });
    };

    await page.route("**/api/tasks", routeHandler);
    try {
      await submitCreateComposer(page, "browser smoke wide size", "1536x1024");
      await submitCreateComposer(page, "browser smoke auto size", "auto");
    } finally {
      await page.unroute("**/api/tasks", routeHandler).catch(() => {});
    }

    assert(capturedBodies.length === 2, `expected 2 intercepted task submissions, got ${capturedBodies.length}`);
    assert(capturedBodies[0]?.params?.size === "1536x1024", `expected size 1536x1024, got ${JSON.stringify(capturedBodies[0]?.params)}`);
    assert(capturedBodies[1]?.params?.size !== "auto", `auto size must not be sent as a literal string: ${JSON.stringify(capturedBodies[1]?.params)}`);
    await capturePage(page, "13-create-composer-size-selector", "创建页尺寸下拉提交验证后");
    return {
      sizeOptions: await page.getByLabel("尺寸").locator("option").evaluateAll((options) =>
        options.map((option) => ({ value: option.value, label: option.textContent })),
      ),
      submittedParams: capturedBodies.map((body) => body?.params ?? {}),
    };
  });
}

async function submitCreateComposer(page, prompt, size) {
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await page.getByLabel("尺寸").waitFor();
  await page.getByRole("textbox").fill(prompt);
  await page.getByLabel("尺寸").selectOption(size);
  await page.getByRole("button", { name: /提交并进入工作台|发送/ }).click();
  await page.waitForResponse((response) => response.url().includes("/api/tasks") && response.request().method() === "POST");
}

async function coverSettings(page) {
  await step("Open settings", "P1", "配置页可访问", async () => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.getByText("配置中心").waitFor();
    return { route: redactUrl(page.url()) };
  });

  const apiKeySection = page.getByText("API key").locator("..").locator("..");
  await capturePage(page, "08-settings-full-page", "配置页全页");
  await captureLocator(page, apiKeySection, "09-settings-api-key-area", "配置页 API key 区域");

  await step("Settings API key safety", "P0", "不打印完整 API key；仅检查输入区和状态", async () => {
    await page.getByLabel("API key").waitFor();
    const statusText = await apiKeySection.textContent();
    assert(!looksLikeFullApiKey(statusText ?? ""), "API key area appears to contain an unmasked full key");
    return { apiKeyInput: "present", status: sanitizeApiKeyText(statusText ?? "") };
  });

  if (config.testInvalidApiKey) {
    await step("Invalid short API key check", "P2", "只使用无效短 key 验证失败提示，不提交真实 key", async () => {
      await page.getByLabel("API key").fill("bad");
      await page.getByRole("button", { name: "验证连通性" }).click();
      await page.waitForTimeout(1000);
      const text = await page.locator("body").textContent();
      assert(/失败|error|invalid|API key/i.test(text ?? ""), "invalid API key feedback was not detected");
      return { testedValue: "bad" };
    });
  }
}

async function listConversationsInBrowser(page) {
  return await page.evaluate(async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/api/conversations`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return [];
    }
    const body = await response.json();
    return Array.isArray(body.conversations) ? body.conversations : Array.isArray(body) ? body : [];
  }, config.apiBaseUrl).catch(() => []);
}

async function capturePage(page, name, label) {
  const filePath = path.join(artifacts.screenshotsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  summary.screenshots.push({ name, label, path: filePath });
  return filePath;
}

async function captureLocator(page, locator, name, label) {
  const filePath = path.join(artifacts.screenshotsDir, `${name}.png`);
  await locator.first().screenshot({ path: filePath });
  summary.screenshots.push({ name, label, path: filePath });
  return filePath;
}

async function step(name, severity, acceptance, action) {
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
    summary.checks.push(record);
    console.log(`✔ ${name}`);
    return detail;
  } catch (error) {
    const record = {
      name,
      severity,
      acceptance,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
    summary.checks.push(record);
    console.error(`✖ ${name}: ${record.error}`);
    if (severity === "P0") {
      throw new Error(`${name} failed: ${record.error}`);
    }
    return null;
  }
}

async function persistSummary() {
  await ensureOutputDirs();
  const serializable = {
    ...summary,
    login: {
      email: config.email,
      password: "[redacted]",
    },
  };
  await writeFile(artifacts.json, `${JSON.stringify(serializable, null, 2)}\n`, "utf8");
  await writeFile(artifacts.markdown, renderMarkdown(serializable), "utf8");
}

async function ensureOutputDirs() {
  await mkdir(config.outputDir, { recursive: true });
  await mkdir(artifacts.screenshotsDir, { recursive: true });
}

function renderMarkdown(report) {
  const rows = report.checks
    .map((item) => {
      const status = item.ok ? "PASS" : "FAIL";
      const detail = item.ok ? summarizeDetail(item.detail) : item.error;
      return `| ${escapeTable(item.name)} | ${item.severity} | ${status} | ${escapeTable(item.acceptance)} | ${escapeTable(detail)} |`;
    })
    .join("\n");

  const screenshots = report.screenshots
    .map((item) => `- ${item.name}: ${item.label} - \`${path.relative(rootDir, item.path)}\``)
    .join("\n");

  return `# Browser Workspace Smoke

- Started: ${report.startedAt}
- Finished: ${report.finishedAt ?? ""}
- Web: ${report.webBaseUrl}
- API: ${report.apiBaseUrl}
- Headless: ${report.headless}
- Session: ${report.sessionId ?? "latest"}
- Runtime mode: ${report.runtimeMode ?? "unknown"}
- Overall: ${report.ok === undefined ? "IN_PROGRESS" : report.ok ? "PASS" : "FAIL"}
- Screenshots: \`${path.relative(rootDir, artifacts.screenshotsDir)}\`

| Check | Severity | Result | Acceptance | Detail |
| --- | --- | --- | --- | --- |
${rows}

## Screenshots

${screenshots || "- No screenshots captured."}

## Notes

${report.notes?.length ? report.notes.map((item) => `- ${escapeTable(item)}`).join("\n") : "- None."}
`;
}

function summarizeDetail(detail) {
  if (detail === null || detail === undefined) {
    return "";
  }
  if (typeof detail !== "object") {
    return String(detail);
  }
  return Object.entries(detail)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`)
    .join("; ");
}

async function expectUrlContains(page, value) {
  assert(page.url().includes(value), `URL ${page.url()} does not include ${value}`);
}

async function expectText(locator, pattern) {
  const text = await locator.textContent();
  assert(pattern.test(text ?? ""), `Text did not match ${pattern}: ${text ?? ""}`);
}

async function locatorBox(locator) {
  const box = await locator.boundingBox();
  assert(box, "locator is not visible");
  return box;
}

function sanitizeApiKeyText(value) {
  return value.replace(/[A-Za-z0-9_-]{12,}/g, (match) => {
    if (match.includes("*")) {
      return match;
    }
    return `${match.slice(0, 4)}...${match.slice(-4)}`;
  });
}

function looksLikeFullApiKey(value) {
  return /\b(sk|ak|key|yw)[A-Za-z0-9_-]{16,}\b/i.test(value.replace(/\*+/g, ""));
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: rootDir,
      windowsHide: true,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    const timeout = setTimeout(() => {
      child.kill();
    }, options.timeoutMs ?? 30000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      finish({
        ok: code === 0,
        code,
        stdout: options.sanitizeOutput === false ? stdout : sanitizeCommandOutput(stdout),
        stderr: options.sanitizeOutput === false ? stderr : sanitizeCommandOutput(stderr),
      });
    });
    child.on("error", (error) => {
      finish({
        ok: false,
        code: null,
        stdout: options.sanitizeOutput === false ? stdout : sanitizeCommandOutput(stdout),
        stderr: options.sanitizeOutput === false
          ? error instanceof Error ? error.message : String(error)
          : sanitizeCommandOutput(error instanceof Error ? error.message : String(error)),
      });
    });
  });
}

function runShellLine(commandLine, options = {}) {
  return runCommand("cmd.exe", ["/d", "/s", "/c", commandLine], options);
}

function sanitizeCommandOutput(value) {
  return sanitizeApiKeyText(String(value ?? ""))
    .replace(/(password|token|secret|api[_-]?key)=\S+/gi, "$1=[redacted]")
    .slice(0, 2000);
}

function formatProbeFailure(probe) {
  return `API ready=${Boolean(probe.api?.ok)} (${probe.api?.status ?? probe.api?.error ?? "unknown"}), Web ready=${Boolean(probe.web?.ok)} (${probe.web?.status ?? probe.web?.error ?? "unknown"})`;
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
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

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  if (/^(1|true|yes|on)$/i.test(value)) {
    return true;
  }
  if (/^(0|false|no|off)$/i.test(value)) {
    return false;
  }
  return fallback;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/key|token|password|secret/i.test(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function escapeTable(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
