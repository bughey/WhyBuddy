# 需求文档：Autopilot Agent Crew — Stage Activation Driver

## 简介

`/autopilot` 的 11 节点叙事（`docs/autopilot-target-experience-architecture-2026-05-07.svg`）与用户在诊断中提出的"架构图要求的 `伴随式 = 全流程陪跑，在不同阶段自动切换 active / watching / reviewing / sleeping`"这一核心口径要求：**Agent Crew 不能只在首批阶段预置四个 role 的静态 snapshot，后续阶段必须真实发出按阶段切换的 role 事件，并由明确的 `StageActivationPolicy` 驱动**。当前 `server/routes/blueprint.ts` 的 `createRouteGenerationSandboxDerivation()` 在路由生成时刻一次性通过 `buildAgentCrew()` / `buildRolePresence()` 产出一份覆盖全部阶段的静态 crew snapshot，`role.capability_invoked` / `role.review_completed` 等事件仅作为 fixture 在首批阶段发射一次，之后阶段进入时并不会针对每个 role 重新计算状态、也不会重新发 `role.activated` / `role.watching` / `role.reviewing` / `role.sleeping`。

本 spec 解决的就是这条"结构在、驱动没在"的主线缺口：**把路由生成时刻一次性落定的静态 role snapshot，升级为跟随沙箱派生管线（或下游阶段推进管线）实际进入 / 结束各阶段时逐阶段计算 role 状态并真实发射 `role.*` 事件的 Stage Activation Driver**。本 spec 是 4 个姊妹 capability-bridge spec（`autopilot-capability-bridge-docker` / `autopilot-capability-bridge-mcp` / `autopilot-capability-bridge-aigc-node` / `autopilot-capability-bridge-role`）之后，第一个**直接消费** sibling role bridge 结构化输出的下游驱动 spec；与前 4 个 capability 桥共享同一套 scope-boundary / Simulated Fallback / `executionMode` / `BlueprintServiceContext` DI / 不修改既有测试 / 新增测试门槛的收口模式。

本 spec 的 **主要输入**直接来自姊妹 spec `autopilot-capability-bridge-role`（`.kiro/specs/autopilot-capability-bridge-role/requirements.md`，见其 R3.1 / R3.6 / R4.6 / R9.3）：该桥产出结构化的 `roles: Array<{ id, label, responsibilities, activationStages, permissions? }>` JSON，与 `shared/blueprint/contracts.ts` 中 `BlueprintAgentRole` / `BlueprintRolePresence` 类型形态对齐，并保证可通过 `jobId` / `routeSetId` / `primaryRouteId` 从 evidence store 稳定检索到。本 spec 消费该结构化角色 JSON，按每个 role 的 `activationStages` 推导出 `BlueprintStageActivationPolicy`（或等价的 stage → role-state 映射），在 Mission Runtime / Workflow Runtime 的实际阶段生命周期钩子处（`stage_started` / `stage_completed` / 手动重试等）发射针对每个 role 的真实 `role.*` 事件；当姊妹桥本身回退到 `simulated_fallback`、或本 spec 在 evidence 检索 / 结构解析阶段失败时，本 spec 也必须**无缝回退到今天的模板化行为**（沿用现有静态 snapshot，或选择不发射额外事件），保证既有 `server/tests/blueprint-routes.test.ts` 中 47 条 E2E 与 48 条子域单测在默认测试装配下继续通过。

本 spec 是 4 个 capability-bridge spec 之后，**第一个可能需要扩展 `shared/blueprint/events.ts` 中 `BlueprintEventName` 常量命名空间的 spec**——与前 4 个桥 spec 只复用现有事件名不同，本 spec 的四态语义中 `role.sleeping`（或 `role.deactivated`）不在当前 `BlueprintEventName` 常量列表内（当前仅有 `RoleActivated` / `RoleWatching` / `RoleCapabilityInvoked` / `RoleReviewStarted` / `RoleReviewCompleted` / `RoleCompleted`），而用户诊断中明确要求 `sleeping` 作为退出阶段的独立状态。本 spec 明确允许（且在 design 阶段确认必要时**必须**）以**追加常量**方式扩展 `BlueprintEventName`，新增至少 `RoleSleeping: "role.sleeping"`；该扩展属于命名空间唯一收口的显式扩展，与前 4 个桥"只复用不新增"的约束形成刻意区分。

本 spec **不做**下列任何事：不做 4 个 capability 桥本身的任何改造（那 4 个 spec 各自推进）；不修改 `buildRouteSet()` 本身的候选路线推导（由 `autopilot-routeset-llm-generation` 推进）；不实现 SPEC Tree / SPEC Documents / Effect Preview / Prompt Package / Engineering Handoff 任一阶段的生成路径；不修改 Agent Crew 前端面板的 UI 订阅 / 渲染逻辑（属于下游前端 spec）；不新增外部 HTTP 契约；不修改既有 47 条 E2E + 48 条子域单测；不定义"阶段本身"是什么（直接消费 RouteSet 已有的 stage 划分，例如 `BlueprintGenerationStage` 枚举或 primary route 的 `stages` 数组）；不改动 GitHub Pages / Browser Runtime 相关路径。

本 spec 属于 Feature 类型，采用 requirements-first 工作流，本轮只产出 `requirements.md`，不产出 `design.md` 与 `tasks.md`。

