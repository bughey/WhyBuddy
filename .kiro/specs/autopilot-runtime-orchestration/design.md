# 设计文档：任务自动驾驶 Runtime 编排层

## 设计概述

任务自动驾驶 Runtime 编排层的职责，不是替换现有 `Mission Runtime`、`workflow runtime` 或 `wait-resume / retry-escalate` 机制，而是把它们组织成一条可解释、可治理、可回放的自动驾驶主线。

这条主线可以概括为：

```text
Destination
  -> Route
  -> Fleet
  -> Execute
  -> Takeover / Retry / Escalate / Replan
  -> Deliver
```

其中：

- `Mission Runtime` 负责承载任务生命周期与六阶段推进；
- `workflow runtime` 负责承载阶段、节点、分支、等待与执行事实；
- `wait-resume` 负责承接结构化人工输入与恢复；
- `retry-escalate` 负责承接恢复性重试、人工升级与异常兜底；
- Runtime 编排层负责把上面这些能力连接起来，并稳定投影为自动驾驶语义。

## 设计目标

- 让 `Destination / Route / Fleet / Takeover` 不再只是概念或界面文案，而是可落到真实运行时的编排对象。
- 让 Mission 六阶段主线与 Route、Fleet、Takeover 形成可解释映射。
- 明确 `wait-resume`、`retry`、`escalate`、`replan` 的边界，避免恢复语义混乱。
- 为驾驶舱、回放、审计、治理提供统一的 runtime 解释层。
- 在不破坏当前主仓稳定性的前提下，采用“映射优先、投影优先、兼容优先”的落地路径。

## 总体分层

### 第一层：产品语义层

这一层负责用户可理解的自动驾驶对象：

- `Destination`
- `Route`
- `Fleet`
- `Takeover`
- `Drive State`

这一层解决的是“系统准备去哪、怎么走、谁来走、什么时候交还给人”。

### 第二层：Runtime 编排层

这一层负责绑定、控制与投影：

- `Destination` 到 Mission 的绑定；
- `Route` 到 workflow runtime 的绑定；
- `Fleet` 到 agents / skills / nodes / executors 的绑定；
- `Takeover` 到 waiting / decision / approval / resume / escalate 的绑定；
- `retry / replan / terminate` 的控制决策；
- 面向 cockpit / replay / audit 的统一投影。

这一层解决的是“用什么现有能力来把自动驾驶语义真正跑起来”。

### 第三层：执行事实层

这一层是当前主仓已经存在的执行真实来源：

- `Mission Runtime`
- `workflow runtime`
- `MissionDecision / HITL / approval`
- `WAITING_INPUT -> resume()`
- `retry / escalate / terminate`
- agents / nodes / adapters / executors
- logs / artifacts / callbacks / evidence

这一层解决的是“系统实际上做了什么”。

### 第四层：证据与消费层

这一层承接编排结果与执行事实：

- cockpit
- task detail
- replay
- audit
- telemetry

这一层解决的是“用户和运营如何看懂这一趟任务行驶过程”。

## 总体架构

```text
用户目标
  -> Destination Parser
  -> Runtime Orchestration Layer
      -> Destination Binder
      -> Route Runtime Mapper
      -> Fleet Binder
      -> Takeover Bridge
      -> Recovery Coordinator
      -> Projection Builder
  -> Mission Runtime
  -> workflow runtime
  -> wait-resume / decision / approval
  -> retry / escalate / terminate
  -> replay / audit / telemetry / cockpit
```

设计原则：

- 编排层是“组织层”，不是“替换层”。
- Mission Runtime 继续是任务生命周期事实主干。
- workflow runtime 继续是阶段、节点、等待、恢复的事实执行器。
- `Takeover` 必须复用已有等待与决策链路。
- `Route` 必须通过映射落地，而不是直接替代 workflow 图。
- `Fleet` 必须对外展示角色，对内保留到底层执行资源。

## 编排主线

## 1. 接收目标

