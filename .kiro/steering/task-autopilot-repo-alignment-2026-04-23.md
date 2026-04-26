---
inclusion: manual
---

# 任务自动驾驶与现有仓库对齐关系（2026-04-23）

## 2026-04-26 增补：Phase 1 已闭合

本文件原始判断仍然成立：`task-autopilot` 是现有 `mission-first` 主仓之上的产品投影层，不是第二套事实源。

但当前状态已经从“18 份 specs 待实现”推进为：

- `18 / 18` specs 已完成并收口
- `54 / 54` markdown 已完成
- `345 / 345` 顶层任务项已闭合
- `602 / 602` raw checklist 已闭合
- 第一条 compatibility-first 代码纵切已进入主线

当前已经落地的对齐锚点：

- `Mission -> Destination`
  - `shared/mission/autopilot.ts` 的 `parseMissionDestination()` 与 `MissionAutopilotSummary.destination`
- `Workflow / Mission stage -> Route`
  - autopilot route summary、candidate route、route selection / replan 字段
- `Runtime state -> Drive State`
  - `inferMissionAutopilotDriveState()` 与 server projection
- `Decision / HITL -> Takeover`
  - takeover summary、decision prompt、missing-info clarifications、operator actions
- `Runtime facts -> Evidence / Explanation`
  - evidence timeline、correlation index、recommendation details、remaining steps

仍需保持的边界：

- 不宣称开放域 L5。
- 不把 projection 等同于完整 runtime 自动化。
- 不以产品对象重命名替代 Mission / Workflow / Runtime 的事实主干。
- 下一阶段重点应转向 runtime 行为深化：parser 版本化、route planner 自动编队、fleet orchestration、takeover governance、evidence replay trust chain 与 success metrics。

## 目的

这份文档用于回答一个实际问题：`task-autopilot` 的 18 份 specs，不应该被理解成“另起一套新的任务平台”，而应该被理解成对现有 `mission-first` 主仓的一层上位产品抽象。

本文重点说明三件事：

1. `task-autopilot` 与现有 `README`、`project-overview`、`Mission Runtime`、`workflow runtime`、`HITL`、`replay`、`audit`、`lineage`、`Web-AIGC` 主线分别如何对齐。
2. 哪些 specs 主要是在复用现有底座做“产品投影和界面收口”。
3. 哪些 specs 虽然已有部分基础，但本质上仍属于待实现能力，不能写成“仓库已经完成”。

本文坚持一个前提：**compatibility-first**。

---

## Compatibility-First 结论

### 1. `task-autopilot` 是上位叙事，不是第二套事实源

当前仓库的事实主干已经很明确：

- `README` 与 `README.zh-CN` 把产品定位为 mission-first 的任务操作系统。
- `.kiro/steering/project-overview.md` 把系统主干定义为办公室主壳、任务工作台、Mission Runtime、workflow runtime、replay / audit / lineage 与 Web-AIGC 主线能力的组合。
- `Mission Runtime`、`workflow runtime`、`HITL`、`replay`、`audit`、`lineage`、`Web-AIGC` 都已经有各自的契约、路由、事件和测试证据。

因此，`task-autopilot` 更适合做成：

- 产品层：`Destination / Route / Drive State / Fleet / Takeover`
- 工程层：继续保留 `mission / workflow / runtime / decision / replay / audit`
- 中间层：通过映射、投影、聚合和 UI 收口把两层连接起来

### 2. 最强底座已经存在，但“自动驾驶一等对象”还没有完全成型

现有仓库已经能稳定承接以下能力：

- 任务创建、任务推进、结构化执行计划、真实执行器回调
- 图运行时、节点调度、`wait / resume`、`retry / terminate / escalate`
- 通用决策、审批、决策历史、飞书按钮、前端决策面板
- 回放时间线、完整性校验、任务投影到 replay
- 审计链、审计查询、异常检测、权限审计镜像
- 血缘模型、图查询、导出、relation index
- Web-AIGC built-in / extra adapters、runtime governance、session / instance / mission projection