## 术语表

- **Stage Activation Driver / 阶段激活驱动器**：本 spec 引入的新组件，负责消费姊妹 spec `autopilot-capability-bridge-role` 写入 evidence store 的结构化角色 JSON，构造 stage → role-state 映射，并在沙箱派生管线或下游阶段推进管线实际进入 / 结束各阶段时针对每个 role 真实发射 `role.*` 事件。建议的工厂函数命名为 `createAgentCrewStageActivationDriver(ctx)`，具体命名由 design 阶段确定。
- **Upstream Role Bridge / 上游角色桥**：指姊妹 spec `autopilot-capability-bridge-role` 产出的 `role-system-architecture` capability 证据产出路径，本 spec 的主要输入源。该桥在 real 路径下写入结构化角色 JSON 并保证可通过 `jobId` / `routeSetId` / `primaryRouteId` 回取（见该 spec R4.6 / R9.3）；在 `simulated_fallback` 路径下则沿用模板化产出。
- **Structured Role JSON / 结构化角色 JSON**：上游角色桥写入 evidence store 的 `roles` 数组及其相关可选字段，形态与 `BlueprintAgentRole` / `BlueprintRolePresence` 对齐，至少包含 `id` / `label` / `responsibilities` / `activationStages` / 可选 `permissions`。
- **`BlueprintStageActivationPolicy`**：`shared/blueprint/contracts.ts` 中已存在的类型，字段为 `stage: BlueprintGenerationStage` / `activeRoleIds: string[]` / `watchingRoleIds: string[]` / `reviewingRoleIds: string[]` / `sleepingRoleIds: string[]` / `overrides: BlueprintRoleActivationOverride[]`。本 spec 优先复用该类型作为 stage → role-state 映射的真相源；若 design 阶段判定现有类型无法承载某项派生信息，任何扩展必须以向后兼容的可选字段实现，且**不得**修改 `BlueprintStageActivationPolicy` 既有字段。
- **`BlueprintRolePresence` / `BlueprintAgentRole`**：`shared/blueprint/contracts.ts` 中已存在的角色存在态与角色类型。本 spec 只消费它们（以及姊妹桥输出的、形态向其靠拢的 JSON），**不得**修改类型定义本身。
- **`BlueprintRolePresenceState`**：`shared/blueprint/contracts.ts` 中已定义的枚举，取值 `"active" | "watching" | "reviewing" | "sleeping"`。本 spec 所有 `role.*` 事件的 `transition` 字段取值域严格对齐该枚举。
- **Stage Lifecycle Hook / 阶段生命周期钩子**：本 spec 需要订阅的阶段级事件源，典型实现为 `createRouteGenerationSandboxDerivation()` 及其下游阶段推进管线在每个 `BlueprintGenerationStage` 进入 / 结束时发出的 `BlueprintEventName.JobStage` 事件、或沙箱派生管线已有的 `sandbox.job.started` / `sandbox.job.completed` 与 capability 级事件的组合。具体挂接点由 design 阶段确定，但必须基于现有事件源，不得新增 HTTP 契约或独立进程。
- **Stage Transition**：本 spec 关注的三类阶段过渡事件：`stage_started`（某 stage 进入）、`stage_completed`（某 stage 完成）、以及可选的 `stage_retry` / `manual_override`（例如重试、手动重入）。本 spec 所有 `role.*` 事件的 `triggeredBy` 字段取值来自该集合。
- **Stage Attempt / 阶段尝试次数**：同一 stage 被多次进入（重试 / 手动重入）时的计数，从 1 起计；同一 `(roleId, stageId, stageAttempt)` 三元组下不得发出两次 `role.activated`（详见 R8）。
- **`BlueprintEventName.RoleSleeping`**：本 spec **可能**需要新增到 `shared/blueprint/events.ts` 的事件名常量；字面量建议为 `"role.sleeping"`，仅当用户诊断要求的 "sleeping" 语义不能用现有 `RoleCompleted` 等价表达时才新增。是否新增、以及最终字面量命名，由 design 阶段确认；若 design 判定 `RoleCompleted` 或其它现有常量足以表达 "exits a stage"，则本 spec 也可以完全不扩展 `BlueprintEventName`。
- **Real 驱动 / Real Activation**：本 spec 在上游角色桥处于 `executionMode === "real"`、结构化角色 JSON 可被检索并解析合法时走的主路径；该路径下本 spec 根据实际阶段推进真实发射 `role.*` 事件。
- **Simulated Fallback / 模拟回退**：上游角色桥处于 `simulated_fallback`、或 evidence 检索失败 / 结构解析失败 / `roles.length === 0` 时本 spec 回退到的路径；该路径下本 spec 要么沿用今天 `buildAgentCrew()` / `buildRolePresence()` 的静态 snapshot 行为（不新增 `role.*` 事件），要么按 design 选择在每个 stage 发射一个最小 `role.snapshot_fallback` 类型的降级事件（复用既有事件常量）。两种子方案由 design 阶段二选一，但本 spec 必须明确在 Simulated Fallback 路径下不得留下噪音事件影响既有测试。
- **`executionMode`**：本 spec 在 driver 自身的 provenance / 作业级元数据中新增的可选字段，取值 `"real"` 或 `"simulated_fallback"`，用于下游观测方判断本 driver 是否在实际驱动 role 事件。该字段命名与姊妹 4 个桥 spec 的 `executionMode` 字段语义一致，但对应对象不同（桥的字段落在 `BlueprintCapabilityInvocation.provenance`；本 driver 的字段落在 driver 级 provenance，具体落点由 design 阶段确定）。
- **Sandbox Derivation Pipeline / 沙箱派生管线**：`createRouteGenerationSandboxDerivation()` 生成 capability invocations / evidence / role timeline / `sandbox.job.*` 事件的这条管线。本 spec 不改外层编排、不改 4 个 capability 的 adapter 实现，只在管线阶段生命周期钩子上挂接 Stage Activation Driver 以补发真实 `role.*` 事件。
- **`BlueprintEventName`**：`shared/blueprint/events.ts` 导出的事件名常量命名空间。前 4 个姊妹桥 spec 明确约束 "不新增事件名、只复用现有常量"；本 spec **刻意放宽**这一约束：允许以追加常量方式显式扩展 `BlueprintEventName` 命名空间（仅当 design 阶段确认必要时），新增常量**仍然必须**通过命名空间统一出口访问，不得在 `server/routes/blueprint/` 目录下散落裸字符串字面量。
- **External HTTP Contract / 外部 HTTP 契约**：`POST /api/blueprint/jobs`、`POST /api/blueprint/generations` 的请求与响应结构；以 `server/tests/blueprint-routes.test.ts` 中 47 条 E2E 用例锁定的行为为准。
- **Subdomain Tests / 子域单测**：`server/routes/blueprint/*/service.test.ts` 等 co-located 子域单元测试共 48 条。

