# 设计文档：Destination 模型与解析器

## 设计概述

`Destination` 是任务自动驾驶体系中的“目标对象层”。
它的职责不是代替现有 `mission` 和 `workflow`，而是在它们之上增加一个更贴近用户意图的结构化入口，使系统能够从“接收一段文本”升级为“理解一个要送达的结果”。

设计原则如下：

- 先引入上位对象，不直接推翻现有 mission / workflow 体系
- 先做结构化解析与映射，再逐步推动 route 和 cockpit 能力
- 所有关键字段都要保留来源、置信度和是否需要澄清
- 支持“原始输入 -> Destination -> mission/workflow payload”的降级兼容链路

## 设计目标

本设计要解决以下问题：

- 用户输入往往过于自然语言化，无法直接用于稳定规划
- mission 输入和 workflow 输入当前偏执行态，缺少目标层显式建模
- runtime 常在中途才发现约束缺失、成功标准不明或任务类型不清
- review / audit 缺少上游“任务理解依据”的结构化证据

## 核心对象设计

### 1. Destination 对象

建议的核心结构如下：

```ts
type Destination = {
  id: string;
  sourceInput: {
    text: string;
    attachments: DestinationAttachmentRef[];
    source: "chat" | "mission_form" | "workflow_launch" | "api";
    submittedAt: string;
  };
  normalizedGoal: GoalSummary;
  subGoals: SubGoal[];
  constraints: DestinationConstraint[];
  successCriteria: SuccessCriterion[];
  missingInformation: MissingInformationItem[];
  taskType: DestinationTaskType;
  auxiliaryTaskTypes: DestinationTaskType[];
  confidence: DestinationConfidence;
  assumptions: DestinationAssumption[];
  suggestedClarifications: ClarificationPrompt[];
  evidence: DestinationEvidence[];
  mappedMissionContext: MissionInputProjection;
  mappedWorkflowInput: WorkflowInputProjection;
  version: number;
};
```

### 2. 目标对象拆解

#### `normalizedGoal`

表示系统对用户目标的归一化理解，应至少包含：

- `title`：一句话目标标题
- `summary`：面向规划器的目标摘要
- `expectedDeliverables`：预期交付物
- `businessIntent`：业务意图或使用意图

#### `subGoals`

表示可进一步拆分的子目标，每个子目标建议包含：

- `id`
- `title`
- `description`
- `priority`
- `dependsOn`
- `statusHint`

#### `constraints`

每条约束建议包含：

- `type`
- `value`
- `required`
- `source`
- `confidence`
- `blockingLevel`

#### `successCriteria`

每条成功标准建议包含：

- `description`
- `metricType`
- `required`
- `source`
- `confidence`

#### `missingInformation`

每条缺失信息建议包含：

- `field`
- `question`
- `reason`
- `blockingLevel`
- `canInferByDefault`

#### `taskType`

首批枚举建议如下：

```ts
type DestinationTaskType =
  | "analysis"
  | "research"
  | "generation"
  | "transformation"
  | "implementation"
  | "coordination"
  | "mixed"
  | "unknown";
```

## 解析器设计

### 1. 总体流程

建议把解析器拆成 6 个阶段：

1. 输入归档
2. 意图抽取
3. 结构化补全
4. 类型识别
5. 缺口分析
6. mission/workflow 投影

### 2. 阶段说明

#### 阶段一：输入归档

输入来源包括：

- 对话框输入
- mission 创建页
- workflow 启动入口
- API 触发

该阶段负责：

- 收集原始文本
- 建立附件引用
- 写入来源信息
- 生成 `Destination.id`

#### 阶段二：意图抽取

目标是把原始输入提炼为：

- 核心目标
- 交付物
- 用户要求
- 可能的子目标

该阶段可以结合规则与模型推断，但输出必须归一化到同一结构中。

#### 阶段三：结构化补全

在这一阶段系统补齐：

- 约束
- 成功标准
- 默认假设
- 任务上下文缺口

此处需要明确区分：

- 明确输入
- 推断结果
- 默认模板

#### 阶段四：类型识别

根据目标表达、交付物、动作词、上下文场景对任务进行分类。
如果是复合任务，应选择一个主类型并补充辅助类型。

#### 阶段五：缺口分析

分析哪些信息缺失会阻塞执行，哪些可在执行中补齐。

输出包括：

- `missingInformation`
- `suggestedClarifications`
- 是否建议进入接管点

#### 阶段六：mission/workflow 投影

将 `Destination` 降级映射回当前主仓已存在的输入体系，保证兼容性。

## 与现有 mission 输入的映射设计

### 映射目标

不破坏现有 mission 体系前提下，为 mission 增加一层来源更清晰的目标结构。

### 映射建议