但以下内容仍然没有形成“自动驾驶一等对象”：

- 统一的 `Destination` 结构
- 统一的 `Route` 对象和候选路线集合
- 统一的高层 `Drive State` 投影
- 面向用户的 `Fleet` 角色封装
- 跨 `runtime / replay / audit / lineage` 的自动驾驶证据主链
- 自动驾驶视角下的指标、置信度、偏航、重规划与恢复治理

### 3. 当前最容易误写过头的地方有两个

- 不应把当前 `lineage` 写成“runtime 事件已全量直写、与 replay / audit 完整闭环”。当前更准确的口径是：**lineage 模型、查询、导出和 relation index 已具备，但 runtime 直写仍属后续增强**。
- 不应把当前能力写成“已经达到 L4/L5 自动驾驶”。当前仓库已具备的是 mission-first 任务系统、图运行时、人工接管、回放审计与 Web-AIGC 主线能力，不是开放域全自动平台。

---

## 本文缩写

为避免矩阵过宽，下面使用以下缩写：

- `RD`：`README.md` 与 `README.zh-CN.md`
- `PO`：`.kiro/steering/project-overview.md`
- `MR`：`.kiro/specs/mission-runtime/`
- `WR`：`workflow runtime` 主线，重点是 `.kiro/specs/web-aigc-platform-runtime-engine/`
- `HITL`：`.kiro/specs/human-in-the-loop/`
- `RP`：回放主线，重点是 `.kiro/specs/collaboration-replay/` 与 `.kiro/specs/replay-and-debug-surface-v1/`
- `AU`：`.kiro/specs/audit-chain/`
- `LN`：`.kiro/specs/data-lineage-tracking/`
- `WA`：`web-aigc-platform-*` 主线能力，尤其是 runtime、mission projection、session instance、observability audit、security governance

判定标准：

- `底座强`：仓库已经有稳定事实源、事件流或页面承接，spec 主要做投影、产品化和收口。
- `底座中`：仓库已有部分基础，但仍缺统一对象、统一视图或端到端闭环。
- `待实现偏多`：仓库虽然能提供一些底层事实，但还没有形成该 spec 所需的一等能力。

---

## 现有仓库能力底座总表