## 需求

### 需求 1：范围边界与独立性

**用户故事：** 作为 `/autopilot` 主线的维护者，我希望本 spec 有一条狭窄且可审核的范围边界，使它既能真正把 Agent Crew 从"静态 snapshot 预置"升级为"按阶段真实驱动的 role 事件流"，又不会踩到 4 个 capability 桥 spec 与其它下游 spec 的地盘、也不会被迫捆绑任何外部 HTTP 契约改造。

#### 验收标准

1.1 THE Feature_Scope SHALL 覆盖并且仅覆盖 "消费上游角色桥结构化 JSON → 构造 stage → role-state 映射 → 在阶段生命周期钩子上针对每个 role 发射真实 `role.*` 事件" 这一条链路；在上游桥不可用时回退到今天的模板化行为。

1.2 THE Feature_Scope SHALL NOT 修改姊妹 spec `autopilot-capability-bridge-role` 的证据产出路径、结构化角色 JSON schema 或其 evidence store 写入逻辑；本 spec 只消费该桥的输出。

1.3 THE Feature_Scope SHALL NOT 修改 `autopilot-capability-bridge-docker` / `autopilot-capability-bridge-mcp` / `autopilot-capability-bridge-aigc-node` 任一 capability 桥的 invocation / evidence 产出路径；这 3 个桥由各自独立 spec 推进。

1.4 THE Feature_Scope SHALL NOT 修改 `buildRouteSet()` 本身的候选路线推导逻辑；该项由前序 spec `autopilot-routeset-llm-generation` 推进。

1.5 THE Feature_Scope SHALL NOT 修改 SPEC Tree、SPEC Documents、Effect Preview、Prompt Package、Engineering Handoff 任一阶段的生成路径；这些由各自独立 spec 推进。

1.6 THE Feature_Scope SHALL NOT 修改 `createRouteGenerationSandboxDerivation()` 外层对 capability 的选择、排序、evidence aggregation、`sandbox.job.*` 事件总编排逻辑；本 spec 只在阶段生命周期钩子上挂接 driver 以补发真实 `role.*` 事件。

1.7 THE Feature_Scope SHALL NOT 删除或修改 `server/routes/blueprint.ts` 中现有的 `buildAgentCrew()` / `buildRolePresence()` 静态 snapshot 生成路径；该路径作为初始 crew snapshot 的产出方式保留，本 spec 只在其之上**叠加**按阶段真实驱动的 `role.*` 事件流。该共存关系的具体实现形态由 design 阶段确认，但 "不删除既有 snapshot 代码" 这一约束不可省略。

1.8 THE Feature_Scope SHALL NOT 修改 Agent Crew 前端面板（`/autopilot` 页面内 Agent Crew 区块）的 UI 订阅代码、渲染逻辑、视觉呈现；前端如何消费本 spec 新增的按阶段 role 事件流，由独立的前端 spec 推进。

1.9 THE Feature_Scope SHALL NOT 引入任何新的外部 HTTP 契约（新 route、新请求体字段、新响应字段）；已有 `POST /api/blueprint/jobs` / `POST /api/blueprint/generations` 保持不变。

1.10 THE Feature_Scope SHALL NOT 修改或删除 `server/tests/blueprint-routes.test.ts` 中原有 47 条 E2E 用例、48 条子域 co-located 单测或 SDK smoke 任一既有断言；本 spec 只新增用例，不改写既有用例。

1.11 THE Feature_Scope SHALL NOT 定义 "阶段" 本身的名称或划分；本 spec 直接消费现有 `BlueprintGenerationStage` 枚举以及 primary route 的 `stages` 数组，不引入新的 stage 语义。

