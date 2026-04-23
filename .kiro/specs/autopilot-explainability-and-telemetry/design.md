# 设计文档：任务自动驾驶可解释性与遥测层

## 设计概述

任务自动驾驶的可解释性与遥测层，是建立在现有 Mission Runtime、workflow runtime、runtime events、replay、audit、monitoring 与 evidence 能力之上的高层投影。

它的目标是把底层事实翻译为用户能够理解和信任的解释：

- 当前状态解释；
- 推荐原因；
- 剩余步骤；
- 风险提示；
- 置信度；
- 证据提示；
- 实时状态信号。

本设计不把可解释性写成一个新的独立平台，而是把它定义为自动驾驶产品对象与现有工程对象之间的解释层。

## 设计原则

1. 解释层是投影层，不是事实源替代层。
2. runtime events、replay、audit 仍然是关键事实与治理承接面。
3. 解释必须能追溯到真实信号，不能只生成漂亮文案。
4. 高风险解释必须保留证据、接管或审计入口。
5. 允许早期由前端 view model 推导，但必须保留服务端 projection 演进路径。
6. 不把“可关联 lineage”误写成“所有事件已全量沉淀 lineage”。

## 总体分层

### 第一层：事实信号层

事实信号层来自当前系统中已经存在或可稳定推导的执行事实：

- Mission 状态；
- Workflow instance 状态；
- Node run 状态；
- Runtime event；
- Route Planner 输出；
- Drive State 投影；
- Takeover Point / decision / approval；
- review / audit / verify / revise；
- replay timeline；
- artifacts / logs / evidence；
- monitoring projection；
- lineage relation index。

这一层回答“发生了什么”。

### 第二层：遥测归一层

遥测归一层把多个事实来源归并成任务自动驾驶需要消费的实时状态信号。

它不要求当前建立新的统一 telemetry backend，而是允许以下来源并存：

- 直接来自现有 runtime event；
- 来自 runtime event bridge；
- 来自 mission / workflow projection；
- 来自 replay / audit 查询；
- 来自前端 view model 的阶段性组合推导。

这一层回答“哪些信号对自动驾驶解释有意义”。

### 第三层：解释对象层

解释对象层把遥测信号转换为结构化解释对象。

典型解释对象包括：

- `CurrentStateExplanation`
- `RecommendationReason`
- `RemainingStepsExplanation`
- `RiskExplanation`
- `ConfidenceExplanation`
- `EvidenceHint`
- `RuntimeSignalSummary`

这一层回答“如何向用户解释”。

### 第四层：消费层

消费层包括：

- 自动驾驶驾驶舱；
- 任务详情页；
- 接管面板；
- 路线推荐与选择界面；
- replay 时间线；
- audit 查询；
- runtime / evidence dock。

这一层回答“在哪里展示和复原解释”。

## 核心对象设计

### 1. AutopilotExplanation

`AutopilotExplanation` 是所有解释对象的基础结构。

```ts
type AutopilotExplanation = {
  explanationId: string;
  type:
    | "current_state"
    | "recommendation_reason"
    | "remaining_steps"
    | "risk"
    | "confidence"
    | "evidence_hint"
    | "runtime_signal";
  title: string;
  summary: string;
  reason?: string;
  source: ExplanationSource;
  relatedRefs: ExplanationRelatedRefs;
  confidence?: ConfidenceSummary;
  risk?: RiskSummary;
  evidenceRefs: EvidenceRef[];
  suggestedActions: SuggestedAction[];
  status: "active" | "superseded" | "resolved" | "expired";
  createdAt: string;
  updatedAt: string;
};
```

设计要点：

- `type` 用于区分解释类型；
- `source` 用于说明解释来自 runtime、projection、audit、replay 或推断；
- `relatedRefs` 用于关联 mission、workflow、route、step、runtime event；
- `status` 用于支持重规划、状态变化后的解释失效。

### 2. ExplanationSource

```ts
type ExplanationSource = {
  sourceType:
    | "runtime_event"
    | "mission_projection"
    | "workflow_projection"
    | "route_planner"
    | "drive_state_projection"
    | "audit_entry"
    | "replay_snapshot"
    | "frontend_view_model"
    | "combined_inference";
  sourceId?: string;
  generatedBy: "system" | "model" | "rule" | "human" | "projection";
  inferenceNote?: string;
};
```

