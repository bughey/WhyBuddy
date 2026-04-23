# 设计文档：任务自动驾驶恢复机制与人工接管治理

## 设计概述

本设计旨在把任务自动驾驶中的“偏航、失败、恢复、接手、升级”统一收敛为一条可解释的治理链路：

```text
Runtime / Review / Governance / Human Feedback Signal
  -> Deviation Detector
  -> Recovery Classifier
  -> Recovery Strategy Planner
  -> Auto Recovery / Degraded Execution / Human Takeover / Escalation
  -> Resume / Replan / Review / Terminate
  -> Replay / Audit / Evidence
```

设计目标：

- 把运行时失败与质量治理失败统一纳入恢复框架
- 在自动恢复和人工接手之间建立清晰边界
- 让降级执行成为显式、可治理、可审计的正式能力
- 让人工接手之后能回到自动链路继续推进
- 与现有 `Drive State`、`Takeover Point`、`MissionDecision`、`retry / resume / escalate / replan` 兼容

## 设计原则

- 不新增一套孤立 runtime，而是在现有 Mission Runtime 与 HITL 之上做投影和编排增强
- 优先最小恢复，避免直接放大为人工接手
- 高风险动作必须显式治理，不允许静默恢复
- 所有恢复动作都必须留下证据链
- 恢复不只面向报错，也面向偏航、质量失败和治理命中

## 总体架构

```text
Runtime Event / Review Result / Governance Signal / Human Feedback
  -> Deviation Detector
  -> Recovery Coordinator
     -> Recovery Attempt Ledger
     -> Governance Boundary Checker
     -> Takeover Bridge
     -> Escalation Bridge
  -> Runtime Action
     -> retry
     -> resume
     -> replan
     -> revise
     -> degrade
     -> terminate
  -> Projection Layer
     -> Drive State
     -> Takeover Queue
     -> Replay Timeline
     -> Audit Chain
```

建议新增的高层模块：

- `DeviationDetector`
  负责聚合运行时、质量、治理和人工反馈信号，输出结构化偏航或失败事件。
- `RecoveryCoordinator`
  负责选择恢复策略、控制恢复顺序、判断是否进入人工接手或升级。
- `RecoveryAttemptLedger`
  负责记录恢复尝试、次数、预算消耗和结果。
- `GovernanceBoundaryChecker`
  负责在恢复动作执行前校验预算、权限、风险和外部副作用边界。
- `TakeoverBridge`
  负责把需要人工的恢复策略映射为 `Takeover Point` 与 `MissionDecision`。
- `EscalationBridge`
  负责把无法在当前自动或普通人工层级解决的问题升级到更高权限流程。

## 模型设计

### 1. DeviationEvent

```ts
type DeviationEvent = {
  id: string;
  missionId: string;
  routeId?: string;
  routeStepId?: string;
  workflowId?: string;
  runtimeNodeId?: string;
  category: DeviationCategory;
  severity: "info" | "warn" | "danger" | "critical";
  triggerKind: "runtime" | "review" | "verify" | "audit" | "governance" | "human-feedback" | "external-change";
  summary: string;
  reason: string;
  evidenceRefs: string[];
  detectedAt: string;
  detectedInDriveState: DriveState;
  recoverable: boolean;
};
```

### 2. DeviationCategory

```ts
type DeviationCategory =
  | "goal_deviation"
  | "route_deviation"
  | "quality_deviation"
  | "governance_deviation"
  | "dependency_failure"
  | "state_block"
  | "recovery_exhausted";
```

说明：

- `goal_deviation`：结果方向与目标不一致
- `route_deviation`：执行路径明显脱离当前路线
- `quality_deviation`：review / verify 不达标
- `governance_deviation`：预算、权限、风险或策略命中边界
- `dependency_failure`：依赖不可用
- `state_block`：自动链路无法继续
- `recovery_exhausted`：已尝试恢复但仍未恢复

### 3. RecoveryStrategy

```ts
type RecoveryStrategy = {
  id: string;
  type: RecoveryStrategyType;
  scope: "node" | "step" | "stage" | "route" | "mission";
  automatic: boolean;
  requiresHumanApproval: boolean;
  requiresComment: boolean;
  governanceChecks: GovernanceCheckKind[];
  expectedImpact: RecoveryImpact;
  fallbackStrategyIds?: string[];
};
```

### 4. RecoveryStrategyType

