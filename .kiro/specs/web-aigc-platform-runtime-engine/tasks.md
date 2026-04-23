# 任务清单：Web-AIGC 平台运行时引擎

- [x] 定义节点执行适配器接口
  - 当前内置运行时节点已不只包含 `selection / confirm_judge / end / condition`，也已包含 `variable_assignment`。
  - `server/core/workflow-runtime-engine.ts` 中已注册 `VariableAssignmentWorkflowNodeAdapter`，说明运行时适配器层已经覆盖变量赋值这类基础数据节点，而不只是分支和终态节点。

- [x] 定义边跳转与状态推进逻辑

- [x] 接入等待输入与恢复执行机制

- [x] 补齐显式终止、重试、失败升级策略闭环
  - `server/core/workflow-runtime-engine.ts` 已具备显式 `terminate()`、`retry()`、`escalate()` 运行时入口。
  - `server/routes/workflows.ts` 已暴露 `/api/workflows/:id/runtime/terminate`、`/runtime/retry`、`/runtime/escalate` 三个控制接口。
  - `server/tests/workflow-runtime-engine.test.ts` 与 `server/tests/workflows-routes.test.ts` 已覆盖三类入口的最小行为验证。
  - 节点现已支持基于 `retryBudget / retryDelayMs / autoEscalateOnFailure / escalateOnRetryExhausted` 的最小自动策略层。
  - 本轮进一步补齐了“实例级统一治理策略层”：
    - 支持通过 `definition.metadata.runtimeGovernance` 或 `/runtime/run` 请求体注入最小治理策略
    - 支持 `maxAutomaticRetries / maxManualRetries / maxTotalRetries / retryDelayMs / escalateOnRetryBlocked`
    - 自动重试、显式重试、自动升级现在都会复用同一份运行时治理预算与快照
    - 当治理预算耗尽时，会留下 `runtimeRetryBlocked` 与 `runtimeGovernanceState` 证据，并进入受控拒绝或自动升级
  - `server/tests/workflow-runtime-engine.test.ts` 已新增：
    - “实例级自动重试预算跨节点生效”
    - “实例级手动重试预算耗尽后阻断重试”
    - “手动重试被治理阻断时仍发出统一 `instance.retry_requested` 事件”
  - `server/tests/workflows-routes.test.ts` 已新增：
    - `/runtime/retry` 在治理阻断时返回 `409`
    - 路由层稳定透出 `Runtime retry blocked by governance policy: ...` 错误文案
  - 结论：虽然当前仍没有独立后台重试队列或独立策略服务，但“最小统一治理策略闭环”已经由运行时内核内的实例级预算/退避/升级控制补齐，可按完成处理。

- [x] 将运行时节点事件统一接入 replay / telemetry / audit
  - `server/core/workflow-runtime-engine.ts` 已统一发射 `node.started / node.completed / node.waiting_input / node.failed / edge.transitioned / edge.loop_iterated` 对应的 runtime 事件。
  - `variable_assignment` 现在还会额外发射 `variable.assigned`，但当前 `server/core/web-aigc-runtime-observability.ts` 尚未将该事件镜像到 replay / audit，因此变量级事件镜像仍属后续增强项。
  - 当前事件通过既有 `eventEmitter -> socket(agent_event)` 通道进入平台公共事件面，形成运行时节点事件的最小统一出口；这里的 `telemetry` 更接近“公共事件面”，而不是独立遥测后端。
  - `server/core/web-aigc-runtime-observability.ts` 已把上述 runtime 事件镜像到 replay / audit，但尚未由 runtime 事件直接写入 lineage。
  - 新增 `instance.terminated / instance.retry_requested / instance.escalated` 三类控制面事件，已进入 replay / audit 映射与测试。
  - 本轮进一步补齐：即使手动重试被治理策略阻断，也会发出统一的 `instance.retry_requested` 事件，保证 blocked retry 具备完整 replay / audit 证据链，而不只是变量快照。
  - 本轮新增的治理快照也已通过 `instance.retry_requested / instance.escalated / instance.terminated` 进入 replay / audit 元数据。

> 说明：`variable_assignment`、`condition`、`selection`、`confirm_judge`、`end` 已作为内置运行时能力落地，支撑图数据写入、分支判定、人工恢复与终态收敛；`terminate / retry / escalate` 与节点级自动重试/自动升级已经具备最小能力。本轮补齐后，运行时已经形成“实例级统一治理预算 + 统一退避/升级决策”的最小真实治理闭环，因此第 4 项现在可以标记为已完成。  
> 边界：当前仍未形成独立后台重试队列、独立指数退避服务、跨实例治理中台或 runtime 直连 lineage，这些属于后续平台增强，不影响本 spec 的最小验收闭环。
