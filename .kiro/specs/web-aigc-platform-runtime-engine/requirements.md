# 需求文档：Web-AIGC 平台运行时引擎

## 目标

定义 Web-AIGC 节点编排在 Cube 主仓中的运行时执行框架，承接图定义、节点调度、等待输入恢复、终态收敛与最小控制面，而不是继续依赖单一路径的线性流程推进。

## 当前主仓边界（2026-04-23）

以下能力已经有代码与测试依据支撑：

- 节点适配器统一执行接口
- 默认边推进与条件边分支
- `WAITING_INPUT -> resume()` 人工恢复链路
- `selection / confirm_judge / end` 三类内置运行时节点
- 显式 `terminate / retry / escalate` 控制入口
- 通过 `/api/workflows/:id/runtime/run` 向实例注入 `runtimeGovernance` 治理策略
- 节点级最小自动策略
  - `retryBudget`
  - `retryDelayMs`
  - `autoEscalateOnFailure`
  - `escalateOnRetryExhausted`
- 实例级最小治理策略
  - `maxAutomaticRetries`
  - `maxManualRetries`
  - `maxTotalRetries`
  - `retryDelayMs`
  - `escalateOnRetryBlocked`
- 治理阻断证据链
  - `runtimeGovernancePolicy`
  - `runtimeGovernanceState`
  - `runtimeRetryBlocked`
  - `instance.retry_requested / instance.terminated / instance.escalated`

以下能力仍不应写成“已完整完成”：

- 完整循环执行闭环
  - 当前领域模型中保留了 `loop` 边类型，但主仓尚缺少 `edge.loop_iterated` 的运行时发射与循环执行测试证据。
- 平台统一重试治理中心
  - 当前只有节点级自动重试/自动升级，不是统一后台队列、统一预算或指数退避中心。
- runtime 事件直连 lineage
  - 当前主仓明确打通的是 replay / audit，lineage 还不是运行时事件的通用直写出口。

## 需求

### 需求 1：图执行能力

系统应支持基于节点与边的图执行，而不仅仅是传统线性工作流推进。

当前验收口径：

- 已有证据：默认边推进、条件边命中、图实例状态持久化。
- 尚未完全验收：循环边执行与循环事件闭环。

### 需求 2：节点生命周期

系统应支持节点运行时的标准生命周期，包括：

- `PENDING`
- `EXECUTING`
- `WAITING_INPUT`
- `EXECUTED`
- `EXCEPTION`

实例层面还应支持：

- `FORCE_TERMINATED`

### 需求 3：条件与循环

系统应支持条件分支、跳转与循环等控制流语义。

当前验收口径：

- 条件边：已落地。
- 循环：领域语义已预留，但当前主仓仍缺完整运行时闭环证据。

### 需求 4：人工介入

系统应允许运行时暂停并等待人工输入，然后继续执行。

当前主仓已具备的最小闭环包括：

- 节点返回 `wait`
- 生成 checkpoint
- 外部调用 `resume(payload)` 恢复
- 必要时显式 `escalate()` 转入人工 review

### 需求 5：运行时控制面

系统应提供最小可用的运行时控制入口，用于处理失败、终止与人工升级。

当前验收口径：

- 已成立：显式 `terminate / retry / escalate` 入口与最小行为测试。
- 已成立：`/runtime/run` 支持注入实例级 `runtimeGovernance`，并在自动重试、显式重试、升级控制之间共享同一份治理预算。
- 已成立：当治理策略阻断手动或自动重试时，运行时会留下结构化阻断状态，并继续发出统一控制面事件，形成 replay / audit 可消费的证据链。
- 仍属后续增强：独立后台重试队列、独立退避服务、跨实例统一治理中台。

### 需求 6：治理证据与可审计性

系统应在运行时治理发生时保留统一、可追踪、可回放的证据，而不是只留下最终失败结果。

当前验收口径：

- 已成立：显式 `retry / terminate / escalate` 事件元数据会附带治理快照。
- 已成立：治理阻断会持久化到 `runtimeGovernanceState / runtimeRetryBlocked`，并通过 `instance.retry_requested` 暴露 `allowed: false` 与 `blockedReason`。
- 未完全成立：runtime 事件尚未直接写入 lineage，仍以 replay / audit 为主。