```ts
type RecoveryStrategyType =
  | "retry"
  | "substitute_executor"
  | "restore_snapshot"
  | "skip_non_critical"
  | "rollback_to_checkpoint"
  | "degrade_execution"
  | "revise_then_review"
  | "replan_stage"
  | "human_confirm_continue"
  | "human_takeover"
  | "escalate_exception"
  | "terminate";
```

### 5. RecoveryImpact

```ts
type RecoveryImpact = {
  costImpact: "lower" | "same" | "higher" | "unknown";
  qualityImpact: "lower" | "same" | "higher" | "unknown";
  riskImpact: "lower" | "same" | "higher" | "unknown";
  permissionImpact: "lower" | "same" | "higher" | "unknown";
  automationImpact: "more_manual" | "same" | "more_auto";
};
```

### 6. RecoveryAttempt

```ts
type RecoveryAttempt = {
  id: string;
  missionId: string;
  deviationEventId: string;
  strategyType: RecoveryStrategyType;
  status: "planned" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
  reason: string;
  governanceDecision?: "allowed" | "denied" | "needs_takeover" | "needs_escalation";
  startedAt: string;
  finishedAt?: string;
  comment?: string;
  triggeredBy: "system" | "user" | "operator" | "policy";
};
```

### 7. RecoveryDecisionPoint

`RecoveryDecisionPoint` 是恢复场景下的人工接手桥接对象，可映射到现有 `Takeover Point`。

```ts
type RecoveryDecisionPoint = {
  id: string;
  missionId: string;
  deviationEventId: string;
  kind: "recovery" | "degrade" | "resume" | "escalation";
  required: boolean;
  title: string;
  description: string;
  recommendedStrategyType?: RecoveryStrategyType;
  options: RecoveryDecisionOption[];
  requiresExplicitAcceptance: boolean;
  evidenceRefs: string[];
};
```

## 偏航检测设计

### 信号来源

偏航检测由以下信号共同驱动：

- runtime 信号
  - 节点报错
  - 超时
  - 重试预算耗尽
  - 执行器不可用
- quality 信号
  - review 失败
  - verify 失败
  - revise 后仍不达标
- governance 信号
  - 成本超预算
  - 权限越界
  - 风险超阈值
  - 外部副作用策略阻断
- route 信号
  - 当前步骤输出与路线约束不一致
  - 关键里程碑未满足
- human 信号
  - 用户指出方向错了
  - 用户要求改线
  - 用户拒绝风险或预算

### 触发强度

建议将信号分为两类：

- 强触发
  - runtime 明确失败
  - governance 明确阻断
  - verify 明确失败
  - 用户明确要求改线或终止
- 弱触发
  - confidence 下降
  - review 给出较弱警告
  - 中间产物与预期存在可修复偏差

处理原则：

- 任一强触发可直接生成 `DeviationEvent`
- 多个弱触发叠加可升级为 `DeviationEvent`
- 弱触发优先尝试局部恢复或 revise，不立即进入重接管

## 恢复策略规划

### 恢复层级

恢复动作按从轻到重的顺序规划：

1. 节点级重试
2. 节点级替代执行
3. 恢复到最近稳定检查点
4. 跳过非关键步骤
5. 降级执行
6. revise 后重进 review / verify
7. 阶段级 replan
8. 人工确认继续
9. 人工接手
10. 异常升级
11. 终止任务

选择原则：

- 优先局部，后全局
- 优先自动，后人工
- 优先低风险，后高风险
- 优先保留原路线，必要时再改线

### 策略矩阵

| 异常类型 | 首选策略 | 次选策略 | 必须人工条件 |
| ---- | ---- | ---- | ---- |
| `dependency_failure` | `retry` / `substitute_executor` | `degrade_execution` / `replan_stage` | 需要更高权限或更高成本时 |
| `quality_deviation` | `revise_then_review` | `replan_stage` / `human_confirm_continue` | 主观质量判断或业务风险高时 |
| `governance_deviation` | `human_confirm_continue` | `degrade_execution` / `escalate_exception` | 命中高风险或高权限边界时 |
| `route_deviation` | `rollback_to_checkpoint` | `replan_stage` / `human_takeover` | 路线变更影响交付承诺时 |
| `goal_deviation` | `human_confirm_continue` | `replan_stage` / `human_takeover` | 目标解释需要责任确认时 |
| `state_block` | `restore_snapshot` / `retry` | `human_takeover` / `escalate_exception` | 自动恢复预算耗尽时 |
| `recovery_exhausted` | `human_takeover` | `escalate_exception` / `terminate` | 默认进入人工或升级 |

