# 设计文档：任务自动驾驶成功度量体系

## 设计概述

本设计为 Cube Pets Office 增加一层“任务自动驾驶成功度量投影层”，目标不是创造新的业务真相源，而是在现有 `mission / runtime / audit / replay` 之上，建立统一的指标定义、事件归一化、任务级样本与聚合查询能力。

核心设计原则如下：

1. 兼容优先，不推翻现有事实源
2. 原子指标优先，不以单一总分掩盖问题
3. 任务样本优先，每个聚合值都能回溯到 mission 级证据
4. 审计与回放可验证，关键指标必须能被 replay 和 audit 交叉核查
5. 投影优先于重命名，通过归一化层连接产品语义与工程事实

## 设计目标

- 定义任务自动驾驶成功度量的统一指标模型
- 为“送达率、接管率、重规划率、偏航率、完成时长、结果复核通过率、用户确认次数”建立稳定口径
- 明确 mission / runtime / audit / replay 在指标中的职责分工
- 避免产生“报表一套口径、回放另一套口径、审计再一套口径”的碎片化问题
- 为后续 cockpit、dashboard、replay、audit drill-down 提供统一输入

## 总体分层

### 第一层：事实源

现有事实源继续保留原职责：

- `mission`
  - 负责任务实体、生命周期、目标上下文、终态
- `runtime`
  - 负责路线执行、状态推进、接管请求、重试、重规划、复核阶段
- `audit`
  - 负责确认、授权、风险接受、审批、治理类动作的不可篡改证据
- `replay`
  - 负责时间线重建、路径回看、人工核查与调试消费

### 第二层：成功度量投影层

在事实源之上新增统一指标投影：

- `AutopilotMetricEvent`
- `AutopilotMissionMetrics`
- `AutopilotMetricsAggregate`

该层职责是：

- 将多源事实转换为同一套统计事件
- 计算任务级成功样本
- 聚合形成报表与看板指标
- 给 replay / audit / cockpit 提供一致口径

### 第三层：消费层

以下视图优先消费成功度量投影，而不是各自复制统计逻辑：

- 任务自动驾驶驾驶舱
- 遥测与成功度量看板
- replay 时间线侧边栏
- audit 治理视图
- 运营报表与周报导出

## 核心数据模型

### 1. 统一指标事件

```ts
type MetricSource = "mission" | "runtime" | "audit" | "replay";

type AutopilotMetricEventType =
  | "mission_accepted"
  | "autopilot_engaged"
  | "route_committed"
  | "delivery_succeeded"
  | "delivery_failed"
  | "mission_cancelled"
  | "takeover_requested"
  | "takeover_resolved"
  | "user_confirmation_submitted"
  | "replan_started"
  | "replan_completed"
  | "deviation_detected"
  | "review_started"
  | "review_passed"
  | "review_failed"
  | "review_skipped";

interface AutopilotMetricEvent {
  eventId: string;
  missionId: string;
  routeId?: string;
  workflowId?: string;
  runtimeId?: string;
  type: AutopilotMetricEventType;
  timestamp: string;
  source: MetricSource;
  sourceRef: string;
  actorType?: "user" | "agent" | "system";
  required?: boolean;
  reasonCode?: string;
  driveState?: string;
  metadata?: Record<string, unknown>;
}
```

设计说明：

- 该事件层不是新的原始事实源，而是面向统计的归一化投影
- 每个事件都必须保留 `source` 与 `sourceRef`
- 同一事件可由多个事实源支持，但应只选择一个主事件实例进入指标计算，同时保留附加证据引用

### 2. 任务级成功样本

```ts
type MetricsEvidenceState = "complete" | "partial" | "missing" | "conflicted";

interface AutopilotMissionMetrics {
  missionId: string;
  missionTitle?: string;
  autopilotLevel?: "L1" | "L2" | "L3" | "L4" | "L5";
  missionType?: string;
  routeFamily?: string;
  workspaceId?: string;
  included: boolean;
  excludeReason?: "manual_only" | "test_data" | "demo_data" | "cancelled_before_route" | "backfill_only";
  lifecycle: {
    missionAcceptedAt?: string;
    autopilotEngagedAt?: string;
    routeCommittedAt?: string;
    terminalAt?: string;
    terminalState?: "delivered" | "failed" | "cancelled" | "in_progress" | "unknown";
  };
  counters: {
    requiredTakeoverCount: number;
    advisoryTakeoverCount: number;
    userConfirmationCount: number;
    replanCount: number;
    deviationCount: number;
    reviewCount: number;
    reviewPassCount: number;
    reviewFailCount: number;
  };
  booleans: {
    delivered: boolean;
    hadRequiredTakeover: boolean;
    hadReplan: boolean;
    hadDeviation: boolean;
    reviewPassed: boolean;
    firstReviewPassed?: boolean;
  };
  durations: {
    completionMs?: number;
    planningMs?: number;
    executingMs?: number;
    reviewMs?: number;
    takeoverWaitMs?: number;
  };
  evidence: {
    state: MetricsEvidenceState;
    missionRefs: string[];
    runtimeRefs: string[];
    auditRefs: string[];
    replayRefs: string[];
    notes?: string[];
  };
}
```