| Destination 字段 | mission 侧建议映射 |
| --- | --- |
| `normalizedGoal.title` | mission 标题 |
| `normalizedGoal.summary` | mission 目标说明 |
| `subGoals` | mission 阶段目标、分解建议或步骤草案 |
| `constraints` | mission metadata / governance / limits |
| `successCriteria` | review / verify / completion hints |
| `missingInformation` | mission 启动后的待澄清事项 |
| `taskType` | mission category / strategy hint |
| `assumptions` | mission startup notes |

### 映射原则

- mission 仍是运行中的业务对象
- `Destination` 是 mission 之前的目标解释层
- 若 mission 侧当前无强类型字段，可先放入 metadata 投影
- 映射必须可逆追踪，至少能知道 mission 内容来自哪个 `Destination`

## 与现有 workflow 输入的映射设计

### 映射目标

让当前 workflow runtime、节点变量与启动 payload 可以直接消费 `Destination` 投影结果。

### 映射建议

| Destination 字段 | workflow 侧建议映射 |
| --- | --- |
| `normalizedGoal` | 顶层 goal / brief 变量 |
| `subGoals` | planner 节点、分段节点、阶段种子变量 |
| `constraints` | runtime governance、tool policy、output control |
| `successCriteria` | review / audit / verify 节点输入 |
| `missingInformation` | wait / clarify / HITL 节点输入 |
| `taskType` | 默认路线模板选择信号 |
| `confidence` | 是否自动执行、是否先澄清的判断依据 |

### 映射原则

- 不要求重写现有 workflow schema
- 先通过投影层组装兼容 payload
- 保留字段来源，避免 runtime 误把推断信息当成用户硬约束

## 解析策略设计

### 1. 规则优先 + 模型补足

首轮建议采用“规则优先、模型补足”的混合策略：

- 对明显结构化信息使用规则抽取
- 对模糊任务类型、隐含成功标准、隐式子目标使用模型推断
- 所有推断结果必须带置信度

这样做的原因：

- 可以更快接入现有主仓
- 容易解释和回放
- 降低完全依赖模型输出带来的不稳定性

### 2. 低置信度处理

当解析结果低于阈值时，解析器不应强行确定：

- 不确定的子目标可以延后到 route planner 再细分
- 不确定的成功标准应进入待澄清
- 不确定的任务类型应标记为 `mixed` 或 `unknown`

### 3. 默认假设策略

对于不阻塞执行、且平台有稳妥默认值的字段，可以进入 `assumptions`：

- 默认输出为 markdown
- 默认先出提纲再出正文
- 默认使用标准路线而不是深度路线

但需要满足：

- 假设必须显式记录
- 假设不能覆盖用户明确输入
- 高风险字段不得自动假设

## 版本与更新设计

`Destination` 需要支持增量更新，原因包括：

- 用户追加说明
- 澄清结果返回
- 附件补充完成
- 审批限制变更

建议增加：

- `version`
- `updatedAt`
- `changeSummary`

更新方式建议为：

1. 保留初版解析结果
2. 基于澄清输入合并修订
3. 对 route planner 和 runtime 暴露最新版
4. 审计与回放可查看历史版本

## 审计与可解释性设计

为支持 replay / audit / lineage，解析器输出需要保留证据。

建议 `evidence` 至少记录：

- 来源文本片段
- 附件引用
- 规则命中项
- 模型推断摘要
- 置信度说明

这样可以回答三个关键问题：

- 系统为什么把任务理解成这个目标
- 系统为什么认为某个信息缺失
- 系统为什么建议这类路线或接管点

## 兼容性与迁移策略

### 兼容性

- 老入口仍可继续提交 mission / workflow payload
- 新入口优先生成 `Destination`
- 若 `Destination` 解析失败，可降级回原有输入模式，但必须带错误原因

### 迁移策略

分三步推进：

1. 在新入口引入 `Destination` 解析，不动旧 runtime
2. 增加 mission/workflow 投影层
3. 再让 route planner、cockpit、takeover 消费 `Destination`

## 风险与边界

### 风险 1：把推断当成事实

需要通过来源标签和置信度约束避免系统误读用户目标。

### 风险 2：映射字段丢失

若 mission/workflow 侧没有对应强类型字段，必须通过 metadata 保留，不能直接丢弃。

### 风险 3：过早大重构

本 spec 重点是增加目标解释层，不是一次性重写所有 runtime。

## 开放问题

- `Destination` 是否需要成为数据库一级实体，还是先作为 mission/workflow 附属结构
- `taskType` 首批枚举是否需要继续细化到行业或场景层
- `successCriteria` 是否要区分业务成功和系统成功两个维度
- 哪些 `missingInformation` 可以由 RAG / 检索自动补全，哪些必须进入用户接管
