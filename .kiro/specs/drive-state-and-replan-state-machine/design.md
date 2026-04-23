# 设计文档：Drive State 与 Replan 状态机

## 设计概述

本设计旨在为 Cube Pets Office 增加一层面向“任务自动驾驶”的高层状态机视图，用于把当前 mission-first、Mission Runtime、workflow runtime、人工接管、review / audit / replay 等底层事实，统一解释为一条用户可理解的任务驾驶过程。

核心原则如下：

1. 高层状态机是“解释层”，不是“替换层”
2. 状态投影优先于底层改名
3. 与现有 Mission Runtime 兼容优先
4. 与 replay / audit / takeover 链路一致

因此，本设计不会要求：

- 当前 runtime state 立即大规模改名
- 当前 workflow engine 立即重写
- 当前任务详情、回放、审计立即统一切换到新命名

更合理的路径是先定义高层状态机，再逐步把前端、服务端投影和治理链路接上来。

## 设计目标

- 建立统一的高层任务驾驶状态机
- 为驾驶舱主界面提供稳定的状态语义
- 为重规划提供清晰、独立的语义边界
- 与当前 mission-first / Mission Runtime / replay / audit 保持兼容
- 为后续前端 view model 和服务端 projection 提供标准输入

## 总体分层

### 第一层：底层事实状态

当前系统中已经存在大量底层状态来源，包括：

- Mission 生命周期状态
- Workflow instance 状态
- Node run 状态
- review / audit / verify / revise 状态
- retry / terminate / escalate / wait / resume 控制状态
- replay / audit 事件证据

这些状态适合驱动执行，但不适合直接成为用户界面语言。

### 第二层：Drive State 高层投影

Drive State 用于将底层多个信号归并为一组用户可理解的高层状态：

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

这一层的核心价值是“统一解释任务当前行驶到了哪里”。

### 第三层：驾驶舱与回放消费层

驾驶舱、任务详情、回放、审计等视图层不再直接拼接底层多个状态来源，而是优先消费以下高层对象：

- 当前 `driveState`
- 当前状态原因
- 进入状态的触发事件
- 下一步预期动作
- 是否需要接管
- 是否发生重规划

## 状态定义

### 1. `understanding`

#### 语义

系统正在理解用户目标、整理上下文、识别约束、判断任务边界。

#### 典型底层信号

- mission 刚创建
- 目标、上下文、约束仍在抽取或归一化
- 尚未形成清晰路线建议

#### 退出条件

- 信息完整度足以进入规划
- 或发现关键信息缺失，转入澄清

### 2. `clarifying`

#### 语义

系统正在补齐关键缺失信息，可能主动发起问题，也可能等待用户补充。

#### 典型底层信号

- 用户目标存在歧义
- workflow / task 等待输入
- 成功标准、预算、风格、范围等缺失

#### 与 `takeover-required` 的关系

- `clarifying` 表示系统当前所处阶段偏向“澄清”
- `takeover-required` 表示系统当前需要外部介入
- 两者可以相互关联，但不完全相同

### 3. `planning`

#### 语义

系统正在生成执行路线、阶段安排、风险点、接管点与候选方案。

#### 典型底层信号

- 任务目标和约束已基本明确
- 正在选择路线模板、工作流骨架、执行策略
- 正在评估成本、时间、风险或能力组合

#### 退出条件

- 形成可执行方案后进入编队或执行
- 若发现关键决策待确认，则进入接管

### 4. `fleet-forming`

#### 语义

系统正在为路线组建执行车队，也就是选择角色、节点组合、Agent 编队、工具装配或执行器资源。

#### 典型底层信号

- 动态组织生成
- 节点/技能/工具绑定
- 执行器、适配器、外部服务准备

#### 退出条件

- 编组完成后进入执行
- 若编组失败或资源不足，可进入重规划或阻塞

### 5. `executing`

#### 语义

系统正在沿当前路线执行任务，产生中间结果或最终交付物。

#### 典型底层信号

- workflow instance 正在运行
- 节点在推进、分支、调用工具、写入结果
- 实时产生输出、日志、证据或中间产物

#### 退出条件