设计说明：

- `AutopilotMissionMetrics` 是本设计的核心任务级统计单元
- 聚合指标均由该对象派生，而不是直接从页面状态汇总
- `included` 与 `excludeReason` 用于避免分母污染
- `evidence.state` 用于显式暴露数据完整性，而不是把脏数据装作正常数据

### 3. 聚合结果

```ts
interface AutopilotMetricsAggregate {
  window: {
    start: string;
    end: string;
    bucket?: "hour" | "day" | "week";
  };
  dimensions: {
    autopilotLevel?: string;
    missionType?: string;
    routeFamily?: string;
    workspaceId?: string;
    environment?: string;
  };
  counts: {
    eligibleMissions: number;
    deliveredMissions: number;
    missionsWithTakeover: number;
    missionsWithReplan: number;
    missionsWithDeviation: number;
    reviewedMissions: number;
    reviewPassedMissions: number;
    totalUserConfirmations: number;
  };
  rates: {
    deliveryRate?: number;
    takeoverRate?: number;
    replanRate?: number;
    deviationRate?: number;
    reviewPassRate?: number;
    avgUserConfirmationsPerMission?: number;
  };
  durations: {
    completionAvgMs?: number;
    completionP50Ms?: number;
    completionP90Ms?: number;
  };
  quality: {
    completeSamples: number;
    partialSamples: number;
    conflictedSamples: number;
  };
}
```

## 指标定义

### 1. 任务送达率

定义：

- 分子：`delivered = true` 的合格任务数
- 分母：`included = true` 的任务数

任务级判定：

- 成功送达以 `mission / runtime` 的终态投影为主
- `delivery_succeeded` 事件存在时优先判定为 delivered
- 若 mission 显示已完成但缺少 runtime 送达证据，可标记为 `partial`

排除：

- `manual_only`
- `test_data`
- `demo_data`
- `cancelled_before_route`
- `backfill_only`

### 2. 接管率

定义：

- 分子：`hadRequiredTakeover = true` 的合格任务数
- 分母：`included = true` 的任务数

计数规则：

- 仅 `required takeover` 计入接管率主指标
- `advisory takeover` 单独记入辅指标，不混入主接管率
- 一次任务出现多次必需接管，主接管率仍按一次任务计数；次数另由 `requiredTakeoverCount` 保存

### 3. 用户确认次数

定义：

- 任务级统计：任务生命周期内所有显式确认动作次数之和
- 聚合级统计：`totalUserConfirmations / eligibleMissions`

纳入动作：

- `approve`
- `accept`
- `confirm`
- `select_route`
- `grant_permission`
- `accept_risk`
- `delivery_acceptance`

不纳入：

- 纯查看行为
- 系统自动默认动作
- 未真正提交成功的表单输入草稿

### 4. 重规划率

定义：

- 分子：`hadReplan = true` 的已承诺路线任务数
- 分母：发生过 `route_committed` 的任务数

关键边界：

- `retry` 不等于 `replan`
- 同一路线内的预期分支切换不等于 `replan`
- 正式重规划要求出现显式的 `replan_started` 或等价 runtime 事实

### 5. 偏航率

定义：

- 分子：`hadDeviation = true` 的已承诺路线任务数
- 分母：发生过 `route_committed` 的任务数

偏航判定原则：

- 实际执行脱离当前路线承诺
- 关键里程碑、依赖或执行顺序发生非预期偏离
- 偏离后触发纠偏、恢复、接管或重规划之一

不计入偏航：

- 路线内已声明的备选分支
- 纯日志顺序变化但不改变路线语义的事件

### 6. 完成时长

主定义：

- `completionMs = terminalAt - autopilotEngagedAt`