1.12 THE Feature_Scope SHALL NOT 引入 Browser Runtime / GitHub Pages 相关改动；GitHub Pages 纯浏览器路径不承载服务端事件总线，不是本 spec 的承接对象（见 `.kiro/steering/2026-04-15-runtime-current-state.md`）。

1.13 THE Feature_Scope SHALL NOT 要求上游角色桥必须处于 real 路径作为产品功能的前置条件；上游可选，不可用时按需求 5 走 Simulated Fallback。

### 需求 2：消费上游结构化角色 JSON 并构造 stage → role-state 映射

**用户故事：** 作为 `/autopilot` 沙箱派生管线的运维者，我希望 Stage Activation Driver 不是用 hardcoded 角色列表跑，而是真的从上游角色桥的 evidence 里拿到针对当前目标 / 当前 RouteSet / 当前 primary route 规划出来的角色清单，并以此推导每个 stage 该让哪些 role 处于 `active` / `watching` / `reviewing` / `sleeping`。

#### 验收标准

2.1 WHEN 沙箱派生管线启动一轮作业，THE Stage_Activation_Driver SHALL 通过 `BlueprintServiceContext` 暴露的 evidence store 访问能力（具体接入点由 design 阶段确定）以 `jobId` / `routeSetId` / `primaryRouteId`（或姊妹 spec `autopilot-capability-bridge-role` R4.6 确定的等价语义键集合）作为 key 检索上游角色桥产出的结构化角色 JSON。

2.2 IF evidence 检索返回 404 / 空结果 / 格式不合法 / `roles` 字段缺失 / `roles.length === 0`，THEN THE Stage_Activation_Driver SHALL 进入需求 5 的 Simulated Fallback 路径，而不得构造空 policy 然后继续发射事件。

2.3 THE Stage_Activation_Driver SHALL 基于每个 role 的 `activationStages` 数组（以及，如可用，`BlueprintStageActivationPolicy` 的上游产出），为当前 primary route 覆盖的每个 `BlueprintGenerationStage` 构造一条 stage → role-state 映射；该映射至少区分 `active` / `watching` / `reviewing` / `sleeping` 四态。

2.4 WHERE 单次作业的 RouteSet 含有多条 primary route 候选（边缘情况），THE Stage_Activation_Driver SHALL 只对**已被选中**的 `primaryRouteId` 对应的 route 的 `stages` 做 stage → role-state 映射；未被选中的候选路线 stages 不进入 driver 的阶段生命周期订阅。

2.5 THE Stage_Activation_Driver SHALL 在沙箱派生管线实际进入 / 结束各阶段时（而不是在路由生成时刻）基于上一步构造出的 stage → role-state 映射逐阶段计算每个 role 的 transition；本 driver SHALL NOT 采用今天 `buildAgentCrew()` / `buildRolePresence()` 在路由生成时刻一次性落定全部阶段 role 状态的做法。

2.6 THE Stage_Activation_Driver SHALL 通过 `BlueprintServiceContext` 注入的依赖获取 evidence store 与 event bus 能力，SHALL NOT 在实现文件内 `import` 模块级 evidence store 单例、模块级 event bus 单例、文件系统客户端或数据库客户端；具体 DI 形态由 design 阶段确定（例如 Context 上新增可选 `evidenceStore` 字段，或复用既有 `ctx.storage` / `ctx.eventBus` 字段）。

2.7 WHERE design 阶段决定如何把多个 role 在同一 stage 的优先级（"lead" / "co-active" / "fallback"）编码进 stage → role-state 映射，THE Stage_Activation_Driver SHALL 基于可被 evidence 追溯的显式规则（例如：`activationStages` 数组首位、上游 JSON 中的显式 `leadStages` 可选字段、或已有 `BlueprintStageActivationPolicy.activeRoleIds` 的第一项）做出决策，SHALL NOT 引入基于时间戳 / 哈希等不可解释的"随机决策"。

### 需求 3：阶段过渡触发 role 事件发射

**用户故事：** 作为 Agent Crew 面板（以及 Artifact Replay、任务墙面 HUD 等事件流消费者）的未来接入方，我希望每个阶段进入与结束时，`role.*` 事件能真实反映这个阶段里每个 role 当前处于 `activated` / `watching` / `reviewing` / `sleeping` 的哪一态，而不是预置的 fixture。

#### 验收标准

3.1 WHEN 某个 `BlueprintGenerationStage` 在沙箱派生管线（或下游阶段推进管线）实际进入，THE Stage_Activation_Driver SHALL 针对当前 stage → role-state 映射中每一个 role 发射一条相应的 `role.*` 事件，事件名严格来自 `BlueprintEventName` 常量命名空间，依据该 role 在该 stage 的状态映射如下：
  - `active` → `BlueprintEventName.RoleActivated`（`"role.activated"`）
  - `watching` → `BlueprintEventName.RoleWatching`（`"role.watching"`）
  - `reviewing` → `BlueprintEventName.RoleReviewStarted`（`"role.review_started"`），或 design 阶段选定的等价"正在审阅"常量
  - `sleeping` → design 阶段选定的"退出 / 休眠"事件名常量；该名称**可能**是新增的 `BlueprintEventName.RoleSleeping`（`"role.sleeping"`），或复用现有的 `BlueprintEventName.RoleCompleted`（`"role.completed"`），详见需求 3.3。

