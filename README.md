# Yunwu Custom API

## Docker MVP（API + Worker + Web + Postgres + Redis + MinIO）

新增了基于 `Dockerfile` + `infra/docker-compose.app.yml` 的部署 overlay，不会覆盖现有仅基础设施的 `infra/docker-compose.yml`。

### 本地开发

```powershell
pnpm install
Copy-Item .env.example .env
docker compose --env-file .env -f infra/docker-compose.yml up -d
pnpm --filter @yunwu/api prisma:migrate
pnpm --filter @yunwu/api dev:api
pnpm --filter @yunwu/api dev:worker
pnpm --filter @yunwu/web dev
```

### Docker 推荐启动路径

推荐默认路径：直接起完整栈；只有在你想单独检查基础设施时，才先起 infra。

```powershell
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
pnpm docker:down
```

### Docker 代理（Windows / Docker Desktop）

如果 Docker Hub 拉取失败，而宿主机已可通过本地代理出网，可先让 Docker Desktop 复用宿主机系统代理；本机本轮验证通过的代理入口是 `127.0.0.1:7897`。

- 启用前提：Windows 系统代理已指向 `127.0.0.1:7897`，且本地代理程序正在监听
- 验证方式：执行 `docker info`，确认存在 `HTTP Proxy` / `HTTPS Proxy`；再执行 `docker pull node:22-bookworm-slim` 或 `docker pull nginx:1.27-alpine`
- 项目启动：代理打通后按默认流程执行 `pnpm docker:up`
- 恢复方式：关闭 Windows 系统代理，或在 Docker Desktop 的 `Settings > Resources > Proxies` 中恢复为默认/关闭手动代理，然后重启 Docker Desktop

说明：本仓库不额外写入 Docker Desktop 私有配置文件，优先复用宿主机现有代理设置，避免引入不可见的本机状态漂移。

等价命令：

```powershell
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml up -d --build
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml ps
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml logs --tail=200
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml down
```

如只想先拉起基础依赖：

```powershell
pnpm docker:infra:up
pnpm docker:infra:down
```

默认入口：

- Web：`http://localhost:5173`
- 管理页：`http://localhost:5173/admin`
- API：`http://localhost:3000`
- API liveness：`http://localhost:3000/health`
- API readiness：`http://localhost:3000/readiness`
- MinIO Console：`http://localhost:9001`

### readiness / health

- `/health` 只做轻量存活返回，不访问外部依赖。
- `/readiness` 检查 PostgreSQL、Redis，以及启用对象存储时的 MinIO live probe。
- Worker 不额外暴露 HTTP 端口，使用容器 `healthcheck` 执行 `apps/api/dist/health/worker-readiness.js` 检查 PostgreSQL、Redis 和已配置的对象存储。

### 环境变量与 Docker 要点

- 本地开发沿用 `.env`，不要提交真实密钥；仅保留 `.env.example`。
- Docker overlay 会把 API / Worker 的 `DATABASE_URL`、`REDIS_URL`、`MINIO_*` 指向 compose 内网服务名。
- 单 provider 约束保持不变：只使用一组 `YUNWU_BASE_URL` + `YUNWU_API_KEY`，不要在 compose 或文档里扩展多 provider 配置。
- Web 容器在构建时把 `VITE_API_BASE_URL` 设为 `/`，由 nginx 代理 `/api/*` 到 API 容器。
- 若你在 `.env` 中自定义 `CORS_ORIGIN`、`WEB_ORIGIN` 或 `MINIO_PUBLIC_BASE_URL`，compose overlay 会继续尊重这些值，不再强行覆盖。
- 如果你接入自定义反向代理，SSE 路径必须关闭 buffering；当前 `infra/nginx/web.conf` 已对 `/api/` 设置 `proxy_buffering off` 和 `X-Accel-Buffering: no`。

### Docker 运行说明（最小运维）

1. 复制环境变量模板并只填写必要项：

```powershell
Copy-Item .env.example .env
```

至少确认：

