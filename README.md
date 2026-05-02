# Yunwu Custom API

面向个人用户的 AI 图片生成与编辑工作台。`v0.4.2` 收口重点是桌面友好的发布方式：API、Worker、Web 发布为 GHCR Docker 镜像，Windows portable 包是 Electron 桌面窗体应用；桌面壳会依赖 Docker Desktop 运行本地服务栈，用户不需要在本机执行 `pnpm install`。

当前推荐版本：`v0.4.2`

## 当前能力

- 个人用户注册、登录、登录态恢复、权限路由回跳
- 首页、创建页、工作台、历史页、作品库
- 文生图、上传图编辑、来源任务继续创作、变体、Fork、失败恢复
- API + BullMQ Worker 异步任务链路，支持 SSE 与轮询状态刷新
- PostgreSQL、Redis、MinIO 本地依赖栈
- 管理台 `/admin`：provider/model 配置、任务与健康状态、DEBUG 级运行日志辅助排障
- Docker 镜像发布：`api`、`worker`、`web` 三个 target
- Windows portable Electron 桌面壳：基于 Docker Desktop 拉取 v0.4.2 镜像运行本地服务栈

## 仓库结构

- `apps/api`：NestJS API、鉴权、任务入队、SSE、Prisma、Worker 入口
- `apps/web`：Vite + React 前台工作台与管理页
- `packages/shared`：共享类型与常量
- `infra`：PostgreSQL、Redis、MinIO、Docker Compose
- `.github/workflows/release.yml`：v0.4.2 发布工程 workflow
- `docs/release/v0.4.2.md`：release notes 草案

## Windows Portable 使用

前置条件：

- Windows 10/11
- Docker Desktop 已安装并启动
- 可访问 GHCR 镜像仓库

Release artifact 中的 `Yunwu Desktop-0.4.2-win-x64-portable.zip` 是 Electron 桌面窗体应用。解压后运行桌面程序，桌面壳负责检查 Docker CLI/daemon，并使用内置 compose 文件拉起 API、Worker、Web、PostgreSQL、Redis、MinIO。

如需不经过桌面壳、直接验证同一组 v0.4.2 镜像，可手动运行：

```powershell
Copy-Item .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.desktop.yml up -d
```

访问地址：

- Web：`http://127.0.0.1:5173`
- 管理台：`http://127.0.0.1:5173/admin`
- API：`http://127.0.0.1:3000`
- Health：`http://127.0.0.1:3000/health`
- Readiness：`http://127.0.0.1:3000/readiness`
- MinIO Console：`http://127.0.0.1:9001`

停止：

```powershell
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.desktop.yml down
```

默认镜像标签是 `v0.4.2`。如需覆盖：

```env
YUNWU_IMAGE_TAG=v0.4.2
YUNWU_IMAGE_REGISTRY=ghcr.io/alterego-42
```

## API Key 配置

真实上游调用需要在 `.env` 设置：

```env
YUNWU_BASE_URL=https://yunwu.ai
YUNWU_API_KEY=your_api_key_here
```

`YUNWU_API_KEY` 留空时适合本地联调或 mock-oriented 验证；真实图片生成、编辑和 provider 检查应配置有效 key。

## 默认账号

默认值来自 `.env.example`：

- Admin：`admin@yunwu.local` / `admin123456`
- Demo：`demo@yunwu.local` / `demo123456`

普通用户也可以直接通过 Web 注册。

## 管理台与 DEBUG 日志

管理员登录后进入 `/admin`。管理台用于查看 provider/model 状态、任务运行状态、配置项和 DEBUG 级排障信息。

排障时优先检查：

- API 容器日志：`docker logs yunwu-desktop-api --tail 200`
- Worker 容器日志：`docker logs yunwu-desktop-worker --tail 200`
- Web 容器日志：`docker logs yunwu-desktop-web --tail 200`
- Compose 聚合日志：`docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.desktop.yml logs --tail=200`

## 手动开发启动

开发者本地仍可使用 Node.js + pnpm 路径。

前置条件：

- Node.js 22+
- Corepack
- `pnpm@10.17.1`
- Docker Desktop

首次准备：

```powershell
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
Copy-Item .env.example .env
```

一键启动：

```powershell
pnpm local:start
```

手动启动基础依赖与迁移：

```powershell
pnpm docker:infra:up
pnpm --filter @yunwu/api prisma:generate
pnpm --filter @yunwu/api prisma:migrate:deploy
```

然后分别启动：

```powershell
pnpm --filter @yunwu/api dev:api
pnpm --filter @yunwu/api dev:worker
pnpm --filter @yunwu/web dev
```

## Docker 开发路径

源码构建完整栈：

```powershell
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

仅做 compose 静态检查，不启动服务：

```powershell
pnpm docker:config
```

桌面镜像栈静态检查：

```powershell
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.desktop.yml config
```

## 发布策略

打 `v*` tag 或手动触发 GitHub Actions Release workflow：

- 构建并发布 `ghcr.io/alterego-42/yunwu-custom-api-api:<version>`
- 构建并发布 `ghcr.io/alterego-42/yunwu-custom-api-worker:<version>`
- 构建并发布 `ghcr.io/alterego-42/yunwu-custom-api-web:<version>`
- 执行 `pnpm desktop:package` 生成 Electron portable zip：`apps/desktop/release/*portable.zip`
- tag 触发时上传同一个 Electron zip 到 GitHub Release；manual dispatch 默认只产出 workflow artifact，勾选 `publish_release` 后上传 Release

## 常见故障

- `docker` 命令失败：确认 Docker Desktop 已启动，并且当前终端能执行 `docker compose version`。
- GHCR 镜像拉取失败：确认网络和 GHCR 访问权限；私有仓库镜像需要先 `docker login ghcr.io`。
- 任务一直 `queued`：检查 Worker 是否健康、Redis 是否可用、API 与 Worker 的 `TASK_QUEUE_NAME` 是否一致。
- SSE 只有心跳：检查 Worker 日志、Redis/DB 是否一致，以及代理是否关闭缓冲。
- 真实生成失败：确认 `YUNWU_API_KEY`、`YUNWU_BASE_URL`、provider/model 配置有效。
- 上传或结果图片不可访问：检查 MinIO 是否健康、`MINIO_BUCKET` 是否初始化、`MINIO_PUBLIC_BASE_URL` 是否指向宿主可访问地址。
- 登录态丢失：本地默认应使用 `AUTH_COOKIE_SECURE=false`，并避免混用 `localhost` 与 `127.0.0.1`。
- Prisma DLL 被占用：Windows 下先关闭 API、Worker 和相关 `node.exe` 进程再重试。

## 更多文档

- Docker 运维交接：[docs/infra/docker-ops-handoff.md](docs/infra/docker-ops-handoff.md)
- Windows 本地启动与测试：[docs/qa/windows-local-startup.md](docs/qa/windows-local-startup.md)
- v0.4.2 release notes 草案：[docs/release/v0.4.2.md](docs/release/v0.4.2.md)