用户输入首先被解析为 `Destination`。编排层在这一阶段负责：

- 创建或绑定 Mission；
- 归一化目标、约束、成功标准、缺失信息与预期交付物；
- 判断是否可以直接进入路线规划；
- 若信息不足，生成澄清类 `Takeover`。

与 Mission Runtime 的对应关系：

- `receive`：接收原始请求，创建 Mission 事实对象；
- `understand`：理解 `Destination`，补齐上下文与缺失信息；
- `plan`：准备路线规划与后续 runtime 绑定。

## 2. 选择路线

一旦 `Destination` 足够明确，编排层会选择当前生效的 `Route`。

这一阶段负责：

- 接收 Route Planner 生成的 Route Set；
- 选定主路线或处理用户路线确认；
- 生成 Route 到 workflow runtime 的映射；
- 生成风险点、接管点和重规划前置条件。

与现有 runtime 的关系：

- `Route` 是执行计划层对象；
- `workflow runtime` 是执行图与节点事实层；
- 编排层负责把前者映射到后者，而不是让两者直接互相取代。

## 3. 组建车队

在 Mission 的 `provision` 阶段，编排层根据 `Route` 选择并绑定 `Fleet`。

这一阶段负责：

- 把高层角色映射到底层 agent / skill / node / executor；
- 准备所需 adapter、权限、外部能力与资源配额；
- 根据 Route 模式和风险策略调整编队规模与治理强度；
- 把资源不足、权限不足、预算不足等问题转换为 `Takeover` 或升级信号。

## 4. 执行路线

在 Mission 的 `execute` 阶段，workflow runtime 负责真实执行，编排层负责：

- 跟踪当前 Route Stage 与 Route Step；
- 跟踪当前 Fleet 哪些角色在工作、阻塞或等待；
- 判断当前处于正常执行、等待接管、局部重试、重规划还是升级；
- 将真实运行信号投影为 `Drive State` 与前端可读状态。

## 5. 复核与交付

在 Mission 的 `finalize` 阶段，编排层负责：

- 把 review / audit / verify / revise 归并到 `reviewing` 和最终交付链路；
- 如需结果验收，生成交付类 `Takeover`；
- 如质量不达标，决定进入局部修正、重试还是重规划；
- 在交付完成后收口证据、工件与路线结果。

## 核心对象模型

建议为编排层定义一组兼容型对象，用于服务端 projection、view model 或聚合查询，而不是替代底层 schema。

### RuntimeOrchestrationRecord

```ts
type RuntimeOrchestrationRecord = {
  id: string;
  missionId: string;
  destinationId: string;
  selectedRouteId?: string;
  driveState: string;
  status: "preparing" | "running" | "waiting" | "replanning" | "done" | "failed";
  destinationBinding: DestinationRuntimeBinding;
  routeBinding?: RouteRuntimeBinding;
  fleetBinding?: FleetRuntimeBinding;
  takeoverQueue: TakeoverRuntimeBinding[];
  controlState: OrchestrationControlState;
  evidenceRefs: string[];
  createdAt: string;
  updatedAt: string;
};
```

### DestinationRuntimeBinding

```ts
type DestinationRuntimeBinding = {
  missionId: string;
  goalSummary: string;
  constraintsSummary: string[];
  successCriteriaSummary: string[];
  missingInfo: string[];
  deliverablesSummary: string[];
  missionStageHint: "receive" | "understand" | "plan" | "provision" | "execute" | "finalize";
};
```

### RouteRuntimeBinding

```ts
type RouteRuntimeBinding = {
  routeId: string;
  routeMode: "fast" | "standard" | "deep" | "custom";
  workflowDefinitionId?: string;
  workflowInstanceId?: string;
  stageMappings: RouteStageRuntimeBinding[];
  stepMappings: RouteStepRuntimeBinding[];
  activeRouteStageId?: string;
  activeRouteStepId?: string;
  replanHistory: RouteReplanBinding[];
};
```

### FleetRuntimeBinding