- `YUNWU_API_KEY`：留空时走 mock；填值时不要提交到仓库
- `AUTH_SESSION_SECRET`：演示环境建议改成自定义随机值
- `MINIO_ROOT_PASSWORD`：如需共享环境，建议改掉默认值

2. 启动完整栈：

```powershell
pnpm docker:up
```

3. 检查容器状态：

```powershell
pnpm docker:ps
```

预期核心容器：

- `yunwu-postgres`
- `yunwu-redis`
- `yunwu-minio`
- `yunwu-minio-init`（一次性执行完成后退出）
- `yunwu-api`
- `yunwu-worker`
- `yunwu-web`

4. 如需手动重跑迁移：

```powershell
pnpm docker:migrate
```

说明：

- `api` 容器启动时默认先执行 `prisma migrate deploy`，正常情况下不需要单独跑
- `worker` 不暴露公网端口，只看容器健康检查和日志
- `web` 提供用户工作台与 `/admin` 管理入口，API 通过同域 `/api/*` 代理

5. 常用运维动作：

```powershell
# 查看最近日志
pnpm docker:logs

# 重启应用层（不动数据卷）
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml restart api worker web

# 停止完整栈
pnpm docker:down
```

### Windows Prisma DLL 锁

Windows 上如果 `prisma generate` / `pnpm build` 报 `query_engine-windows.dll.node` 被占用，先停止正在运行的 API / Worker / `node.exe` 进程后再重试；通常是 Prisma 引擎文件被本地开发进程锁住。

当前仓库提供图片工作台的 API、异步任务 Worker、Web 工作台与本地基础设施：

- `apps/api`：NestJS HTTP API、鉴权、SSE、Prisma 数据访问、BullMQ 入队逻辑
- `apps/api` Worker 入口：独立消费 BullMQ 图片任务，调用上游、写入数据库与对象存储
- `apps/web`：Vite + React 工作台
- `packages/shared`：共享类型与接口定义
- `infra`：PostgreSQL、Redis、MinIO 的本地 `docker compose` 配置

API 和 Worker 是两个正式拆分的进程：API 只负责 HTTP / SSE / 入队，Worker 只负责消费队列。二者共享 `DATABASE_URL`、`REDIS_URL`、对象存储和上游 `YUNWU_*` 配置；生产环境必须分别拉起至少 1 个 API 进程和 1 个 Worker 进程。

## 运行前提清单

- Node.js 22+、Corepack、`pnpm@10.17.1`
- Docker Desktop 或兼容 Docker Engine（本地 Postgres / Redis / MinIO）
- `.env` 已从 `.env.example` 复制并按需调整
- `DATABASE_URL` 指向可用 PostgreSQL，且已执行 Prisma migration
- `REDIS_URL` 指向可用 Redis；Redis 是 BullMQ 队列的必需依赖
- `TASK_QUEUE_NAME` 在 API 与 Worker 中保持一致
- Worker 进程已启动；否则任务只会停留在 `queued` / `submitted`
- `YUNWU_API_KEY` 未配置时会走本地 mock 结果；配置后才会调用真实上游

## 快速开始

```powershell
corepack enable
corepack prepare pnpm@10.17.1 --activate
pnpm install
Copy-Item .env.example .env
```

## 本地开发启动顺序

1. 启动基础设施：

```powershell
cd infra
docker compose --env-file ..\.env up -d
cd ..
```

2. 生成 Prisma Client 并执行迁移：

```powershell
pnpm --filter @yunwu/api prisma:generate
pnpm --filter @yunwu/api prisma:migrate
```

3. 分别启动 API、Worker、Web（建议 3 个终端）：

```powershell
# 终端 1：API 进程，只提供 HTTP / SSE / 入队
pnpm --filter @yunwu/api dev:api

# 终端 2：Worker 进程，只消费 BullMQ 队列
pnpm --filter @yunwu/api dev:worker

# 终端 3：Web 工作台
pnpm --filter @yunwu/web dev
```

