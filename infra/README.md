# Local Infra

独立交接文档见：`docs/infra/docker-ops-handoff.md`

## App overlay（Docker 部署）

基础设施 compose 仍然只负责 PostgreSQL、Redis、MinIO；应用容器放在 `infra/docker-compose.app.yml`，通过 overlay 组合启动：

```powershell
docker compose --env-file ..\.env -f docker-compose.yml -f docker-compose.app.yml up -d --build
docker compose --env-file ..\.env -f docker-compose.yml -f docker-compose.app.yml ps
docker compose --env-file ..\.env -f docker-compose.yml -f docker-compose.app.yml logs --tail=200
docker compose --env-file ..\.env -f docker-compose.yml -f docker-compose.app.yml down
```

应用服务：

- `api`：NestJS API，启动前执行 `prisma migrate deploy`
- `worker`：BullMQ Worker，无对外端口，依赖容器 healthcheck
- `web`：Vite build 产物，由 nginx 提供静态服务并代理 `/api/*`
- 管理入口：`http://localhost:5173/admin`

### Docker Hub 代理前提（Windows）

如果 Docker Desktop 无法直接拉取基础镜像，可优先复用宿主机系统代理。本机本轮验证使用的是 `127.0.0.1:7897`，并通过 `docker info` 中的 `HTTP Proxy` / `HTTPS Proxy` 生效。

- 验证拉取：`docker pull node:22-bookworm`
- 验证拉取：`docker pull nginx:1.27-alpine`
- 恢复默认：关闭 Windows 系统代理，或在 Docker Desktop 代理设置中取消手动代理后重启 Docker Desktop

仓库侧不持久化 Docker Desktop 私有代理配置，只记录使用前提和回退方式。

### readiness / 健康检查

- API `GET /health`：只做轻量存活。
- API `GET /readiness`：检查 PostgreSQL、Redis，以及启用对象存储时的 MinIO live probe。
- Worker：`docker inspect yunwu-worker` 可看到 health 状态，实际检查逻辑为 `node apps/api/dist/health/worker-readiness.js`。

### env 对齐

- 本地开发的 `.env.example` 仍然是唯一模板。
- overlay 会把应用容器内的 `DATABASE_URL`、`REDIS_URL`、`MINIO_ENDPOINT=minio` 等内部地址覆盖为 compose 服务名。
- 如果根目录 `.env` 已设置 `CORS_ORIGIN`、`WEB_ORIGIN` 或 `MINIO_PUBLIC_BASE_URL`，overlay 会直接沿用。
- `CORS_ORIGIN` 建议至少包含 `http://localhost:5173,http://127.0.0.1:5173`。

### SSE 代理说明

Web 容器内置 nginx 反向代理 API，并已关闭 `/api/` 的 proxy buffering；如果后续接入外层 Nginx / Traefik / ingress，也需要对 SSE 路径保持无缓冲转发，否则事件流会被攒包。

### Windows Prisma DLL 锁

在 Windows 宿主上做本地 `pnpm build`、`prisma generate` 或清理依赖时，如果碰到 Prisma DLL 占用，先关闭运行中的本地 API / Worker 进程再重试。

本目录提供本地开发依赖服务：

- PostgreSQL：Prisma 数据库
- Redis：BullMQ 任务队列依赖，API 入队与 Worker 消费都必须连接它
- MinIO：本地 S3 兼容对象存储

## 文件说明

- `docker-compose.yml`：本地依赖服务编排
- `scripts/init-minio.sh`：MinIO bucket 初始化脚本

## 前置要求

- 已安装 Docker Desktop 或兼容 Docker Engine
- 仓库根目录存在 `.env` 文件，可直接从 `.env.example` 复制

```powershell
Copy-Item ..\.env.example ..\.env
```

## 启动与停止

在 `infra` 目录执行：

```powershell
docker compose --env-file ..\.env up -d
docker compose --env-file ..\.env ps
```

首次启动会自动完成：

- 创建 PostgreSQL 数据库
- 启动 Redis 并开启 AOF 持久化
- 启动 MinIO
- 自动创建 `MINIO_BUCKET` 对应 bucket

停止服务：

```powershell
docker compose --env-file ..\.env down
```

连同数据卷一起清理：

```powershell
docker compose --env-file ..\.env down -v
```

## 默认端口与凭据

- PostgreSQL
  - Host: `localhost`
  - Port: `5432`
  - DB: `yunwu_platform`
  - User: `postgres`
  - Password: `postgres`
- Redis
  - Host: `localhost`
  - Port: `6379`
  - 用途：BullMQ 队列；默认队列 key 匹配 `bull:yunwu-image-tasks:*`
- MinIO
  - API Endpoint: `http://localhost:9000`
  - Console: `http://localhost:9001`
  - Root User: `minioadmin`
  - Root Password: `minioadmin`
  - Bucket: `yunwu-assets`

## 与根目录环境变量的对应关系

应用基础依赖：

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/yunwu_platform?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `TASK_QUEUE_ENABLED=true`
- `TASK_QUEUE_NAME=yunwu-image-tasks`
- `TASK_WORKER_ENABLED=true`
- `TASK_WORKER_CONCURRENCY=2`

本地 MinIO 联调：

- `STORAGE_MODE=minio`
- `MINIO_ENDPOINT=localhost`
- `MINIO_PORT=9000`
- `MINIO_ROOT_USER=minioadmin`
- `MINIO_ROOT_PASSWORD=minioadmin`
- `MINIO_BUCKET=yunwu-assets`
- `MINIO_USE_SSL=false`