| 仓库面 | 当前事实 | 对 task-autopilot 的意义 | 当前边界 |
| --- | --- | --- | --- |
| `RD` | 已明确 mission-first、办公室主壳、`/tasks`、`/replay/:missionId`、`/debug` 的角色边界；已写明 runtime 主线具备 built-in adapters、Web-AIGC extra adapters、`wait / resume` 与 replay / audit observability | 自动驾驶的产品叙事可以建立在现有“任务操作系统”之上，不需要推翻 README 主线 | README 仍然是“任务操作系统”口径，不是“任务自动驾驶平台”最终口径 |
| `PO` | 已明确 Mission Runtime、十阶段 workflow、回放、审计、血缘、Web-AIGC `58 / 58` 封板，以及后续待收口项：runtime adapter result、observability / lineage、HITL / Office 闭环、tools-and-agents 治理字段 | 自动驾驶所有 specs 都应把 `PO` 当作真实主线约束，而不是重新定义系统骨架 | `PO` 同时明确了多个未收口点，自动驾驶文档不能跳过这些现实边界 |
| `MR` | 已有六阶段状态机、结构化 `ExecutionPlan`、执行器派发、执行器回调、`markWaiting` / `POST /api/tasks/:id/decision`、任务驾驶舱、重启恢复 | `Destination`、`Drive State`、`Takeover` 的产品层语义，都可以从 Mission 主线投影出来 | `MR` 解决的是 mission 事实推进，不等于已经有了自动驾驶对象模型 |
| `WR` | 已有图执行、条件边推进、`WAITING_INPUT -> resume()`、`selection / confirm_judge / end` 内置节点、`terminate / retry / escalate` 控制面、`runtimeGovernance` 治理策略 | `Route`、高层 `Drive State`、局部恢复与自动驾驶编排，都应优先复用这条主线 | 循环闭环与 runtime 直写 lineage 仍未达到“完整完成”口径 |
| `HITL` | 已有决策类型、决策历史、模板、前端 `DecisionPanel`、飞书消息按钮、Socket 决策事件 | 自动驾驶里的 `Takeover Point` 可以直接建立在现有 HITL / decision 主线上 | 现有 HITL 仍偏“决策系统”，还不是统一的自动驾驶接管面板 |
| `RP` | 已有 mission 执行回放、时间轴、快照、完整性校验、任务详情到 replay 的入口；`/replay/:missionId` 与 `/debug` 边界已收口 | 自动驾驶证据链和驾驶时间线，最容易先落在 replay 这条面上 | 当前 replay 更擅长“发生了什么”，还不等于已经统一表达“为什么这样发生” |
| `AU` | 已有审计事件、哈希链、查询、验证、导出、异常检测、权限审计镜像 | 自动驾驶里的关键决策、接管、治理阻断和高风险动作，可以直接挂到审计主链 | 审计强在追责和完整性，不天然等于高层路线解释 |
| `LN` | 已有血缘节点、变换链、决策血缘、图查询、导出与审计集成约束 | 自动驾驶信任链可以把 lineage 当作来源追踪与影响分析底座 | 当前不应写成“runtime 事件已统一直写 lineage store” |
| `WA` | 已有图运行时、instance / session / mission projection、observability / audit relation index、高风险节点治理与 runtime governance | 自动驾驶里的路线执行能力、节点能力池、高风险治理与 mission 投影，最适合直接复用 Web-AIGC 主线 | `WA` 是能力池和图运行时，不应替代 Mission Runtime 成为新的产品真相源 |

---

## 18 份 task-autopilot specs 对齐矩阵

### A. 产品叙事与映射层

| Spec | 主要对齐锚点 | 判定 | 已具备底座 | 待实现重点 |
| --- | --- | --- | --- | --- |
| `task-autopilot-platform-positioning` | `RD / PO / WA` | 底座强 | 已有 mission-first、办公室主壳、任务工作台、回放审计与 Web-AIGC 主线，可以支撑“任务操作系统升级为任务自动驾驶平台”的叙事起点 | 统一一句话定位、对外边界、与 chat playground / workflow builder / agent platform 的差异口径；避免把现状写成开放域全自动 |
| `task-autopilot-core-concepts` | `PO / MR / WR / HITL` | 底座强 | 现有 `mission / workflow / runtime / decision` 模型已经完整存在，只是产品层词汇还未统一 | 明确 `Destination / Route / Drive State / Fleet / Takeover / Replan / Confidence / Risk` 的统一词汇表与映射关系 |
| `task-autopilot-levels-l1-to-l5` | `RD / PO / WR / HITL / WA` | 底座中 | 已有 `wait / resume`、`retry / escalate`、高风险节点治理、人工审批和回放审计证据，可以支撑分级标准落地 | 建立按任务域、风险、接管要求区分的等级矩阵；明确当前真实可宣称等级，不能把远期目标写成现状 |
| `task-autopilot-success-metrics` | `PO / MR / WR / RP / AU / WA` | 待实现偏多 | 已有 mission 事件、runtime 事件、replay / audit 关联索引、成本与遥测基础 | 统一定义送达率、接管率、重规划率、偏航率、用户确认次数、复核通过率，以及样本纳入 / 排除规则 |
| `mission-model-to-autopilot-model-mapping` | `RD / PO / MR / WR / HITL` | 底座强 | 现有工程对象已经稳定，尤其是 `Mission`、`Workflow`、`Runtime State`、`Decision` | 把 `Mission -> Destination`、`Workflow -> Route`、`Runtime State -> Drive State`、`Decision / HITL -> Takeover` 固化成统一映射层，避免后续各自解释 |