设计要点：

- `frontend_view_model` 是阶段性允许的来源，但不应长期成为关键解释的唯一来源；
- `combined_inference` 必须说明推断依据；
- 高风险解释优先使用 `runtime_event`、`audit_entry` 或服务端 projection。

### 3. ExplanationRelatedRefs

```ts
type ExplanationRelatedRefs = {
  missionId?: string;
  workflowId?: string;
  workflowInstanceId?: string;
  routeId?: string;
  routeVersion?: string;
  driveState?: string;
  stepId?: string;
  nodeId?: string;
  runtimeEventIds?: string[];
  decisionId?: string;
  auditEntryId?: string;
  replaySnapshotId?: string;
  artifactIds?: string[];
  lineageId?: string;
};
```

设计要点：

- 关联字段保持宽松，便于分阶段接入；
- `lineageId` 是关联线索，不代表所有解释都已完整写入 lineage store；
- `runtimeEventIds` 支持解释与多个底层事件建立关系。

### 4. CurrentStateExplanation

`CurrentStateExplanation` 用于解释系统当前正在做什么。

```ts
type CurrentStateExplanation = AutopilotExplanation & {
  type: "current_state";
  currentDriveState:
    | "understanding"
    | "clarifying"
    | "planning"
    | "fleet-forming"
    | "executing"
    | "reviewing"
    | "blocked"
    | "takeover-required"
    | "replanning"
    | "delivered";
  currentStageTitle: string;
  currentActionText: string;
  whyNow: string;
  nextExpectedAction?: string;
};
```

示例解释口径：

- “正在执行第 3 阶段：生成候选方案，因为路线已确认且研究角色已完成资料收集。”
- “当前需要接管，因为预算确认缺失，继续执行会触发高成本外部工具。”

### 5. RecommendationReason

`RecommendationReason` 用于解释系统为什么推荐某条路线、动作或接管默认选项。

```ts
type RecommendationReason = AutopilotExplanation & {
  type: "recommendation_reason";
  targetKind: "route" | "action" | "takeover_option" | "replan_strategy";
  recommendedTargetId: string;
  comparedTargetIds: string[];
  tradeoffs: {
    time?: string;
    cost?: string;
    quality?: string;
    risk?: string;
    autonomy?: string;
  };
  autopilotLevelImpact?: string;
};
```

设计要点：

- 推荐原因必须能解释“为什么是它”；
- 路线推荐应关联 Route Planner 输出；
- 接管默认动作应关联 Takeover Point 与 risk/confidence。

### 6. RemainingStepsExplanation

`RemainingStepsExplanation` 用于解释还剩哪些主要步骤。

```ts
type RemainingStepsExplanation = AutopilotExplanation & {
  type: "remaining_steps";
  currentStepId?: string;
  completedStepIds: string[];
  activeStepIds: string[];
  remainingSteps: RemainingStepSummary[];
  changedByReplan?: boolean;
  replanReason?: string;
};

type RemainingStepSummary = {
  stepId: string;
  title: string;
  status: "pending" | "running" | "waiting" | "blocked" | "skipped" | "done";
  expectedOutput?: string;
  riskLevel?: "low" | "medium" | "high" | "unknown";
  mayRequireTakeover?: boolean;
};
```

设计要点：

- 剩余步骤来自 Route、workflow projection 或 runtime projection；
- 发生 Replan 时必须能说明剩余步骤变化；
- 并行支路应保留主线与分支关系。

### 7. RiskExplanation

`RiskExplanation` 用于说明当前风险。

```ts
type RiskExplanation = AutopilotExplanation & {
  type: "risk";
  riskType:
    | "goal_ambiguity"
    | "missing_data"
    | "cost_overrun"
    | "permission"
    | "security"
    | "compliance"
    | "tool_failure"
    | "runtime_instability"
    | "quality_gap"
    | "audit_gap"
    | "unknown";
  severity: "low" | "medium" | "high" | "critical" | "unknown";
  trigger: string;
  impact: string;
  mitigation?: string;
  mayTriggerTakeover: boolean;
  mayTriggerReplan: boolean;
};
```

