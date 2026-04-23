# 设计文档：路线规划器与路线模型

## 设计目标

路线规划器负责把 Destination 转换为可执行的 Route，并让 Route 同时满足三类需求：

- 用户可理解：能看到推荐路线、候选路线、风险点、接管点与当前进度。
- 运行时可执行：能映射到现有 workflow / mission runtime / node adapter。
- 平台可治理：能进入 replay、audit、telemetry、risk、HITL 与恢复链路。

本设计不要求立即重构现有 `mission / workflow / task` 底层命名，而是在产品层引入 Route 抽象，通过映射层与现有能力连接。

## 总体架构

```text
用户输入
  -> Destination Parser
  -> Route Planner
      -> Route Candidate Builder
      -> Risk Evaluator
      -> Takeover Point Generator
      -> Runtime Mapping Builder
  -> Route Set
      -> 主路线
      -> 候选路线
  -> Mission / Workflow Runtime
  -> Drive State / Telemetry / Replay / Audit
```

## Route Set

一次路线规划应输出 Route Set，而不是只输出单条路线。

```ts
type RouteSet = {
  id: string;
  destinationId: string;
  recommendedRouteId: string;
  routes: Route[];
  generatedAt: string;
  plannerVersion: string;
  planningContextSummary: string;
};
```

设计说明：

- `recommendedRouteId` 指向主路线。
- `routes` 至少包含一条路线，最多建议默认展示三条路线。
- `plannerVersion` 用于后续回放、审计与规划器升级兼容。
- `planningContextSummary` 面向用户和审计，说明规划依据。

## Route 对象

```ts
type Route = {
  id: string;
  destinationId: string;
  name: string;
  mode: RouteMode;
  status: RouteStatus;
  summary: string;
  recommendationReason: string;
  stages: RouteStage[];
  steps: RouteStep[];
  parallelGroups: RouteParallelGroup[];
  risks: RouteRisk[];
  takeoverPoints: RouteTakeoverPoint[];
  estimates: RouteEstimates;
  runtimeMapping: RouteRuntimeMapping;
  governance: RouteGovernanceProfile;
};
```

### RouteMode

```ts
type RouteMode = "fast" | "standard" | "deep" | "custom";
```

路线模式说明：

- `fast`：快速路线，优先减少步骤、减少接管、尽快产出可用结果。
- `standard`：标准路线，默认推荐，平衡质量、速度、成本与可控性。
- `deep`：深度路线，增加研究、复核、审计、证据与多轮修正。
- `custom`：由用户、策略或历史偏好生成的自定义路线。

### RouteStatus

```ts
type RouteStatus =
  | "planned"
  | "selected"
  | "executing"
  | "paused"
  | "takeover_required"
  | "replanning"
  | "delivered"
  | "failed"
  | "cancelled";
```

## Route Stage

Route Stage 是面向用户的高层阶段，建议默认采用任务自动驾驶语义。

```ts
type RouteStage = {
  id: string;
  name: string;
  description: string;
  order: number;
  status: RouteStageStatus;
  stepIds: string[];
  workflowPhaseHint?: string;
};
```

建议阶段：

- 理解目标
- 澄清缺口
- 规划路线
- 组建车队
- 执行任务
- 复核修正
- 交付结果

与现有十阶段 workflow 的关系：

| Route Stage | 可映射 workflow 阶段 |
| --- | --- |
| 理解目标 | Assemble / CEO split |
| 澄清缺口 | CEO split / Mgr plan |
| 规划路线 | Mgr plan |
| 组建车队 | Mgr plan / Execute |
| 执行任务 | Execute |
| 复核修正 | Review / Audit / Revise / Verify |
| 交付结果 | Summary / Evolve |

## Route Step

Route Step 是路线中可展示、可执行、可审计的最小产品层步骤。