3.2 WHEN 某个 `BlueprintGenerationStage` 在沙箱派生管线实际结束，THE Stage_Activation_Driver SHALL 针对在该 stage 属于 `active` 或 `reviewing` 态的每一个 role，根据其在**下一个即将进入**的 stage 中的映射状态发射对应转移事件；若该 role 在下一 stage 的映射状态为 `sleeping`（即脱离主活跃路径），则发射 3.1 中为 `sleeping` 选定的事件名，`transition` 字段取值 `"sleeping"`。

3.3 THE Feature SHALL 在 design 阶段就 "是否需要向 `shared/blueprint/events.ts` 的 `BlueprintEventName` 常量命名空间新增 `RoleSleeping` 常量" 做一次显式决策，两种结果都必须在 design 文档中说明理由：
  - 决策 A：新增 `BlueprintEventName.RoleSleeping: "role.sleeping"`，同时在 `BlueprintGenerationEventType` union 与 `resolveBlueprintEventFamily()` 映射中同步扩展；
  - 决策 B：不新增新常量，约定以 `BlueprintEventName.RoleCompleted` 表达"role 在本 stage 之后进入 sleeping 态"，并在事件 payload 中用 `transition: "sleeping"` 字段区分。
  无论最终采用哪个决策，本 spec 的所有 role sleeping 语义 SHALL 只能通过 `BlueprintEventName` 常量命名空间出口发射，不得在 `server/routes/blueprint/` 目录下以裸字符串字面量（例如 `"role.sleeping"`）方式构造事件 `type`。

3.4 THE Stage_Activation_Driver SHALL 在每条 `role.*` 事件的 payload 中携带至少以下字段：
  - `jobId: string`：当前作业标识；
  - `stageId: BlueprintGenerationStage`：当前阶段枚举值；
  - `roleId: string`：触发本条事件的角色标识；
  - `roleLabel: string`：角色显示名（与上游结构化角色 JSON 中 `label` 字段一致，或 design 阶段选定的等价字段）；
  - `transition: BlueprintRolePresenceState`：本次事件对应的目标状态，取值严格来自 `"active" | "watching" | "reviewing" | "sleeping"` 枚举（与 3.1 中事件名映射表对齐）；
  - `timestamp: string`：发射时刻 ISO8601 时间戳；
  - `triggeredBy: "stage_started" | "stage_completed" | "stage_retry" | "manual_override"`：本次事件的触发来源；
  - 可选 `stageAttempt?: number`：同一 stage 被多次进入时的计数（详见需求 8）。

3.5 THE Stage_Activation_Driver SHALL 通过 `BlueprintServiceContext.eventBus.emit(...)` 同步（不做 `setTimeout` / `queueMicrotask` 等异步推迟）发射 3.1 / 3.2 中定义的事件，以保证同一 stage 内多个 role 的事件按可预期顺序被下游消费；SHALL NOT 采用任何可能导致事件到达顺序与 stage 实际推进顺序不一致的推迟策略。

3.6 THE Stage_Activation_Driver SHALL 按**以 role 为外层、以 stage-transition 为内层**的稳定顺序发射事件：同一 stage 的多条 `role.*` 事件顺序由 design 阶段确定（例如按 role `id` 字典序、或按上游 `roles` 数组顺序），但该顺序在 real 路径下对于同一 (结构化角色 JSON, stage 序列) 输入必须完全可复现。

3.7 WHERE 某个 role 在当前 stage 的状态与上一 stage 完全一致（例如连续两个 stage 都处于 `watching`），THE Stage_Activation_Driver MAY 选择不发射重复事件以减少事件噪音，但**一旦**发射就必须遵循 3.4 的 payload 最小字段集要求；是否抑制等同状态事件由 design 阶段决定，但 real 路径与 Simulated Fallback 路径在该选择上必须一致。

### 需求 4：事件发射基础设施与持久化

**用户故事：** 作为依赖 replay / audit / 事件回放做调试的工程师，我希望 Stage Activation Driver 发出的 role 事件与其它 blueprint 事件一样能进入既有持久化 / 回放链路，而不是另造一套事件总线或单独的存储。

#### 验收标准

4.1 THE Stage_Activation_Driver SHALL 通过 `BlueprintServiceContext.eventBus`（或 design 阶段选定的 Context 上等价事件总线字段）发射所有 `role.*` 事件，SHALL NOT 在实现文件内直接 `import` 模块级 event bus 单例、或通过 `process.emit` / 全局 Node `EventEmitter` 绕过 Context。

4.2 THE Stage_Activation_Driver SHALL 保证每条 `role.*` 事件的 `type` 字段严格来自 `BlueprintEventName` 常量命名空间（含需求 3.3 可能新增的 `RoleSleeping`）；实现文件内 SHALL NOT 以裸字符串字面量（例如 `"role.activated"` / `"role.sleeping"`）方式构造 `type`。

4.3 THE Stage_Activation_Driver SHALL 使发射出的 `role.*` 事件通过既有 `jobStore.save()` / `createJobBackedReplayStore()`（或 design 阶段确认的等价 blueprint 作业持久化链路）被持久化与回放，SHALL NOT 引入新的事件持久化后端（例如新数据表、新文件格式、新远程服务）。

