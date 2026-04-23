# 设计文档：任务自动驾驶证据回放与信任链

## 设计概述

本设计将“任务自动驾驶”的任务历史统一解释为一条可回放、可审计、可追溯的证据主链：

`Destination -> Route -> Drive Timeline -> Evidence Items -> Result Evidence -> Trust Chain`

在这条主链中：

- `Drive Timeline` 负责回答“任务是怎样一步步开到这里的”。
- `Evidence Items` 负责回答“哪些事实支撑了这个过程和结果”。
- `Replay` 负责回答“当时按什么顺序发生了什么”。
- `Audit` 负责回答“谁做了什么决定、批准了什么、承担了什么风险”。
- `Lineage` 负责回答“数据与中间结果从哪里来、流向哪里去”。
- `Trust Chain` 负责回答“为什么这些证据和最终结果值得信任”。

本设计不是要把 audit、lineage、replay 三套能力合并成一个大而全的新系统，而是为它们增加一条共享的任务自动驾驶主脊柱，让它们围绕同一批证据对象协同消费。

## 设计目标

- 建立面向任务自动驾驶的统一证据解释层。
- 让驾驶时间线成为 replay、audit、lineage 的共享主脊柱。
- 让关键决策、路线变化、接管事件、工具调用和结果证据有统一的数据口径。
- 让结果可信状态可被结构化表达，而不是只能靠人工拼接日志。
- 保持与现有 `Route / Drive State / Takeover / Mission Runtime / workflow runtime` 兼容。

## 分层设计

### 第一层：底层事实层

底层事实层继续保留当前已有来源：

- Mission 与 workflow 生命周期事件；
- Route 规划、路线切换与重规划记录；
- Drive State 高层状态变化；
- `waiting / decision / approval / resume / escalate` 等接管链路；
- 工具调用、资源访问、执行器输出；
- review / audit / verify / revise；
- replay、audit、lineage 自己已有的事件与索引。

这一层适合真实执行，但不适合直接作为统一产品叙事。

### 第二层：证据投影层

证据投影层负责把多来源底层事实归并为任务自动驾驶统一证据对象：

- 驾驶时间线事件；
- 关键决策证据；
- 路线变化证据；
- 接管证据；
- 工具调用证据；
- 结果证据；
- 信任标记与串联引用。

这一层是本 spec 的核心。

### 第三层：消费层

消费层包括：

- 自动驾驶驾驶舱；
- 任务详情；
- replay 页面；
- audit 面；
- lineage 面；
- 导出报告或后续治理接口。

这些消费层应优先读取统一证据对象，而不是继续各自拼接底层状态。

## 总体架构

```text
Mission / Route / Runtime / HITL / Tool / Review / Audit / Lineage Facts
  -> Evidence Projector
      -> Drive Timeline
      -> Decision Evidence
      -> Route Change Evidence
      -> Takeover Evidence
      -> Tool Call Evidence
      -> Result Evidence
      -> Trust Marks
  -> Shared Correlation Index
      -> Replay Consumption
      -> Audit Consumption
      -> Lineage Consumption
      -> Cockpit Consumption
```

设计原则：

- 先做投影与串联，不先做底层整体改名。
- 驾驶时间线是主脊柱，其他证据挂载到时间线位置。
- 同一事实尽量维护单一证据主记录，再向 replay / audit / lineage 投影。
- 允许分阶段接线，暂时缺失的投影必须显式标记。

## 核心对象

### 1. Autopilot Evidence Chain

一次任务自动驾驶实例对应一条总证据链。

```ts
type AutopilotEvidenceChain = {
  chainId: string;
  missionId: string;
  destinationId?: string;
  routeSetId?: string;
  activeRouteId?: string;
  timelineId: string;
  resultEvidenceId?: string;
  trustProfile: TrustProfile;
  evidenceIds: string[];
  correlation: EvidenceCorrelationIndex;
};
```

设计说明：

- `chainId` 是任务证据主链标识。
- `timelineId` 指向该任务的驾驶时间线。
- `resultEvidenceId` 指向当前主交付结果。
- `correlation` 负责把 replay、audit、lineage 关联键统一收拢。

### 2. Base Evidence Item

所有证据对象共享统一基类。

```ts
type EvidenceType =
  | "drive_state_change"
  | "decision"
  | "route_change"
  | "takeover"
  | "tool_call"
  | "result"
  | "trust_update";

type EvidenceActorKind = "system" | "user" | "agent" | "tool" | "runtime" | "governance";

type EvidenceItem = {
  id: string;
  chainId: string;
  type: EvidenceType;
  occurredAt: string;
  recordedAt: string;
  summary: string;
  actor: {
    kind: EvidenceActorKind;
    id?: string;
    label?: string;
  };
  missionId: string;
  workflowId?: string;
  routeId?: string;
  routeStepId?: string;
  driveState?: string;
  runtimeEventId?: string;
  upstreamEvidenceIds: string[];
  auditRefs: string[];
  lineageRefs: string[];
  replayRefs: string[];
  trustMarks: TrustMark[];
  redaction?: EvidenceRedaction;
};
```

