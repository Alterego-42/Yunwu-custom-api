# Implementation Plan

## 1. 任务拆分原则

- 本文档用于 `round-2-personal-user` 的 Phase 3 任务拆分，按“先收口共享基线，再分模块并行，最后统一联调”组织。
- 任务默认面向多个 subagent 并行执行；凡是会修改同一热点文件（如 `schema.prisma`、路由入口、共享类型）的内容，统一收敛到单独任务包，避免并行冲突。
- 每个任务均要求同时给出代码落点、依赖关系、最小验收标准与测试落点，便于 PM / Tech Lead / 工程负责人联审后直接分派。

## 2. 实施任务包

### A. 共享基线与数据模型

- [ ] T01 锁定数据模型与共享契约基线
  - 目标：一次性完成本轮所有底层模型与共享类型扩展，避免后续任务反复争抢 `schema.prisma` 与共享 DTO。
  - 模块 / 文件范围：`apps/api/prisma/schema.prisma`、`apps/api/prisma/migrations/*`、`packages/shared/src/types.ts`、`packages/shared/src/index.ts`、必要时 `apps/web/src/lib/api-types.ts`
  - 关键实现：补齐 `User.role/passwordHash/passwordUpdatedAt`、`Task.sourceTaskId/sourceAction`，明确 `Conversation.metadata.forkedFromConversationId/forkedFromTaskId` 的约定，并同步共享枚举/类型。
  - 依赖：无
  - 并行说明：T01 完成并合入后，再放开 T02 / T05 / T08 / T10，避免 Prisma 与共享类型冲突。
  - 验收标准：Prisma migration 可生成并通过；不新增独立作品表；旧数据兼容策略写清楚且不阻断现有管理员链路。
  - _关联需求：R1、R7、R8、R9、R10_

### B. 认证与身份边界

- [ ] T02 改造后端认证服务为数据库账号体系
  - 目标：把现有 `admin/demo` 内建登录升级为“数据库用户 + 自签 Cookie”，并兼容内建账号落库。
  - 模块 / 文件范围：`apps/api/src/auth/auth.service.ts`、`apps/api/src/auth/auth.controller.ts`、`apps/api/src/auth/auth.guard.ts`、`apps/api/src/auth/auth.types.ts`、`apps/api/src/auth/dto/login.dto.ts`、新增 `apps/api/src/auth/dto/register.dto.ts`、`apps/api/src/config/configuration.ts`、`apps/api/package.json`
  - 关键实现：新增 `POST /api/auth/register`；调整 `POST /api/auth/login`、`GET /api/auth/me`、`POST /api/auth/logout`；Cookie payload 切换为 `userId + role`；引入 `argon2`；启动阶段确保 `admin/demo` 标准化落库。
  - 依赖：T01
  - 并行说明：完成后可与 T05 并行推进；前端鉴权接线建议等 T02 接口稳定后开展。
  - 验收标准：普通用户可自注册、自登录；`/admin` 仍只允许 `admin`；旧 demo/admin 账号不丢失。
  - _关联需求：R1、R10_

- [ ] T03 完成前端鉴权上下文与登录/注册入口接线
  - 目标：让前端具备独立注册页、登录后原路返回、前后台导航分离的能力。
  - 模块 / 文件范围：`apps/web/src/lib/auth.tsx`、`apps/web/src/lib/api-client.ts`、`apps/web/src/lib/api-types.ts`、`apps/web/src/app.tsx`、`apps/web/src/pages/login-page.tsx`、新增 `apps/web/src/pages/register-page.tsx`、`apps/web/src/components/layout/app-shell.tsx`
  - 关键实现：补齐注册 API Client；统一未登录跳转与 `state.from` 恢复；区分普通用户与管理员导航入口；首页不再承载工作台默认入口。
  - 依赖：T02
  - 并行说明：可与 T10 合并执行，或拆成“鉴权上下文 / 页面 UI”两个子分支，但应保持同一负责人收口 `app.tsx`。
  - 验收标准：访客访问受保护页会跳转登录；注册成功后进入首页；管理员仍可进入 `/admin`。
  - _关联需求：R1、R10_

- [ ] T04 认证链路自动化回归
  - 目标：为认证改造建立最小自动化护栏，避免后续联调阶段反复回退登录态问题。
  - 模块 / 文件范围：`apps/api/package.json`、新增 `apps/api/test/auth.*` 或 `apps/api/src/auth/*.spec.ts`；如前端补测试则涉及 `apps/web/package.json`、新增 `apps/web/src/lib/auth*.test.tsx`
  - 覆盖场景：注册成功、重复邮箱、密码错误、Cookie 失效、`admin/demo/member` 角色边界、登录后原路返回。
  - 依赖：T02、T03
  - 并行说明：可在接口冻结后独立执行，不阻塞业务代码继续开发。
  - 验收标准：认证关键路径可通过单独命令回归；失败时能定位到后端或前端责任面。
  - _关联需求：R1、R10_