```ts
type RouteStep = {
  id: string;
  stageId: string;
  title: string;
  description: string;
  type: RouteStepType;
  status: RouteStepStatus;
  dependencies: string[];
  expectedOutputs: string[];
  ownerRole?: FleetRoleName;
  runtimeRef?: RouteRuntimeRef;
  riskIds: string[];
  takeoverPointIds: string[];
};
```

### RouteStepType

```ts
type RouteStepType =
  | "understand"
  | "clarify"
  | "plan"
  | "research"
  | "generate"
  | "execute"
  | "review"
  | "audit"
  | "revise"
  | "deliver"
  | "human_decision";
```

设计原则：

- Route Step 不等于 runtime node。
- 一个 Route Step 可以映射到多个底层节点。
- 多个 Route Step 也可以映射到同一个 workflow phase。
- 前端展示 Route Step，运行时执行 runtime mapping。

## 快速 / 标准 / 深度路线

### 快速路线

适用场景：

- 用户要初稿、草案、原型、方向建议。
- 上下文较完整或风险较低。
- 允许先交付，再补深度。

默认策略：

- 减少澄清次数。
- 减少复核轮次。
- 优先使用已有上下文。
- 接管点只保留关键确认。
- governance profile 采用轻量审计。

### 标准路线

适用场景：

- 默认大多数办公任务。
- 需要质量、速度、可解释性之间平衡。

默认策略：

- 保留目标澄清。
- 保留一次 review / audit / revise。
- 保留关键工具调用证据。
- 接管点覆盖路线确认、风险接受、结果验收。

### 深度路线

适用场景：

- 高价值、高风险、复杂、多角色、多证据任务。
- 需要长链条研究、比对、审计、复盘。

默认策略：

- 增加研究和证据收集步骤。
- 增加多轮 review / audit / verify。
- 提高接管点密度。
- 强化 replay / lineage / audit。
- 允许更多并行子路线与汇总节点。

## 并行与串行安排

Route 通过 `dependencies` 与 `parallelGroups` 表达执行关系。

```ts
type RouteParallelGroup = {
  id: string;
  title: string;
  stepIds: string[];
  joinStepId: string;
  maxConcurrency?: number;
  fallbackMode: "serial" | "skip_optional" | "takeover";
};
```

设计原则：

- 串行步骤通过 `dependencies` 表达。
- 并行步骤通过 `parallelGroups` 聚合。
- `joinStepId` 负责汇总并行结果。
- 如果 runtime 当前不具备真实并行执行能力，应降级为串行执行，并记录 `fallbackMode` 和原因。
- 并行组应映射到 Mission Runtime 的并发调度能力或 workflow engine 的任务拆分能力。

## 风险点模型

```ts
type RouteRisk = {
  id: string;
  routeId: string;
  stepId?: string;
  type: RouteRiskType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  triggerCondition: string;
  mitigation: string;
  requiresTakeover: boolean;
};
```

### RouteRiskType

```ts
type RouteRiskType =
  | "missing_context"
  | "permission_required"
  | "budget_overrun"
  | "quality_uncertain"
  | "tool_failure"
  | "data_trust"
  | "long_running"
  | "policy_sensitive";
```

风险点使用方式：

- 影响主路线推荐。
- 影响是否生成候选路线。
- 影响接管点密度。
- 影响 runtime governance profile。
- 进入 replay / audit / telemetry 元数据。

## 接管点模型

```ts
type RouteTakeoverPoint = {
  id: string;
  routeId: string;
  stepId?: string;
  type: RouteTakeoverType;
  required: boolean;
  reason: string;
  prompt: string;
  options: RouteTakeoverOption[];
  defaultOptionId?: string;
  timeoutPolicy?: RouteTakeoverTimeoutPolicy;
  runtimeDecisionRef?: string;
};
```

### RouteTakeoverType

```ts
type RouteTakeoverType =
  | "clarification"
  | "route_selection"
  | "permission_confirm"
  | "budget_confirm"
  | "risk_acceptance"
  | "result_acceptance"
  | "manual_override";
```