```ts
type FleetRuntimeBinding = {
  fleetId: string;
  roles: FleetRoleRuntimeBinding[];
  activeRoleIds: string[];
  blockedRoleIds: string[];
  executorRefs: string[];
  capabilityRefs: string[];
};
```

### TakeoverRuntimeBinding

```ts
type TakeoverRuntimeBinding = {
  takeoverPointId: string;
  type: string;
  blocking: boolean;
  missionDecisionId?: string;
  runtimeDecisionRef?: string;
  waitingStateRef?: string;
  escalationRef?: string;
  routeId?: string;
  routeStepId?: string;
  status: "pending" | "active" | "resolved" | "expired" | "escalated" | "cancelled";
};
```

### OrchestrationControlState

```ts
type OrchestrationControlState = {
  lastAction:
    | "run"
    | "wait"
    | "resume"
    | "retry"
    | "escalate"
    | "terminate"
    | "replan";
  retryScope?: "node" | "step" | "route";
  retryBudgetRemaining?: number;
  blockedReason?: string;
  nextExpectedAction?: string;
};
```

这些对象的设计目标是：

- 对外提供稳定投影；
- 对内保持与现有事实对象的关联；
- 允许未来逐步下沉为更正式的服务端实体；
- 当前阶段不要求直接重构底层 Mission / workflow schema。

## 核心映射设计

### 1. `Destination -> Mission Runtime`

`Destination` 的职责是告诉系统“要去哪”，Mission Runtime 的职责是把这趟任务真正纳入生命周期推进。两者的关系不是替换，而是承载与投影。

建议映射如下：

| 自动驾驶对象 | 运行时承载对象 | 说明 |
| --- | --- | --- |
| `destination.goal` | mission title / summary / objective | 任务目标摘要 |
| `destination.constraints` | mission metadata / plan context | 时间、预算、权限、风格、范围约束 |
| `destination.successCriteria` | finalize / review / verify checks | 最终结果达标依据 |
| `destination.missingInfo` | clarification takeover / waiting | 缺失信息必须显式进入澄清链路 |
| `destination.deliverables` | artifacts contract / delivery summary | 预期交付物与最终产物对齐 |

阶段映射原则：

- `receive`：接收请求，建立 Mission 事实对象。
- `understand`：构建 `DestinationRuntimeBinding`，补齐目标与上下文。
- `plan`：在 `Destination` 已清晰的前提下生成并选择 `Route`。

关键原则：

- 不要求 `Mission` 被重命名为 `Destination`。
- `Destination` 是用户可理解的目标层对象，Mission 是执行主干承载对象。
- `Destination` 的变化必须影响运行时，而不是只改前端文案。

### 2. `Route -> workflow runtime`

`Route` 的职责是说明“准备怎么走”，workflow runtime 的职责是“具体怎么执行”。编排层的关键工作，就是把前者稳定映射到后者。

建议映射如下：

| 自动驾驶对象 | 运行时承载对象 | 说明 |
| --- | --- | --- |
| `Route` | workflow definition / workflow instance | 当前选中的执行路径 |
| `Route Stage` | workflow phase / mission stage hint | 用户可读阶段与底层阶段的桥 |
| `Route Step` | workflow node / node group / adapter action | 产品层步骤到执行单元的映射 |
| `Route Risk` | governance rule / runtime policy | 风险影响执行与接管策略 |
| `Route TakeoverPoint` | decision point / waiting input / approval | 接管点进入现有人工链路 |

设计原则：

- 一个 `Route Step` 可以映射到多个底层节点。
- 多个 `Route Step` 也可以共同落在同一 workflow phase。
- `Route` 是计划对象，workflow 是执行图对象。
- `Route` 的变更必须进入 `replanHistory`，而不是静默覆盖旧值。

### 3. `Fleet -> agent / skill / node / executor`

`Fleet` 的职责是解释“由谁来走”，底层 runtime 负责真实执行。编排层必须把用户可理解的角色，与底层执行资源稳定连接。

