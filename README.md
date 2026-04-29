# Yunwu Custom API

面向个人用户的 AI 图片生成 + 编辑工作台。当前代码库已完成 round-2 的前台主链路，`Phase 3` 可以在 Windows 本地直接拉起并做最小回归验证。

## 当前状态

已完成并可本地验证的能力：

- 个人用户注册 / 登录 / 登录态恢复 / 路由回跳
- 首页 `/`、创建页 `/create`、工作台 `/workspace/:conversationId`
- 历史页 `/history`、作品库 `/library`
- 管理页 `/admin` 与普通用户前台壳层分离
- API + Worker 异步任务链路、SSE / 轮询状态刷新
- 文生图、来源任务再编辑、上传图编辑、变体、Fork、失败恢复
- 本地对象存储 / MinIO、PostgreSQL、Redis、最小烟测脚本

当前推荐版本号：`v0.3.0`

- 仍处于 `0.x` 阶段，说明产品还在快速迭代，不承诺稳定 API
- 相比 `0.1.0`，现在已经不是只有底层链路，而是具备个人用户可跑通的前台创作闭环

## 仓库结构

- `apps/api`：NestJS API、鉴权、任务入队、SSE、Prisma
- `apps/api` Worker 入口：BullMQ 消费、上游调用、结果落库 / 入存储
- `apps/web`：Vite + React 前台工作台与管理页
- `packages/shared`：共享类型与常量
- `infra`：PostgreSQL、Redis、MinIO、本地 Docker Compose
- `scripts/dev`：Windows 本地启动 / 停止脚本

## 推荐本地启动

### 前置条件

- Windows PowerShell 5.1+ 或 PowerShell 7+
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

### 一键启动

默认推荐：

```powershell
pnpm local:start
```

这个命令会自动完成：

1. 若缺少 `.env`，从 `.env.example` 复制
2. 若缺少 `node_modules`，执行 `pnpm install`
3. 启动 Postgres / Redis / MinIO
4. 执行 Prisma generate + migrate deploy
5. 打开 3 个新的 PowerShell 窗口：
   - API：`pnpm --filter @yunwu/api dev:api`
   - Worker：`pnpm --filter @yunwu/api dev:worker`
   - Web：`pnpm --filter @yunwu/web dev`

### 其他本地脚本

- `pnpm local:start:manual`
  - 只准备环境并打印手动启动命令
- `pnpm local:prepare`
  - 只做 infra + migration 预热，不自动启动 API / Worker / Web
- `pnpm local:stop`
  - 关闭 `local:start` 拉起的窗口，并停止基础设施

### 本地访问地址

- Web：首页 `http://127.0.0.1:5173`
- 管理页 `http://127.0.0.1:5173/admin`
- API `http://127.0.0.1:3000`
- Health `http://127.0.0.1:3000/health`
- Readiness `http://127.0.0.1:3000/readiness`
- MinIO Console `http://127.0.0.1:9001`

建议优先使用 `127.0.0.1`，不要混用 `localhost` 与 `127.0.0.1`。

## 核心体验路径

### 个人用户主链路

1. 打开 `/register` 注册普通用户
2. 登录后进入首页 `/`
3. 从 `/create` 发起首个文生图或上传图编辑任务
4. 提交后进入 `/workspace/:conversationId` 查看任务时间线、状态刷新与结果
5. 从工作台继续再编辑、生成变体，或 Fork 到新会话
6. 在 `/history` 查看任务链与恢复入口
7. 在 `/library` 查看成功作品、继续创作、软删除作品

### 管理员主链路

1. 使用管理员账号登录
2. 默认进入 `/admin`
3. 查看 provider、模型能力、任务状态与可用性信息

## 关键页面与能力

| 页面 | 路径 | 当前能力 |
| --- | --- | --- |
| 登录页 | `/login` | 登录、恢复原目标页、区分普通用户 / 管理员默认落点 |
| 注册页 | `/register` | 个人用户自注册并直接进入前台 |
| 首页 | `/` | 最近会话、最近任务、最近作品、失败恢复入口 |
| 创建页 | `/create` | 文生图、上传图编辑、来源任务预填、提交后进入工作台 |
| 工作台 | `/workspace/:conversationId` | 会话时间线、上传图、继续创作、再编辑、变体、Fork、SSE / 轮询刷新 |
| 历史页 | `/history` | 按任务追溯来源链、重试、继续创作、Fork |
| 作品库 | `/library` | 成功作品查看、继续创作、Fork、软删除 |
| 管理页 | `/admin` | 模型能力、provider 健康、后台入口，与前台壳层分离 |

当前 round-2 重点能力：