- 执行完成后进入复核
- 执行中等待关键输入则进入接管或澄清
- 执行失败且需改线则进入重规划
- 执行无法推进则进入阻塞

### 6. `reviewing`

#### 语义

系统正在执行 review、audit、verify、revise 等质量与治理动作，验证结果是否达标。

#### 典型底层信号

- 结果评审中
- 风险复核中
- 输出对照成功标准中
- 准备决定是否交付、返工或改线

#### 退出条件

- 达标则进入交付
- 不达标但可修正则进入重规划
- 需要人工验收则进入接管

### 7. `blocked`

#### 语义

系统当前无法自动向前推进，但尚未完成有效恢复。

#### 典型底层信号

- 重试预算耗尽
- 关键依赖不可用
- 关键状态不一致
- 没有可继续执行的合法路径

#### 关键说明

`blocked` 不是“失败终态”，而是“当前受阻态”。
它后续可以转向：

- `takeover-required`
- `replanning`
- 极少数情况下回到 `executing`

### 8. `takeover-required`

#### 语义

系统需要用户或人工角色介入，才能继续推进或确认结果。

#### 典型底层信号

- decision pending
- approval pending
- wait for user input
- 预算 / 权限待确认
- 结果待验收

#### 关键说明

这是高层接管态，不限定接管原因，具体原因由 takeover 元数据补充。

### 9. `replanning`

#### 语义

系统正在调整原路线，生成新的执行路径或替代策略。

#### 典型触发场景

- 当前路线持续失败
- 结果质量不达标
- 用户修改目标、约束、优先级
- 成本、风险、时延超限
- 某类工具或执行器失效
- 人工接管后要求换路线

#### 与 `retry` 的区别

- `retry` 仍然沿原路线或原节点继续尝试
- `replanning` 是改变高层路径或策略

#### 与 `clarifying` 的区别

- `clarifying` 是补信息
- `replanning` 是改路线

### 10. `delivered`

#### 语义

系统已经完成当前任务的交付，产生了结果、摘要、工件或最终说明。

#### 典型底层信号

- 最终输出已形成
- review / verify 通过
- mission 已具备可交付状态

## 状态迁移设计

### 主链路迁移

标准主链路建议如下：

`understanding`
-> `planning`
-> `fleet-forming`
-> `executing`
-> `reviewing`
-> `delivered`

这是理想自动推进链路。

### 澄清链路

当信息不足时，状态迁移可为：

`understanding`
-> `clarifying`
-> `planning`

或：

`planning`
-> `takeover-required`
-> `clarifying`
-> `planning`

### 接管链路

当系统无法自动推进或需要人工决策时：

`executing`
-> `takeover-required`

`reviewing`
-> `takeover-required`

`blocked`
-> `takeover-required`

接管完成后，可恢复到：

- `clarifying`
- `planning`
- `executing`

### 重规划链路

当原路线无效或不优时：

`executing`
-> `replanning`

`reviewing`
-> `replanning`

`blocked`
-> `replanning`

重规划完成后，可进入：

- `fleet-forming`
- `executing`
- `takeover-required`

### 阻塞链路

当系统无法继续自动推进时：

`executing`
-> `blocked`

`planning`
-> `blocked`

`fleet-forming`
-> `blocked`

阻塞并非终态，通常需要接管或重规划。

## 映射设计

### 与 Mission Runtime 的映射

Drive State 不直接替代 Mission Runtime，而是从 Mission Runtime 投影得出。

建议映射方式：

| Mission Runtime 信号 | Drive State | 说明 |
| ---- | ---- | ---- |
| mission 创建、目标解析中 | understanding | 任务意图理解阶段 |
| mission 缺失关键上下文 | clarifying | 待补信息 |
| workflow / route 准备中 | planning | 正在计划 |
| 动态组织、执行角色配置中 | fleet-forming | 正在编队 |
| runtime 正在执行节点 | executing | 主执行阶段 |
| review / audit / verify 激活 | reviewing | 复核阶段 |
| runtime 无法前进 | blocked | 受阻 |
| decision / resume / approval 等待 | takeover-required | 需接管 |
| 发生换路、返工、重组执行方案 | replanning | 重规划 |
| 最终交付完成 | delivered | 完成送达 |