建议映射如下：

| Fleet 角色 | 运行时承载对象 | 说明 |
| --- | --- | --- |
| Planner | manager / planning agents / planning nodes | 负责规划与组织 |
| Clarifier | input collection / user-input / decision nodes | 负责澄清与参数补齐 |
| Researcher | search / retrieval / knowledge nodes | 负责检索与研究 |
| Generator | generation / transform / writing nodes | 负责内容或结果生成 |
| Reviewer | review / verify / judge nodes | 负责复核与校验 |
| Auditor | audit / lineage / governance units | 负责治理与审计 |
| Executor | browser / sandbox / native / external executor | 负责真实执行与副作用 |

设计原则：

- `Fleet` 对外展示角色，对内保留到底层执行资源。
- 一个角色可以绑定多个 node / agent / executor。
- 角色绑定可以随 `Route` 或 `Replan` 动态变化。
- `Fleet` 必须与 Mission 的 `provision` 和 `execute` 阶段直接相关，而不是单纯视图包装。

### 4. `Takeover -> wait-resume / decision / approval / escalate`

`Takeover` 的职责是说明“什么时候该把方向盘交还给人”，而现有 runtime 已经具备等待、决策、审批、恢复与升级能力。编排层的职责是统一这些入口。

建议映射如下：

| Takeover 类型 | 运行时落点 | 说明 |
| --- | --- | --- |
| `clarification` | `markWaiting()` / `WAITING_INPUT` / `resume(payload)` | 缺失信息补齐 |
| `route_confirmation` | decision 提交后选择 route / trigger replan | 路线确认或切换 |
| `budget_confirmation` | approval / governance / resume | 预算确认 |
| `permission_confirmation` | capability approval / grant / deny | 权限确认 |
| `risk_acceptance` | decision + audit evidence | 风险接受 |
| `delivery_acceptance` | finalize waiting / revise / done | 交付验收 |
| `exception_takeover` | `retry / escalate / terminate / replan` | 异常接管 |

关键原则：

- 阻塞型 `Takeover` 必须驱动真实 waiting 状态。
- 非阻塞建议接管可以以队列方式展示，但仍需可审计。
- 用户提交后，不是简单关闭弹窗，而是驱动真实 `resume`、`replan`、`retry` 或 `escalate` 动作。

## 与 Mission 六阶段的关系

runtime 编排层建议直接挂接 Mission 六阶段主线：

| Mission 阶段 | 编排层职责 | 自动驾驶对象主角 |
| --- | --- | --- |
| `receive` | 接收目标、建立 Mission、初始化编排记录 | `Destination` |
| `understand` | 理解目标、整理上下文、识别缺口 | `Destination`、`Takeover` |
| `plan` | 生成路线、选择路线、建立 runtime 映射 | `Route` |
| `provision` | 组建车队、准备资源、校验能力与权限 | `Fleet` |
| `execute` | 沿路线执行、等待、恢复、重试、升级 | `Route`、`Fleet`、`Takeover` |
| `finalize` | 复核、验收、交付、收口证据 | `Takeover`、`Destination` |

这使得 Mission Runtime 继续承担生命周期主干，而编排层承担高层语义解释与控制组织。

## 控制动作设计

编排层必须以有限控制动作来统一现有 runtime 主线。

### `run`

语义：

- 沿当前 `Route` 继续执行。

典型场景：

- 路线已选定；
- 车队已完成绑定；
- 当前没有阻塞型接管；
- 当前不需要重规划。

### `wait`

语义：

- 进入等待用户或外部决策的阻塞态。

典型场景：

- 缺失信息；
- 预算、权限、风险或路线确认；
- 结果待验收。

运行时映射：

- Mission waiting；
- runtime `WAITING_INPUT`；
- decision / approval pending。

### `resume`

语义：

- 接收用户输入后恢复当前执行。

典型场景：

- 澄清已回答；
- 预算已批准；
- 权限已授予；
- 交付已验收或要求修正。

