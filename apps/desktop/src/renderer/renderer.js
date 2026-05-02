const api = window.yunwuDesktop;

const elements = {
  message: document.querySelector("#message"),
  services: document.querySelector("#services"),
  dockerCli: document.querySelector("#docker-cli"),
  dockerDaemon: document.querySelector("#docker-daemon"),
  dockerActionText: document.querySelector("#docker-action-text"),
  dockerAction: document.querySelector("#docker-action"),
  instanceId: document.querySelector("#instance-id"),
  composeProject: document.querySelector("#compose-project"),
  webUrl: document.querySelector("#web-url"),
  userData: document.querySelector("#user-data"),
  logs: document.querySelector("#logs"),
  phase: document.querySelector("#phase"),
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

function render(status) {
  elements.message.textContent = status.message;
  elements.dockerCli.textContent = status.dockerCli;
  elements.dockerDaemon.textContent = status.dockerDaemon;
  elements.dockerActionText.textContent = status.dockerAction === "none" ? "-" : status.dockerAction;
  elements.instanceId.textContent = status.instanceId || "-";
  elements.composeProject.textContent = status.composeProjectName || "-";
  elements.webUrl.textContent = status.webUrl;
  elements.userData.textContent = status.userDataPath || "-";
  elements.phase.textContent = status.phase;
  elements.phase.dataset.phase = status.phase;
  elements.retry.disabled = status.phase === "checking" || status.phase === "starting" || status.phase === "waiting";

  elements.dockerAction.hidden = status.dockerAction === "none";
  if (status.dockerAction === "start") {
    elements.dockerAction.textContent = "启动 Docker Desktop";
  } else if (status.dockerAction === "install") {
    elements.dockerAction.textContent = "下载/安装 Docker Desktop";
  }

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

elements.retry.addEventListener("click", () => api.retry());
elements.dockerAction.addEventListener("click", () => {
  if (elements.dockerAction.textContent === "启动 Docker Desktop") {
    api.startDocker();
  } else {
    api.openDockerDownload();
  }
});
elements.workbench.addEventListener("click", () => api.openWorkbench());
elements.admin.addEventListener("click", () => api.openAdmin());
elements.folder.addEventListener("click", () => api.openUserData());

api.getStatus().then(render);
api.onStatus(render);