设计要点：

- 风险必须能关联阶段、路线、runtime event 或 audit entry；
- 高风险必须提供建议动作；
- 风险变化应进入可回放时间线。

### 8. ConfidenceExplanation

`ConfidenceExplanation` 用于表达系统把握程度。

```ts
type ConfidenceExplanation = AutopilotExplanation & {
  type: "confidence";
  dimensions: {
    goalUnderstanding?: ConfidenceLevel;
    routeFeasibility?: ConfidenceLevel;
    executionCompletion?: ConfidenceLevel;
    resultQuality?: ConfidenceLevel;
    evidenceSufficiency?: ConfidenceLevel;
  };
  changedReason?: string;
  thresholdAction?: "continue" | "clarify" | "takeover" | "degrade" | "replan";
};

type ConfidenceLevel = {
  level: "low" | "medium" | "high" | "unknown";
  explanation: string;
};
```

设计要点：

- 避免伪精确，不强制使用百分比；
- 置信度变化必须能说明原因；
- 低置信度应与澄清、接管或重规划策略连接。

### 9. EvidenceHint

`EvidenceHint` 用于把当前解释关联到相关证据。

```ts
type EvidenceHint = AutopilotExplanation & {
  type: "evidence_hint";
  evidenceType:
    | "runtime_event"
    | "replay_timeline"
    | "audit_entry"
    | "artifact"
    | "log_summary"
    | "decision_record"
    | "review_result"
    | "lineage_ref";
  evidenceTitle: string;
  evidenceSummary: string;
  evidenceRef: EvidenceRef;
  freshness: "live" | "recent" | "snapshot" | "stale" | "unknown";
};

type EvidenceRef = {
  refType:
    | "runtime_event"
    | "replay"
    | "audit"
    | "artifact"
    | "log"
    | "decision"
    | "review"
    | "lineage";
  refId: string;
  relation?: "supports" | "explains" | "contradicts" | "supersedes" | "context";
};
```

设计要点：

- 证据提示只展示最相关证据，不替代完整证据库；
- 证据不足时应明确提示；
- 对外展示应避免把审计摘要伪装成完整事实。

### 10. RuntimeSignalSummary

`RuntimeSignalSummary` 用于归一化实时状态信号。

```ts
type RuntimeSignalSummary = {
  signalId: string;
  signalType:
    | "drive_state.changed"
    | "route.recommended"
    | "route.selected"
    | "route.replanned"
    | "step.progressed"
    | "risk.changed"
    | "confidence.changed"
    | "evidence.updated"
    | "takeover.requested"
    | "takeover.resolved"
    | "runtime.health_changed";
  relatedRefs: ExplanationRelatedRefs;
  payload: Record<string, unknown>;
  source: ExplanationSource;
  occurredAt: string;
};
```

设计要点：

- `signalType` 是任务自动驾驶解释层的高层信号；
- 它可以由现有 runtime event、projection 或组合推断得到；
- 不要求第一阶段全部变成底层原生事件。

## 遥测信号映射设计

### 与现有 runtime events 的关系

现有 Web-AIGC 可观测事件目录已经覆盖多个关键事件，例如：

- `node.started`
- `node.completed`
- `node.failed`
- `node.waiting_input`
- `edge.transitioned`
- `human.decision_submitted`
- `human.approved`
- `human.rejected`
- `instance.terminated`
- `instance.retry_requested`
- `instance.escalated`

自动驾驶遥测信号不应替代这些底层事件，而应在其上形成解释投影。

示意映射：

| 底层事件或事实 | 自动驾驶遥测信号 | 说明 |
| ---- | ---- | ---- |
| `node.started` / `node.completed` | `step.progressed` | 节点进展投影为步骤进展 |
| `node.waiting_input` | `takeover.requested` 或 `drive_state.changed` | 等待输入可能进入澄清或接管 |
| `node.failed` | `risk.changed` 或 `drive_state.changed` | 失败可能提升风险或进入阻塞 |
| `edge.transitioned` | `step.progressed` | 边跳转投影为路线推进 |
| `instance.retry_requested` | `risk.changed` | 重试可提升风险，但不等同 Replan |
| `instance.escalated` | `takeover.requested` | 升级投影为接管请求 |
| `human.decision_submitted` | `takeover.resolved` | 人工决策完成 |
| Route Planner 输出 | `route.recommended` | 路线推荐生成 |
| 用户路线确认 | `route.selected` | 当前路线锁定或切换 |
| Replan 触发 | `route.replanned` | 高层路线变化 |