### C. 任务链路、失败恢复与来源关系

- [ ] T05 改造任务创建链路，支持懒创建、原会话继续与 fork
  - 目标：把 `POST /api/tasks` 升级为兼容首次创建、原会话继续创作、显式 fork 新会话的统一入口。
  - 模块 / 文件范围：`apps/api/src/api/dto/create-task.dto.ts`、`apps/api/src/api/api.controller.ts`、`apps/api/src/api/api.service.ts`、`apps/api/src/tasks/task-queue.service.ts`、`apps/api/src/tasks/task-events.service.ts`、必要时 `packages/shared/src/types.ts`
  - 关键实现：`conversationId` 改为可选；支持 `sourceTaskId/sourceAction/fork`；首次提交自动懒创建会话；fork 时写入 `Conversation.metadata` 且保留来源链。
  - 依赖：T01
  - 并行说明：T05 与 T02 可并行，但与 T06 共享任务 DTO，建议由同一后端子组连续完成。
  - 验收标准：上传素材不生成空会话；首次提交成功后拿到新 `conversationId`；原会话继续与 fork 会话分流正确。
  - _关联需求：R3、R4、R8、R9_

- [ ] T06 统一暴露任务详情、失败分类与前台重试语义
  - 目标：让首页、工作台、历史页、创建页能使用同一套 failure/source 数据，不再各自猜测业务规则。
  - 模块 / 文件范围：`apps/api/src/api/api.service.ts`、`apps/api/src/api/api.types.ts`、`apps/api/src/tasks/task-execution.service.ts`、`apps/api/src/tasks/task-queue-recovery.service.ts`、`apps/api/src/tasks/dto/task-status.dto.ts`、`packages/shared/src/types.ts`
  - 关键实现：任务详情返回完整 `prompt/model/assetIds/params`；补齐 `failure.category/retryable/title/detail/statusCode`；把 `POST /api/tasks/:id/retry` 从管理员专用调整为“任务所有者或管理员可用”；`retry` 新建任务但不覆盖原任务。
  - 依赖：T05
  - 并行说明：完成后再让前端开始失败恢复与参数回填接线，避免前端重复写临时映射。
  - 验收标准：系统类失败可一键重试；内容类失败可用于创建页参数回填；来源链能识别 retry / edit / variant / fork。
  - _关联需求：R4、R7、R8、R9_

- [ ] T07 任务链路与失败恢复后端测试
  - 目标：覆盖本轮最容易回归的后端主流程：懒创建、继续创作、fork、retry、参数回填。
  - 模块 / 文件范围：`apps/api/package.json`、新增 `apps/api/test/tasks.*` 或 `apps/api/src/api/*.spec.ts`、`apps/api/src/tasks/*.spec.ts`
  - 覆盖场景：无 `conversationId` 首次创建、原会话继续创作、fork 新会话、系统类失败 retry、新旧任务链路、内容类失败详情回填、权限校验。
  - 依赖：T05、T06
  - 并行说明：可独立于前端执行，建议在前端大规模接线前先跑通。
  - 验收标准：任务链核心接口具备最小集成测试；失败时能明确定位是 schema、service 还是 DTO 问题。
  - _关联需求：R3、R4、R7、R8、R9_

### D. 首页 / 历史 / 作品库聚合接口

- [ ] T08 实现首页、历史页、作品库聚合查询与软删除接口
  - 目标：为前台多页拆分提供稳定聚合 API，避免前端自己拼 4 套查询与过滤逻辑。
  - 模块 / 文件范围：`apps/api/src/api/api.controller.ts`、`apps/api/src/api/api.service.ts`、`apps/api/src/api/api.types.ts`、必要时 `apps/api/src/api/dto/*`、`packages/shared/src/types.ts`
  - 关键实现：新增 `GET /api/home`、`GET /api/history`、`GET /api/library`、`DELETE /api/library/assets/:id`；作品库查询排除 `Asset.status=deleted`，工作台/历史追溯查询不做全局过滤。
  - 依赖：T01、T06
  - 并行说明：T08 完成后可并行启动 T13（前端列表页）与 T09（接口测试）。
  - 验收标准：首页可返回最近会话/最近任务/最近作品/失败恢复卡片；历史页能带来源链摘要；作品删除为软删除且不影响任务追溯。
  - _关联需求：R2、R5、R6、R7、R9_

