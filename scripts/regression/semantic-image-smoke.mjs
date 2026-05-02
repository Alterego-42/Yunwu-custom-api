#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const rootDir = process.cwd();
loadDotEnv(path.join(rootDir, ".env"));

const TEXT_PROMPT = "纯黄色背景，中间一个巨大的黑色字母 YW3，极简海报，无其他文字";
const EDIT_P0_PROMPT = "保留红色方块和蓝色圆形，把背景改成纯绿色，并给红色方块加粗黑色描边，不要改变主体位置";
const EDIT_P1_PROMPT = "保留红色方块和蓝色圆形，把背景改成纯绿色，并在画面下方加入清晰黑色文字 EDIT";
const TERMINAL_STATUSES = ["succeeded", "failed", "cancelled", "expired"];

const startedAt = new Date();
const config = {
  mode: process.env.SEMANTIC_IMAGE_SMOKE_MODE ?? "prepare",
  apiBaseUrl: stripTrailingSlash(
    process.env.SEMANTIC_API_BASE_URL ||
      process.env.ROUND3_API_BASE_URL ||
      process.env.REGRESSION_BASE_URL ||
      process.env.BASE_URL ||
      "http://127.0.0.1:3000",
  ),
  webBaseUrl: stripTrailingSlash(
    process.env.SEMANTIC_WEB_BASE_URL ||
      process.env.ROUND3_WEB_BASE_URL ||
      process.env.WEB_BASE_URL ||
      "http://127.0.0.1:5173",
  ),
  userEmail:
    process.env.SEMANTIC_USER_EMAIL ||
    process.env.ROUND3_USER_EMAIL ||
    process.env.REGRESSION_USER_EMAIL ||
    process.env.AUTH_DEMO_EMAIL ||
    "demo@yunwu.local",
  userPassword:
    process.env.SEMANTIC_USER_PASSWORD ||
    process.env.ROUND3_USER_PASSWORD ||
    process.env.REGRESSION_USER_PASSWORD ||
    process.env.AUTH_DEMO_PASSWORD ||
    "demo123456",
  model:
    process.env.SEMANTIC_MODEL ||
    process.env.ROUND3_MODEL ||
    process.env.REGRESSION_MODEL ||
    process.env.YUNWU_DEFAULT_GENERATE_MODEL ||
    "gpt-image-2",
  taskTimeoutMs: Number(process.env.SEMANTIC_TASK_TIMEOUT_MS ?? 240000),
  taskPollMs: Number(process.env.SEMANTIC_TASK_POLL_MS ?? 3000),
  outputDir: path.join(rootDir, "test-results", "regression", "semantic-image-smoke"),
};

const cookieJar = new Map();
const summary = {
  startedAt: startedAt.toISOString(),
  mode: config.mode,
  apiBaseUrl: config.apiBaseUrl,
  webBaseUrl: config.webBaseUrl,
  model: config.model,
  prompts: {
    textToImage: TEXT_PROMPT,
    editImageP0: EDIT_P0_PROMPT,
    editImageP1: EDIT_P1_PROMPT,
  },
  artifacts: {},
  cases: [],
};

main().catch(async (error) => {
  summary.finishedAt = new Date().toISOString();
  summary.ok = false;
  summary.error = error instanceof Error ? error.message : String(error);
  await persistArtifacts();
  console.error(`✖ ${summary.error}`);
  process.exitCode = 1;
});