### 与 replay 的关系

replay 负责复原时间线。

可解释性层需要 replay 支持：

- 展示 Drive State 变化；
- 展示路线推荐与选择；
- 展示风险与置信度变化；
- 展示接管请求与用户选择；
- 展示关键证据提示；
- 展示 Replan 前后的剩余步骤变化。

早期可以通过 runtime event 与 projection 重建解释；后续应逐步将关键解释对象写入可回放时间线。

### 与 audit 的关系

audit 负责治理与关键决策证据。

必须进入或关联 audit 的解释包括：

- 高风险推荐；
- 权限、预算、合规、外部副作用相关接管；
- 用户接受风险；
- 用户拒绝推荐路线；
- 系统自动降级或重规划；
- 结果质量不达标后的恢复策略。

普通低风险状态解释可以不全部写入 audit，但必须能关联 replay 或 runtime evidence。

### 与 monitoring 的关系

monitoring 可以继续作为兼容读取与健康投影入口。

自动驾驶可解释性层可消费 monitoring projection 中的：

- mission 状态；
- workflow 状态；
- session 状态；
- runtime 健康摘要；
- 最近错误或等待信号。

但 monitoring 不应被描述为独立的自动驾驶事实源。

### 与 lineage 的关系

lineage 可用于增强证据提示与跨对象关联。

准确口径：

- 可以通过 `lineageId` 或 relation index 关联部分证据；
- 可以把 artifact、audit entry、runtime event 与解释对象建立线索；
- 不应声称所有 runtime event 已统一直写 lineage；
- 不应把 lineage 当成当前唯一或完整事实源。

## 解释生成流程

### 1. 收集事实

从以下来源读取事实：

- mission；
- workflow instance；
- node run；
- runtime event；
- route planner；
- drive state projection；
- takeover / decision；
- review / audit；
- replay / artifact / log。

### 2. 归一信号

将事实归一为高层遥测信号，例如：

- 当前 Drive State 是否变化；
- 当前步骤是否推进；
- 是否出现等待输入；
- 风险是否升高；
- 置信度是否下降；
- 是否出现新证据；
- 是否触发接管或重规划。

### 3. 生成解释对象

根据不同信号生成解释对象：

- 状态变化生成 `CurrentStateExplanation`；
- 路线推荐生成 `RecommendationReason`；
- 路线或步骤变化生成 `RemainingStepsExplanation`；
- 风险变化生成 `RiskExplanation`；
- 置信度变化生成 `ConfidenceExplanation`；
- 证据变化生成 `EvidenceHint`。

### 4. 分发消费

解释对象可被以下界面消费：

- 驾驶舱当前状态区；
- 路线推荐卡；
- 剩余步骤区域；
- 风险与置信度提示；
- 接管面板；
- replay 时间线；
- audit 查询结果；
- evidence dock。

### 5. 失效与更新

当发生以下情况时，旧解释必须被更新或标记为失效：

- Drive State 变化；
- Route 被重新选择；
- Replan 发生；
- 用户完成接管；
- 风险被缓解；
- 证据被补齐；
- 任务完成或终止。

## 与任务自动驾驶对象的映射