4.4 THE Stage_Activation_Driver SHALL 在同一 stage 过渡（例如"进入 stage X"）下发射的多条 `role.*` 事件之间保持同步调用栈完整性，即：上层 orchestrator 完成 "进入 stage X" 动作 → driver 同步发射该 stage 下所有 role 事件 → 再回到 orchestrator 继续推进；SHALL NOT 采用任何将事件发射推迟到下一事件循环 tick 或下一 stage 开始后的策略。

4.5 THE Stage_Activation_Driver SHALL 保持每条 `role.*` 事件 payload 的新增字段（`transition` / `triggeredBy` / `stageAttempt` 等）对既有订阅 `role.*` 事件的消费者保持向后兼容：作为可选或可扩展字段存在，既有消费者 SHALL NOT 因字段追加而断言失败。

### 需求 5：上游角色桥回退 / 结构不可用时的 Simulated Fallback

**用户故事：** 作为在本机没有配置 LLM API Key、或在默认测试装配下运行 CI 的工程师，我希望即便上游角色桥回退到 `simulated_fallback`、或本 driver 在 evidence 检索 / JSON 解析环节失败，沙箱派生照样能跑完，并在结果里清楚标注这次是回退产物而不是真实驱动。

#### 验收标准

5.1 IF 以下任一条件成立：
  - 上游 `autopilot-capability-bridge-role` 本轮作业中 `executionMode === "simulated_fallback"`；
  - evidence 检索抛出任意异常 / 返回空结果 / 返回非法结构（`roles` 字段缺失 / 类型错误）；
  - 结构化角色 JSON 解析得到 `roles.length === 0`；
  - 当前 `BlueprintServiceContext` 未注入 evidence store 访问能力（即 driver 无法完成 2.1 要求的检索）；
  THEN THE Stage_Activation_Driver SHALL 进入 Simulated Fallback 路径。

5.2 WHEN Stage_Activation_Driver 走 Simulated Fallback 路径，THE Feature SHALL 在该路径下**二选一**采用下列任一子方案，具体由 design 阶段决定：
  - 子方案 A：**不**发射任何额外 `role.*` 事件，沿用现有 `buildAgentCrew()` / `buildRolePresence()` 一次性静态 snapshot 产出（即保持今天行为）；
  - 子方案 B：在每个 stage 发射最多一条降级事件 `BlueprintEventName.CrewContextUpdated`（或 design 阶段选定的等价既有事件常量），payload 携带 `executionMode: "simulated_fallback"` 与今天 `buildRolePresence()` 产出的静态 snapshot 子集；**不得**发射任何 real 路径专属的 `role.*` 事件名。
  无论选择哪个子方案，Simulated Fallback 路径下发射的事件总数与形态都必须**不改变**既有 47 条 E2E + 48 条子域单测的断言结果。

5.3 THE Stage_Activation_Driver SHALL 在作业启动时的初始事件（例如 `BlueprintEventName.SandboxJobStarted` 的 payload 扩展，或在 driver 自身落位置的 provenance）中附加可选字段 `activationDriverExecutionMode: "real" | "simulated_fallback"`，使下游观测方能够判断本轮作业 driver 的生效路径；该字段作为可选字段存在，既有消费者 SHALL NOT 因其缺失或新增而断言失败。

5.4 WHEN Stage_Activation_Driver 走 Simulated Fallback 路径，THE Feature SHALL 保持 `BlueprintCapabilityInvocation` / `BlueprintCapabilityEvidence` / `BlueprintAgentCrew` / `BlueprintRolePresence` / `BlueprintRoleTimelineEntry` 既有外层字段形态与今天 simulated 产出完全等价，使既有 47 条 E2E + 48 条子域单测在默认装配（上游角色桥 LLM 未 mock → 桥回退 → 本 driver 回退）下继续通过。

5.5 IF `BlueprintServiceContext` 显式注入了一个总是抛错的 evidence store 访问器、或总是返回合法 JSON 但 `roles.length === 0` 的 fake evidence（用于测试场景），THEN THE Stage_Activation_Driver SHALL 按 Simulated Fallback 路径工作，且不得额外输出 noisy 日志或事件影响既有测试的稳定性。

5.6 THE Stage_Activation_Driver SHALL 仅通过**追加可选字段**的方式扩展需求 5.3 / 4.5 中提到的 provenance / payload 字段；不得删除、不得重命名现有字段，也不得把既有字段改为必填或变更类型。

### 需求 6：`BlueprintServiceContext` 依赖注入与可测试性

**用户故事：** 作为 Stage Activation Driver 的单元测试作者，我希望 driver 的实现完全通过 `BlueprintServiceContext` 拿到 evidence store、事件总线与阶段生命周期订阅点，这样我既能在没有 LLM 与没有 Docker 的机器上跑测试，也能在 CI 中注入 fake 适配器模拟 real-happy / upstream-simulated / evidence-missing / structured-json-malformed 四种场景。

#### 验收标准

6.1 THE Stage_Activation_Driver SHALL 被组织为一个工厂函数（建议 `createAgentCrewStageActivationDriver(ctx)`，具体命名由 design 阶段确定），其构造签名只接收 `BlueprintServiceContext`，而不接收模块级单例依赖。

