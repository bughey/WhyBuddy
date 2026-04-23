# 设计文档：接管面板与决策点

## 设计目标

接管面板与决策点用于把任务自动驾驶从“全自动黑盒”变成“可看见、可解释、可接管”的协作系统。

设计目标：

- 统一澄清、路线确认、预算、权限、风险接受、交付验收、异常接管等用户介入场景。
- 复用现有 HITL / decision / approval / wait-resume 链路。
- 为 Route、Drive State、Mission Runtime 和审计系统提供一致的接管语义。
- 降低打断感，让接管像导航中的关键路口提示，而不是反复弹窗。

## 总体架构

```text
Route / Drive State / Runtime Event / Governance Signal
  -> Takeover Point Generator
  -> Takeover Queue
  -> Takeover Panel
  -> User Decision
  -> MissionDecision / Approval / Resume / Escalate
  -> Runtime Continue / Retry / Replan / Terminate
  -> Replay / Audit / Evidence
```

## 模型设计

### TakeoverPoint

```ts
type TakeoverPoint = {
  id: string;
  type: TakeoverType;
  status: TakeoverStatus;
  required: boolean;
  title: string;
  description: string;
  reason: string;
  severity: "info" | "warn" | "danger" | "critical";
  routeId?: string;
  routeStepId?: string;
  missionId?: string;
  workflowId?: string;
  runtimeNodeId?: string;
  trigger: TakeoverTrigger;
  options: TakeoverOption[];
  defaultOptionId?: string;
  timeoutPolicy?: TakeoverTimeoutPolicy;
  evidenceRefs: string[];
  createdAt: string;
  resolvedAt?: string;
};
```

### TakeoverType

```ts
type TakeoverType =
  | "clarification"
  | "route_confirmation"
  | "budget_confirmation"
  | "permission_confirmation"
  | "risk_acceptance"
  | "delivery_acceptance"
  | "exception_takeover";
```

### TakeoverStatus

```ts
type TakeoverStatus =
  | "pending"
  | "active"
  | "resolved"
  | "skipped"
  | "expired"
  | "escalated"
  | "cancelled";
```

### TakeoverOption

```ts
type TakeoverOption = {
  id: string;
  label: string;
  description: string;
  action: TakeoverAction;
  severity?: "info" | "warn" | "danger";
  requiresComment?: boolean;
  payload?: Record<string, unknown>;
};
```

### TakeoverAction

```ts
type TakeoverAction =
  | "answer"
  | "approve"
  | "reject"
  | "select_route"
  | "adjust_budget"
  | "grant_permission"
  | "accept_risk"
  | "request_revision"
  | "retry"
  | "replan"
  | "escalate"
  | "terminate"
  | "resume";
```

## 接管队列

接管面板不应只处理单个弹窗，而应维护一个 Takeover Queue。

```ts
type TakeoverQueue = {
  missionId: string;
  activeTakeoverId?: string;
  pendingIds: string[];
  resolvedIds: string[];
  blockedRuntime: boolean;
};
```

队列规则：

- 必须接管优先级高于建议接管。
- `critical` 高于 `danger`，高于 `warn`，高于 `info`。
- 同一 Route Step 下的低风险确认可以合并展示。
- 运行时阻塞类接管会将 `blockedRuntime` 设为 `true`。
- 非阻塞建议接管可以在右侧面板提示，不中断中间执行视图。

## 接管面板信息架构

接管面板建议放在任务自动驾驶三栏驾驶舱右侧，同时可在任务详情页复用。

面板区域：

- 当前接管：展示最需要处理的接管点。
- 决策上下文：展示为什么需要接管、关联路线步骤、影响范围。
- 可选动作：展示按钮、输入框、路线卡片、预算输入或权限范围。
- 推荐默认：展示系统推荐动作和理由。
- 风险与证据：展示风险说明、证据引用、审计提示。
- 历史接管：展示已处理的接管时间线。

## 各类型设计

### 澄清

触发来源：

- Destination 缺少成功标准。
- 用户目标存在歧义。
- Route Planner 无法选择可靠路线。
- Runtime 需要额外输入才能继续。

UI 表达：

- 问题说明。
- 系统推断的默认答案。
- 单选、多选、自由文本或上下文选择。
- “使用默认并继续”动作。

Runtime 映射：

- `waiting`
- `WAITING_INPUT`
- `resume(payload)`
- `request-info` 类型 decision

### 路线确认

触发来源：

- 存在多条候选路线。
- 路线差异会显著影响成本、质量、风险或时长。
- 用户偏好未知。

UI 表达：

- 快速 / 标准 / 深度路线对比。
- 每条路线展示时间、成本、风险、接管次数、预期质量。
- 推荐路线高亮。