| 自动驾驶对象 | 可解释性对象 | 遥测信号 | 说明 |
| ---- | ---- | ---- | ---- |
| `Destination` | 目标理解置信度、目标歧义风险 | `confidence.changed` / `risk.changed` | 解释目标是否明确 |
| `Route` | 推荐原因、剩余步骤 | `route.recommended` / `route.selected` | 解释为什么这样走 |
| `Drive State` | 当前状态解释 | `drive_state.changed` | 解释现在在哪里 |
| `Fleet` | 当前执行角色解释 | `step.progressed` | 解释谁在做什么 |
| `Takeover Point` | 接管原因、风险提示、默认动作解释 | `takeover.requested` / `takeover.resolved` | 解释为什么交还方向盘 |
| `Replan` | 重规划原因、剩余步骤变化 | `route.replanned` | 解释为什么换路 |
| `Confidence` | 置信度解释 | `confidence.changed` | 解释把握程度 |
| `Risk` | 风险解释 | `risk.changed` | 解释风险与缓解动作 |
| Evidence | 证据提示 | `evidence.updated` | 解释依据在哪里 |

## 兼容策略

### 策略 1：优先投影，不重写事实源

首阶段应优先在 view model 或 projection 层构建解释，不要求改造所有 runtime event。

### 策略 2：关键解释逐步服务端化

会影响用户决策、风险接受、权限审批、预算确认、路线切换的解释，应优先沉淀到服务端 projection、replay 或 audit。

### 策略 3：低风险解释允许轻量推导

普通状态摘要、轻量剩余步骤说明，可以先由前端组合信号生成，但需要保留来源标记。

### 策略 4：事件命名保持兼容

新增高层信号不应和现有 runtime events 抢命名空间。
底层仍使用已有 Web-AIGC observability event catalog，高层使用自动驾驶解释信号进行投影。

### 策略 5：证据不足必须显式表达

如果某个解释没有足够证据，应显示“证据不足”或“基于当前信号推断”，而不是伪装为确定事实。

## 风险与边界

### 风险 1：解释层变成纯文案层

如果解释无法追溯到 runtime、route、audit 或 replay，用户看到的只是包装文案。
因此每个关键解释必须带 `source` 和 `evidenceRefs`。

### 风险 2：过早承诺统一 telemetry backend

当前主仓更准确的状态是最小 observability / replay / audit 闭环，而不是完整统一 telemetry 平台。
因此本 spec 只能定义高层信号语义和映射方式，不宣称底层总线已经完成。

### 风险 3：置信度伪精确

如果把置信度简单写成百分比，会造成虚假的确定性。
因此首阶段建议使用 `low / medium / high / unknown` 等级和解释文本。

### 风险 4：证据提示夸大 lineage 能力

当前 lineage 更适合作为关联线索和增强方向。
解释层可以使用 lineage 关联，但不能声称所有 runtime evidence 已全量进入 lineage。

### 风险 5：实时解释无法回放

如果解释只存在于前端内存，任务完成后无法复盘。
因此关键解释需要进入 replay 或 audit，至少要能由 runtime events 重建。

## 分阶段落地建议

### 第一阶段：文档与对象口径

- 固化解释对象类型；
- 固化高层遥测信号目录；
- 明确与 runtime events / replay / audit 的关系；
- 明确不替代现有观测系统。

### 第二阶段：前端 view model

- 在驾驶舱或任务详情页生成当前状态解释；
- 展示推荐原因、剩余步骤、风险、置信度和证据提示；
- 标注解释来源。

### 第三阶段：服务端 projection

- 服务端生成可复用解释对象；
- 将关键解释与 mission / workflow / runtime event 关联；
- 为 replay / audit 提供稳定查询入口。

### 第四阶段：事件与证据增强

- 将高风险解释、接管解释、路线变化解释写入 replay / audit；
- 补充关键高层信号到 runtime event bridge 或 projection；
- 增强 evidence hint 与 artifact / audit / replay 的跳转关系。

### 第五阶段：回放与审计闭环

- 在 replay 中复原解释时间线；
- 在 audit 中查询关键解释与人工决策；
- 支持对“为什么这么做”进行事后追踪。

## 设计结论

本 spec 的结论是：

1. 可解释性与遥测层是任务自动驾驶的信任投影层。
2. 它覆盖当前状态解释、推荐原因、剩余步骤、风险提示、置信度、证据提示与实时状态信号。
3. 它必须建立在现有 mission / workflow / runtime events / replay / audit / observability 之上。
4. 它不替代现有 runtime，也不新建独立 telemetry backend。
5. 它必须支持分阶段落地，先做稳定解释口径，再逐步服务端化和证据化。