如果当前分支仍处于拆分过渡期，只有 `pnpm --filter @yunwu/api dev` 一个入口，请确保 API 侧禁用内置消费，Worker 侧单独启用消费；最终以 `apps/api/package.json` 中的 `dev:api` / `dev:worker` 脚本为准。

## 生产启动方式

生产环境不要把 API 和 Worker 合在同一个进程里运行：

```powershell
pnpm --filter @yunwu/api build
pnpm --filter @yunwu/web build

# 迁移只执行一次，通常由发布流水线或一次性 Job 负责
pnpm --filter @yunwu/api prisma:generate
pnpm --filter @yunwu/api prisma:migrate

# API 服务进程
pnpm --filter @yunwu/api start:api

# Worker 服务进程，可按队列压力水平扩容
pnpm --filter @yunwu/api start:worker
```

部署要点：

- API 进程暴露 `PORT`，负责 `/health`、`/api/*`、SSE 与静态资产代理
- Worker 进程不需要暴露公网端口，但必须能访问 PostgreSQL、Redis、对象存储和上游 API
- 多个 Worker 可并行运行；单进程并发由 `TASK_WORKER_CONCURRENCY` 控制
- 多个 API 副本承载 SSE 时，需要保持连接不被代理缓冲；若 Worker 与 API 跨进程通知依赖 Redis / pubsub 或队列事件，确认二者使用同一 `REDIS_URL`

## 环境变量说明

最小必需配置：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yunwu_platform?schema=public
REDIS_URL=redis://localhost:6379
TASK_QUEUE_NAME=yunwu-image-tasks
TASK_WORKER_ENABLED=true
TASK_WORKER_CONCURRENCY=2
```

关键规则：

- `DATABASE_URL`：Prisma 与 API / Worker 共用；Prisma schema 路径由 API 包内 Prisma 配置或 package script 管理
- `REDIS_URL`：BullMQ 必需；API 负责 `Queue.add`，Worker 负责 `Worker.process`
- `TASK_QUEUE_NAME`：API 与 Worker 必须完全一致；Redis key 形如 `bull:<queueName>:*`
- `TASK_QUEUE_ENABLED`：保留给兼容实现；正式拆分后队列应默认启用
- `TASK_WORKER_ENABLED`：用于过渡期或共享模块入口控制 Worker 消费；API 进程不应消费任务
- `TASK_WORKER_CONCURRENCY`：Worker 单进程并发；优先使用它，`TASK_QUEUE_CONCURRENCY` 仅作兼容旧配置

## 最小烟测步骤

以下命令假设 API 在 `http://localhost:3000`，且已启动 Worker。

```powershell
$base = "http://localhost:3000"

curl.exe -i "$base/health"
curl.exe -i "$base/api/capabilities"

curl.exe -i -c cookies.txt `
  -H "Content-Type: application/json" `
  -d '{"email":"demo@yunwu.local","password":"demo123456"}' `
  "$base/api/auth/login"

$conversation = curl.exe -s -b cookies.txt `
  -H "Content-Type: application/json" `
  -d '{"title":"local smoke"}' `
  "$base/api/conversations" | ConvertFrom-Json
$conversationId = $conversation.conversation.id

$task = curl.exe -s -b cookies.txt `
  -H "Content-Type: application/json" `
  -d ('{"conversationId":"' + $conversationId + '","capability":"image.generate","model":"gpt-image-1","prompt":"local smoke test"}') `
  "$base/api/tasks" | ConvertFrom-Json
$taskId = $task.task.id