接管点映射：

- `clarification` 映射到现有 wait-resume 链路。
- `permission_confirm` 映射到权限与 capability 检查。
- `budget_confirm` 映射到 cost governance。
- `risk_acceptance` 映射到 audit / policy / human decision。
- `manual_override` 映射到 `escalate()` 或人工接管面板。

## Runtime Mapping

Route 需要保留到现有执行基座的映射。

```ts
type RouteRuntimeMapping = {
  missionId?: string;
  workflowId?: string;
  workflowDefinitionId?: string;
  stageMappings: RouteStageRuntimeMapping[];
  stepMappings: RouteStepRuntimeMapping[];
  eventCorrelationKey: string;
};
```

```ts
type RouteStepRuntimeMapping = {
  routeStepId: string;
  workflowPhase?: string;
  workflowNodeId?: string;
  adapterName?: string;
  agentRole?: string;
  decisionPointId?: string;
  runtimeControl?: "run" | "wait" | "resume" | "retry" | "escalate" | "terminate";
};
```

映射原则：

- Route 是计划层，Workflow 是执行图，Mission Runtime 是执行控制面。
- Route 不直接替代 workflow node。
- Route 的用户可见状态应通过 runtime event 投影更新。
- Route 的接管点应复用现有 HITL / wait-resume / decision 机制。
- Route 的失败恢复应复用现有 `retry / escalate / terminate`。

## Route Planner 组件

### Destination Analyzer

读取 Destination，提取目标类型、复杂度、上下文完整度、交付物类型、用户偏好与风险信号。

### Route Candidate Builder

生成快速、标准、深度三类路线候选，并根据任务类型裁剪阶段与步骤。

### Risk Evaluator

为每条路线生成风险点，评估严重程度和是否需要接管。

### Takeover Point Generator

根据风险、缺失信息、权限、预算、路线模式生成接管点。

### Runtime Mapping Builder

把 Route Stage / Route Step 映射到现有 workflow phase、runtime node、agent role、decision point 与 control surface。

### Recommendation Selector

从候选路线中选择主路线，生成推荐原因。

## 重规划设计

重规划触发条件：

- 用户修改目标或约束。
- 工具调用失败。
- 结果质量低于阈值。
- 风险点触发。
- 接管点选择改变路线。
- runtime 重试预算耗尽。
- 新上下文进入。

重规划输出：

```ts
type RouteReplanRecord = {
  id: string;
  previousRouteId: string;
  nextRouteId: string;
  reason: string;
  changedStepIds: string[];
  preservedStepIds: string[];
  createdAt: string;
  requestedBy: "system" | "user" | "runtime" | "governance";
};
```

重规划原则：

- 不静默替换路线。
- 保留已完成步骤证据。
- 前端展示偏航原因与新路线差异。
- replay / audit 记录重规划前后快照。

## 前端展示摘要

Route 应提供前端驾驶舱友好的摘要字段：

- 目标摘要
- 推荐路线名称
- 当前阶段
- 当前步骤
- 剩余步骤数
- 风险数量
- 必须接管数量
- 预计时间
- 预计成本
- 自动化等级提示
- 推荐原因

## 与现有系统的兼容边界

短期内：

- 不重命名现有 Mission / Workflow / Task 代码。
- Route 作为产品层与计划层对象存在。
- Route 状态通过 runtime event 投影生成。
- Route 接管点复用现有人工恢复链路。

中期：

- 将 RouteSet 持久化。
- 将 Route 与 Mission 实例建立稳定关联。
- 将 Route 风险与接管点进入 audit / replay。
- 在驾驶舱中展示主路线、候选路线与重规划。

长期：

- Route Planner 形成可插拔策略。
- 支持历史路线学习与用户偏好。
- 支持跨任务路线模板。
- 支持限定场景 L3 / L4 自动化。
