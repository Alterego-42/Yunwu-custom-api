const api = window.yunwuDesktop;

const elements = {
  appVersionLabel: document.querySelector("#app-version-label"),
  message: document.querySelector("#message"),
  services: document.querySelector("#services"),
  appVersion: document.querySelector("#app-version"),
  port: document.querySelector("#port"),
  instanceId: document.querySelector("#instance-id"),
  webUrl: document.querySelector("#web-url"),
  dataPath: document.querySelector("#data-path"),
  userData: document.querySelector("#user-data"),
  legacyState: document.querySelector("#legacy-state"),
  legacyMessage: document.querySelector("#legacy-message"),
  migrateLegacy: document.querySelector("#migrate-legacy"),
  logs: document.querySelector("#logs"),
  phase: document.querySelector("#phase"),
  updatePhase: document.querySelector("#update-phase"),
  latestVersion: document.querySelector("#latest-version"),
  updateMessage: document.querySelector("#update-message"),
  checkUpdates: document.querySelector("#check-updates"),
  applyUpdate: document.querySelector("#apply-update"),
  updateProgress: document.querySelector("#update-progress"),
  updateProgressBar: document.querySelector("#update-progress-bar"),
  updateProgressText: document.querySelector("#update-progress-text"),
  releasePage: document.querySelector("#release-page"),
  retry: document.querySelector("#retry"),
  workbench: document.querySelector("#workbench"),
  admin: document.querySelector("#admin"),
  folder: document.querySelector("#folder")
};

function statusLabel(status) {
  switch (status) {
    case "healthy":
      return "已就绪";
    case "running":
      return "进行中";
    case "error":
      return "错误";
    default:
      return "等待";
  }
}

function legacyStateLabel(legacy) {
  if (!legacy) {
    return "-";
  }
  switch (legacy.state) {
    case "done":
      return "已完成";
    case "running":
      return "迁移中";
    case "failed":
      return "失败";
    case "skipped":
      return "已跳过";
    default:
      return legacy.detected ? "检测到旧数据" : "无旧数据";
  }
}

function render(status) {
  elements.appVersionLabel.textContent = `Yunwu Desktop v${status.desktopVersion || "-"}`;
  elements.message.textContent = status.message;
  elements.appVersion.textContent = status.desktopVersion || "-";
  elements.port.textContent = status.port ? String(status.port) : "-";
  elements.instanceId.textContent = status.instanceId || "-";
  elements.webUrl.textContent = status.webUrl;
  elements.dataPath.textContent = status.dataPath || "-";
  elements.userData.textContent = status.userDataPath || "-";
  elements.phase.textContent = status.phase;
  elements.phase.dataset.phase = status.phase;

  const busy =
    status.phase === "checking" ||
    status.phase === "migrating" ||
    status.phase === "starting" ||
    status.phase === "waiting";
  elements.retry.disabled = busy;

  const legacy = status.legacy;
  elements.legacyState.textContent = legacyStateLabel(legacy);
  const legacyMessage = legacy && legacy.message ? legacy.message : "";
  elements.legacyMessage.textContent = legacyMessage;
  elements.legacyMessage.hidden = !legacyMessage;
  // 检测到旧数据但尚未成功迁移时，提供手动迁移入口
  const canMigrate = Boolean(legacy && legacy.detected && legacy.state !== "done");
  elements.migrateLegacy.hidden = !canMigrate;
  elements.migrateLegacy.disabled = busy;

  elements.services.innerHTML = "";
  for (const service of status.services) {
    const row = document.createElement("div");
    row.className = `service service-${service.status}`;
    row.innerHTML = `
      <span class="dot"></span>
      <strong>${service.name}</strong>
      <small>${statusLabel(service.status)}</small>
      <p>${service.detail || ""}</p>
    `;
    elements.services.appendChild(row);
  }

  elements.logs.textContent = status.logs.length ? status.logs.join("\n") : "等待启动日志...";
  elements.logs.scrollTop = elements.logs.scrollHeight;
}

const STAGE_LABELS = {
  download: "下载",
  verify: "校验",
  extract: "解压",
  stage: "准备替换",
  restart: "重启"
};

function formatMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function renderUpdateProgress(status) {
  const applying = status.phase === "applying" || status.phase === "applied";
  elements.updateProgress.hidden = !applying;
  if (!applying) {
    return;
  }

  const stage = STAGE_LABELS[status.stage] || "处理中";
  const { downloadedBytes, totalBytes } = status;
  const hasBytes = typeof downloadedBytes === "number" && typeof totalBytes === "number" && totalBytes > 0;
  // 只有下载阶段能算出百分比，其余阶段用满条表示正在进行。
  const percent = status.stage === "download" && hasBytes
    ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
    : 100;

  elements.updateProgressBar.style.width = `${percent}%`;
  elements.updateProgressText.textContent =
    status.stage === "download" && hasBytes
      ? `${stage} ${percent}% · ${formatMegabytes(downloadedBytes)} / ${formatMegabytes(totalBytes)}`
      : stage;
}

function renderUpdateStatus(status) {
  elements.updatePhase.textContent = status.phase || "unknown";
  elements.latestVersion.textContent = status.latestTag || status.latestVersion || "-";
  elements.updateMessage.textContent = status.message || "尚未检查更新。";

  const busy = status.phase === "checking" || status.phase === "applying" || status.phase === "applied";
  elements.checkUpdates.disabled = busy;
  elements.releasePage.disabled = status.phase === "checking";
  elements.applyUpdate.hidden = !status.canApplyDesktopUpdate;
  elements.applyUpdate.disabled = busy;
  renderUpdateProgress(status);
}

elements.retry.addEventListener("click", () => api.retry());
elements.migrateLegacy.addEventListener("click", () => {
  const confirmed = window.confirm(
    "将从旧版本（Docker 卷）导入数据并覆盖当前数据库，确认继续？"
  );
  if (confirmed) {
    api.migrateLegacy();
  }
});
elements.checkUpdates.addEventListener("click", async () => {
  renderUpdateStatus({
    phase: "checking",
    message: "正在检查更新...",
    canOpenReleasePage: false
  });
  try {
    renderUpdateStatus(await api.checkUpdates());
  } catch (error) {
    renderUpdateStatus({
      phase: "error",
      message: error instanceof Error ? error.message : "更新检查失败。",
      canOpenReleasePage: true
    });
  }
});
elements.applyUpdate.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "将下载新版本并替换当前程序，完成后自动重启。你的数据保存在用户目录，不会被覆盖。确认继续？"
  );
  if (!confirmed) {
    return;
  }
  try {
    renderUpdateStatus(await api.applyUpdate());
  } catch (error) {
    renderUpdateStatus({
      phase: "error",
      message: error instanceof Error ? error.message : "更新失败。",
      canOpenReleasePage: true
    });
  }
});
elements.releasePage.addEventListener("click", () => api.openReleasePage());
elements.workbench.addEventListener("click", () => api.openWorkbench());
elements.admin.addEventListener("click", () => api.openAdmin());
elements.folder.addEventListener("click", () => api.openUserData());

api.getStatus().then(render);
api.onStatus(render);
api.getUpdateStatus().then(renderUpdateStatus);
api.onUpdateStatus(renderUpdateStatus);