async function main() {
  await mkdir(config.outputDir, { recursive: true });
  const inputImagePath = path.join(config.outputDir, "input-edit-source.png");
  const inputPng = createSemanticInputPng(420, 300);
  await writeFile(inputImagePath, inputPng);

  summary.artifacts = {
    directory: config.outputDir,
    inputImage: inputImagePath,
    requestSummary: path.join(config.outputDir, "request-summary.json"),
    inspectionChecklist: path.join(config.outputDir, "manual-review.md"),
    inspectionHtml: path.join(config.outputDir, "inspection.html"),
    workspaceScreenshotTextToImage: path.join(config.outputDir, "workspace-text-to-image.png"),
    workspaceScreenshotEditImage: path.join(config.outputDir, "workspace-edit-image.png"),
  };

  if (config.mode !== "run") {
    summary.ok = true;
    summary.note = "Prepared semantic smoke assets only. Set SEMANTIC_IMAGE_SMOKE_MODE=run after backend/frontend fixes to call the real provider.";
    summary.finishedAt = new Date().toISOString();
    await persistArtifacts();
    console.log("✔ Semantic image smoke assets prepared");
    console.log(`- directory: ${config.outputDir}`);
    console.log("- real provider run: set SEMANTIC_IMAGE_SMOKE_MODE=run");
    return;
  }

  await requestJson("POST", "/auth/login", {
    email: config.userEmail,
    password: config.userPassword,
  });

  const textCase = await runTextToImageCase();
  summary.cases.push(textCase);
  assert(
    textCase.status === "needs-human-review",
    `text-to-image ${textCase.status}: ${textCase.failure?.detail ?? textCase.failure?.message ?? "semantic case did not produce reviewable output"}`,
  );

  const editCase = await runEditImageCase(inputImagePath, {
    name: "edit-image P0 input-grounding expected image",
    priority: "P0",
    blocking: true,
    prompt: EDIT_P0_PROMPT,
    filePrefix: "edit-p0-output",
    expected: [
      "必须使用真实上传输入图，输出图能看出红色方块和蓝色圆形",
      "红色方块和蓝色圆形主体位置大体不变",
      "背景改为纯绿色或明显绿色",
      "红色方块出现明显黑色描边或边框强化",
      "不得完全忽略上传图生成无关图片",
    ],
    passLabel: "PASS_P0",
  });
  summary.cases.push(editCase);
  assert(
    editCase.status === "needs-human-review",
    `edit-image ${editCase.status}: ${editCase.failure?.detail ?? editCase.failure?.message ?? "semantic case did not produce reviewable output"}`,
  );

  const detailCase = await runEditImageCase(inputImagePath, {
    name: "edit-image P1 detail-following expected image",
    priority: "P1",
    blocking: false,
    prompt: EDIT_P1_PROMPT,
    filePrefix: "edit-p1-detail-output",
    expected: [
      "应继续使用真实上传输入图，并保留红色方块和蓝色圆形",
      "背景应变为绿色",
      "尽量在画面下方加入清晰黑色文字 EDIT",
      "如果未生成 EDIT 但 P0 输入图主体和稳定视觉变化成立，只记录为 P1 细节跟随失败",
    ],
    passLabel: "PASS_P1_DETAIL",
  });
  summary.cases.push(detailCase);

  summary.ok = summary.cases
    .filter((item) => item.blocking !== false)
    .every((item) => item.status === "needs-human-review");
  summary.finishedAt = new Date().toISOString();
  await persistArtifacts();

  if (!summary.ok) {
    throw new Error("Semantic image smoke failed before human visual review.");
  }

  console.log("✔ Semantic image smoke completed; human visual review is still required");
  console.log(`- checklist: ${summary.artifacts.inspectionChecklist}`);
  console.log(`- inspection html: ${summary.artifacts.inspectionHtml}`);
}

async function runTextToImageCase() {
  const requestBody = {
    capability: "image.generate",
    model: config.model,
    prompt: TEXT_PROMPT,
  };
  const created = await requestJson("POST", "/tasks", requestBody);
  const taskId = created.body.task?.id;
  assert(taskId, "text-to-image task id is required");
  const finalTask = await pollTask(taskId);
  const baseRecord = {
    name: "text-to-image semantic expected image",
    priority: "P0",
    blocking: true,
    prompt: TEXT_PROMPT,
    requestBody,
    taskId,
    conversationId: created.body.conversation?.id,
    workspaceUrl: created.body.conversation?.id ? `${config.webBaseUrl}/workspace/${created.body.conversation.id}` : undefined,
    expected: [
      "纯黄色背景占主体",
      "画面中间有一个巨大黑色字母或字样 YW3",
      "极简海报风格",
      "不得出现其他文字、人物、复杂物体或明显多余元素",
    ],
  };
  if (finalTask?.status !== "succeeded") {
    return {
      ...baseRecord,
      status: statusFromFailedTask(finalTask),
      failure: finalTaskFailure(finalTask),
    };
  }
  if (isMockedTaskOutput(finalTask)) {
    return {
      ...baseRecord,
      status: "fail-product",
      failure: mockedTaskFailure(finalTask),
    };
  }
  const outputAssets = extractOutputAssets(finalTask);
  assert(outputAssets.length > 0, "text-to-image succeeded but returned no generated assets");
  const downloaded = await downloadAssets(outputAssets, "text-to-image-output", created.body.conversation?.id);

  return {
    ...baseRecord,
    status: "needs-human-review",
    outputAssets,
    downloaded,
  };
}

