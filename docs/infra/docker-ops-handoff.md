# Docker 运维交接说明

本文只覆盖当前仓库的 Docker/Compose 路径，供后续交接与值守使用；不包含业务代码变更说明。

## 1. 前提与代理

- Docker Desktop / Docker Engine 可用。
- 仓库根目录存在 `.env`，可由 `.env.example` 复制生成。
- 若基础镜像拉取失败，当前机器可复用本机代理 `127.0.0.1:7897`。

建议先确认 Docker 代理是否生效：

```powershell
docker info
docker pull node:22-bookworm
docker pull nginx:1.27-alpine
```

确认点：

- `docker info` 中出现 `HTTP Proxy` / `HTTPS Proxy`
- 基础镜像可正常拉取

恢复默认方式：

- 关闭 Windows 系统代理，或
- 在 Docker Desktop 中取消手动代理后重启 Docker Desktop

仓库内不持久化任何本机私有代理配置。

## 2. 推荐启动命令

在仓库根目录执行：

```powershell
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
```

等价原生命令：

```powershell
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml up -d --build
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml ps
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml logs --tail=200
```

停止应用栈：

```powershell
pnpm docker:down
```

只启动基础依赖：

```powershell
pnpm docker:infra:up
pnpm docker:infra:down
```

## 3. 迁移命令

应用容器启动时会自动执行一次：

```powershell
./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

需要手动补跑时，在仓库根目录执行：

```powershell
pnpm docker:migrate
```

若迁移失败，优先检查：

- `postgres` 是否健康
- `.env` 中数据库账号、端口是否与 Compose 一致
- 数据卷是否残留了不兼容的旧状态

## 4. 健康检查与访问入口

默认入口：

- Web 管理端：`http://localhost:5173/admin`
- API 健康：`http://localhost:3000/health`
- API 就绪：`http://localhost:3000/readiness`
- MinIO API：`http://localhost:9000`
- MinIO Console：`http://localhost:9001`

推荐检查命令：

```powershell
pnpm docker:ps
curl.exe http://localhost:3000/health
curl.exe http://localhost:3000/readiness
curl.exe http://localhost:9000/minio/health/live
docker inspect --format "{{json .State.Health}}" yunwu-api
docker inspect --format "{{json .State.Health}}" yunwu-worker
docker inspect --format "{{json .State.Health}}" yunwu-web
```

预期：

- `api` / `worker` / `web` 状态为 `healthy`
- `/health` 返回存活
- `/readiness` 返回依赖已就绪
- MinIO live probe 返回 HTTP 200

## 5. OpenSSL 轻量硬化说明

本轮已将 Node 运行时基础镜像切换为自带 OpenSSL 的 `node:22-bookworm`。

目的：

- 避免 Prisma 在 build / migrate 阶段无法识别 OpenSSL 运行环境
- 让 Prisma 不再回退到默认的 `openssl-1.1.x` 猜测路径
- 保持现有 Debian + Compose 结构，不引入新部署体系

复验命令：

```powershell
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml build api
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml run --rm api /bin/sh -lc "node -p process.versions.openssl; ./apps/api/node_modules/.bin/prisma -v"
```

预期：

- 不再出现 Prisma 的 `failed to detect the libssl/openssl version` 告警
- `Computed binaryTarget` 与当前 Debian/OpenSSL 环境一致

## 6. 常见故障恢复

### 6.1 基础镜像拉取失败

处理顺序：

1. 检查本机 `127.0.0.1:7897` 代理是否可用
2. 检查 `docker info` 中代理是否生效
3. 单独执行 `docker pull node:22-bookworm`
4. 重启 Docker Desktop 后重试

### 6.2 PostgreSQL unhealthy / 迁移失败

```powershell
docker logs yunwu-postgres --tail 100
docker exec yunwu-postgres pg_isready -U postgres -d yunwu_platform
pnpm docker:migrate
```

仍失败时，可确认是否需要重建数据卷：

```powershell
pnpm docker:down
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.app.yml down -v
pnpm docker:up
```

注意：`down -v` 会删除本地 Docker 数据。

### 6.3 API/Worker 不健康

```powershell
docker logs yunwu-api --tail 200
docker logs yunwu-worker --tail 200
docker inspect --format "{{json .State.Health}}" yunwu-api
docker inspect --format "{{json .State.Health}}" yunwu-worker
```

优先检查：

- `DATABASE_URL`
- `REDIS_URL`
- `MINIO_*`
- 上游 provider 配置是否缺失（文档与日志中仅记录变量名，不记录完整密钥）

### 6.4 MinIO bucket 未初始化

```powershell
docker logs yunwu-minio-init --tail 100
docker compose --env-file .env -f infra/docker-compose.yml run --rm minio-init
```

### 6.5 Web 可打开但接口异常

优先检查：

- `yunwu-web`、`yunwu-api` 是否都为 `healthy`
- `/readiness` 是否通过
- 反向代理链路是否仍保持 SSE 无缓冲

## 7. 本任务遇到的工具链问题

- 当前 PowerShell 环境不适合使用 `ConvertFrom-Json -Depth`，本任务未使用该参数。
- Docker 基础镜像 `node:22-bookworm-slim` 默认缺少 `openssl`，导致 Prisma 在 build / migrate 时发出 OpenSSL 探测告警。
- Windows 宿主在本地执行 Prisma 相关命令时，仍可能遇到 DLL 占用问题；需先关闭本地运行中的 API / Worker 进程再重试。
- Docker 拉取基础镜像依赖宿主代理可用性；仓库只能记录前提与恢复方式，不能持久化个人代理配置。
