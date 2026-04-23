# 工具链问题汇总

## 1. PowerShell JSON 兼容性

- 本机环境下不建议使用 `ConvertFrom-Json -Depth`
- 为避免兼容性差异，本轮回归脚本统一使用 Node 原生 `fetch` + `JSON.parse()`
- 结论：后续同类脚本优先采用 Node 或 Python 解析 JSON，不再依赖该 PowerShell 参数

## 2. Docker 拉取镜像依赖宿主代理

- 本地 Docker 启动成功与否，受 Docker Desktop 是否继承宿主代理影响较大
- 若 `pnpm docker:up` 卡在基础镜像拉取，优先检查 `docker info` 中代理是否生效
- 结论：这是环境前提，不应写入仓库私有配置；仅保留检查与恢复说明

## 3. Provider real 模式带来的不确定性

- 当前 provider 管理接口可能工作在 `real` 模式
- `provider/check` 与 `provider/test-generate` 会触发真实上游访问，耗时、稳定性、额度均受外部环境影响
- 结论：回归脚本保留此检查，但文档中明确标注其外部依赖属性，避免误判为纯本地故障

## 4. 任务轮询需要 Worker 同步在线

- 基础业务任务和 provider test-generate 都依赖 `yunwu-worker` 消费队列
- 若 API 可登录但任务长期停留在 `queued` / `submitted`，优先检查 Worker 与 Redis，而不是重复提交任务
- 结论：回归脚本将“任务进入终态”设为关键断言，避免只测到入队成功