## 降级执行设计

### 降级维度

`degrade_execution` 不是单一动作，而是一个受治理约束的策略包，至少支持以下维度：

- 模型降级
  - 从高成本模型切换到低成本模型
  - 从深度推理切换到标准推理
- 路线降级
  - 从深度路线切换到标准路线
  - 从全自动闭环切换到半自动路线
- 权限降级
  - 从可写切换到只读
  - 从执行外部动作切换到给出建议
- 范围降级
  - 缩小处理数据范围
  - 跳过非关键增强步骤

### 降级准入

降级执行必须先通过 `GovernanceBoundaryChecker`：

- 是否仍满足最低交付标准
- 是否违反用户明确要求
- 是否降低到不可接受质量
- 是否绕过高风险审批
- 是否引入新的外部副作用

若任一项不满足：

- 不允许自动降级
- 转为 `human_confirm_continue` 或 `human_takeover`

## 人工接手设计

### 人工确认后继续 vs 人工直接接手

两者必须区分：

- `human_confirm_continue`
  - 系统仍是执行主体
  - 人类只负责选择恢复策略、确认边界或补充上下文
  - 适合预算、权限、风险接受、低幅度改线
- `human_takeover`
  - 人类成为当前阶段主导者
  - 系统等待人类决策、修正、选择路线或直接操作
  - 适合恢复耗尽、目标偏航、复杂质量争议、高风险异常

### 接手范围

人工接手范围建议支持：

- `step`
  - 只接手当前步骤恢复
- `stage`
  - 接手当前阶段策略与结果
- `route`
  - 接手路线改写与后续策略
- `mission`
  - 接手整任务后续走向

### 与 Takeover Point 的兼容映射

```ts
type RecoveryTakeoverMapping = {
  recoveryDecisionPointId: string;
  takeoverType: "exception_takeover" | "risk_acceptance" | "route_confirmation" | "delivery_acceptance";
  missionDecisionType: "approve" | "request-info" | "multi-choice" | "escalate" | "custom-action";
  actionMapping: Record<string, RecoveryStrategyType>;
};
```

映射原则：

- 需要人工处理时进入现有 `Takeover Queue`
- 需要等待人工时进入 `waiting` 或 `WAITING_INPUT`
- 人工提交后复用 `submitMissionDecision()`
- 决策通过后调用 `resume()`、`replan` 或 orchestrator 继续

## 恢复后继续设计

### Resume 路径

恢复成功后，任务可回到以下高层状态：

- `executing`
  - 自动恢复成功，继续原执行链
- `reviewing`
  - revise 或恢复后需要重新复核
- `replanning`
  - 路线已变更，需要重新生成执行计划
- `takeover-required`
  - 仍有未解决治理或人工问题
- `delivered`
  - 恢复后完成交付且通过校验

### 继续前校验

任何恢复后的继续动作都必须重新执行以下检查：

- 当前治理边界是否仍允许继续
- 当前路线是否仍有效
- 当前人工批准是否覆盖后续动作
- 当前 review / verify 是否要求再次执行

## 与 Drive State 的映射

| 恢复阶段 | 对应 Drive State | 说明 |
| ---- | ---- | ---- |
| 偏航检测中 | `executing` / `reviewing` | 在原状态内发现异常 |
| 自动恢复中 | `blocked` 或 `executing` | 取决于是否阻塞主链 |
| 等待人工恢复决策 | `takeover-required` | 进入人工链路 |
| 改线恢复中 | `replanning` | 重新规划路线 |
| 恢复后重新复核 | `reviewing` | 防止带病继续 |
| 恢复成功继续 | `executing` | 回到主链 |

说明：

- `blocked` 不是终态，而是“当前无法自动推进且恢复尚未完成”
- `replanning` 与 `retry` 不同，它代表正式改写路线
- `reviewing` 也可以成为恢复入口，而不是只在结果末尾出现

## 与 review / audit / revise / verify 的兼容

### review

- 发现结果偏弱但可修补时，优先进入 `revise_then_review`
- 发现方向错误时，升级为 `goal_deviation` 或 `route_deviation`

### verify