async function runEditImageCase(inputImagePath, caseConfig) {
  const inputBytes = await readFile(inputImagePath);
  const upload = await uploadPng(inputBytes, "semantic-edit-input.png");
  const asset = upload.body.asset;
  assert(asset?.id, "uploaded semantic input asset id is required");

  const requestBody = {
    capability: "image.edit",
    model: config.model,
    prompt: caseConfig.prompt,
    assetIds: [asset.id],
  };
  const created = await requestJson("POST", "/tasks", requestBody);
  const taskId = created.body.task?.id;
  assert(taskId, "edit-image task id is required");
  assert(created.body.task?.capability === "image.edit", "edit-image task must use image.edit capability");
  const finalTask = await pollTask(taskId);
  const baseRecord = {
    name: caseConfig.name,
    priority: caseConfig.priority,
    blocking: caseConfig.blocking,
    prompt: caseConfig.prompt,
    requestBody,
    uploadedAsset: asset,
    inputImage: inputImagePath,
    taskId,
    conversationId: created.body.conversation?.id,
    workspaceUrl: created.body.conversation?.id ? `${config.webBaseUrl}/workspace/${created.body.conversation.id}` : undefined,
    expected: caseConfig.expected,
    passLabel: caseConfig.passLabel,
  };
  if (finalTask?.status !== "succeeded") {
    return {
      ...baseRecord,
      status: statusFromFailedTask(finalTask),
      failure: finalTaskFailure(finalTask),
    };
  }
  if (isMockedTaskOutput(finalTask)) {
    return {
      ...baseRecord,
      status: "fail-product",
      failure: mockedTaskFailure(finalTask),
    };
  }
  const outputAssets = extractOutputAssets(finalTask);
  assert(outputAssets.length > 0, "edit-image succeeded but returned no generated assets");
  const downloaded = await downloadAssets(outputAssets, caseConfig.filePrefix, created.body.conversation?.id);

  return {
    ...baseRecord,
    status: "needs-human-review",
    outputAssets,
    downloaded,
  };
}

async function pollTask(taskId) {
  const deadline = Date.now() + config.taskTimeoutMs;
  let lastTask;
  while (Date.now() < deadline) {
    const response = await requestJson("GET", `/tasks/${encodeURIComponent(taskId)}`);
    lastTask = response.body.task;
    if (TERMINAL_STATUSES.includes(lastTask?.status)) {
      return lastTask;
    }
    await sleep(config.taskPollMs);
  }
  throw new Error(`task ${taskId} did not reach terminal state; last status=${lastTask?.status ?? "unknown"}`);
}

function assertTaskSucceeded(task, label) {
  if (task?.status === "succeeded") {
    return;
  }
  const message = task?.failure?.detail || task?.failure?.title || task?.errorMessage || `${label} task did not succeed`;
  const classification = classifyFailure(message);
  throw new Error(`${label} ${classification} failure: ${message}`);
}

function statusFromFailedTask(task) {
  const failure = finalTaskFailure(task);
  const classification = classifyFailure(`${failure.category ?? ""} ${failure.detail ?? ""} ${failure.message ?? ""}`);
  return classification === "upstream/provider" ? "fail-upstream" : "fail-product";
}