- [ ] T09 聚合接口与软删除回归测试
  - 目标：给多页聚合接口加护栏，重点防止“软删除误伤历史链路”。
  - 模块 / 文件范围：`apps/api/package.json`、新增 `apps/api/test/home-history-library.*` 或对应 `.spec.ts`
  - 覆盖场景：首页最近内容聚合、历史页状态分类、作品库仅显示成功且未删除作品、删除后列表消失但来源任务仍可打开、管理员链路不受影响。
  - 依赖：T08
  - 并行说明：可与前端列表页开发并行。
  - 验收标准：接口过滤边界被自动化验证；不会把 `deleted` 过滤扩散到工作台或历史追溯。
  - _关联需求：R2、R5、R6、R9_

### E. 前端路由壳层与页面骨架

- [ ] T10 重构前端路由树与登录后主壳层
  - 目标：把当前“首页即工作台”改造成“多页职责分层”的稳定入口，并收口路由热点文件。
  - 模块 / 文件范围：`apps/web/src/app.tsx`、`apps/web/src/components/layout/app-shell.tsx`、新增 `apps/web/src/pages/home-page.tsx`、`apps/web/src/pages/create-page.tsx`、`apps/web/src/pages/history-page.tsx`、`apps/web/src/pages/library-page.tsx`
  - 关键实现：建立 `/`、`/create`、`/workspace/:conversationId`、`/history`、`/library`、`/login`、`/register`、`/admin` 路由树；保留 `RequireAuth/RequireAdmin`；首页改为用户入口页。
  - 依赖：T03
  - 并行说明：T10 完成后，T11 / T12 / T13 才能稳定并行，避免多人同时改 `app.tsx`。
  - 验收标准：前端路由结构与设计稿一致；后台 `/admin` 保持独立；未登录跳转与壳层导航正常。
  - _关联需求：R1、R2、R3、R5、R6、R10_

- [ ] T11 创建页与 Composer 复用改造
  - 目标：让 `/create` 成为独立创作起点，同时复用现有表单能力承接参数回填与首次提交。
  - 模块 / 文件范围：`apps/web/src/pages/create-page.tsx`、`apps/web/src/components/chat/composer.tsx`、`apps/web/src/lib/api-client.ts`、`apps/web/src/lib/api-types.ts`、必要时 `apps/web/src/lib/api-mappers.ts`
  - 关键实现：支持文生图 / 上传图编辑两种模式；接收 `fromTaskId/mode/fork` 预填；上传素材阶段不创建空会话；首次提交后跳转 `/workspace/:conversationId`。
  - 依赖：T05、T06、T10
  - 并行说明：与 T13 可并行；与 T12 共用 `api-client` 时需先约定请求/响应字段。
  - 验收标准：创建页能独立完成首次创作、失败回填继续、来源任务预填。
  - _关联需求：R2、R3、R7、R8、R9_

- [ ] T12 工作台 URL 驱动化与继续创作交互接线
  - 目标：把当前 `WorkspacePage` 从内部状态驱动改造成 URL 驱动，并接上继续创作、fork、失败恢复统一 CTA。
  - 模块 / 文件范围：`apps/web/src/pages/workspace-page.tsx`、`apps/web/src/components/chat/session-list.tsx`、`apps/web/src/components/chat/chat-panel.tsx`、`apps/web/src/components/chat/detail-panel.tsx`、`apps/web/src/components/cards/task-card.tsx`、`apps/web/src/components/cards/image-result-card.tsx`、`apps/web/src/lib/api-client.ts`
  - 关键实现：用 `conversationId` 路由参数驱动当前会话；处理 SSE 重连与切换清理；结果卡片补“再编辑 / 生成变体 / fork 新会话 / 下载 / 查看来源”；失败卡片按 failure 类型展示不同 CTA。
  - 依赖：T06、T10、T11
  - 并行说明：建议单独分给熟悉现有工作台状态机的负责人，避免与列表页任务互相阻塞。
  - 验收标准：原会话继续创作默认不跳新会话；显式 fork 才新建会话；失败恢复 CTA 语义与首页/历史页保持一致。
  - _关联需求：R4、R7、R8、R9_

- [ ] T13 首页、历史页、作品库页面接线
  - 目标：完成三类聚合页 UI 与交互落地，承接“开始创作 / 回流最近内容 / 回看历史 / 管理作品”。
  - 模块 / 文件范围：`apps/web/src/pages/home-page.tsx`、`apps/web/src/pages/history-page.tsx`、`apps/web/src/pages/library-page.tsx`、`apps/web/src/lib/api-client.ts`、`apps/web/src/lib/api-types.ts`、必要时新增页面级卡片组件
  - 关键实现：首页展示最近作品/最近任务/最近会话/失败恢复；历史页展示时间线与状态分类；作品库提供预览、下载、删除、查看来源、继续创作、fork。
  - 依赖：T08、T10
  - 并行说明：可与 T11、T12 并行；但涉及共享卡片组件时需提前约定复用方式。
  - 验收标准：三页各自职责边界清晰，不退化成后台列表；跨页跳转来源关系不丢失。
  - _关联需求：R2、R5、R6、R7、R8、R9_

