# Browser Workspace Smoke

可复用脚本：

```powershell
pnpm local:test:browser-workspace
```

脚本路径：

```text
scripts/regression/browser-workspace-smoke.mjs
```

输出路径：

```text
test-results/regression/browser-workspace-smoke/latest.json
test-results/regression/browser-workspace-smoke/latest.md
test-results/regression/browser-workspace-smoke/screenshots/*.png
```

## 环境变量

```powershell
$env:WEB_BASE_URL="http://127.0.0.1:5173"
$env:ROUND3_WEB_BASE_URL="http://127.0.0.1:5173"
$env:API_BASE_URL="http://127.0.0.1:3000"
$env:ROUND3_API_BASE_URL="http://127.0.0.1:3000"
$env:BROWSER_SMOKE_EMAIL="demo@yunwu.local"
$env:BROWSER_SMOKE_PASSWORD="demo123456"
$env:BROWSER_SMOKE_OUTPUT_DIR="test-results/regression/browser-workspace-smoke"
$env:BROWSER_SMOKE_HEADLESS="true"
$env:BROWSER_SMOKE_SESSION_ID="conversation_id_optional"
$env:BROWSER_SMOKE_AUTO_START="true"
```

兼容已有账号变量：`ROUND3_USER_EMAIL`、`ROUND3_USER_PASSWORD`、`REGRESSION_USER_EMAIL`、`REGRESSION_USER_PASSWORD`、`AUTH_DEMO_EMAIL`、`AUTH_DEMO_PASSWORD`。

`BROWSER_SMOKE_AUTO_START=true` 且 Web/API 都是 loopback 地址时，脚本会在服务不可达时尝试执行 `pnpm local:start`，再等待 API `/health` 和 Web 首页可访问。若不希望脚本拉起本地服务，设置：

```powershell
$env:BROWSER_SMOKE_AUTO_START="false"
```

## 覆盖点

脚本优先覆盖当前工作台 UI 回归点：

| 覆盖点 | 证据 |
| --- | --- |
| 登录普通用户或 env 覆盖账号 | `latest.json` 的 `Login` check |
| 打开指定会话或最近工作台 | `Open workspace` / `Resolve workspace target` |
| 无会话兜底打开 `/create` | `00-no-workspace-data.png` |
| 工作台全页 | `01-workspace-full-page.png` |
| 左侧会话列表常态 | `02-session-list-normal.png` |
| 搜索过滤后 | `03-session-list-search-filtered.png` |
| 切换会话 loading/切换后 | `04-session-switch-loading.png`、`05-session-switch-after.png`，无多会话时标记 skipped |
| composer 区域 | `06-composer-area.png` |
| 任务卡轮次/重试 | `07-task-card-round-retry.png`，无任务或无多轮时标记 skipped |
| 配置页与 API key 区域 | `08-settings-full-page.png`、`09-settings-api-key-area.png` |

locator 断言包括：

| 断言 | 说明 |
| --- | --- |
| 搜索框存在 | `aria-label="搜索会话"` |
| 归档/删除入口可见 | `aria-label` 以 `归档 ` / `删除 ` 开头 |
| composer 在 viewport 内 | textarea bounding box 检查 |
| 消息气泡宽度不全屏 | 有消息时检查 inline bubble 宽度小于 viewport 的 86% |
| 轮次控件存在 | 有多轮任务时检查 `data-testid="task-round-switcher"` |

## API key 安全

脚本不会打印完整 API key。配置页只检查 API key 区域存在，并对报告文本做脱敏。

默认不执行真实 key 验证。如需只用无效短 key 验证失败提示，可显式开启：

```powershell
$env:BROWSER_SMOKE_TEST_INVALID_API_KEY="true"
pnpm local:test:browser-workspace
```

该模式只会输入 `bad` 并点击“验证连通性”，不会提交真实 key。

## 浏览器运行模式

脚本支持两种模式，执行入口保持不变：

```powershell
pnpm local:test:browser-workspace
```

### Playwright structured mode

优先模式。脚本会依次尝试：

- 当前项目/工作区可解析的 `playwright`
- `PLAYWRIGHT_MODULE_PATH` 指定的 Playwright 模块
- 本机常见 npm/pnpm 全局 `node_modules` 中的 `playwright`

可解析 Playwright 时，脚本执行结构化断言和截图，覆盖登录、工作台、会话列表、搜索过滤、composer、任务卡、配置页 API key 区域等检查。

### browser-use screenshot fallback

如果 Playwright 模块不可解析，脚本不会只因项目缺少 Playwright 依赖而失败。它会尝试使用本机 `browser-use`：

```powershell
uvx browser-use --help
browser-use --help
```

fallback 模式会先探测 API/Web 服务；服务不可达时报告明确的环境失败。服务可达时，使用 `browser-use` 打开关键页面并保存截图，报告中的 `Runtime mode` 为 `browser-use-screenshot-fallback`。该模式至少产出首页、登录页、创建页、配置页截图；若设置 `BROWSER_SMOKE_SESSION_ID`，还会截图指定工作台。

本机首次使用或排障：

```powershell
uvx browser-use doctor
uvx browser-use install
```

结构化 UI 断言只在 Playwright 可用时执行；browser-use fallback 用于保留关键视觉证据和环境报告，不替代完整断言。

## 推荐回归流程

```powershell
pnpm local:prepare
pnpm local:start
pnpm local:test:browser-workspace
```

若服务已经启动，可直接执行：

```powershell
pnpm local:test:browser-workspace
```

指定某个工作台会话：

```powershell
$env:BROWSER_SMOKE_SESSION_ID="conv_xxx"
pnpm local:test:browser-workspace
```

保留可视浏览器便于调试：

```powershell
$env:BROWSER_SMOKE_HEADLESS="false"
pnpm local:test:browser-workspace
```