Runtime 映射：

- route selection decision。
- 选定后绑定 `recommendedRouteId` 或触发重规划。

### 预算确认

触发来源：

- 预计成本超出默认阈值。
- 需要长时间执行。
- 需要高成本模型、浏览器、外部工具或多轮生成。

UI 表达：

- 预计成本。
- 成本来源。
- 最大预算输入。
- 低成本路线选项。

Runtime 映射：

- cost governance。
- runtime governance budget。
- approval decision。

### 权限确认

触发来源：

- 文件访问。
- 网络访问。
- 外部 API。
- 沙箱执行。
- 浏览器控制。
- 高权限工具。

UI 表达：

- 权限名称。
- 使用目的。
- 权限范围。
- 有效期。
- 风险说明。

Runtime 映射：

- permission / capability check。
- approval decision。
- grant / deny payload。

### 风险接受

触发来源：

- 数据可信度不足。
- 质量不确定。
- 策略敏感。
- 结果可能影响真实业务。
- 工具失败概率高。

UI 表达：

- 风险类型。
- 严重程度。
- 缓解方案。
- 接受风险的确认输入。

Runtime 映射：

- audit evidence。
- risk governance。
- decision history。

### 交付验收

触发来源：

- Route 到达交付阶段。
- Review / Verify 完成。
- 系统建议结束任务。

UI 表达：

- 结果摘要。
- 成功标准覆盖情况。
- 未解决问题。
- 接受交付 / 继续修正 / 深度复核。

Runtime 映射：

- mission completion。
- revise / retry / replan。
- result acceptance decision。

### 异常接管

触发来源：

- 工具失败。
- runtime retry budget 耗尽。
- 质量检查失败。
- 任务偏航。
- 治理策略阻断。
- 人工升级。

UI 表达：

- 出错位置。
- 已尝试恢复动作。
- 推荐恢复策略。
- 重试、换路线、跳过、升级、终止。

Runtime 映射：

- `retry()`
- `escalate()`
- `terminate()`
- `resume()`
- replan record

## 与现有 HITL / decision 的兼容

TakeoverPoint 应映射到现有 `MissionDecision` 或兼容扩展。

```ts
type TakeoverDecisionMapping = {
  takeoverPointId: string;
  missionDecisionId?: string;
  decisionType: string;
  submitEndpoint?: string;
  resumePayload?: Record<string, unknown>;
  approvalRef?: string;
};
```

兼容原则：

- 不绕开 `submitMissionDecision()` 的幂等提交语义。
- 不绕开现有 `MissionStore.markWaiting()` / `resolveWaiting()`。
- 对 workflow runtime 的 `WAITING_INPUT` 使用 `resume(payload)`。
- 对需要人工升级的场景使用 `escalate()`。
- 对失败恢复使用现有 `retry / terminate` 控制面。

## 状态流转

```text
pending
  -> active
  -> resolved

pending
  -> active
  -> escalated

pending
  -> active
  -> expired

pending
  -> skipped

active
  -> cancelled
```

状态说明：

- `pending`：已生成，等待展示或排队。
- `active`：当前正在要求用户处理。
- `resolved`：用户已提交有效决策。
- `skipped`：建议接管被系统默认动作跳过。
- `expired`：超时后按策略处理。
- `escalated`：升级到人工或更高权限。
- `cancelled`：Route 或 Mission 变化导致接管点失效。

## 审计与回放

每个接管点应记录：

- 生成原因；
- 展示给用户的内容；
- 用户看到的选项；
- 用户选择；
- 用户补充说明；
- 触发的 runtime action；
- 关联证据；
- Route / Mission / Workflow / Runtime Event 关联键。

replay 表达：

- 在驾驶时间线上标记“系统请求接管”。
- 展示用户选择后路线如何继续。
- 展示异常接管是否导致 retry、replan、escalate 或 terminate。

audit 表达：

- 预算、权限、风险接受必须记录用户决策。
- 高风险动作必须保留 reason/comment。
- 默认动作必须记录为什么允许默认继续。

## 降低打断策略

接管面板应遵循以下策略：

- 低风险建议接管不阻塞 runtime。
- 多个同类低风险确认合并展示。
- 系统可推断的问题提供默认答案。
- 关键路线选择、预算、权限、风险接受必须显式确认。
- 超时策略只能用于低风险或已有默认授权的场景。

## 非目标

- 不在本 spec 中实现多人投票审批。
- 不在本 spec 中替代完整 BPMN 审批流。
- 不在本 spec 中接入第三方审批系统。
- 不在本 spec 中重构所有 MissionDecision 底层存储。
- 不在本 spec 中承诺开放域 L5 全自动无需接管。