Compose 额外支持以下可选变量：

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `REDIS_PORT`
- `MINIO_CONSOLE_PORT`
- `MINIO_INTERNAL_ENDPOINT`

## 健康检查

### PostgreSQL

```powershell
docker compose --env-file ..\.env ps postgres
docker exec yunwu-postgres pg_isready -U postgres -d yunwu_platform
docker exec -e PGPASSWORD=postgres yunwu-postgres psql -U postgres -d yunwu_platform -c "select 1;"
```

预期：

- `pg_isready` 返回 `accepting connections`
- `select 1` 返回一行结果

### Redis

```powershell
docker compose --env-file ..\.env ps redis
docker exec yunwu-redis redis-cli ping
```

预期：

- `redis-cli ping` 返回 `PONG`
- API / Worker 使用的 `REDIS_URL` 应为 `redis://localhost:6379`

### MinIO

```powershell
docker compose --env-file ..\.env ps minio
curl.exe http://localhost:9000/minio/health/live
```

预期：

- 健康接口返回 HTTP 200
- Console 可通过 `http://localhost:9001` 登录
- bucket 与 `.env` 中 `MINIO_BUCKET` 一致，默认 `yunwu-assets`

## Redis / BullMQ 验证

Redis 是 API / Worker 拆分后的队列中枢：

- API 进程：创建任务后向 `TASK_QUEUE_NAME` 入队
- Worker 进程：从同一 `TASK_QUEUE_NAME` 消费任务
- 队列名不一致会导致 API 已入队但 Worker 永远消费不到

提交图片任务后检查队列 key：

```powershell
docker exec yunwu-redis redis-cli --scan --pattern "bull:*"
docker exec yunwu-redis redis-cli llen "bull:yunwu-image-tasks:wait"
docker exec yunwu-redis redis-cli llen "bull:yunwu-image-tasks:active"
docker exec yunwu-redis redis-cli zcard "bull:yunwu-image-tasks:completed"
docker exec yunwu-redis redis-cli zcard "bull:yunwu-image-tasks:failed"
```

常见判断：

- 有 `wait`：任务已入队，等待 Worker 消费
- 有 `active`：Worker 正在处理
- `completed` 增长：任务成功完成
- `failed` 增长：查看 Worker 日志和 API 任务详情
- 没有 `bull:*` key：API 没有成功入队，先检查 `REDIS_URL` 和 API 日志

## MinIO 验证与初始化

打开控制台并登录：

- 地址：`http://localhost:9001`
- 用户名：`.env` 中的 `MINIO_ROOT_USER`
- 密码：`.env` 中的 `MINIO_ROOT_PASSWORD`

确认 bucket 已创建：

- 进入 Console 后检查是否存在 `MINIO_BUCKET`
- 默认应为 `yunwu-assets`

如需手动重跑 bucket 初始化：

```powershell
docker compose --env-file ..\.env run --rm minio-init
```

说明：为避免与应用侧 `MINIO_ENDPOINT=localhost` 冲突，初始化容器默认使用内部地址 `MINIO_INTERNAL_ENDPOINT=minio`。

## 应用层最小运维

推荐直接在仓库根目录执行：

```powershell
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
```

如需手动重跑迁移：

```powershell
pnpm docker:migrate
```

如只需要基础依赖，不启动 API / Worker / Web：

```powershell
pnpm docker:infra:up
pnpm docker:infra:down
```

## 排查命令

查看容器状态和健康检查：

```powershell
docker compose --env-file ..\.env ps
docker inspect --format "{{json .State.Health}}" yunwu-postgres
docker inspect --format "{{json .State.Health}}" yunwu-redis
docker inspect --format "{{json .State.Health}}" yunwu-minio
```

查看日志：

```powershell
docker logs yunwu-postgres --tail 100
docker logs yunwu-redis --tail 100
docker logs yunwu-minio --tail 100
docker logs yunwu-minio-init --tail 100
```

## 常见失败排查

- PostgreSQL unhealthy：检查 `POSTGRES_*` 是否改过、端口 `5432` 是否被占用；必要时 `docker compose --env-file ..\.env down -v` 清理重建
- Prisma migration 失败：先跑 PostgreSQL 健康检查，再确认根目录 `.env` 中的 `DATABASE_URL` 与 compose 凭据一致
- Redis `PONG` 正常但任务不消费：确认 API / Worker 的 `TASK_QUEUE_NAME` 完全一致，并确认 Worker 进程已启动
- BullMQ `wait` 不断增长：Worker 未启动、Worker 连接的是其他 Redis，或 Worker 进程报错退出
- BullMQ `failed` 增长：查看 Worker 日志，重点检查上游 `YUNWU_API_KEY`、对象存储、数据库写入错误
- MinIO health 失败：查看 `yunwu-minio` 日志，确认 `MINIO_PORT` 未冲突且 root 用户名密码长度满足 MinIO 要求
- Bucket 未创建：查看 `yunwu-minio-init` 日志，或手动运行 `docker compose --env-file ..\.env run --rm minio-init`
- API / Worker 访问 MinIO 失败：本机运行使用 `MINIO_ENDPOINT=localhost`；容器内运行需使用 compose 网络名或配置内部 endpoint

## 数据持久化

默认启用以下 named volumes：

- `postgres_data`
- `redis_data`
- `minio_data`

重启容器后，本地数据仍会保留；需要完全重置时使用 `docker compose --env-file ..\.env down -v`。
