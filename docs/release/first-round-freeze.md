# 首轮封板说明（29.1）

## 1. 本轮完成范围

- 进入首轮封板，冻结当前 Docker + HTTP 闭环作为演示与回归基线。
- 补充一份面向交接的发布说明，聚焦启动路径、演示顺序、已知限制与工具链注意事项。
- 沉淀一套本地可复用回归脚本，覆盖健康检查、登录、基础业务链路、provider check / test 与关键断言。
- 本轮不改业务代码、不改 Dockerfile / Compose，仅新增文档与脚本。

## 2. 推荐演示路径

1. 启动栈：`pnpm docker:up`
2. 检查容器：`pnpm docker:ps`
3. 检查 API 存活：访问 `http://localhost:3000/health`
4. 登录后台账号，确认会话可创建、任务可提交
5. 运行本地回归脚本：`node ./scripts/regression/local-smoke.mjs`
6. 查看脚本输出摘要：`test-results/regression/local-smoke-latest.json`

建议演示时按“健康检查 → 登录态恢复 → 基础生图任务 → provider 管理态 → provider test-generate”顺序，避免跳步后难以定位故障点。

## 3. 启动方式

### Docker 推荐路径

```bash
pnpm docker:up
pnpm docker:ps
pnpm docker:logs
```

### 最小校验命令

```bash
curl.exe http://localhost:3000/health
curl.exe http://localhost:9000/minio/health/live
```

### 回归脚本

```bash
node ./scripts/regression/local-smoke.mjs
```

脚本默认读取当前 shell 环境变量；若未显式注入，则会回退读取仓库根目录 `.env`。不会输出或持久化完整 provider API key。

## 4. 已知限制

- 当前回归链路依赖本地 Docker 栈已成功启动，脚本不负责拉起容器。
- provider 当前可能处于 `real` 模式，`provider/check` 与 `provider/test-generate` 会触达真实上游，速度与稳定性受外部环境影响。
- 回归脚本当前覆盖的是核心闭环与关键断言，不替代 UI 端视觉验收、上传类场景和长时稳定性测试。
- provider 历史告警会出现在 `GET /api/admin/provider` 结果中；如存在旧失败记录，不代表本次回归必然失败，应结合脚本本次结果判断。

## 5. 工具链注意事项

- PowerShell JSON 解析不要使用 `ConvertFrom-Json -Depth`；兼容性存在问题。本轮脚本统一使用 Node 原生 `JSON.parse()`。
- 启动链路优先复用仓库既有 `pnpm docker:*` 命令，不额外引入复杂测试框架。
- 若 Docker Desktop 拉取镜像失败，先检查宿主机代理是否可被 Docker 继承，再重试 `pnpm docker:up`。
- 如需排查本轮遇到的工具链问题，见 `docs/qa/toolchain-issues.md`。

## 6. 交接物

- 封板说明：`docs/release/first-round-freeze.md`
- 回归说明：`docs/qa/local-regression-smoke.md`
- 工具链问题：`docs/qa/toolchain-issues.md`
- 本地回归脚本：`scripts/regression/local-smoke.mjs`
