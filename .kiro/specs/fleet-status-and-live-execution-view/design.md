# 设计文档：车队状态与实时执行主视图

## 设计概述

“车队状态与实时执行主视图”是任务自动驾驶驾驶舱中的执行主屏。
它的设计目标不是替代现有 mission 详情页、runtime 面板或 replay 页面，而是在这些能力之上建立一个“用户可直接理解的实时总览层”。

这个主视图要完成两个翻译动作：

1. 把底层 `agent / node / executor / runtime / evidence` 翻译成“当前车队如何推进任务”
2. 把线性或碎片化的运行事实翻译成“当前在哪一步、谁在做、做出了什么、为什么停住、能否恢复”

因此，本设计的核心是“投影层”而不是“重写底层运行时”。

## 设计原则

- 上层抽象必须建立在现有真实运行态之上
- 一类信息只能有一个主入口，避免首页、任务页、dock、debug 多处并列竞争
- 角色层是面向用户的包装层，node / agent / executor 是底层事实层
- 并行状态必须被看见，但不能破坏主线可读性
- 中间产物必须可预览、可追踪、可关联到步骤和角色
- 阻塞和等待必须显式，而不是埋在日志里

## 视图对象模型

建议为前端主视图定义一组投影对象。

### 1. FleetExecutionView

```ts
type FleetExecutionView = {
  taskId: string;
  missionId?: string;
  workflowInstanceId?: string;
  goalSummary: {
    title: string;
    summary: string;
  };
  currentStage: StageSummary;
  currentStep: StepSummary;
  fleetRoles: FleetRoleCard[];
  parallelLanes: ParallelLaneSummary[];
  blockers: BlockerSummary[];
  intermediateOutputs: IntermediateOutputSummary[];
  evidence: EvidenceDockSummary;
  runtimeHealth: RuntimeHealthSummary;
  updatedAt: string;
};
```

### 2. FleetRoleCard

```ts
type FleetRoleCard = {
  roleId: string;
  roleType:
    | "planner"
    | "clarifier"
    | "researcher"
    | "generator"
    | "reviewer"
    | "auditor"
    | "executor"
    | "custom";
  title: string;
  status: "idle" | "running" | "waiting" | "blocked" | "failed" | "done";
  responsibility: string;
  boundAgents: string[];
  boundNodeIds: string[];
  boundExecutors: string[];
  currentFocus?: string;
};
```

### 3. StepSummary

```ts
type StepSummary = {
  stepId: string;
  title: string;
  phase: string;
  status: "pending" | "running" | "waiting" | "blocked" | "retrying" | "failed" | "done";
  ownerRoleIds: string[];
  startedAt?: string;
  updatedAt?: string;
  progressText?: string;
};
```

### 4. ParallelLaneSummary

```ts
type ParallelLaneSummary = {
  laneId: string;
  title: string;
  status: "running" | "waiting" | "blocked" | "failed" | "done";
  roleIds: string[];
  nodeIds: string[];
  executorIds: string[];
  outputCount: number;
};
```

### 5. BlockerSummary

```ts
type BlockerSummary = {
  blockerId: string;
  type:
    | "clarification"
    | "approval"
    | "callback"
    | "executor"
    | "permission"
    | "governance"
    | "tool_failure"
    | "unknown";
  title: string;
  reason: string;
  ownerRoleId?: string;
  relatedStepId?: string;
  recoverability: "auto" | "manual" | "takeover_required" | "unknown";
};
```

### 6. IntermediateOutputSummary

```ts
type IntermediateOutputSummary = {
  outputId: string;
  title: string;
  outputType: "text" | "file" | "image" | "link" | "code" | "summary" | "other";
  status: "draft" | "proposed" | "accepted" | "superseded";
  stepId?: string;
  roleId?: string;
  artifactRef?: string;
  previewText?: string;
};
```

## 分层设计

建议将该主视图拆成 4 层：

1. 事实层
2. 投影层
3. 交互层
4. 证据层

### 1. 事实层

事实层来自现有主仓：

- mission 状态
- workflow 实例状态
- node run 状态
- agent 记录
- executor 状态
- logs / artifacts / runtime callbacks
- HITL 决策与等待态

这层不新增产品语义，只读取真实执行态。

### 2. 投影层

投影层将事实层转换为用户可读对象：

- node / agent -> fleet role
- workflow current node -> current step
- parallel node runs -> parallel lanes
- waiting / governance block / failed callback -> blockers
- artifact / intermediate result -> intermediate outputs

### 3. 交互层

交互层负责展示与跳转：

- 主线步骤区
- 角色编队区
- 并行执行区
- 中间产物区
- 阻塞与等待区
- 证据 dock 入口

### 4. 证据层

证据层负责承接：