设计原则：

- 任意关键事实都必须可落到统一 `EvidenceItem` 口径。
- `upstreamEvidenceIds` 用于表达支撑关系，而不是只做平铺日志。
- `auditRefs / lineageRefs / replayRefs` 是共享串联点。
- 脱敏是证据层能力，而不是单独交给前端临时处理。

### 3. Drive Timeline

Drive Timeline 是证据链主脊柱，用于表达任务推进过程。

```ts
type DriveTimeline = {
  id: string;
  missionId: string;
  startAt: string;
  endAt?: string;
  currentDriveState: string;
  eventIds: string[];
};
```

```ts
type DriveTimelineEvent = {
  id: string;
  timelineId: string;
  occurredAt: string;
  previousDriveState?: string;
  nextDriveState: string;
  stageLabel?: string;
  routeId?: string;
  routeStepId?: string;
  triggerType:
    | "mission_created"
    | "state_transition"
    | "decision_made"
    | "route_switched"
    | "takeover_triggered"
    | "tool_finished"
    | "result_submitted"
    | "result_delivered";
  triggerReason: string;
  nextActionHint?: string;
  evidenceIds: string[];
};
```

设计说明：

- Timeline Event 不等于底层 runtime event，而是面向用户解释的高层事件。
- 每个 Timeline Event 可以挂载多个证据项。
- 任何关键状态跳转都应尽量能回到时间线定位点。

### 4. Decision Evidence

关键决策证据用于解释“为什么选这条路、这个动作或这个结果”。

```ts
type DecisionEvidence = EvidenceItem & {
  type: "decision";
  subject: string;
  decisionMode: "automatic" | "human" | "hybrid";
  inputsSummary: string[];
  options: {
    id: string;
    label: string;
    pros?: string[];
    cons?: string[];
  }[];
  selectedOptionId: string;
  rationale: string;
  confidence?: number;
  relatedRiskIds?: string[];
};
```

设计原则：

- 记录关键输入与候选方案，而不只记录最终选项。
- 决策必须能关联路线、接管或结果。
- 若决策被后续推翻，也应保留原决策证据。

### 5. Route Change Evidence

路线变化证据用于解释偏航、重规划和路线切换。

```ts
type RouteChangeEvidence = EvidenceItem & {
  type: "route_change";
  previousRouteId?: string;
  nextRouteId: string;
  reasonType:
    | "replanning"
    | "human_override"
    | "risk_exceeded"
    | "quality_gap"
    | "dependency_unavailable"
    | "constraint_changed";
  reasonSummary: string;
  preservedStepIds: string[];
  invalidatedStepIds: string[];
  addedStepIds: string[];
};
```

设计原则：

- 路线变化必须保留前后关系和影响范围。
- 普通 `retry` 不应伪装成路线变化。
- 路线变化应能连接到 `Drive State = replanning` 的时间线位置。

### 6. Takeover Evidence

接管证据用于解释系统为什么交还方向盘，以及用户如何处理。

```ts
type TakeoverEvidence = EvidenceItem & {
  type: "takeover";
  takeoverType:
    | "clarification"
    | "route_selection"
    | "permission_confirm"
    | "budget_confirm"
    | "risk_acceptance"
    | "result_acceptance"
    | "manual_override"
    | "exception_recovery";
  required: boolean;
  reason: string;
  prompt: string;
  options: {
    id: string;
    label: string;
  }[];
  selectedOptionId?: string;
  submittedBy?: string;
  submittedAt?: string;
  timeoutOutcome?: "default_action" | "escalated" | "waiting";
  resumeTargetState?: string;
};
```

设计原则：

- 接管证据必须同时服务用户解释、审计追责和回放重现。
- 展示内容与用户选择都要保留。
- 接管完成后的恢复路径必须显式记录。

### 7. Tool Call Evidence

工具调用证据用于解释系统如何借助工具、执行器和资源推进任务。

```ts
type ToolCallEvidence = EvidenceItem & {
  type: "tool_call";
  toolId: string;
  toolKind: "file" | "browser" | "api" | "database" | "sandbox" | "mcp" | "other";
  purpose: string;
  inputDigest?: string;
  outputDigest?: string;
  startedAt: string;
  finishedAt?: string;
  status: "success" | "failure" | "timeout" | "cancelled";
  permissionDecision?: "granted" | "denied" | "not_required";
  estimatedCost?: number;
  actualCost?: number;
  sideEffectScope?: string;
  errorSummary?: string;
};
```

设计原则：