这一组的判断很明确：**仓库已经有事实主干，缺的是统一口径与投影层，不缺新的底层引擎**。

### B. 目标、路线、车队与驾驶舱层

| Spec | 主要对齐锚点 | 判定 | 已具备底座 | 待实现重点 |
| --- | --- | --- | --- | --- |
| `destination-model-and-parser` | `MR / HITL / WA / PO` | 待实现偏多 | 现有任务创建、workflow 输入、表单输入、等待澄清和决策提交都已存在 | 新增一等 `Destination` 对象、解析器、`successCriteria / missingInformation / confidence / assumptions` 等字段，并与 mission 输入映射 |
| `route-planner-and-route-model` | `WR / MR / WA / AU` | 待实现偏多 | 现有十阶段 workflow、图运行时、节点适配器、治理控制面都能充当路线执行骨架 | 形成一等 `Route` 对象、主路线与候选路线、快/稳/深差异解释、成本时长预估、风险点与接管点 |
| `drive-state-and-replan-state-machine` | `MR / WR / HITL / RP / AU` | 底座强 | 已有 mission 六阶段、workflow 节点状态、等待输入、重试、终止、升级、review / audit 等事实 | 把底层状态统一投影为高层 `Drive State`，并定义 `Replan` 与 `retry / escalate / resume` 的边界 |
| `fleet-organization-and-role-packaging` | `PO / WR / office-task-cockpit / WA` | 底座强 | 动态组织、角色、agent、skill、tool、executor、Web-AIGC 节点与 3D 办公室都已存在 | 把底层能力包装成 `Planner / Clarifier / Researcher / Generator / Reviewer / Auditor / Operator` 等面向用户的车队角色 |
| `autopilot-cockpit-information-architecture` | `RD / PO / office-task-cockpit / task-runtime-visibility-v1 / RP` | 底座中 | 现有桌面主壳、任务中台、运行证据区、`/replay` 与 `/debug` 边界已经收口 | 把办公室主壳升级为自动驾驶三栏驾驶舱，明确左侧目标路线、中间执行主视图、右侧接管与证据 |
| `destination-card-and-goal-summary` | `MR / PO / office-task-cockpit` | 底座中 | 已有任务摘要、任务详情、投影数据与上下文区域 | 新增面向自动驾驶的目标卡片，显式展示成功标准、约束、缺失信息、预期交付物和置信度 |
| `route-recommendation-and-selection` | `WR / HITL / RP / WA / AU` | 待实现偏多 | 已有 `selection / confirm_judge`、`wait / resume`、runtime governance 与多类节点能力池 | 把隐式路线规划升级为可见候选路线、推荐理由、切换规则、风险差异与接管点；并与回放、审计做证据关联 |
| `fleet-status-and-live-execution-view` | `MR / WR / task-runtime-visibility-v1 / office-task-cockpit / RP` | 底座强 | 已有步骤流、日志、artifact、executor 状态、场景 Agent 状态、Socket 事件与运行证据收口 | 用 `Fleet` 语义重新组织当前执行主视图，突出并行分支、阻塞点、中间产物和当前活跃角色 |
| `takeover-panel-and-decision-points` | `HITL / MR / WR / AU / WA` | 底座强 | 已有 `MissionDecision`、决策历史、`markWaiting`、`POST /api/tasks/:id/decision`、飞书接线、`WAITING_INPUT -> resume()` | 把现有 HITL 统一包装为 `Takeover Point` 模型，补预算确认、权限确认、风险接受、路线确认、异常接管等类型，以及默认动作 / 超时策略 |

这一组的核心判断是：**目标、路线和驾驶舱对象多数还不是一等对象，但执行事实和页面载体已经大多存在**。

### C. Runtime、解释、治理与证据层