运行时映射：

- `resolveWaiting()`；
- `resume(payload)`；
- orchestrator decision submit。

### `retry`

语义：

- 在当前 Route 与当前高层策略不变的前提下，对局部执行单元重试。

典型场景：

- 幂等工具失败；
- 短暂依赖不可用；
- 节点超时但仍可恢复。

关键限制：

- `retry` 不改变当前 `Route`。
- `retry` 不应吞掉需要显式解释的重规划。

### `escalate`

语义：

- 升级到人工或更高权限处理。

典型场景：

- 重试预算耗尽；
- 权限、预算、风险超过自动处理边界；
- 结果偏航且需要人工兜底。

运行时映射：

- `escalate()`；
- exception takeover；
- operator / approval / manual intervention。

### `terminate`

语义：

- 主动终止当前 Mission 或当前执行路径。

典型场景：

- 用户拒绝继续；
- 风险不可接受；
- 关键依赖永久不可用。

### `replan`

语义：

- 改写当前路线，而不是在原路径上继续硬撑。

典型场景：

- 用户修改目标或约束；
- 当前路线连续失败；
- review 发现质量不达标；
- 风险、成本、时延超阈值；
- 用户在接管中选择切换路线。

关键限制：

- `replan` 必须保留旧路线与差异记录。
- `replan` 可以触发新的 `Fleet` 绑定。

## `wait-resume`、`retry-escalate` 与 `replan` 的边界

这是 runtime 编排层最关键的边界定义。

### 适合 `wait-resume` 的场景

- 需要补充缺失信息；
- 需要用户确认路线；
- 需要预算、权限、风险接受或结果验收；
- 任务本身并未换路，只是等待外部输入。

### 适合 `retry` 的场景

- 当前步骤仍然合理；
- 当前路线仍然成立；
- 失败原因是局部且可恢复的；
- 重试不会显著改变任务策略与成本结构。

### 适合 `escalate` 的场景

- 高风险动作需要人工兜底；
- 重试预算耗尽；
- 系统无法安全决定下一步；
- 需要更高权限、人工审批或人工接管。

### 适合 `replan` 的场景

- 当前路线前提已失效；
- 用户目标、约束、优先级发生变化；
- 结果质量与成功标准明显不匹配；
- 局部重试已经不能解决结构性问题。

建议决策矩阵：

| 触发情况 | 编排决策 | 运行时动作 |
| --- | --- | --- |
| 缺失成功标准 | 等待接管 | `wait -> resume` |
| 权限未授权 | 等待或升级 | `wait` 或 `escalate` |
| 单节点网络抖动 | 局部恢复 | `retry` |
| 工具连续失败且替代方案存在 | 改路 | `replan` |
| 风险超阈值且无法自动降级 | 人工兜底 | `escalate` |
| 用户切换快速路线到深度路线 | 改路并重编队 | `replan` |

## 高层状态投影

编排层应负责把 Mission、workflow、fleet、takeover 的信号统一解释为高层 `Drive State`。

建议投影方式：

| 编排层信号 | Drive State |
| --- | --- |
| Destination 仍在归一化 | `understanding` |
| 存在缺失信息且等待补充 | `clarifying` |
| 正在生成或切换路线 | `planning` |
| 正在绑定角色、资源、执行器 | `fleet-forming` |
| workflow 正在推进主执行链路 | `executing` |
| review / audit / verify 激活 | `reviewing` |
| runtime 无法前进 | `blocked` |
| 存在阻塞型 takeover | `takeover-required` |
| 当前 Route 已切换或重写 | `replanning` |
| 结果完成并可交付 | `delivered` |

关键原则：

- 高层状态不直接替代底层 runtime state。
- 状态切换必须能被 replay / audit 重建。
- `takeover-required`、`blocked`、`replanning` 必须在语义上彼此区分。

## 事件与证据设计

编排层应输出一组可重建、可追踪的编排事件，而不是只在前端临时拼装状态。

建议事件至少包含：