- Logs
- Artifacts
- Runtime
- Recent action / failure
- Callback / socket 状态

它是主视图的可展开辅助层，而不是与主视图同权竞争的另一套主页面。

## 与现有对象的兼容映射

### 1. agent 到 fleet role 的映射

现有 agent 体系不应直接原样暴露给用户，而应通过角色包装：

| 底层对象 | 上层角色映射 |
| --- | --- |
| 规划类 agent / manager | Planner |
| 参数收集 / 用户输入 / 澄清节点 | Clarifier |
| 检索、知识、搜索节点 | Researcher |
| 生成、转换、编写类节点 | Generator |
| review / verify / judge 节点 | Reviewer |
| audit / lineage / compliance 相关单元 | Auditor |
| browser / native / sandbox executor | Executor |

映射原则：

- 一个角色可以绑定多个 node / agent / executor
- 一个底层单元在不同任务中可属于不同角色
- 若无法分类，可进入 `custom` 角色

### 2. node 到 current step 的映射

`current step` 不必等于某一个单独 node，但必须能由 node run 状态稳定投影。

建议规则：

- 正在执行的关键 node 对应当前步骤
- 若多 node 并行，则保留一个主步骤，同时把并行支路投影到 `parallel lanes`
- `WAITING_INPUT`、`blocked retry`、`escalated` 等状态需直接投影到步骤状态

### 3. executor 到 runtime health 的映射

执行器不应只出现在技术面板中，也应成为主视图中的执行健康信号。

建议展示：

- 当前使用的 executor 类型
- 运行中 executor 数量
- 最近失败 executor
- callback / socket / preview 可用性

### 4. artifact 与中间结果映射

artifact 既是证据，也可能是中间结果。
建议采用双重投影：

- 在中间产物区展示用户能理解的结果片段
- 在证据区保留完整 artifact 入口

## 布局设计

建议主视图在驾驶舱中占据中间主区域，布局分为 5 块：

1. 顶部执行摘要
2. 主线步骤条
3. 角色编队区
4. 并行执行与中间产物区
5. 阻塞与证据区

### 1. 顶部执行摘要

包含：

- 当前目标摘要
- 当前阶段
- 当前步骤
- 当前总体状态

### 2. 主线步骤条

以阶段流或步骤流方式展示：

- 已完成
- 进行中
- 等待中
- 阻塞
- 失败

### 3. 角色编队区

展示当前活跃角色卡片，重点看：

- 谁在工作
- 谁在等待
- 谁被阻塞
- 谁已经完成

### 4. 并行执行与中间产物区

并行分支应在视觉上并列，但要受主线约束。
每个分支应展示：

- 分支标题
- 当前状态
- 绑定角色
- 最新产物

### 5. 阻塞与证据区

阻塞点应优先级更高，避免被埋没。
证据区则负责承接深层内容：

- logs
- artifacts
- runtime details

## 实时更新机制

主视图应消费现有稳定更新源：

- socket 事件
- callback 状态
- runtime poll
- mission / workflow 状态刷新

建议机制：

- 关键状态走增量刷新
- 大型证据列表延迟加载
- 中间结果采用“最近更新优先”

## 阻塞与恢复设计

阻塞是自动驾驶主视图的关键对象，建议统一归一为：

- 信息不足
- 审批未决
- 外部回调未完成
- 执行器失败
- 治理阻塞
- 工具调用失败

每个阻塞点需带：

- 标题
- 原因
- 所属步骤
- 所属角色
- 可恢复性
- 建议动作

## 与现有 runtime 证据体系的关系

该主视图不替代 replay / debug / audit，而是负责把证据“拉近到执行上下文”。

关系定义如下：

- 主视图：实时执行主屏
- runtime dock：实时证据主出口
- replay：任务完成后的回放与复盘
- debug：低频调试与系统级诊断

## 风险与边界

### 风险 1：角色层成为空壳包装

如果角色无法稳定映射到真实运行态，视图会失真。
因此必须以映射层而非硬编码角色文案实现。

### 风险 2：并行状态把主线冲散

如果所有分支都被平权展示，用户会失去“当前任务主线”感。
因此需要保留一个主步骤和一个主阶段。

### 风险 3：证据重复入口继续扩散

如果 logs / artifacts / runtime 同时在多个板块做同级主入口，视图会继续失控。
因此必须有统一证据出口。

### 风险 4：过早重写底层 schema

该 spec 的目标是视图投影，不是重写 mission / runtime 模型。
首轮应优先通过映射层完成。

## 开放问题

- 角色卡是否需要允许用户展开看到绑定的 node / executor 明细
- 并行分支是否需要支持折叠和优先级排序
- 中间产物是否需要支持“被哪个步骤采用”的血缘关系
- 主视图是否应直接承接部分 takeover 操作，还是只展示状态后跳转
