# 设计文档：Mission 模型到任务自动驾驶模型映射

## 设计概述

本设计的核心目标，不是创造一套替代当前主仓领域模型的新底层，而是增加一层“产品语义投影层”：

- 工程层继续使用 `Mission / Workflow / Runtime State / Decision-HITL`
- 产品层新增 `Destination / Route / Drive State / Takeover`

这两层不是互斥关系，而是“事实对象”和“用户态对象”的关系。

因此，本设计采用如下原则：

1. 兼容优先
2. 投影优先
3. 展示先行
4. 逐步收敛

其中最重要的一条是：

> 不建议立刻大规模修改底层命名。
> 先建立清晰映射，再根据真实使用效果决定是否需要更深层的领域重构。

## 设计目标

- 让 Cube Pets Office 可以对外表达为“任务自动驾驶平台”
- 让现有任务系统、工作流系统、运行时状态、人工介入机制获得统一的上层产品解释
- 让后续驾驶舱界面有稳定的概念基础
- 降低大规模重命名和推翻式重构的风险

## 总体分层

### 第一层：工程事实层

这一层是当前主仓的真实执行基础，包括但不限于：

- `Mission`
- `Workflow`
- `Workflow Instance / Runtime State`
- `Decision`
- `HITL`
- `Audit / Replay / Lineage / Evidence`

这层的特点是：

- 贴近代码和运行时
- 已被现有 API、测试、任务系统、Web-AIGC 适配
- 稳定性优先于命名美感

### 第二层：产品语义层

这一层是面向用户、产品、信息架构的概念投影，包括：

- `Destination`
- `Route`
- `Drive State`
- `Takeover`

这层的特点是：

- 贴近用户理解
- 适合做驾驶舱展示
- 可以吸纳多种底层状态和对象

### 第三层：视图与交互层

这一层是前端消费产品语义的结构，例如：

- 目的地卡片
- 路线推荐面板
- 车队摘要
- 当前驾驶状态面板
- 接管点面板
- 回放与证据面板

## 核心映射设计

### 1. Mission -> Destination

#### 设计意图

`Mission` 是当前系统的任务事实对象，负责承载执行上下文、任务目标、会话关联、状态推进与交付结果。
在自动驾驶叙事下，用户更容易理解的是“我要去哪里”，因此需要将 `Mission` 投影成 `Destination`。

#### 映射关系

`Mission` 不直接改名为 `Destination`，而是通过投影生成一个面向用户的目的地对象。

建议映射如下：

| 工程事实字段 | 目标投影字段 | 说明 |
| ---- | ---- | ---- |
| mission.title / summary | destination.goal | 用户想达成的结果概述 |
| mission.input | destination.request | 原始任务请求 |
| mission.context | destination.context | 当前已知背景 |
| mission.constraints | destination.constraints | 时间、预算、权限、风格等限制 |
| mission.successCriteria | destination.successCriteria | 成功定义 |
| mission.metadata.deliverables | destination.deliverables | 预期交付物 |
| mission.missingInfo | destination.missingInfo | 当前缺失信息 |

#### 设计结论

- `Mission` 继续作为运行时真实主对象
- `Destination` 作为产品展示与规划输入对象
- 两者允许阶段性不完全对齐

这意味着系统可以先以投影形式提供 `Destination`，而不是要求 `Mission` 一步重构成全新的领域对象。

### 2. Workflow -> Route

#### 设计意图

`Workflow` 当前承担底层编排与执行定义职责，但对于用户而言，“工作流”属于工程术语。
自动驾驶叙事需要一个更贴近用户的概念，也就是“路线”。

#### 映射关系

`Route` 不等于单个 `Workflow` 文件或 DAG 定义，而是从多个工程对象中归纳出的高层执行路径。

建议映射如下：

| 工程事实对象 | 目标投影字段 | 说明 |
| ---- | ---- | ---- |
| workflow.definition | route.structure | 路线骨架 |
| workflow.phases / stages | route.stages | 用户可理解的阶段划分 |
| workflow.edges / branching | route.transitions | 路线切换与分支逻辑 |
| workflow.parallel groups | route.parallelism | 并行执行安排 |
| governance checkpoints | route.riskPoints | 风险点 |
| hitl / decision nodes | route.takeoverPoints | 接管点 |

#### 关键说明

- `Route` 可以投影自一个 workflow，也可以聚合多个 workflow 片段
- `Route` 允许存在“推荐路线”和“替代路线”
- `Route` 的职责是“解释系统准备怎么送达结果”，不是替代底层执行图

#### 设计结论

- `Workflow` 保持底层编排职责
- `Route` 提供产品层解释、推荐和展示
- 不建议为追求名词统一，直接废弃 `Workflow`

### 3. Runtime State -> Drive State

#### 设计意图

当前运行态通常分散在多个地方：

- mission 状态
- workflow instance 状态
- node run 状态
- replay / audit 事件
- review / verify / revise 中间态

这些状态对系统有意义，但对用户不够直观。
因此需要一个高层的 `Drive State` 来统一解释。

#### Drive State 建议集合

建议优先定义以下高层状态：

- `understanding`
- `clarifying`
- `planning`
- `fleet-forming`
- `executing`
- `reviewing`
- `blocked`
- `takeover-required`
- `replanning`
- `delivered`

#### 映射规则