- 文生图：无上传图时正常走 `image.generate`
- 上传图编辑：有上传图时优先按 `image.edit` 提交，不再悄悄退化成文生图
- 来源任务继续创作：支持再编辑、变体、Fork
- 失败恢复：系统类失败走重试，内容类失败走参数回填
- 资产沉淀：成功结果进入作品库，支持从作品继续创作

## 最小测试方式

### 自动化最小回归

本地环境启动后执行：

```powershell
pnpm local:test
pnpm local:test:smoke
```

包含内容：

- `pnpm local:test:auth`
  - 后端鉴权关键测试
- `pnpm local:test:routes`
  - 前端登录 / 注册 / 路由壳层 / 权限跳转测试
- `pnpm local:test:smoke`
  - health、登录、`auth/me`、provider 检查、创建会话、创建任务、轮询结果

### 手工最小验收

推荐按这个顺序走一遍：

1. `pnpm local:start`
2. 浏览器打开 `http://127.0.0.1:5173/register`
3. 注册普通用户并确认进入首页
4. 退出后直接访问 `/history`，确认会被带到 `/login`，登录后自动回跳
5. 打开 `/create` 提交一条文生图任务
6. 再测试一次上传图片后发起编辑任务
7. 打开 `/workspace/:conversationId`，确认时间线与任务状态刷新
8. 点一遍 `/history` 与 `/library`
9. 如需后台验证，再用管理员登录测试 `/admin`

## 默认账号

内建账号默认来自 `.env.example`：

- Admin
  - 邮箱：`admin@yunwu.local`
  - 密码：`admin123456`
- Demo
  - 邮箱：`demo@yunwu.local`
  - 密码：`demo123456`

普通用户可直接通过 Web 注册。

## 手动开发启动

如果你不使用一键脚本，请按顺序执行：

```powershell
pnpm docker:infra:up
pnpm --filter @yunwu/api prisma:generate
pnpm --filter @yunwu/api prisma:migrate:deploy
```

然后在 3 个终端分别启动：

```powershell
pnpm --filter @yunwu/api dev:api
pnpm --filter @yunwu/api dev:worker
pnpm --filter @yunwu/web dev
```

## Docker 推荐路径

如果你想直接启动完整栈：

```powershell
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

如只想先拉起基础依赖：

```powershell
pnpm docker:infra:up
pnpm docker:infra:down
```

等价命令：

```powershell
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml up -d --build
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml ps
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml logs --tail=200
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml down
```

## 运行前提

- `DATABASE_URL` 指向可用 PostgreSQL
- `REDIS_URL` 指向可用 Redis
- `TASK_QUEUE_NAME` 在 API 与 Worker 中保持一致
- Worker 已启动，否则任务会停在 `queued` / `submitted`
- `YUNWU_API_KEY` 留空时走 mock；配置后走真实上游

最小必需环境变量：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yunwu_platform?schema=public
REDIS_URL=redis://localhost:6379
TASK_QUEUE_NAME=yunwu-image-tasks
TASK_WORKER_ENABLED=true
TASK_WORKER_CONCURRENCY=2
```

对象存储模式：

- `STORAGE_MODE=local`
  - 本地文件存储，适合联调
- `STORAGE_MODE=minio`
  - 本地模拟真实对象存储，推荐开发默认
- `STORAGE_MODE=s3`
  - 真实 S3 / 兼容 S3

## 健康检查

- `/health`
  - 轻量存活检查，不访问外部依赖
- `/readiness`
  - 检查 PostgreSQL、Redis，以及对象存储可用性

Worker 不额外暴露 HTTP 端口，使用容器健康检查执行 `apps/api/dist/health/worker-readiness.js`。

## 常见问题

- `docker` 命令失败
  - 确认 Docker Desktop 已启动
- 任务一直 `queued`
  - Worker 未启动、Redis 不通，或 `TASK_QUEUE_NAME` 不一致
- SSE 只有心跳，没有任务更新
  - 检查 Worker 是否消费同一个会话链路、Redis / DB 是否一致、代理是否关闭缓冲
- 注册或登录后未保持登录态
  - 检查 `.env` 的 `AUTH_COOKIE_SECURE=false`，并确认 `CORS_ORIGIN` 包含 `http://127.0.0.1:5173`
- Prisma DLL 被占用
  - Windows 下先关闭 API / Worker / 相关 `node.exe` 再重试

## 更多文档

- Windows 本地启动与测试：[docs/qa/windows-local-startup.md](docs/qa/windows-local-startup.md)
- round-2 PRD v0.2：[docs/prd/round-2-personal-user-prd-v0.2.md](docs/prd/round-2-personal-user-prd-v0.2.md)
- PM 交接：[docs/handoff/pm-handoff-round-1-to-round-2.md](docs/handoff/pm-handoff-round-1-to-round-2.md)