function finalTaskFailure(task) {
  return {
    status: task?.status,
    category: task?.failure?.category,
    title: task?.failure?.title,
    detail: task?.failure?.detail,
    retryable: task?.failure?.retryable,
    message: task?.errorMessage,
  };
}

function isMockedTaskOutput(task) {
  return task?.outputSummary?.mocked === true;
}

function mockedTaskFailure(task) {
  return {
    status: task?.status,
    category: "mock_output",
    title: "Semantic smoke received mock output",
    detail:
      "The task succeeded in backend mock mode, so the image is not a real provider result and must not be used for semantic review.",
    retryable: false,
    message:
      "Configure a provider API key and rerun semantic smoke; mock images are product/test-environment failures for this check.",
  };
}

function extractOutputAssets(task) {
  const outputAssets = Array.isArray(task?.outputSummary?.assets) ? task.outputSummary.assets : [];
  const outputAssetIds = Array.isArray(task?.outputSummary?.generatedAssetIds) ? task.outputSummary.generatedAssetIds : [];
  const assetsById = new Map(outputAssets.map((asset) => [asset.id, asset]));
  return outputAssetIds.map((id) => assetsById.get(id) ?? { id }).filter((asset) => asset.id);
}

async function downloadAssets(assets, filePrefix, conversationId) {
  const downloaded = [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const detail = await findAssetById(asset.id, conversationId);
    const url = detail?.url;
    assert(url, `generated asset ${asset.id} has no downloadable url`);
    const bytes = await downloadBinary(resolveAssetUrl(url));
    const extension = extensionFromMimeType(detail?.mimeType) || ".png";
    const filePath = path.join(config.outputDir, `${filePrefix}-${index + 1}${extension}`);
    await writeFile(filePath, bytes);
    downloaded.push({
      assetId: asset.id,
      url: summarizeAssetUrl(url),
      filePath,
      mimeType: detail?.mimeType,
      width: detail?.width,
      height: detail?.height,
    });
  }
  return downloaded;
}

async function findAssetById(assetId, conversationId) {
  if (conversationId) {
    const conversation = await requestJson("GET", `/conversations/${encodeURIComponent(conversationId)}`);
    const conversationAsset = (conversation.body.conversation?.assets ?? []).find((asset) => asset.id === assetId);
    if (conversationAsset) {
      return conversationAsset;
    }
  }

  const library = await requestJson("GET", "/library");
  const libraryItem = (library.body.items ?? []).find((item) => item.asset?.id === assetId);
  if (libraryItem?.asset) {
    return libraryItem.asset;
  }

  const home = await requestJson("GET", "/home");
  const homeItem = (home.body.recentAssets ?? []).find((item) => item.asset?.id === assetId);
  return homeItem?.asset;
}