### 与 workflow / runtime state 的映射

底层 workflow / runtime state 通常更细粒度，例如：

- pending
- executing
- waiting_input
- executed
- exception
- terminated
- retry requested
- escalated

这些状态不应直接暴露为驾驶态，而应通过归并映射解释为高层 Drive State。

示意如下：

| 底层状态或事件 | 高层解释 |
| ---- | ---- |
| `WAITING_INPUT` | `clarifying` 或 `takeover-required` |
| `EXECUTING` | `executing` |
| `EXCEPTION` + 可恢复 | `blocked` 或 `replanning` |
| `instance.escalated` | `takeover-required` |
| `retry requested` 但仍沿原路线 | 保持 `executing` 或短暂 `blocked` |
| `review / verify active` | `reviewing` |

### 与 replay / audit 的映射

Drive State 变化应能够被 replay / audit 重建。

建议记录的高层状态事件字段包括：

- `previousDriveState`
- `nextDriveState`
- `triggerType`
- `triggerReason`
- `relatedMissionId`
- `relatedWorkflowId`
- `relatedDecisionId`
- `replanReason`
- `takeoverReason`

这样可以让回放真正像“驾驶时间线”，而不只是底层节点流水。

## Replan 设计

### Replan 定义

`Replan` 是对“当前路线不再最优或不可行”的高层反应。
它不是单次节点失败后的普通重试，而是对任务推进策略的重新组织。

### Replan 触发器

建议至少支持以下触发器分类：

- `quality_gap`
  - review 发现质量不达标
- `route_failure`
  - 当前路线关键步骤失败
- `dependency_unavailable`
  - 外部工具、服务、执行器不可用
- `constraint_changed`
  - 用户修改目标、预算、时限、风格、权限要求
- `risk_exceeded`
  - 风险、成本、时延超出当前路线承受范围
- `human_override`
  - 人工接管后要求切换路线

### Replan 输出

重规划后至少应能输出：

- 原路线摘要
- 触发原因
- 新路线摘要
- 是否需要重新编队
- 是否需要接管确认

## 兼容策略

### 策略 1：不大规模改底层命名

本设计明确不建议当前就把底层 runtime 状态全部改名成 Drive State。

原因：

- 当前 Mission Runtime、workflow runtime、测试与事件模型已有稳定依赖
- Drive State 更适合作为高层解释对象
- 先投影、后收敛比先改名更稳妥

### 策略 2：优先做投影层和 view model

建议优先在以下位置引入 Drive State：

- 服务端 projection
- 前端任务详情 view model
- 驾驶舱状态摘要
- replay / audit 高层时间线

### 策略 3：允许阶段性“弱一致”

初期可以接受：

- 高层 Drive State 由多个底层信号推断
- 少数状态尚未有完整服务端事件支持
- 前端先做展示映射，后续再下沉到服务端

只要状态语义和迁移规则稳定，就可以分阶段演进。

## 风险与边界

### 风险 1：把 Drive State 误当成底层执行状态

如果直接要求每个 runtime 节点都强制落到一个 Drive State，会造成：

- 粒度不匹配
- 工程实现复杂度过高
- 状态语义反而混乱

### 风险 2：把 Replan 写成 Retry

如果无法区分重试和重规划，就会导致：

- 产品层看不出系统是否真正换路
- 审计层无法解释为什么结果突然变化
- 驾驶舱无法展示偏航修正能力

### 风险 3：只做前端状态，不做可回放证据

如果 Drive State 只在前端临时计算，而没有事件或投影证据：

- 回放无法复原状态变化
- 审计无法解释关键切换
- 用户信任感不足

## 设计结论

本 spec 的最终结论是：

1. `Drive State` 是任务自动驾驶的高层状态机解释层
2. 高层状态采用十态模型：
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
3. `replanning` 必须作为独立状态存在，不能被 `retry` 或 `clarifying` 吞并
4. 状态机必须与 mission-first、Mission Runtime、workflow runtime、replay、audit、HITL 保持兼容
5. 初期应优先通过 projection 与 view model 落地，而不是立刻大规模重构底层命名
