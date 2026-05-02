# Round 3 QA 验收矩阵

适用基线：`v0.3.0`

目标：把 Round 3 的功能验收拆成可自动执行的 API smoke、真实浏览器 smoke、用户侧测试清单三层。QA worker 只维护测试脚本和测试文档，不修改业务实现。

## 1. 自动化入口

优先执行现有基础 smoke，再执行 Round 3 验收矩阵：

```powershell
pnpm local:test
pnpm local:test:smoke
pnpm local:test:round3
pnpm local:test:browser-workspace
pnpm local:test:semantic-image
```

`pnpm local:test:round3` 对应脚本：

```text
scripts/regression/round3-acceptance.mjs
```

输出路径：

```text
test-results/regression/round3-acceptance-latest.json
test-results/regression/round3-acceptance-latest.md
test-results/regression/round3-browser/
test-results/regression/browser-workspace-smoke/
test-results/regression/semantic-image-smoke/
```

可选环境变量：

```powershell
$env:ROUND3_API_BASE_URL="http://127.0.0.1:3000"
$env:ROUND3_WEB_BASE_URL="http://127.0.0.1:5173"
$env:ROUND3_MODEL="gpt-image-2"
$env:ROUND3_USER_EMAIL="demo@yunwu.local"
$env:ROUND3_USER_PASSWORD="demo123456"
```

真实浏览器工作台截图可复用：

```powershell
pnpm local:test:browser-workspace
```

说明文档见 `docs/qa/browser-workspace-smoke.md`。输出固定包含 `latest.json`、`latest.md` 和 `screenshots/*.png`。Playwright 可解析时运行结构化断言，覆盖工作台全页、会话列表、搜索过滤、切换会话、composer、任务卡轮次/重试、配置页 API key 区域；Playwright 不可解析时使用 `browser-use` 截图 fallback，保留关键页面截图和清晰环境报告。

如果站点或 provider 无法直连，先按本地环境要求配置代理；已知可用代理端口为 `7897`。

### Round 3 语义图片 smoke

`pnpm local:test:semantic-image` 默认是 `prepare` 模式，只生成输入图、预期说明和人工检查模板，不调用真实 provider。后端/前端 worker 修复后再执行真实模式：

```powershell
$env:SEMANTIC_IMAGE_SMOKE_MODE="run"
pnpm local:test:semantic-image
```

输出目录固定为：

```text
test-results/regression/semantic-image-smoke/
```

该目录必须保留以下证据：

| 证据 | 文件 |
| --- | --- |
| 请求摘要、任务 ID、模型、prompt、任务结果 | `request-summary.json` |
| 编辑图真实上传输入图 | `input-edit-source.png` |
| 文生图输出图 | `text-to-image-output-*.png` 或对应图片扩展名 |
| 编辑图输出图 | `edit-image-output-*.png` 或对应图片扩展名 |
| 人工看图判定表 | `manual-review.md` |
| 输出图检查页 | `inspection.html` |
| 文生图工作台截图 | `workspace-text-to-image.png` |
| 编辑图工作台截图 | `workspace-edit-image.png` |

语义图片 smoke 的通过条件不是 `succeeded`，而是“任务成功 + 输出图可下载/可打开 + 工作台截图已保存 + 人工看图符合预期”。编辑图拆分为 P0/P1：P0 验证上传图被真实使用、可识别主体保留、稳定视觉变化执行；P1 验证文字或细粒度指令跟随。P1 失败不能直接判定为“没读到图”。

## 2. 验收矩阵