async function uploadPng(bytes, filename) {
  const formData = new FormData();
  formData.append("file", new Blob([bytes], { type: "image/png" }), filename);
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

async function requestJson(method, urlPath, body) {
  const headers = { Accept: "application/json" };
  const cookieHeader = serializeCookies();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetchWithTimeout(`${config.apiBaseUrl}/api${urlPath}`, {
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
  assert(parsed !== null, `${method} ${urlPath} did not return JSON`);
  return { status: response.status, body: parsed };
}

async function downloadBinary(url) {
  if (url.startsWith("data:")) {
    const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    assert(match, "invalid data URL image output");
    return match[2]
      ? Buffer.from(match[3], "base64")
      : Buffer.from(decodeURIComponent(match[3]), "utf8");
  }

  const headers = {};
  const cookieHeader = serializeCookies();
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  const response = await fetchWithTimeout(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} download returned ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${url} fetch failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function persistArtifacts() {
  await mkdir(config.outputDir, { recursive: true });
  await writeFile(path.join(config.outputDir, "request-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(path.join(config.outputDir, "manual-review.md"), renderManualReview(), "utf8");
  await writeFile(path.join(config.outputDir, "inspection.html"), renderInspectionHtml(), "utf8");
}

function renderManualReview() {
  const caseSections = summary.cases.length > 0
    ? summary.cases.map((item) => renderCaseReview(item)).join("\n\n")
    : `## 待真实运行\n\n当前为 prepare 模式，仅创建输入图和检查模板。后端/前端 worker 修复后执行：\n\n\`\`\`powershell\n$env:SEMANTIC_IMAGE_SMOKE_MODE="run"\npnpm local:test:semantic-image\n\`\`\``;

  return `# Round 3 Semantic Image Smoke Review

- Started: ${summary.startedAt}
- Finished: ${summary.finishedAt ?? ""}
- Mode: ${summary.mode}
- API: ${summary.apiBaseUrl}
- Web: ${summary.webBaseUrl}
- Model: ${summary.model}
- Result before human review: ${summary.ok === undefined ? "IN_PROGRESS" : summary.ok ? "READY_FOR_REVIEW" : "FAILED"}

## 强制规则

- 用户侧验收必须打开图片或工作台截图看图判断，不允许只看 task.status=succeeded。
- 文生图和编辑图都必须保存请求摘要、任务 ID、输入图、输出图、工作台截图、预期说明。
- 编辑图验收拆成 P0/P1：P0 验证上传图被使用、主体保留、稳定视觉变化；P1 验证文字或细粒度指令跟随，P1 失败不等同于 P0 没读到图。
- 真实 provider 失败要区分：上游/provider 调用失败、产品上传/任务/资产链路失败、语义不符合预期。

## 预期截图文件

- 文生图工作台截图：\`${summary.artifacts.workspaceScreenshotTextToImage ?? "workspace-text-to-image.png"}\`
- 编辑图工作台截图：\`${summary.artifacts.workspaceScreenshotEditImage ?? "workspace-edit-image.png"}\`

${caseSections}
`;
}

function renderCaseReview(item) {
  const downloaded = (item.downloaded ?? []).map((asset) => `- ${asset.filePath}`).join("\n") || "- 未下载到输出图";
  const expected = item.expected.map((line) => `- ${line}`).join("\n");
  const failure = item.failure ? `\n### 失败信息\n\n\`\`\`json\n${JSON.stringify(item.failure, null, 2)}\n\`\`\`\n` : "";
  return `## ${item.name}

- Status: ${item.status}
- Priority: ${item.priority ?? "P0"}
- Blocking: ${item.blocking === false ? "no" : "yes"}
- Task ID: ${item.taskId}
- Workspace: ${item.workspaceUrl ?? "N/A"}
- Prompt: ${item.prompt}

### 输出图

${downloaded}

### 人工判定标准

${expected}
${failure}

### QA 判定

- [ ] ${item.passLabel ?? "PASS"}：输出图符合该优先级的关键预期，工作台截图已保存。
- [ ] FAIL_PRODUCT：任务成功但输出图缺失、无法下载、上传资产未被使用，或工作台不展示结果。
- [ ] FAIL_SEMANTIC：任务成功且有图，但图片内容明显不符合上述预期。
- [ ] FAIL_UPSTREAM：任务失败信息明确来自 provider、网络、额度、模型或上游接口。
`;
}

function renderInspectionHtml() {
  const cards = summary.cases.map((item) => {
    const images = (item.downloaded ?? [])
      .map((asset) => `<figure><img src="${escapeHtml(path.basename(asset.filePath))}" alt="${escapeHtml(item.name)} output"><figcaption>${escapeHtml(asset.assetId)}</figcaption></figure>`)
      .join("");
    const expected = item.expected.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    const failure = item.failure ? `<pre>${escapeHtml(JSON.stringify(item.failure, null, 2))}</pre>` : "";
    return `<section><h2>${escapeHtml(item.name)}</h2><p><strong>Status:</strong> ${escapeHtml(item.status)}</p><p><strong>Priority:</strong> ${escapeHtml(item.priority ?? "P0")} · <strong>Blocking:</strong> ${item.blocking === false ? "no" : "yes"}</p><p><strong>Task:</strong> ${escapeHtml(item.taskId)}</p><p><strong>Prompt:</strong> ${escapeHtml(item.prompt)}</p><div class="grid">${images || "<p>No output image was downloaded.</p>"}</div><ul>${expected}</ul>${failure}</section>`;
  }).join("");

  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<title>Round 3 Semantic Image Smoke</title>
<style>
body { font-family: sans-serif; margin: 24px; background: #f6f2e8; color: #17140e; }
section { border: 1px solid #d8cdb8; border-radius: 16px; padding: 16px; margin: 16px 0; background: #fffaf0; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
img { max-width: 100%; border: 1px solid #111; background: white; }
figcaption { font-size: 12px; color: #5c5447; }
</style>
<h1>Round 3 Semantic Image Smoke</h1>
<p>必须看图判断，不允许只看 succeeded。</p>
<section>
  <h2>编辑输入图</h2>
  <figure><img src="input-edit-source.png" alt="edit input"><figcaption>input-edit-source.png</figcaption></figure>
</section>
${cards || "<p>Prepare mode only. Run with SEMANTIC_IMAGE_SMOKE_MODE=run.</p>"}
</html>
`;
}

function createSemanticInputPng(width, height) {
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      setPixel(rgba, width, x, y, 245, 245, 245, 255);
    }
  }
  fillRect(rgba, width, 42, 42, 150, 150, [220, 20, 20, 255]);
  fillCircle(rgba, width, 285, 115, 72, [20, 95, 230, 255]);
  drawText(rgba, width, 82, 220, "INPUT", 6, [0, 0, 0, 255]);
  return encodePng(width, height, rgba);
}

function fillRect(rgba, width, left, top, rectWidth, rectHeight, color) {
  for (let y = top; y < top + rectHeight; y += 1) {
    for (let x = left; x < left + rectWidth; x += 1) {
      setPixel(rgba, width, x, y, ...color);
    }
  }
}

function fillCircle(rgba, width, centerX, centerY, radius, color) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2) {
        setPixel(rgba, width, x, y, ...color);
      }
    }
  }
}

function drawText(rgba, width, left, top, text, scale, color) {
  const font = {
    I: ["111", "010", "010", "010", "111"],
    N: ["101", "111", "111", "111", "101"],
    P: ["110", "101", "110", "100", "100"],
    U: ["101", "101", "101", "101", "111"],
    T: ["111", "010", "010", "010", "010"],
  };
  let cursor = left;
  for (const char of text) {
    const glyph = font[char];
    for (let gy = 0; gy < glyph.length; gy += 1) {
      for (let gx = 0; gx < glyph[gy].length; gx += 1) {
        if (glyph[gy][gx] === "1") {
          fillRect(rgba, width, cursor + gx * scale, top + gy * scale, scale, scale, color);
        }
      }
    }
    cursor += 4 * scale;
  }
}

function setPixel(rgba, width, x, y, red, green, blue, alpha) {
  if (x < 0 || y < 0 || x >= width) {
    return;
  }
  const offset = (y * width + x) * 4;
  if (offset < 0 || offset + 3 >= rgba.length) {
    return;
  }
  rgba[offset] = red;
  rgba[offset + 1] = green;
  rgba[offset + 2] = blue;
  rgba[offset + 3] = alpha;
}

function encodePng(width, height, rgba) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    rgba.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(crc32(Buffer.concat([typeBuffer, data])))]); 
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function classifyFailure(message) {
  const normalized = String(message).toLowerCase();
  if (/(provider|upstream|yunwu|openai|timeout|timed out|rate limit|quota|network|fetch|502|503|504|401|403)/.test(normalized)) {
    return "upstream/provider";
  }
  return "product";
}

function summarizeAssetUrl(url) {
  if (url.startsWith("data:")) {
    const commaIndex = url.indexOf(",");
    const header = commaIndex >= 0 ? url.slice(0, commaIndex) : "data:";
    return `${header},<omitted>`;
  }
  return url;
}

function resolveAssetUrl(url) {
  if (url.startsWith("data:")) {
    return url;
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  return `${config.apiBaseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function extensionFromMimeType(mimeType) {
  switch (mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/png":
    default:
      return ".png";
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

function splitSetCookieHeader(value) {
  return value ? value.split(/,(?=[^;]+=[^;]+)/g) : [];
}

function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