`Drive State` 不要求与任一底层状态一一对应，而是允许由多种信号共同推断。

示例：

| 底层信号 | Drive State | 说明 |
| ---- | ---- | ---- |
| mission created + context incomplete | understanding | 正在理解目的地 |
| workflow waiting for user input | clarifying / takeover-required | 需要补充信息 |
| route generated + not started | planning | 路线生成阶段 |
| multiple agents assigned | fleet-forming | 编队中 |
| workflow actively running | executing | 执行中 |
| review / audit / verify active | reviewing | 复核中 |
| runtime blocked / retry exhausted | blocked | 阻塞 |
| decision pending | takeover-required | 等待用户接管 |
| runtime switched path | replanning | 重规划 |
| final artifacts emitted | delivered | 已送达结果 |

#### 设计结论

- `Drive State` 是高层解释对象
- 可以由运行时投影器、前端 selector 或服务端 projection 生成
- 不要求底层 runtime state 立即重构

### 4. Decision / HITL -> Takeover

#### 设计意图

当前系统已经有人工确认、人工恢复、审批与决策链路，但这些能力在产品层分散且名称偏工程化。
自动驾驶叙事中，最自然的统一词汇是 `Takeover`。

#### 映射范围

以下能力都应被纳入 `Takeover`：

- 澄清提问
- 人工选择分支
- 审批确认
- 权限授权
- 预算确认
- 输出验收
- 异常人工接管

#### 映射模型

建议定义统一的接管对象投影：

| 工程事实对象 | takeover 字段 | 说明 |
| ---- | ---- | ---- |
| pending decision | takeover.reason | 为什么需要接管 |
| hitl checkpoint | takeover.type | 接管类型 |
| required input schema | takeover.input | 需要用户补充什么 |
| branch options | takeover.options | 可选方向 |
| permission / budget policy | takeover.constraints | 接管限制条件 |
| timeout / urgency | takeover.urgency | 紧急程度 |

#### 设计结论

- `Takeover` 是对多类 HITL 机制的统一包装
- 保留原有执行真实性
- 提升产品可理解性和信任感

## 兼容策略

### 策略 1：不做底层大规模即时改名

本设计明确不建议当前就执行以下动作：

- 将所有 `Mission` 类、接口、文件批量重命名为 `Destination`
- 将所有 `Workflow` 对象和 API 直接替换为 `Route`
- 将所有 runtime state 统一重写为 drive state
- 将 decision / approval / hitl 节点全部立刻改成 takeover 命名

原因如下：

- 当前系统已有大量 spec、测试、接口、运行时逻辑依赖既有命名
- 大规模改名会制造高噪音提交
- 改名本身并不等于真正完成产品建模
- 当前阶段最需要的是稳定映射，而不是词汇整齐

### 策略 2：优先做投影对象

建议优先新增以下“上层对象”：

- destination projection
- route projection
- drive-state projection
- takeover projection

这些对象可以：

- 存在于服务端 projection 层
- 存在于前端 view model 层
- 存在于 steering / spec / README 文档层

### 策略 3：逐步把现有页面升级为自动驾驶表达

优先升级的不是底层 runtime 文件名，而是：

- 任务详情页中的目标摘要
- workflow 可视化中的路线解释
- session / task 中的等待输入和确认状态
- replay / audit 中的驾驶状态与接管证据

### 策略 4：Web-AIGC 侧继续保留节点内部视角

当前 50+ Web-AIGC 节点不应直接暴露给用户作为主产品语言。
建议：

- 内部继续保留节点编排
- 外部逐步抽象为路线阶段与车队角色
- 后续再扩展“节点角色分类”和“车队编组”层

## 推荐的落地结构

### 服务端

建议增加投影层能力，而不是替换底层对象：

- `mission -> destination projection`
- `workflow -> route projection`
- `runtime -> drive-state projection`
- `decision/hitl -> takeover projection`

### 前端

建议让主界面围绕四个对象消费数据：

- `destination`
- `route`
- `driveState`
- `takeover`

### 文档与规格

后续 specs、README、架构图、产品说明可以统一升级到自动驾驶叙事，但应在文档中保留与旧模型的映射说明。

## 风险与边界

### 风险 1：只改词，不改对象

如果只是把文案从 `Mission` 改成 `Destination`，但没有实际投影结构，最终会导致：

- 文档很好看
- 界面很难落地
- 工程侧无法稳定消费

### 风险 2：过早重命名底层

如果在映射未稳定前就大规模改名，容易造成：

- 现有 spec 与代码脱节
- 测试批量失效
- 开发心智混乱

### 风险 3：把自动驾驶对象做成全新孤岛

如果新对象完全脱离当前主仓对象体系，会导致：

- 双模型长期并存却无法互通
- 前后端概念不一致
- 无法复用现有 Mission Runtime 能力

## 设计结论

本 spec 的最终设计结论是：

1. 自动驾驶模型应作为产品语义层引入
2. 当前工程层模型继续保留
3. 四组核心映射是当前阶段的首要工作：
   - `Mission -> Destination`
   - `Workflow -> Route`
   - `Runtime State -> Drive State`
   - `Decision / HITL -> Takeover`
4. 兼容优先，不建议立即大规模底层改名
5. 后续应通过 projection、view model、驾驶舱 IA 与治理视图逐步落地