| Spec | 主要对齐锚点 | 判定 | 已具备底座 | 待实现重点 |
| --- | --- | --- | --- | --- |
| `autopilot-runtime-orchestration` | `MR / WR / HITL / WA / AU` | 底座中 | 已有 Mission Runtime、workflow runtime、`wait / resume`、`retry / escalate`、runtime governance 与执行器接线 | 增加“自动驾驶编排层”，把 `Destination / Route / Fleet / Takeover` 稳定绑定到现有运行时；明确 `retry`、`replan`、`escalate` 的分工 |
| `autopilot-explainability-and-telemetry` | `PO / WR / RP / AU / LN / WA` | 待实现偏多 | 已有 runtime 事件、replay / audit 最小桥接、遥测仪表盘、监控兼容接口、relation index | 统一“现在在做什么、为什么这样做、还有几步、风险是什么、证据是什么”的解释层；补置信度、风险、剩余步骤和证据提示的统一模型 |
| `autopilot-recovery-and-human-takeover-governance` | `MR / WR / HITL / AU / WA` | 底座中 | 已有等待、恢复、重试、终止、升级、权限与成本治理、review / audit / verify 闭环 | 建立统一的偏航、失败、降级执行、人工接手、恢复后继续、异常升级策略；把这些策略变成用户可见、可审计、可回放的治理框架 |
| `autopilot-evidence-replay-and-trust-chain` | `RP / AU / LN / PO / WA` | 待实现偏多 | 已有 replay 时间线与完整性校验、audit 哈希链、lineage 模型与查询、任务投影到 replay 的闭环 | 构建统一的自动驾驶证据链模型，把 `drive_state_change / decision / route_change / takeover / tool_call / result` 串成一条主链；当前尤其要谨慎处理 runtime -> lineage 仍未完整直写的边界 |

这一组的结论是：**执行和治理的底座很强，但“自动驾驶解释层”和“统一证据主链”仍然主要是待实现能力**。

---

## 哪些是“已具备底座为主”，哪些是“待实现能力为主”

### 1. 已具备底座为主，优先做投影与收口

这些 specs 最适合先落地，因为它们不要求推翻现有主线：

- `task-autopilot-platform-positioning`
- `task-autopilot-core-concepts`
- `drive-state-and-replan-state-machine`
- `fleet-organization-and-role-packaging`
- `takeover-panel-and-decision-points`
- `mission-model-to-autopilot-model-mapping`
- `fleet-status-and-live-execution-view`

它们的共同特点是：

- 仓库里已经有足够稳定的事实源
- 主要工作是产品词汇、页面收口和运行时投影
- 与现有 `MR / WR / HITL / RP / AU / WA` 的兼容性最好

### 2. 已有部分底座，但需要新增一层统一编排或统一界面

这些 specs 适合在第一批投影完成后推进：

- `autopilot-cockpit-information-architecture`
- `destination-card-and-goal-summary`
- `autopilot-runtime-orchestration`
- `autopilot-recovery-and-human-takeover-governance`
- `task-autopilot-levels-l1-to-l5`

它们的共同特点是：

- 现有仓库能提供所需事实和控制面
- 但还缺用户态对象、统一策略层或统一驾驶舱结构
- 更适合在保持兼容的前提下做“中间层整合”，而不是直接重写

### 3. 待实现能力偏多，不应写成“仓库已具备”

这些 specs 的底层材料已经有一些，但一等能力还没有真正形成：

- `task-autopilot-success-metrics`
- `destination-model-and-parser`
- `route-planner-and-route-model`
- `route-recommendation-and-selection`
- `autopilot-explainability-and-telemetry`
- `autopilot-evidence-replay-and-trust-chain`

它们的共同特点是：

- 现有数据、事件、页面和路由可以提供原材料
- 但还没有统一对象、统一口径或统一端到端闭环
- 实现时需要新建模型、聚合器、解释层或指标层

---

## 对齐落地顺序建议

如果目标是务实推进，而不是先把文档写得很大，建议按下面顺序落地：

### 第一批：先把“产品层投影”立起来