补充拆分：

- `planningMs`
- `executingMs`
- `reviewMs`
- `takeoverWaitMs`

聚合输出：

- `avg`
- `p50`
- `p90`

未终态任务：

- 不进入完成任务时长分布
- 可进入进行中任务监控，但不混入已完成聚合

### 7. 结果复核通过率

定义：

- 分子：`reviewPassed = true` 的已完成复核任务数
- 分母：已完成复核任务数，即 `reviewCount > 0` 且最终状态为 `review_passed` 或 `review_failed`

边界：

- `review_skipped` 不默认进入分母
- 同一任务多轮复核只保留最终结论用于主指标
- 首轮是否通过应保存为辅指标，以支持质量诊断

## 事实源映射

### 1. source of truth 分工

| 指标或字段 | 主事实源 | 次事实源 | 说明 |
| ---- | ---- | ---- | ---- |
| missionAcceptedAt / terminalState | mission | runtime | mission 负责任务实体终态，runtime 用于补全阶段细节 |
| autopilotEngagedAt / routeCommittedAt | runtime | mission | 自动驾驶真正进入路线推进由 runtime 更可靠 |
| requiredTakeoverCount | runtime | audit | runtime 负责“请求接管”，audit 负责“接管提交”证据 |
| userConfirmationCount | audit | runtime | 治理敏感确认以 audit 为主 |
| replanCount | runtime | replay | replay 可辅助核对重规划时间线 |
| deviationCount | runtime | replay | 偏航首先来自运行时判定，replay 用于人工核查 |
| reviewPassCount / reviewFailCount | runtime | audit | runtime 负责复核状态，audit 补充审批与验收痕迹 |
| drill-down timeline | replay | runtime | replay 是消费层主入口，但不替代事实判定 |

### 2. 冲突优先级

建议优先级如下：

1. `runtime` 与 `mission` 用于执行与终态事实判定
2. `audit` 用于用户确认、权限、预算、风险接受等治理事实判定
3. `replay` 主要用于重建时间线与排错，不应在主事实存在时反向覆盖主事实

冲突处理：

- 若 `mission` 与 `runtime` 对终态不一致，样本标记为 `conflicted`
- 若 `audit` 记录了确认提交，但 `runtime` 未恢复推进，保留确认次数，同时标记恢复链路异常
- 若仅有 replay 事件而缺少主事实源，样本标记为 `partial`

## 归一化事件映射

### 1. mission -> metric event

建议映射：

- mission 创建并进入自动驾驶模式 -> `mission_accepted`
- mission 终态为 delivered -> `delivery_succeeded`
- mission 终态为 failed -> `delivery_failed`
- mission 终态为 cancelled -> `mission_cancelled`

### 2. runtime -> metric event

建议映射：

- Drive State / route 生效 -> `autopilot_engaged`、`route_committed`
- 等待人工介入 -> `takeover_requested`
- resume / decision 已处理 -> `takeover_resolved`
- route rewrite / reroute -> `replan_started`、`replan_completed`
- deviation / blocked / reroute trigger -> `deviation_detected`
- review active -> `review_started`
- verify pass / fail -> `review_passed`、`review_failed`

### 3. audit -> metric event

建议映射：

- approve / accept / grant / confirm -> `user_confirmation_submitted`
- 风险接受、权限授权、预算确认、交付验收应保留事件分类与 reason
- 这些 audit 事件既支持计数，也支持 drill-down 证据引用

### 4. replay -> metric evidence

建议使用方式：

- 为任务样本补充时间线片段引用
- 验证偏航、接管、重规划前后顺序
- 支持人工复盘为何某任务被记为失败或偏航

不建议：

- 直接把前端 replay 展示结果当作统计主分母来源

## 派生计算规则

### 1. 样本纳入判定

任务样本满足以下条件时可计入主统计：

- 存在 `mission_accepted` 或等价 mission 进入自动驾驶信号
- 非 `manual_only`
- 非测试 / demo / 纯回灌样本

样本排除必须保留 `excludeReason`，不得仅通过查询条件隐式丢弃。

### 2. 阶段耗时计算

建议从 Drive State 或 runtime phase 投影如下：

- `planningMs`
  - `planning` 段累积时长
- `executingMs`
  - `executing` 段累积时长
- `reviewMs`
  - `reviewing` 段累积时长
- `takeoverWaitMs`
  - 从 `takeover_requested` 到 `takeover_resolved` 的等待时长累积

