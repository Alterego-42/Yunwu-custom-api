# 本地回归脚本说明（30.1）

## 1. 目标

将本轮烟测沉淀为一条可重复执行的本地回归路径，尽量复用当前 Docker / HTTP 能力，不引入额外测试框架。

脚本文件：`scripts/regression/local-smoke.mjs`

## 2. 覆盖范围

脚本按以下顺序执行：

1. `GET /health`
2. `POST /api/auth/login`
3. `GET /api/auth/me`
4. `GET /api/admin/provider`
5. `POST /api/admin/provider/check`
6. `POST /api/conversations`
7. `POST /api/tasks`
8. 轮询 `GET /api/tasks/:id` 直到业务任务完成
9. `POST /api/admin/provider/test-generate`
10. 轮询 `GET /api/tasks/:id` 直到 provider 测试任务完成

关键断言包括：

- 健康检查返回 `status=ok`
- 登录成功且用户角色为 `admin`
- `auth/me` 返回的用户与登录态一致
- provider check 返回合法状态
- 基础业务任务可从提交进入终态
- provider test-generate 可成功入队并完成

## 3. 前置条件

- 已安装 Node.js 22+（仓库当前 Docker 基线也是 Node 22）
- 已执行依赖安装
- 本地栈已启动，推荐使用：

```bash
pnpm docker:up
```

- API 默认地址为 `http://localhost:3000`

## 4. 运行命令

默认运行：

```bash
node ./scripts/regression/local-smoke.mjs
```

可选环境变量：

```bash
REGRESSION_BASE_URL=http://localhost:3000
REGRESSION_ADMIN_EMAIL=admin@yunwu.local
REGRESSION_ADMIN_PASSWORD=***
REGRESSION_MODEL=flux-schnell
REGRESSION_TASK_TIMEOUT_MS=120000
REGRESSION_TASK_POLL_MS=3000
REGRESSION_PROVIDER_PROMPT=Provider regression smoke test image.
```

说明：

- 脚本优先读取当前环境变量，其次读取仓库根目录 `.env`
- 未显式设置管理员账号时，会回退到仓库当前默认管理员配置
- 不会打印或写入完整 provider API key；只保留接口返回的脱敏字段

## 5. 输出

脚本控制台会打印每个步骤的通过情况，并在成功后输出：

- 会话 ID
- 基础业务任务 ID / 状态
- provider 测试任务 ID / 状态
- 摘要文件位置

摘要文件默认写入：

```text
test-results/regression/local-smoke-latest.json
```

该摘要适合交接时快速确认本次回归链路是否完整跑通。

## 6. 常见失败定位

- `health failed`：先执行 `pnpm docker:ps`，确认 `yunwu-api` 为 `healthy`
- `login failed`：检查管理员账号配置是否与当前 `.env` / 环境变量一致
- `admin.provider.check failed`：优先确认 provider 基础配置是否存在，以及上游网络是否可达
- `task did not reach terminal state`：检查 `yunwu-worker`、Redis 与 provider 可用性
- `provider test task must succeed`：说明上游 provider 当前不可用，或真实调用受限

## 7. 设计约束

- 不使用 PowerShell `ConvertFrom-Json -Depth`
- 不写真实密钥
- 不修改业务代码、Dockerfile、Compose
- 优先复用现有接口与容器路径，降低维护成本