- 记录摘要和校验信息，不要求总是存全部原始载荷。
- 高风险或高成本调用必须可被审计定位。
- 调用失败也应是证据，而不是被过滤掉。

### 8. Result Evidence

结果证据用于把最终交付与其支撑链打通。

```ts
type ResultEvidence = EvidenceItem & {
  type: "result";
  resultVersion: number;
  status: "draft" | "reviewing" | "accepted" | "rejected" | "superseded";
  artifactRefs: {
    kind: "file" | "message" | "report" | "summary" | "external_link";
    ref: string;
  }[];
  qualitySignals: {
    review?: string;
    audit?: string;
    verify?: string;
    acceptance?: string;
  };
  supportingEvidenceIds: string[];
};
```

设计原则：

- 最终结果必须能向上游证据追溯。
- 支持多版本结果，而不是只保留最后一次交付。
- 结果状态必须能表达草稿、复核中、已验收、被替换等阶段。

### 9. Trust Profile

Trust Profile 用于统一表达可信状态。

```ts
type TrustStatus = "verified" | "partial" | "unverified" | "redacted";

type TrustDimension =
  | "origin"
  | "integrity"
  | "lineage"
  | "audit"
  | "replayability"
  | "result_readiness";

type TrustMark = {
  dimension: TrustDimension;
  status: TrustStatus;
  reason: string;
  sourceRef?: string;
};

type TrustProfile = {
  overallStatus: TrustStatus;
  marks: TrustMark[];
  gaps: string[];
};
```

设计原则：

- 信任不是单一分数，而是一组维度化判断。
- 脱敏、断链、未复核等情况必须显式体现在 `gaps` 中。
- `overallStatus` 是聚合结论，不替代维度细节。

## 串联关系设计

### 1. 驾驶时间线作为主脊柱

所有关键证据项都应挂载到某个时间线位置或时间线片段上。

主链路示意：

```text
Mission Created
  -> understanding
  -> planning
  -> fleet-forming
  -> executing
  -> reviewing
  -> delivered
```

非理想链路示意：

```text
executing
  -> takeover-required
  -> replanning
  -> executing
  -> reviewing
  -> takeover-required
  -> delivered
```

时间线作用：

- 给 replay 提供可播放顺序。
- 给 audit 提供上下文定位。
- 给 lineage 提供时间和阶段语义。
- 给驾驶舱提供“现在开到哪了”的主叙事。

### 2. 关键决策挂载到时间线事件

关键决策一般挂载在以下时间点：

- 路线生成后；
- 重规划时；
- 高风险工具调用前；
- review / audit 结果回流时；
- 交付验收前。

设计要求：

- 决策不能只存在于单独决策表中。
- 必须能从时间线进入决策详情。
- 决策结果若影响后续路线或结果，应建立下游引用。

### 3. 路线变化连接前后两段时间线

路线变化证据的本质不是一条普通事件，而是两段驾驶历史之间的桥。

它至少应连接：

- 原路线；
- 触发原因；
- 新路线；
- 受影响步骤；
- 进入 `replanning` 的时间线事件；
- 恢复执行的时间线事件。

这样 replay 才能解释“为什么突然换路”，audit 才能解释“谁批准了换路”，lineage 才能解释“哪些中间结果被复用或废弃”。

### 4. 接管事件连接系统与人工链路

接管证据必须把两部分连接起来：

- 系统视角：为什么需要接管、若不处理会怎样；
- 人工视角：用户看到了什么、做了什么选择、系统如何恢复。

串联要求：

- 接管前关联当前 `Drive State`、风险、当前路线与上下文摘要；
- 接管中保留展示内容与决策选项；
- 接管后记录进入何种恢复路径，如 `clarifying / planning / executing / replanning / terminate`。

### 5. 工具调用连接执行事实与结果支撑

工具调用证据连接两类对象：

- 上游决策和路线步骤；
- 下游中间结果和最终结果。

设计要求：

- 若工具调用生成了文件、摘要、报告、搜索结果或结构化数据，应尽量生成输出摘要或哈希。
- 若工具调用失败，应保留失败原因和对应恢复动作。
- 若工具调用受权限或预算约束，应连接审计与接管证据。

### 6. 结果证据作为任务信任汇总点

结果证据是任务交付阶段的汇总对象：

- 汇总最终工件；
- 汇总 review / audit / verify / 验收 信号；
- 汇总关键支撑证据；
- 给 trust chain 提供最终聚合结论。

结果证据不是简单的“附件列表”，而是一次交付的可信摘要。

## audit / lineage / replay 串联设计

### Replay 消费

Replay 优先消费：

- `DriveTimelineEvent`
- `EvidenceItem.summary`
- 关键决策、路线变化、接管、工具调用、结果证据

Replay 需要回答：

- 任务如何推进；
- 在哪里偏航；
- 在哪里请求用户；
- 为什么最终结果变成现在这样。