### 3. 重规划与偏航关联

一个偏航事件可能导致：

- 无需操作，仅记录偏差
- 触发接管
- 触发重规划

因此需要保留以下关联：

- `deviation_detected.eventId -> replan_started.eventId`
- `deviation_detected.eventId -> takeover_requested.eventId`

这样 replay 与 dashboard 才能回答“偏航后发生了什么”。

### 4. 复核通过判定

最终复核状态按最后一个复核终态事件决定：

- 最后事件为 `review_passed` -> 复核通过
- 最后事件为 `review_failed` -> 复核失败

首轮通过单独计算：

- 第一条复核终态事件为 `review_passed` -> 首轮通过

## 查询与展示约束

### 1. 聚合约束

所有聚合展示必须基于 `AutopilotMissionMetrics`，而不是页面临时再算一遍。

原因：

- 避免 dashboard、replay、audit 各自重写口径
- 允许稳定缓存、导出与回溯
- 允许显式展示 `partial / conflicted` 样本比例

### 2. 钻取约束

每个聚合卡片至少应支持钻取到：

- 任务样本列表
- 单任务指标摘要
- 证据引用集合
- replay 深链
- audit 深链

### 3. 时间窗口约束

建议最小支持：

- 最近 24 小时
- 最近 7 天
- 最近 30 天
- 自定义时间范围

聚合时需按 `missionAcceptedAt` 或 `terminalAt` 明确选择时间锚点，默认建议：

- 成功与失败结果类指标使用 `terminalAt`
- 进行中规模类指标使用 `missionAcceptedAt`

## 数据质量与回补策略

### 1. 完整性状态

样本完整性分为：

- `complete`
  - 主事实源与关键证据齐全
- `partial`
  - 主指标可算，但部分证据缺失
- `missing`
  - 关键字段缺失，无法形成有效样本
- `conflicted`
  - 多源事实互相矛盾

### 2. 回补原则

允许通过 replay 或 audit 为旧数据补充证据，但不应在未标记的情况下直接覆盖已有主事实。

建议策略：

- 允许补充 `replayRefs`、`auditRefs`
- 若补充后解除冲突，可将 `partial` 升级为 `complete`
- 若补充仍无法消除主事实矛盾，保持 `conflicted`

## 兼容策略

### 策略 1：不再造新的底层真相源

本设计明确不建议：

- 新建一套脱离 `mission / runtime / audit / replay` 的指标专用主数据模型
- 由前端页面直接定义统计口径并反向成为事实标准

### 策略 2：投影层统一，事实层保持原名

建议通过：

- `mission -> success metric sample`
- `runtime -> metric event`
- `audit -> confirmation evidence`
- `replay -> drill-down timeline`

实现统一，而不是立刻改动大量底层命名。

### 策略 3：先稳定原子指标，再考虑综合分数

当前阶段不建议直接引入“自动驾驶成功分”作为主输出。
更合理的顺序是：

1. 先稳定七个原子指标
2. 再观察哪些指标在不同任务域有可比性
3. 最后才决定是否引入受控的复合评分

## 风险与边界

### 风险 1：把 replay 当成事实源

若直接以 replay 前端展示作为统计真相，会导致：

- 页面改版影响历史口径
- 前端容错逻辑污染指标
- 无法证明与底层事实一致

### 风险 2：把 retry 当成 replan

若普通重试和正式重规划不区分，会导致：

- 路线质量被误判
- 重规划率虚高
- 偏航恢复能力无法解释

### 风险 3：忽略样本排除规则

若测试、demo、纯人工、回灌任务混入分母，会导致：

- 送达率和接管率失真
- 环境之间不可比
- 运营判断被噪音污染

### 风险 4：不显示数据完整性

若 `partial` 与 `conflicted` 样本被静默吞并，最终会造成：

- 指标看似平滑，实则不可核查
- audit 与 dashboard 数字对不上
- 团队误以为口径已经稳定

## 设计结论

本 spec 的最终设计结论是：

1. 任务自动驾驶成功度量应建立统一的任务级样本模型
2. 七个核心指标必须具备明确分子、分母、时间锚点与排除规则
3. `mission / runtime / audit / replay` 应被整合为“事实源 + 投影层 + 消费层”的关系，而不是互相争夺主真相
4. replay 负责解释和核查，audit 负责治理证据，mission/runtime 负责执行事实
5. 所有聚合展示应从统一投影层派生，避免多套口径并存
