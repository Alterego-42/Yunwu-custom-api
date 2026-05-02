# 本地回归脚本说明（30.1）

## 1. 目标

将本轮烟测沉淀为一条可重复执行的本地回归路径，尽量复用当前 Docker / HTTP 能力，不引入额外测试框架。

脚本文件：`scripts/regression/local-smoke.mjs`

Round 3 增量验收脚本：`scripts/regression/round3-acceptance.mjs`

Round 3 图片语义验收脚本：`scripts/regression/semantic-image-smoke.mjs`

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

Round 3 图片语义 smoke 额外覆盖：

1. 生成本地 PNG 输入图：红色方块、蓝色圆形、黑色 `INPUT`
2. 文生图 prompt：`纯黄色背景，中间一个巨大的黑色字母 YW3，极简海报，无其他文字`
3. 编辑图 P0 prompt：`保留红色方块和蓝色圆形，把背景改成纯绿色，并给红色方块加粗黑色描边，不要改变主体位置`
4. 编辑图 P1 detail-following prompt：`保留红色方块和蓝色圆形，把背景改成纯绿色，并在画面下方加入清晰黑色文字 EDIT`
5. 真实运行模式下上传输入图、提交任务、轮询终态、下载输出图
6. 生成 `manual-review.md` 和 `inspection.html`，要求人工看图判定

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

Round 3 验收矩阵：

```bash
pnpm local:test:round3
```

该命令会输出 `test-results/regression/round3-acceptance-latest.json` 与 `test-results/regression/round3-acceptance-latest.md`，并为真实浏览器截图预创建 `test-results/regression/round3-browser/`。

Round 3 图片语义 smoke：

```bash
pnpm local:test:semantic-image
```

默认只准备 `test-results/regression/semantic-image-smoke/` 下的输入图和检查模板。后端/前端 worker 修复完成并确认 provider 可真实调用后，再运行：

```bash
SEMANTIC_IMAGE_SMOKE_MODE=run pnpm local:test:semantic-image
```

Windows PowerShell：

```powershell
$env:SEMANTIC_IMAGE_SMOKE_MODE="run"
pnpm local:test:semantic-image
```

该命令的通过条件必须包含人工看图：打开输出图或 `inspection.html`，并保存工作台截图。只看到任务 `succeeded` 不能判定通过。

编辑图验收分层：

- P0 input-grounding：必须使用真实上传资产，输出保留红色方块/蓝色圆形等可识别主体，并执行稳定视觉变化（纯绿色背景、红色方块黑色描边）；这是“模型读到输入图”的阻断项。
- P1 detail-following：新增文字 `EDIT` 或其他细粒度文字/局部指令尽量遵循；失败记录为语义细节失败，但不能单独判定 P0 读图失败。

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
test-results/regression/semantic-image-smoke/request-summary.json
test-results/regression/semantic-image-smoke/manual-review.md
test-results/regression/semantic-image-smoke/inspection.html
```

该摘要适合交接时快速确认本次回归链路是否完整跑通。

## 6. 常见失败定位

- `health failed`：先执行 `pnpm docker:ps`，确认 `yunwu-api` 为 `healthy`
- `login failed`：检查管理员账号配置是否与当前 `.env` / 环境变量一致
- `admin.provider.check failed`：优先确认 provider 基础配置是否存在，以及上游网络是否可达
- `task did not reach terminal state`：检查 `yunwu-worker`、Redis 与 provider 可用性
- `provider test task must succeed`：说明上游 provider 当前不可用，或真实调用受限
- 图片语义 smoke 中任务失败且错误包含 provider、upstream、timeout、quota、rate limit、认证或上游 5xx：优先归类为上游/provider 失败
- 图片语义 smoke 中任务成功但没有输出资产、输出图无法下载、编辑任务没有真实 `assetIds`：归类为产品链路失败
- 图片语义 smoke 中任务成功且有图，但文生图不符合 YW3/黄色背景，或编辑图 P0 不保留输入主体/不执行绿色背景与描边：归类为 P0 语义失败
- 图片语义 smoke 中任务成功且编辑图 P0 通过，但没有生成清晰 `EDIT` 等文字细节：归类为 P1 detail-following 失败，不阻断 P0 读图结论

## 7. 设计约束

- 不使用 PowerShell `ConvertFrom-Json -Depth`
- 不写真实密钥
- 不修改业务代码、Dockerfile、Compose
- 优先复用现有接口与容器路径，降低维护成本