- 明确不通过时，生成强触发 `DeviationEvent`
- 若可通过补证据解决，可进入人工确认或 revise

### revise

- `revise` 不是独立终态，而是恢复策略中的一种
- revise 成功后应返回 `reviewing` 或 `executing`

### audit

- audit 命中治理问题时，默认视为 `governance_deviation`
- 可能导致 `human_confirm_continue`、`human_takeover` 或 `escalate_exception`

## 与 runtime governance 的兼容

`GovernanceBoundaryChecker` 在每个恢复策略执行前都要运行。

建议治理检查维度：

- `retry_budget`
- `cost_budget`
- `permission_scope`
- `risk_level`
- `external_side_effect`
- `automation_level`

治理结果分类：

- `allowed`
  - 允许自动执行恢复
- `needs_takeover`
  - 可以做，但必须人工确认
- `needs_escalation`
  - 普通人工确认不够，需要更高层级审批或升级
- `denied`
  - 不允许执行该恢复动作

## 异常升级设计

### 触发条件

以下场景建议进入 `escalate_exception`：

- 自动恢复预算已耗尽
- 人工接手仍无法决策
- 需要超出当前权限边界的操作
- 风险等级达到 `critical`
- 任务可能造成真实外部副作用
- 审计或合规要求更高等级审批

### 升级后动作

升级后任务可进入三种处理结果：

- `takeover-required`
  - 等待更高权限人工处理
- `blocked`
  - 冻结任务，保留证据，等待治理响应
- `terminate`
  - 强制停止任务并记录终止原因

## 审计与回放

### Recovery Attempt Ledger

每次恢复尝试至少记录：

- 偏航事件 ID
- 恢复策略类型
- 触发来源
- 治理判断
- 是否自动执行
- 是否需要人工评论
- 开始与结束时间
- 成功或失败原因

### replay 表达

在回放时间线上至少展示：

- 何时检测到偏航或失败
- 当时处于什么 Drive State
- 系统先尝试了哪些恢复动作
- 哪一步进入人工接手
- 人工最终选择了什么
- 恢复后回到了执行、重规划、复核还是终止

### audit 表达

在审计链中至少记录：

- 高风险降级执行
- 人工批准继续或风险接受
- 权限、预算、外部副作用相关恢复
- 异常升级与终止
- 默认自动恢复为何被允许

## 与现有基础设施的兼容方案

### 兼容现有 MissionDecision

恢复场景下不新增独立提交协议，优先使用现有决策体系承载：

- `approve`
  - 批准继续、批准降级、批准恢复
- `request-info`
  - 要求补充上下文或人工填写理由
- `multi-choice`
  - 在多种恢复策略之间选择
- `escalate`
  - 升级到更高权限人工处理
- `custom-action`
  - 特殊恢复动作

### 兼容现有 runtime 控制面

- 节点重试映射到 `retry`
- 人工处理后继续映射到 `resume`
- 改线恢复映射到 `replan`
- 质量修正映射到 `revise`
- 升级映射到 `escalate`
- 不可恢复时映射到 `terminate`

### 兼容现有接管面板

恢复决策点进入现有接管队列，但增加以下信息：

- 当前恢复层级
- 已尝试恢复动作
- 推荐恢复策略
- 降级影响说明
- 继续后需要重新 review / verify 的提示

## 分阶段落地建议

### 第一阶段：语义与事件层

- 定义 `DeviationEvent`、`RecoveryStrategy`、`RecoveryAttempt`
- 梳理 runtime / review / governance 信号映射
- 建立最小恢复事件投影

### 第二阶段：恢复控制与接管桥接

- 建立 `RecoveryCoordinator`
- 将恢复决策映射到 `Takeover Point` 和 `MissionDecision`
- 接入 `retry / resume / replan / escalate / terminate`

### 第三阶段：可视化与治理集成

- 在驾驶舱和任务详情中展示恢复状态
- 在 replay / audit 中展示恢复时间线
- 将治理命中与恢复动作打通

### 第四阶段：策略优化

- 灰度调整自动恢复阈值
- 优化降级策略矩阵
- 补充更细粒度异常升级流程

## 非目标

- 不在本 spec 中要求重写现有 workflow engine
- 不在本 spec 中实现外部值班系统或 Pager 集成
- 不在本 spec 中定义多人审批编排
- 不在本 spec 中承诺所有异常都能自动恢复