| 功能点 | 自动化覆盖 | 真实浏览器覆盖 | 通过标准 | 失败严重性 |
| --- | --- | --- | --- | --- |
| 创建页提交 | `Create page submit API` | `/create` 输入提示词，提交后跳 `/workspace/:id` | 不提前创建空会话；提交成功返回任务和会话；页面跳转到工作台 | P0 |
| 文生图语义正确性 | `Semantic image smoke: text-to-image` | 打开输出图和工作台截图 | prompt 为“纯黄色背景，中间一个巨大的黑色字母 YW3，极简海报，无其他文字”；输出图必须主要是黄色背景、中央黑色 YW3、无其他文字或明显多余元素 | P0 |
| 上传编辑 | `Upload edit submit API` | `/create` 上传图片后能力切到图片编辑，提交 | 上传资产成功；任务 capability 为 `image.edit`；携带 `assetIds` | P0 |
| 编辑图 P0 读图与稳定编辑 | `Semantic image smoke: edit-image P0` | 对照输入图、输出图和工作台截图 | 必须使用真实上传的 `input-edit-source.png`；输出图保留红色方块和蓝色圆形，主体位置大体不变，背景改为绿色，并给红色方块加明显黑色描边 | P0 |
| 编辑图 P1 细节跟随 | `Semantic image smoke: edit-image P1 detail-following` | 对照输入图、输出图和工作台截图 | 尝试加入黑色文字 `EDIT` 或执行更细粒度文字指令；失败只记录 P1 语义偏差，不阻断 P0 读图验收 | P1 |
| 来源图再编辑 | `Source image re-edit API` | 从首页/历史/作品库点再编辑或继续创作 | 创建页带来源任务；提交携带 `sourceTaskId` 和 `sourceAction=edit` | P0 |
| 模型默认列表 | `Model default list` | 创建页、工作台、`/settings` 模型列表可见且默认启用指定模型 | `/api/models` 包含并默认启用 `gpt-image-2`、`gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`、`grok-4.2-image`、`grok-imagine-image-pro`；`flux-schnell` 不默认启用 | P0 |
| `base_url` 切换 | `User settings GET/PATCH base_url` | 普通用户打开 `/settings` 切换 Yunwu base_url | `/api/settings` GET/PATCH 可用；候选值只能是 `https://yunwu.ai` 与 `https://api3.wlai.vip`；不允许带 `/v1` | P1 |
| 配置页视觉 | `User settings GET/PATCH base_url` | `/settings` 普通用户配置页视觉检查 | base_url、主题/颜色、信息栏条数、默认模型开关信息清晰不溢出；不依赖 `/admin` | P1 |
| 首页最近项 | `Home recent items API` | `/` 查看最近会话、最近任务、最近作品 | 首页包含本轮新会话/任务；最近作品不展示软删除项 | P1 |
| 历史列表预览 | `History preview API` | `/history` 查看任务卡片和继续创作入口 | 历史包含本轮任务；卡片展示状态、模型、来源/失败摘要；继续创作可进入创建页 | P1 |
| 作品管理 | `Library management API` | `/library` 查看来源、继续创作、Fork、删除 | 作品库只展示成功作品；删除后作品库和首页最近作品移除；历史仍保留任务记录 | P2 |
| 工作台即会话管理 | `Workspace session management API` | `/workspace/:id` 和工作台会话列表切换 | 会话列表包含新会话；点击会话切换详情；提交后工作台和列表同步 | P0 |

## 3. 真实浏览器 smoke 路径

建议使用 Browser Use / in-app browser 执行，截图保存到：

```text
test-results/regression/round3-browser/
```

推荐截图命名：

```text
01-create-submit.png
02-upload-edit.png
03-source-reedit.png
04-model-default-list.png
05-settings-base-url-switch.png
06-settings-visual.png
07-home-recent.png
08-history-preview.png
09-library-management.png
10-workspace-session-management.png
11-semantic-text-to-image-workspace.png
12-semantic-edit-image-workspace.png
```

浏览器步骤：

1. 打开 `http://127.0.0.1:5173/login`，使用普通用户登录。
2. 打开 `/create`，输入提示词并提交，确认跳转到 `/workspace/:conversationId`。
3. 回到 `/create`，上传一张小图片，确认出现“按图片编辑处理”的提示，提交后进入工作台。
4. 从工作台、首页最近任务、历史页或作品库进入“再编辑/继续创作”，确认 URL 包含 `fromTaskId`，页面显示来源任务，提交后仍能回工作台。
5. 检查创建页、工作台 composer 和 `/settings` 的模型列表，确认默认模型严格为 `gpt-image-2`、`gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`、`grok-4.2-image`、`grok-imagine-image-pro`，且 `flux-schnell` 未默认启用。
6. 分别访问 `http://127.0.0.1:5173` 与 `http://localhost:5173`，登录后刷新页面，确认未因 cookie/CORS/base_url host 混用掉线。
7. 打开 `/settings`，检查普通用户配置页视觉，并切换 base_url 到 `https://yunwu.ai` 与 `https://api3.wlai.vip`；确认选项不带 `/v1`。
8. 打开 `/`，确认最近会话/最近任务包含刚才创建的记录。
9. 打开 `/history`，确认任务卡片包含预览、状态、来源和继续创作入口。
10. 打开 `/library`，若已有成功作品，执行查看来源、继续创作、Fork；删除一条作品后确认作品库和首页最近作品不再显示该作品。
11. 打开 `/workspace/:conversationId`，在会话列表中新建/切换会话，确认“工作台即会话管理”的列表和详情同步。

## 4. 图片语义验收流程

Round 3 起，用户侧图片测试必须看图，不允许只看 API 返回、任务状态或页面可达。