### Audit 消费

Audit 优先消费：

- 决策证据；
- 接管证据；
- 工具调用中的权限、风险、成本信号；
- 结果证据中的复核和验收结论；
- `TrustMark.integrity / audit / result_readiness`

Audit 需要回答：

- 谁批准了什么；
- 谁接受了什么风险；
- 为什么允许这次调用或换路；
- 结果是否经过必要治理。

### Lineage 消费

Lineage 优先消费：

- 工具调用输出摘要；
- 数据或中间结果节点；
- 决策输入来源；
- 结果证据的支撑引用。

Lineage 需要回答：

- 结果依赖了哪些输入；
- 输入在何处被变换；
- 某次路线变化是否复用了旧结果；
- 某个异常结果受哪些上游证据影响。

### Shared Correlation Index

为了让三者不再割裂，需要定义统一关联键：

```ts
type EvidenceCorrelationIndex = {
  missionId: string;
  workflowId?: string;
  timelineId: string;
  routeIds: string[];
  routeStepIds: string[];
  runtimeEventIds: string[];
  decisionIds: string[];
  auditEventIds: string[];
  lineageIds: string[];
  replayEventIds: string[];
};
```

设计原则：

- 关联键是串联层，不要求底层所有对象改名。
- 允许某些字段暂时为空，但必须显式存在。
- 串联失败要可观察，不能静默吞掉。

## 信任链计算原则

### 1. 来源可信

如果证据来自受控的 runtime、明确的用户操作或已登记工具调用，则 `origin` 可标记为较高可信。

### 2. 链路完整

如果证据存在明确上游和下游引用，且能回到时间线定位点，则 `integrity` 和 `lineage` 可提升。

### 3. 可回放

如果证据能被 replay 直接消费或能定位到时间线事件，则 `replayability` 可标记为 `verified` 或 `partial`。

### 4. 已复核

如果存在 review / audit / verify / 验收结论，则 `audit` 和 `result_readiness` 可提升。

### 5. 缺口显式暴露

出现以下情况时，可信状态不得显示为完整可信：

- 证据缺失；
- 只剩前端临时文案，没有服务端投影；
- 工具输出被截断或无法定位来源；
- 结果未经过复核；
- 关键接管或批准记录缺失；
- 关键路线变化没有原因。

## 兼容与落地策略

### 1. 与 Drive State 兼容

本设计直接复用现有高层十态 `Drive State` 作为时间线状态语义来源，不重新定义第二套状态机。

### 2. 与 Route / Replan 兼容

路线变化证据应直接复用 Route、候选路线、Replan 记录与 Route Runtime Mapping 作为事实输入。

### 3. 与 Takeover 兼容

接管证据应复用现有 `MissionDecision`、`waiting`、`resume()`、`escalate()`、approval 链路。

### 4. 与 replay / audit / lineage 兼容

优先做共享证据对象与关联键，再逐步让 replay、audit、lineage 改为消费统一投影。

### 5. 分阶段落地

建议分四段推进：

- A 段：术语、对象模型和文档统一。
- B 段：前端或 view model 层先消费统一时间线和关键证据。
- C 段：服务端落地证据投影与关联索引。
- D 段：补齐 trust marks、审计锚点、lineage 接线与 replay 深度消费。

## 风险与边界

### 风险 1：把证据链做成新的平行日志系统

如果证据链与现有 replay、audit、lineage 各做一套记录，会导致事实冲突和维护成本激增。

应对原则：

- 优先投影共享对象。
- 避免每个消费面维护一套独立事实。

### 风险 2：只做前端拼接，不做可重建投影

如果证据链只能在前端临时算出，就无法支撑真实回放和审计。

应对原则：

- 至少核心证据要能由服务端或事件层重建。

### 风险 3：把信任链误做成“永远可信”的装饰标签

如果缺口、脱敏和断链不被暴露，信任链会失去意义。

应对原则：

- 信任链必须能表达 `partial / unverified / redacted`。
- 缺口必须被显示，而不是隐藏。

### 风险 4：把重试误当成换路

如果 `retry` 与 `route_change` 混淆，用户和审计都无法理解系统是否真正重新规划。

应对原则：

- 明确区分普通重试、步骤返工和路线切换。

## 设计结论

本 spec 的最终结论是：

1. 任务自动驾驶需要一条统一的证据主链，而不是 replay、audit、lineage 三个并列孤岛。
2. 驾驶时间线是证据主链的脊柱，关键决策、路线变化、接管事件、工具调用和结果证据挂载其上。
3. 结果可信状态来自结构化信任链，而不是人工阅读日志后的主观判断。
4. 该设计优先做投影层和串联层，不要求立刻重构底层执行引擎。
5. 后续驾驶舱、回放、审计、血缘和导出面，应优先复用本 spec 中定义的证据对象和关联口径。