6.2 THE Stage_Activation_Driver SHALL 通过 `BlueprintServiceContext` 获取 evidence store 访问能力、事件总线、以及（若 design 决定使用）阶段生命周期订阅钩子；实现文件内 SHALL NOT 直接 `import` 模块级 evidence store 单例或模块级 event bus。

6.3 THE Stage_Activation_Driver SHALL 可以被 `createRouteGenerationSandboxDerivation()` 外层 orchestration 在不破坏现有管线编排的前提下挂接；具体挂接形态（作为 Context 上新增的服务、作为传给 orchestrator 的 callback、作为 stage-transition observer 注册到既有订阅链）由 design 阶段确定，但挂接方式**不得**要求修改 `createRouteGenerationSandboxDerivation()` 外层的主干事件发射顺序、也不得要求把 4 个 capability 桥的内部实现暴露给 driver。

6.4 THE Stage_Activation_Driver SHALL 可以通过 `buildBlueprintServiceContext({ evidenceStore: fakeStore, eventBus: fakeBus, ... })`（或 design 阶段选定的等价注入入口）在端到端测试与子域单测中被替换为：
  - 返回合法结构化角色 JSON 的 fake evidence store；
  - 返回 404 / 空结果的 fake evidence store；
  - 返回合法 JSON 但 `roles.length === 0` 的 fake evidence store；
  - 总是抛错的 fake evidence store；
  - 上游 `executionMode === "simulated_fallback"` 的 fake 上下文。

6.5 THE Stage_Activation_Driver SHALL 支持在不实际访问外部 LLM 服务、不依赖真实 evidence 持久化后端、不启动 Docker 的前提下完成所有子域单测，只要测试端提供一个满足 Context 的 mock 装配。

6.6 WHERE design 阶段发现需要在 `BlueprintServiceContext` 上新增可选 `evidenceStore` / `stageLifecycleHook` 字段以承接本 driver 的 DI 需求，THE Feature SHALL 保持任何扩展向后兼容，即既有 `buildBlueprintServiceContext()` 调用在不注入新字段时依然能构造出合法 Context。

### 需求 7：向后兼容、静态 snapshot 共存与响应结构稳定性

**用户故事：** 作为已经在消费 `/api/blueprint/jobs` / `/api/blueprint/generations` 响应、或在依赖既有 E2E + 子域单测 + SDK smoke 的团队成员，我希望这次驱动升级对我完全是"按阶段叠加真实 role 事件、原有静态 crew snapshot 保留不变"，而不需要我改客户端或改测试。

#### 验收标准

7.1 THE External_HTTP_Contract SHALL 保持 `POST /api/blueprint/jobs` / `POST /api/blueprint/generations` 的 URL、HTTP 方法、请求体结构、以及既有响应体字段完全不变。

7.2 THE Feature SHALL 保持 `server/routes/blueprint.ts` 中现有的 `buildAgentCrew()` / `buildRolePresence()` 静态 snapshot 生成代码路径**不被删除**；本 spec 在其之上叠加按阶段真实驱动的 `role.*` 事件流，design 阶段必须明确两者的共存策略（例如 snapshot 作为初始 crew 状态，真实 `role.*` 事件作为阶段推进的增量更新）。

7.3 THE Feature SHALL 保持 `server/tests/blueprint-routes.test.ts` 中原有 47 条 E2E 用例与 48 条子域 co-located 单测在默认装配（上游角色桥未 mock → 桥 LLM 未可用 → 桥走 `simulated_fallback` → 本 driver 也走 Simulated Fallback）下继续通过，且 SHALL NOT 改写或删除这 95 条用例中的任一条以迁就 real 路径行为。

7.4 THE Feature SHALL 保持 `client/src/lib/blueprint-api/` 目录下 SDK smoke 现有通过状态；real 路径新增的 `role.*` 事件（以及 `activationDriverExecutionMode` 等可选 provenance 字段）作为可选新增内容存在，SDK 侧 normalizer 若需要扩展必须以追加方式实现，不得修改既有 normalizer 的输出语义。

7.5 IF 在实现过程中发现必须修改 `server/tests/blueprint-routes.test.ts` 或任一既有子域单测才能让 real 路径通过，THEN THE Feature SHALL 视该情况为违反本需求，必须调整实现而不是调整测试。

7.6 THE Feature SHALL 保持 Mission Runtime / Workflow Runtime / tasks-store / Office Task Cockpit / GitHub Pages Browser Runtime 的现有 API 与行为不变；GitHub Pages 预览仍按 browser-only 口径说明，不承载本 feature 的事件总线发射路径。

### 需求 8：确定性与幂等性

**用户故事：** 作为对回放一致性有要求的调试者，我希望同一份结构化角色 JSON + 同一条 stage 序列输入下，driver 发出的 role 事件在数量、内容、顺序上都是完全一致的；如果某个 stage 被重试，事件会带上明确的尝试次数而不是产生难以解释的重复记录。

#### 验收标准

8.1 WHEN 同一份结构化角色 JSON + 同一条 stage 序列输入，Stage_Activation_Driver 在 real 路径下 SHALL 发射出**数量相同、顺序相同、`type` 相同、`transition` 相同、`roleId` 相同** 的一组 `role.*` 事件；事件的 `timestamp` 字段可以不同（因为记录真实时间），但其它所有字段必须完全一致。