1. 先运行 prepare，生成本地输入图和检查模板：

```powershell
pnpm local:test:semantic-image
```

2. 后端/前端 worker 修复完成、provider 可真实生成后，运行真实语义 smoke：

```powershell
$env:SEMANTIC_IMAGE_SMOKE_MODE="run"
pnpm local:test:semantic-image
```

3. 打开 `test-results/regression/semantic-image-smoke/inspection.html`，逐张检查输出图。
4. 打开对应 `/workspace/:conversationId`，保存工作台截图到 `workspace-text-to-image.png` 和 `workspace-edit-image.png`。
5. 在 `manual-review.md` 勾选 PASS/FAIL，并填写失败分类。

文生图用例：

- Prompt：`纯黄色背景，中间一个巨大的黑色字母 YW3，极简海报，无其他文字`
- PASS：黄色背景占主体，中央巨大黑色 `YW3` 清晰可辨，没有其他文字、人物或复杂元素。
- FAIL_SEMANTIC：任务成功且有图，但不是黄色背景、没有 `YW3`、出现其他文字，或主体明显不符合。

编辑图 P0 用例：

- 输入图：脚本生成的 `input-edit-source.png`，包含红色方块、蓝色圆形、黑色 `INPUT`。
- Prompt：`保留红色方块和蓝色圆形，把背景改成纯绿色，并给红色方块加粗黑色描边，不要改变主体位置`
- PASS_P0：输出图能看出来自输入图，红色方块和蓝色圆形保留且位置大体不变，背景变绿，红色方块有明显黑色描边或边框强化。
- FAIL_PRODUCT：提交时没有真实上传资产、`assetIds` 丢失、输出图无法下载、工作台不展示结果，或任务成功但没有输出资产。
- FAIL_SEMANTIC：资产链路正常但模型忽略输入图、没有保留红色方块/蓝色圆形、没有绿色背景，或输出与 P0 稳定视觉变化明显不符。
- FAIL_UPSTREAM：任务失败信息明确来自 provider、网络、额度、认证、模型不可用或上游 5xx。

编辑图 P1 细节跟随用例：

- Prompt：`保留红色方块和蓝色圆形，把背景改成纯绿色，并在画面下方加入清晰黑色文字 EDIT`
- PASS_P1_DETAIL：在 P0 输入图主体和绿色背景成立的基础上，额外生成清晰黑色 `EDIT`。
- FAIL_SEMANTIC：未生成 `EDIT`、文字错误或位置不明显，只记 P1 细节跟随失败；如果 P0 已通过，不应据此判定“模型没读到输入图”。

## 5. 失败记录模板

```text
失败项：
严重性：P0/P1/P2
环境：API / Web URL / 浏览器 / 是否代理 7897
截图：
复现步骤：
实际结果：
期望结果：
建议修复策略：
```

严重性定义：

- P0：阻断主链路，创建、上传编辑、来源再编辑、模型列表、工作台会话不可用。
- P1：影响关键验收或用户信任，首页/历史/base_url/配置页信息异常。
- P2：非阻断但需修复，作品库空态、删除联动、视觉细节或文案问题。

## 6. 用户侧测试清单草案

交付用户前建议按以下顺序点测：

1. 登录普通用户，确认能进入首页、创建页、工作台、历史页、作品库和 `/settings`。
2. 在创建页直接提交一次文生图，确认自动进入新工作台；必须打开生成图片检查是否符合 prompt，不能只看 `succeeded`。
3. 上传图片后提交编辑，确认能力变为图片编辑且工作台出现新任务；必须对照输入图和输出图检查是否保留输入图主体。P0 看主体保留和稳定视觉变化，P1 再看文字等细节。
4. 从来源任务点再编辑，确认创建页预填来源信息，提交后来源链保留。
5. 检查模型下拉默认列表，确认默认启用模型严格为 `gpt-image-2`、`gemini-3-pro-image-preview`、`gemini-3.1-flash-image-preview`、`grok-4.2-image`、`grok-imagine-image-pro`，且 `flux-schnell` 未默认启用。
6. 用 `127.0.0.1` 和 `localhost` 各登录刷新一次，确认不会掉登录态。
7. 查看 `/settings` 普通用户配置页，确认 base_url 只能在 `https://yunwu.ai` 与 `https://api3.wlai.vip` 间切换，且不带 `/v1`。
8. 回首页确认最近会话、最近任务、最近作品更新。
9. 到历史页确认任务预览、失败提示和继续创作入口可用。
10. 到作品库确认查看来源、继续创作、Fork、删除符合预期。
11. 到工作台切换会话、新建会话、提交任务，确认会话列表和详情同步。
