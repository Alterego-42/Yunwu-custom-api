# Windows PowerShell 本地启动与测试说明

适用场景：你希望在 **Windows PowerShell** 下快速拉起本地可测试环境，覆盖：

- PostgreSQL / Redis / MinIO
- API
- Worker
- Web
- 注册 / 登录 / 回跳 / 路由壳层 / 基础烟测

## 1. 前置条件

- Windows PowerShell 5.1+ 或 PowerShell 7+
- Node.js 22+
- Corepack / `pnpm`
- Docker Desktop 已启动

首次准备建议：

```powershell
corepack enable
corepack prepare pnpm@10.17.1 --activate
```

## 2. 推荐启动方式

### 方式 A：一键启动（推荐）

在仓库根目录执行：

```powershell
pnpm local:start
```

这个命令会做 4 件事：

1. 若缺少 `.env`，自动从 `.env.example` 复制
2. 若缺少 `node_modules`，自动执行 `pnpm install`
3. 启动基础设施容器：Postgres / Redis / MinIO
4. 执行 Prisma generate + migrate deploy
5. 自动打开 3 个新的 PowerShell 窗口：
   - API：`pnpm --filter @yunwu/api dev:api`
   - Worker：`pnpm --filter @yunwu/api dev:worker`
   - Web：`pnpm --filter @yunwu/web dev`

### 方式 B：只做准备，不自动开窗口

```powershell
pnpm local:start:manual
```

该命令会准备 infra 与迁移，然后打印你需要在 **3 个 PowerShell 终端** 里手动执行的命令。

### 方式 C：只做环境预热

```powershell
pnpm local:prepare
```

适合你只想先把基础设施和数据库迁移准备好，稍后再自行启动 API / Worker / Web。

## 3. 手动启动命令

如果你使用手动方式，请分别在 3 个终端里执行：

```powershell
# 终端 1：API
pnpm --filter @yunwu/api dev:api

# 终端 2：Worker
pnpm --filter @yunwu/api dev:worker

# 终端 3：Web
pnpm --filter @yunwu/web dev
```

## 4. 启动后访问地址

- Web：首页 `http://127.0.0.1:5173`
- 管理页 `http://127.0.0.1:5173/admin`
- API `http://127.0.0.1:3000`
- 健康检查 `http://127.0.0.1:3000/health`
- MinIO Console `http://127.0.0.1:9001`

## 5. 默认登录信息

内建账号默认来自 `.env.example`：

- Admin
  - 邮箱：`admin@yunwu.local`
  - 密码：`admin123456`
- Demo
  - 邮箱：`demo@yunwu.local`
  - 密码：`demo123456`

普通用户可通过 Web 自行注册。

## 6. 建议测试主链路

### 6.1 普通用户注册 / 登录 / 回跳

1. 打开 `http://127.0.0.1:5173/register`
2. 注册一个新邮箱账号
3. 注册成功后应自动进入首页 `/`
4. 退出登录
5. 直接访问 `http://127.0.0.1:5173/history`
6. 应被重定向到 `/login`
7. 登录刚注册的账号
8. 登录成功后应自动回跳到 `/history`

### 6.2 管理员入口

1. 退出当前账号
2. 打开 `http://127.0.0.1:5173/login`
3. 用 `admin@yunwu.local / admin123456` 登录
4. 登录成功后默认进入 `/admin`
5. 确认管理壳层与普通用户壳层导航分离

### 6.3 页面主入口

登录后建议顺序点一遍：

- `/`
- `/create`
- `/workspace/:conversationId`（可从首页最近会话或历史页进入）
- `/history`
- `/library`
- `/admin`（仅 admin）

## 7. 命令行测试命令

### 7.1 鉴权 / 路由关键测试

```powershell
pnpm local:test
```

包含：

- `pnpm local:test:auth`
- `pnpm local:test:routes`

### 7.2 前端鉴权 / 路由测试

```powershell
pnpm local:test:routes
```

### 7.3 后端认证测试

```powershell
pnpm local:test:auth
```

### 7.4 本地接口烟测

需要本地 API / Worker / Web / infra 已启动后执行：

```powershell
pnpm local:test:smoke
```

该脚本会走：

- health
- admin 登录
- `auth/me`
- provider 检查
- 创建会话 / 创建任务
- 轮询任务结果

更多细节见：`docs/qa/local-regression-smoke.md`

## 8. 如何停止服务

### 一键停止

```powershell
pnpm local:stop
```

该命令会：

1. 关闭 `pnpm local:start` 拉起的 API / Worker / Web PowerShell 窗口
2. 停止基础设施容器

### 如果你是手动开终端

请手动关闭 API / Worker / Web 的 PowerShell 窗口，然后执行：

```powershell
pnpm docker:infra:down
```

## 9. 常见问题

### 9.1 `docker` 命令失败

- 确认 Docker Desktop 已启动
- 先执行：

```powershell
docker version
pnpm docker:ps
```

### 9.2 5173 / 3000 / 5432 / 6379 / 9000 端口被占用

先检查端口占用，再释放后重启：

```powershell
Get-NetTCPConnection -LocalPort 5173,3000,5432,6379,9000 -ErrorAction SilentlyContinue
```

### 9.3 注册或登录后没保持登录态

- 检查 `.env` 中是否为本地开发：
  - `AUTH_COOKIE_SECURE=false`
  - `CORS_ORIGIN` 包含 `http://127.0.0.1:5173`
- 建议优先使用 `http://127.0.0.1:5173`，不要混用 `localhost` 与 `127.0.0.1`

### 9.4 Worker 没消费任务

- 确认 Worker 窗口已成功启动
- 检查 `REDIS_URL` 可用
- 查看 Worker 日志窗口是否有报错

### 9.5 数据库迁移失败

可手动重试：

```powershell
pnpm --filter @yunwu/api prisma:generate
pnpm --filter @yunwu/api prisma:migrate:deploy
```

### 9.6 Windows Prisma DLL 被占用

若看到 `query_engine-windows.dll.node` 被占用，先关闭 API / Worker / 相关 `node.exe` 进程，再重试。

## 10. 建议你的实测顺序

如果你是第一次启动，建议按这个顺序：

```powershell
pnpm local:start
pnpm local:test
pnpm local:test:smoke
pnpm local:stop
```

如果你更想人工点一遍页面：

1. `pnpm local:start`
2. 浏览器打开 `http://127.0.0.1:5173/register`
3. 注册普通账号 → 退出 → 测回跳
4. 登录 admin → 测 `/admin`
5. 点一遍 `/` `/create` `/history` `/library`
6. `pnpm local:stop`