curl.exe -s -b cookies.txt "$base/api/tasks/$taskId"
```

预期结果：

- `/health` 返回 `status: ok`
- 登录接口写入 `cookies.txt`
- 创建任务返回 `task.status=queued`
- Worker 正常消费后，任务状态进入 `submitted` / `running`，最终为 `succeeded` 或 `failed`

## Redis / BullMQ 验证

确认 Redis 可用：

```powershell
cd infra
docker compose --env-file ..\.env ps redis
docker exec yunwu-redis redis-cli ping
cd ..
```

提交任务后检查 BullMQ key：

```powershell
docker exec yunwu-redis redis-cli --scan --pattern "bull:*"
docker exec yunwu-redis redis-cli llen "bull:yunwu-image-tasks:wait"
docker exec yunwu-redis redis-cli llen "bull:yunwu-image-tasks:active"
docker exec yunwu-redis redis-cli zcard "bull:yunwu-image-tasks:completed"
docker exec yunwu-redis redis-cli zcard "bull:yunwu-image-tasks:failed"
```

判断方式：

- `wait` 增长但不减少：API 能入队，但 Worker 未启动、连错 Redis，或 `TASK_QUEUE_NAME` 不一致
- `active` 长时间不归零：Worker 卡在上游调用、对象存储或数据库写入
- `failed` 增长：查看 Worker 日志和任务详情里的 `errorMessage`
- 没有 `bull:*` key：API 未成功入队，优先检查 `REDIS_URL` 与 API 日志

## SSE 验证

打开一个终端保持 SSE 连接：

```powershell
curl.exe -N -b cookies.txt "http://localhost:3000/api/conversations/$conversationId/events"
```

再用另一个终端提交任务，SSE 终端应至少看到：

- `connected`：连接建立
- `heartbeat`：约每 25 秒一次，说明 API 与代理没有缓冲 / 断开 SSE
- `task.updated` / `conversation.updated`：提交任务或 Worker 更新任务时推送

如果只有 `heartbeat` 没有任务更新：

- 确认 Worker 正在消费同一个 `TASK_QUEUE_NAME`
- 确认 Worker 与 API 使用同一 `DATABASE_URL`、`REDIS_URL`
- 检查 Worker 到 API 的跨进程事件桥是否启用；正式拆分后不能依赖单进程内存事件
- 反向代理需关闭 SSE 缓冲，Nginx 可参考 `X-Accel-Buffering: no`

## 对象存储模式

### 1. 本地 fallback

适合不启 MinIO、只想先跑通 API / Web 联调。

```env
STORAGE_MODE=local
LOCAL_STORAGE_PATH=./storage
PUBLIC_ASSET_BASE_URL=http://localhost:3000/api/assets
```

### 2. MinIO 模式

适合本地模拟真实对象存储，和后续 S3 接入方式保持一致。

```env
STORAGE_MODE=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=yunwu-assets
MINIO_USE_SSL=false
```

验证：

- MinIO API：`http://localhost:9000/minio/health/live`
- MinIO Console：`http://localhost:9001`
- bucket 名称与 `.env` 中 `MINIO_BUCKET` 保持一致

### 3. 真实 S3 / 兼容 S3

```env
STORAGE_MODE=s3
S3_ENDPOINT=
S3_REGION=auto
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_BASE_URL=
```

## 当前接口

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/capabilities`
- `GET /api/models`
- `GET /api/conversations`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `GET /api/conversations/:id/events`
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/assets/upload`
- `GET /api/assets/:storageKey/content`

## 常见失败排查

- API 启动失败并提示 `REDIS_URL is required`：`.env` 未加载或 Redis 配置缺失
- 任务一直 `queued`：Worker 未启动、连错 Redis，或 API / Worker 的 `TASK_QUEUE_NAME` 不一致
- 任务一直 `running`：检查 Worker 日志、上游 `YUNWU_API_KEY`、对象存储和数据库连接
- Prisma 报连接错误：先确认 `docker exec yunwu-postgres pg_isready -U postgres -d yunwu_platform` 通过，再确认 `DATABASE_URL`
- BullMQ key 名称不符合预期：以 `.env` 的 `TASK_QUEUE_NAME` 为准，默认是 `bull:yunwu-image-tasks:*`
- SSE 连接立即断开：检查登录 cookie、会话权限、代理超时和缓冲配置
- SSE 有心跳但无任务更新：检查 Worker 是否已消费，并确认拆分后的跨进程事件通知链路已启用
- MinIO 上传失败：确认 `STORAGE_MODE`、`MINIO_*`、bucket 创建状态，以及 API / Worker 都能访问同一 endpoint