```ts
type OrchestrationEvent = {
  id: string;
  missionId: string;
  routeId?: string;
  routeStepId?: string;
  fleetRoleId?: string;
  takeoverPointId?: string;
  action:
    | "destination_bound"
    | "route_selected"
    | "fleet_bound"
    | "takeover_requested"
    | "takeover_resolved"
    | "retry_requested"
    | "escalated"
    | "replanned"
    | "delivered";
  reason?: string;
  relatedRuntimeEventId?: string;
  relatedDecisionId?: string;
  createdAt: string;
};
```

这些事件的用途：

- cockpit 展示当前主线；
- replay 重建任务行驶时间线；
- audit 解释关键人工与自动决策；
- telemetry 统计等待、重试、升级与重规划分布。

## 与现有系统的兼容策略

### 策略 1：投影优先，不立即改名

短期内不要求：

- 把 `Mission` 改名为 `Destination`；
- 把 `Workflow` 改名为 `Route`；
- 把 runtime state 改名为 `Drive State`；
- 把 decision / approval 全部改名为 takeover。

短期应优先：

- 新增 binding；
- 新增 projection；
- 新增 orchestration event；
- 新增前端 view model 消费层。

### 策略 2：Mission Runtime 继续做事实主干

Mission Runtime 继续负责：

- 生命周期；
- 六阶段推进；
- waiting / done / failed 事实状态；
- 工件、事件、实例信息聚合。

编排层只负责解释、连接与控制组织。

### 策略 3：workflow runtime 继续做执行事实层

workflow runtime 继续负责：

- 节点推进；
- 分支与并行；
- `WAITING_INPUT`；
- `resume()`；
- `retry / escalate / terminate`。

编排层负责把这些信号组织成 Route、Fleet、Takeover 语义。

### 策略 4：Web-AIGC 节点继续保留为内部执行单元

不要求把 50+ 节点直接暴露给用户作为主产品语言。短期仍采用：

- 内部继续节点编排；
- 外部通过 Route Step、Fleet Role、Takeover Point 来解释。

## 落地建议

建议按以下顺序落地：

1. 建立编排层对象与字段契约。
2. 建立 `Destination / Route / Fleet / Takeover` 四类 binding。
3. 建立 Mission Runtime 与 workflow runtime 到编排层的投影。
4. 建立 `wait-resume`、`retry-escalate`、`replan` 的决策规则。
5. 让 cockpit、task detail、replay、audit 统一消费编排层。

## 风险与边界

### 风险 1：只有文档概念，没有真实绑定

如果只写了自动驾驶对象，却没有 `mission / workflow / runtime / decision` 绑定，就会让编排层变成纯叙事层，无法真正解释运行时。

### 风险 2：把重规划写成重试

如果无法区分 `retry` 与 `replan`，前端和审计都会误判系统只是“又试了一次”，而看不到路线真的变化了。

### 风险 3：把接管做成孤立弹窗系统

如果 `Takeover` 不复用现有 `wait-resume / decision / approval / escalate`，就会产生两套人工介入体系，最终状态会失真。

### 风险 4：试图一次性重构底层命名

如果一开始就试图把底层 `Mission / Workflow / Runtime` 全部替换为新词，会带来高噪音改动和大范围回归风险，不符合当前仓库的演进路径。

## 设计结论

本 spec 的最终设计结论如下：

1. Runtime 编排层是自动驾驶对象与现有执行主线之间的兼容层与组织层。
2. `Destination` 映射到 Mission Runtime 的任务理解与生命周期主线。
3. `Route` 映射到 workflow runtime 的阶段、步骤、节点与控制路径。
4. `Fleet` 映射到 agent / skill / node / executor / adapter 的动态编组。
5. `Takeover` 映射到 `wait-resume / decision / approval / escalate`。
6. `retry`、`escalate`、`replan` 必须在编排层被清晰区分。
7. 首轮落地应优先做 binding、projection 与事件，而不是立刻重写底层 runtime。