- [ ] T14 前端页面级测试与类型回归
  - 目标：为多页路由改造建立最小前端自动化护栏，并把关键交互沉淀为可复跑回归。
  - 模块 / 文件范围：`apps/web/package.json`、如需新增 `apps/web/vitest.config.ts`、`apps/web/src/test/setup.ts`、新增 `apps/web/src/pages/*.test.tsx`、`apps/web/src/lib/*.test.tsx`
  - 覆盖场景：受保护路由跳转恢复、注册成功进入首页、创建页上传不生成空会话、工作台继续创作留在原会话、fork 跳新工作台、作品删除后只从作品库消失、失败卡片 CTA 分流。
  - 依赖：T11、T12、T13
  - 并行说明：接口契约稳定后可独立推进；若本轮无法完整落地组件测试，至少要完成路由与状态映射层测试。
  - 验收标准：前端关键行为可通过自动化或最小可维护测试脚本复跑；`pnpm --filter @yunwu/web lint` 不回退。
  - _关联需求：R1-R9_

### F. 联调、回归与发布收口

- [ ] T15 执行端到端联调与人工回归矩阵
  - 目标：按产品主链路验证“自注册 -> 开始创作 -> 继续创作 -> 删除作品 -> 历史追溯 -> 失败恢复”整条闭环。
  - 模块 / 文件范围：以联调记录为主；必要时补充 `README.md` 或 `specs/round-2-personal-user/tasks.md` 的执行状态，不额外扩散业务代码改动。
  - 回归场景：自注册后进入首页；首次创建懒创建会话；上传图编辑成功后继续创作仍在原会话；显式 fork 新会话；作品软删除仅影响作品库；系统类失败 retry；内容类失败参数回填；管理员 `/admin`、provider 检查、worker、SSE 不回退。
  - 依赖：T04、T07、T09、T14
  - 并行说明：建议由独立联调 owner 执行，不与功能开发混编。
  - 验收标准：P0 主链路全部走通，缺陷按阻塞级别归类，形成上线前问题清单。
  - _关联需求：R1-R10_

## 3. 关键回归点

- [ ] RG1 自注册、登录、退出、原路返回完整可用，且普通用户不可见后台能力。
- [ ] RG2 创建页上传素材不会创建空会话；首次提交成功后才懒创建会话并跳转工作台。
- [ ] RG3 工作台内“再编辑 / 生成变体”默认沿用原会话；仅显式 `fork` 才新建会话。
- [ ] RG4 系统类失败走一键重试且创建新任务；内容类失败走参数回填；配置异常展示不可用说明。
- [ ] RG5 作品软删除只影响作品库与首页最近作品陈列，不影响工作台、历史页、来源追溯。
- [ ] RG6 历史页、作品库、工作台跨页跳转后仍能识别来源任务、重试链与 fork 链。
- [ ] RG7 `/admin`、Provider 检查、测试生图、Worker 执行链、SSE 推流不因前台改造回退。

## 4. 风险门禁

- [ ] G1 `apps/api/prisma/schema.prisma` 与迁移目录只允许在 T01 收口；后续任务不得私自追加并行 schema 改动。
- [ ] G2 `Asset.status=deleted` 的过滤只能出现在作品库/首页最近作品查询，不得抽成全局资产过滤器。
- [ ] G3 `POST /api/tasks` 在前端全部切换完成前必须兼容旧调用形态，避免工作台历史入口整体失效。
- [ ] G4 工作台路由 URL 化后，必须验证 SSE 订阅释放、切换会话重连、轮询兜底三件事同时成立。
- [ ] G5 认证 Cookie payload 切换为 `userId + role` 后，必须准备统一重新登录方案并回归 `admin/demo` 兼容。
- [ ] G6 前端多页拆分期间，`apps/web/src/app.tsx` 与 `apps/web/src/components/layout/app-shell.tsx` 只能由单任务包收口，避免路由冲突。
- [ ] G7 聚合接口上线前，首页/历史/作品库的状态文案、CTA 语义必须与工作台保持一致，禁止同一失败类型在不同页面出现不同动作承诺。

## 5. 建议执行顺序

- [ ] S1 先完成 T01，冻结 Prisma 与共享类型基线。
- [ ] S2 并行推进 T02（认证后端）与 T05（任务链后端）。
- [ ] S3 在 T02 稳定后推进 T03、在 T05/T06 稳定后推进 T08。
- [ ] S4 以 T10 收口前端路由壳层，再并行展开 T11、T12、T13。
- [ ] S5 各模块测试任务 T04 / T07 / T09 / T14 完成后，再执行 T15 联调回归。