- `mission-model-to-autopilot-model-mapping`
- `drive-state-and-replan-state-machine`
- `takeover-panel-and-decision-points`
- `fleet-organization-and-role-packaging`
- `fleet-status-and-live-execution-view`
- `autopilot-cockpit-information-architecture`

原因：

- 这批最能直接复用现有仓库事实
- 也是最能让自动驾驶叙事快速可见的一批
- 对现有 `/`、`/tasks`、`/replay` 的冲击最小

### 第二批：把目标和路线从隐式变成显式对象

- `destination-model-and-parser`
- `route-planner-and-route-model`
- `route-recommendation-and-selection`
- `autopilot-runtime-orchestration`

原因：

- 这批开始引入自动驾驶一等对象
- 需要同时碰产品层、runtime 层和治理层
- 适合在第一批完成后再做，避免前期对象定义漂移

### 第三批：补解释、证据与指标

- `task-autopilot-levels-l1-to-l5`
- `task-autopilot-success-metrics`
- `autopilot-explainability-and-telemetry`
- `autopilot-recovery-and-human-takeover-governance`
- `autopilot-evidence-replay-and-trust-chain`

原因：

- 这批最依赖前两批形成稳定对象和统一事件口径
- 也是最容易写大、写空、写过度承诺的一批
- 应该建立在已有对象和投影稳定后再推进

---

## 当前不建议做的事

为了保持 compatibility-first，当前不建议做以下动作：

1. 不要把 `mission / workflow / runtime / decision` 立即全量重命名成 `destination / route / drive / takeover`。
2. 不要为自动驾驶另起一套任务事实源、另一套 `/api/tasks`、另一套 replay 或另一套 audit。
3. 不要把 Web-AIGC 图运行时写成“替代 Mission Runtime 的新主平台”；当前更准确的定位是执行能力池和图运行时内核。
4. 不要把 `lineage` 写成已经与 runtime、replay、audit 完整三向闭环；当前只能写成“模型与查询已具备，直写仍在收口中”。
5. 不要在 `README`、steering 或对外口径里提前承诺 `L4 / L5` 自动驾驶、开放域全自动或无需接管。

---

## 最终口径

截至 2026-04-23，`task-autopilot` 最准确的仓库对齐关系是：

- **不是新平台替换旧平台**，而是对现有 mission-first 主仓的一层上位产品抽象。
- **不是重新发明运行时**，而是复用 `Mission Runtime + workflow runtime + HITL + replay + audit + lineage + Web-AIGC` 组合底座。
- **当前最强的是执行与治理底座**，最弱的是自动驾驶一等对象、统一解释层、统一指标层和统一证据主链。
- **第一阶段最应该做的是投影、收口和兼容映射**，而不是改名、拆底座、重写主线。

换句话说，`task-autopilot` 在本仓库中的正确落地方式，是：

**以现有仓库为底座，先把自动驾驶语言和界面投影出来，再逐步把目标、路线、接管、解释、证据和指标做成真正的一等能力。**

---

## 参考依据

本文主要基于以下现有文档与规格整理：

- `README.md`
- `README.zh-CN.md`
- `.kiro/steering/project-overview.md`
- `.kiro/steering/task-autopilot-spec-roadmap-2026-04-23.md`
- `.kiro/specs/mission-runtime/requirements.md`
- `.kiro/specs/human-in-the-loop/requirements.md`
- `.kiro/specs/collaboration-replay/requirements.md`
- `.kiro/specs/replay-and-debug-surface-v1/requirements.md`
- `.kiro/specs/audit-chain/requirements.md`
- `.kiro/specs/data-lineage-tracking/requirements.md`
- `.kiro/specs/web-aigc-platform-runtime-engine/requirements.md`
- `.kiro/specs/web-aigc-platform-observability-audit/requirements.md`
- `.kiro/specs/web-aigc-platform-mission-projection/requirements.md`
- `.kiro/specs/web-aigc-platform-session-instance/requirements.md`
- `.kiro/specs/web-aigc-platform-security-governance/requirements.md`