8.2 WHEN 同一个 `stageId` 被多次进入（例如失败后重试、手动重入），THE Stage_Activation_Driver SHALL 对该 stage 在每一次进入时重新发射完整的一组 `role.*` 事件，每条事件的 payload MAY 携带可选字段 `stageAttempt: number`（从 1 起计，单调递增）；但 SHALL NOT 对同一 `(roleId, stageId, stageAttempt)` 三元组发射两条 `role.activated`（或其它同名事件）。

8.3 THE Stage_Activation_Driver SHALL 在 Simulated Fallback 路径下也维持确定性：同一份（初始静态 snapshot, stage 序列）输入下发射的事件数量与 payload 字段形态必须完全一致（`timestamp` 除外），使测试断言可以基于 payload 子集做稳定匹配。

8.4 THE Stage_Activation_Driver SHALL 在未收到任何 stage 生命周期钩子信号前（例如作业刚启动但尚未进入第一个 stage）不发射任何 `role.*` 事件；事件发射严格与阶段实际推进绑定。

8.5 THE Stage_Activation_Driver SHALL 在作业最终完成（`BlueprintEventName.SandboxJobCompleted`）或失败（`BlueprintEventName.SandboxJobFailed`）后不再发射任何 `role.*` 事件；若 design 决定在作业结束时发一条"整 crew 收尾"事件，必须复用既有 `BlueprintEventName.RoleCompleted` 常量而不新增常量。

### 需求 9：测试门槛与不在范围内事项

**用户故事：** 作为代码评审人，我希望在评审阶段就能按照一组明确、可核对的测试清单判断本 spec 是否到位，以及哪些周边改动必须被排除在本 spec 之外；我尤其希望能看到 3 条分别锁定 real-path / fallback-path / 确定性的 E2E 证据，以及至少 4 条围绕 driver 本身的 co-located 单测。

#### 验收标准

9.1 THE Feature SHALL 在 `server/tests/blueprint-routes.test.ts` 中至少新增 3 条 E2E 用例：
  - **(a) Real-path with role JSON**：通过 `buildBlueprintServiceContext` 注入一个让上游角色桥 `callJson` 返回合法结构化角色 payload 的 fake，让沙箱派生管线跑完全部 stage，断言响应或对应 replay timeline 中包含针对每个 role 的按阶段 `role.*` 事件，其 `type` 严格来自 `BlueprintEventName` 常量命名空间、`transition` / `stageId` / `roleId` / `triggeredBy` 字段值与输入结构化角色 JSON 一致；
  - **(b) Fallback path**：通过注入让上游角色桥回退到 `simulated_fallback` 的 fake `callJson`（或让 evidence 检索失败），断言本 spec 走 Simulated Fallback 路径，事件流符合需求 5.2 中 design 阶段选定的子方案（不发额外事件 **或** 每 stage 一条降级事件），并且 `activationDriverExecutionMode === "simulated_fallback"`（或 design 阶段确认的等价 provenance 字段）可见；
  - **(c) Determinism**：同一份结构化角色 JSON + 同一条 stage 序列作为输入，连续运行 2 次，断言两次发出的 `role.*` 事件序列在除 `timestamp` 外的所有字段上完全一致。

9.2 THE Feature SHALL 在 Stage Activation Driver 实现文件所在目录新增至少 4 条 co-located 单元测试：
  - **stage → state 映射**：给定一份合法结构化角色 JSON，断言 driver 推导出的 stage → role-state 映射与预期完全一致（至少覆盖 `active` / `watching` / `reviewing` / `sleeping` 四态）；
  - **stage 推进触发**：mock 阶段生命周期钩子依次发出 `stage_started` / `stage_completed` 信号，断言 driver 按预期顺序发出对应 `role.*` 事件，且事件 `triggeredBy` 字段准确反映来源；
  - **evidence 不可用回退**：fake evidence store 返回 404 或 `roles.length === 0`，断言 driver 进入 Simulated Fallback 路径、不发射 real 路径专属事件、且 `executionMode === "simulated_fallback"`；
  - **stage 重试幂等性**：模拟同一 `stageId` 被进入两次，断言两次各自完整发一组 `role.*` 事件、`stageAttempt` 字段（若 design 采纳）分别为 1 与 2，且同 `(roleId, stageId, stageAttempt)` 不被重复发射。

9.3 THE Feature SHALL NOT 引入 property-based test（PBT）；本 spec 的验收完全以 example-based test 为准。

9.4 THE Feature SHALL NOT 改动 `server/tests/blueprint-routes.test.ts` 中原有 47 条 E2E 用例、48 条子域 co-located 单测、SDK smoke 中任一既有断言；本 spec 只以新增方式补测试。

9.5 THE Feature SHALL NOT 引入 UI 改动作为验收条件；Agent Crew 面板是否消费新增的按阶段 `role.*` 事件流属于独立前端 spec 的范围。

9.6 THE Feature SHALL NOT 引入 Web-AIGC runtime main line、task-autopilot Phase 1 本 spec 之外的运行时 / 治理 / observability 主线改动作为验收条件；这些主线由各自 steering 推进，本 spec 只保证不引入新的倒退。
