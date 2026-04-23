# 设计文档：任务自动驾驶核心概念

## 设计概述

本设计将“任务自动驾驶”抽象为一条从目标到交付的可解释链路：

`Destination -> Route -> Fleet -> Drive State -> Result`

在这条链路中：

- `Takeover Point` 提供人工协同入口
- `Replan` 提供偏航后的恢复机制
- `Confidence` 与 `Risk` 持续评估当前路线是否仍然可信

设计目标不是替换现有 `mission / workflow / task` 基座，而是在其上增加一层更适合产品叙事和界面表达的用户态模型。

## 核心对象

### 1. Destination

`Destination` 是用户真正想抵达的结果，不等同于一次原始输入文本。

建议包含：

- 目标描述
- 子目标
- 约束条件
- 成功标准
- 缺失信息
- 预期交付物

设计原则：

- 关注“想达到什么”，而不是“想调用什么功能”
- 可由自然语言输入解析而来
- 可被澄清和补充，但应保持语义稳定

### 2. Route

`Route` 是系统为达到 `Destination` 生成的一条可执行路线。

建议包含：

- 主路线
- 可选路线
- 阶段拆分
- 并行与串行安排
- 预期产物
- 风险点
- 接管点

设计原则：

- `Route` 面向用户解释“准备怎么完成任务”
- `Route` 不等于底层 DAG，但可投影到 `workflow`
- `Route` 可在执行中被更新，而不是一次性冻结

### 3. Drive State

`Drive State` 是任务执行过程中的用户态状态机，用于回答“系统现在在做什么”。

建议基础状态：

- `understanding`：理解目标
- `clarifying`：澄清缺口
- `planning`：规划路线
- `fleet-forming`：组织编队
- `executing`：执行路线
- `reviewing`：复核结果
- `blocked`：出现阻塞
- `takeover-required`：请求用户接管
- `replanning`：重新规划
- `delivered`：结果送达

设计原则：

- 面向产品和界面，不直接暴露底层细碎状态
- 应能映射到现有 runtime 与 workflow 阶段
- 应支持回放、审计和证据关联

### 4. Fleet

`Fleet` 是围绕当前 `Route` 被组织起来的一组角色化能力编队。

建议角色层：

- Planner
- Clarifier
- Researcher
- Generator
- Reviewer
- Auditor
- Operator

设计原则：

- 对外展示角色，不直接暴露 50+ 节点
- 对内可映射到 agent、skill、node、tool、executor
- 同一任务的 `Fleet` 可随 `Route` 和 `Drive State` 动态调整

### 5. Takeover Point

`Takeover Point` 是系统主动请求用户确认、输入或决策的路口。

典型场景：

- 目标方向不明确
- 缺少关键上下文
- 成本或权限需要授权
- 高风险动作需要确认
- 路线切换需要选择
- 最终结果需要确认交付

设计原则：

- 接管点应被显式建模，而不是零散散落在流程里
- 应记录触发原因、所需输入、影响范围和恢复方式
- 接管完成后应能返回原路线或触发 `Replan`

### 6. Replan

`Replan` 是在当前路线不再适合时，对 `Route` 的重新规划动作。

典型触发：

- 用户修改目标
- 风险升高
- 置信度下降
- 外部工具失败
- 中间结果不达标
- 关键资源不可用

设计原则：

- `Replan` 不是报错后的兜底，而是正式的运行时能力
- 应保留原路线、触发原因和新路线差异
- 应避免无边界重复重规划

### 7. Confidence

`Confidence` 是系统对当前理解、路线和结果的把握程度。

建议评估维度：

- 目标理解置信度
- 路线可行性置信度
- 执行完成度置信度
- 结果质量置信度

设计原则：

- `Confidence` 不应只是单一分数，也应支持阶段性解释
- 低置信度不一定失败，但应触发澄清、降级或接管策略
- 可作为界面提示和治理决策依据

### 8. Risk

`Risk` 是影响任务安全、质量、成本、时间和稳定性的风险集合。

建议风险类型：

- 目标歧义风险
- 数据缺失风险
- 成本超预算风险
- 权限与安全风险
- 工具依赖风险
- 结果质量风险
- 合规与审计风险

设计原则：

- `Risk` 应与路线阶段绑定，而不是只在结尾复盘
- 高风险动作需要关联 `Takeover Point`
- 风险变化应可触发 `Replan`

## 对象关系

### 主链路

1. 用户输入被解析为 `Destination`
2. 系统围绕 `Destination` 生成 `Route`
3. 系统根据 `Route` 组织 `Fleet`
4. 执行过程中通过 `Drive State` 对外展示当前进展
5. 当出现不确定性时，使用 `Confidence` 与 `Risk` 做判断
6. 必要时触发 `Takeover Point` 或 `Replan`
7. 最终形成任务交付结果

### 决策链路

- `Risk` 升高时，不一定立刻中断，但必须进入评估
- `Confidence` 下降时，优先考虑澄清或补信息
- `Risk` 与 `Confidence` 共同决定：
  - 继续执行
  - 请求接管
  - 降级执行
  - 重新规划

## 与 mission / workflow / task 的关系

### 分层原则

- `Destination / Route / Drive State / Fleet` 属于产品层对象
- `mission / workflow / task / runtime` 属于工程层对象
- 两层通过映射关系共存，不要求立即重命名底层实现

### 建议映射

| 自动驾驶对象 | 中文语义 | 现有工程对象 | 说明 |
| ---- | ---- | ---- | ---- |
| `Destination` | 目的地 | `mission` | 表达用户想送达的结果，可映射为一个或一组 mission |
| `Route` | 路线 | `workflow` | 表达任务完成路径，可投影到 workflow 与阶段编排 |
| `Drive State` | 驾驶状态 | runtime state / phase state | 面向用户的状态抽象，屏蔽底层细节 |
| `Fleet` | 车队编队 | agents / skills / nodes / executors | 对外展示角色化编队，对内仍是能力组合 |
| `Takeover Point` | 接管点 | HITL / decision / approval | 统一承接确认、输入、授权、审批 |
| `Replan` | 重规划 | workflow revision / retry / reroute | 对路线的正式改写动作 |
| `task` | 执行单元 | `task` | 保留为更细粒度的执行项，不提升为第一产品对象 |

### 兼容策略

- 不要求现有 `task` 升级为用户主对象
- 不要求现有 `workflow` 被新的 `Route` 完整替代
- 优先做“映射、投影、解释”，再考虑深层重构

## 设计约束

- 不在本 spec 中定义具体 UI 布局
- 不在本 spec 中定义具体 runtime API
- 不在本 spec 中引入过多新术语，避免与现有模型断裂
- 后续 specs 必须复用本文件中的对象定义与映射口径
