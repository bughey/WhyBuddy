# Requirements Document

## Introduction

将已实现的 `autopilot-multi-agent-brainstorm` 子系统（Decision Gate、BrainstormOrchestrator、Tool Proxy、Synthesizer）接入真实的 autopilot blueprint 管线。当前 `executeStageWithBrainstorm()` 仅在测试中调用，真实管线各阶段（route_generation、spec_tree、spec_docs、effect_preview、prompt_packaging、engineering_handoff）仍走单 Agent 直连 LLM 路径。本 spec 定义将 Decision Gate 作为可选拦截层嵌入各阶段入口的需求与约束。

## Glossary

- **Pipeline_Stage**: autopilot blueprint 管线中的一个阶段，对应 `BlueprintGenerationStage` 类型的枚举值（route_generation / spec_tree / spec_docs / effect_preview / prompt_packaging / engineering_handoff）
- **Decision_Gate**: LLM 驱动的决策点，判断当前阶段是否需要启动多智能体头脑风暴
- **Brainstorm_Orchestrator**: 多智能体会话管理器，负责角色实例化、协作模式调度与结果聚合
- **Stage_Wrapper**: 在现有阶段 LLM 调用外层包裹的适配函数，负责调用 Decision Gate 并根据结果路由到 brainstorm 或 single-agent 路径
- **Single_Agent_Fallback**: 现有的直连 LLM 单 Agent 执行路径，brainstorm 关闭或失败时的默认路径
- **Blueprint_Service_Context**: 蓝图栈统一运行期依赖容器（`BlueprintServiceContext` 类型），所有子域服务通过此 context 获取依赖
- **Event_Bus**: `BlueprintEventBus`，蓝图栈统一事件总线，负责 emit 事件并通过 Socket.IO relay 到前端
- **LLM_Caller_Fn**: brainstorm 子系统的 LLM 调用函数签名 `(prompt: string, systemPrompt?: string) => Promise<string>`
- **Event_Emitter_Fn**: brainstorm 子系统的事件发射函数签名 `(type: string, payload: unknown) => void`
- **Stage_Config**: 每个管线阶段的 brainstorm 启用/禁用配置，通过环境变量控制

## Requirements

### Requirement 1: BlueprintServiceContext 扩展与 Brainstorm 子系统装配

**User Story:** As a 平台工程师, I want the brainstorm subsystem to be properly assembled and injected into BlueprintServiceContext, so that all pipeline stages can access brainstorm capabilities through the standard dependency injection pattern.

#### Acceptance Criteria

1. THE Blueprint_Service_Context SHALL include an optional `brainstormContext` field of type `BrainstormServiceContext | null`
2. WHEN `BLUEPRINT_BRAINSTORM_ENABLED` environment variable equals `"true"`, THE `buildBlueprintServiceContext` factory SHALL assemble a `BrainstormServiceContext` instance containing orchestrator, synthesizer, and memory store
3. WHEN `BLUEPRINT_BRAINSTORM_ENABLED` environment variable does not equal `"true"`, THE `buildBlueprintServiceContext` factory SHALL set `brainstormContext` to `null`
4. THE `BrainstormServiceContext` assembly SHALL use an LLM_Caller_Fn adapter that delegates to `ctx.llm.callJson` from the parent Blueprint_Service_Context
5. THE `BrainstormServiceContext` assembly SHALL use an Event_Emitter_Fn adapter that delegates to `ctx.eventBus.emit` from the parent Blueprint_Service_Context
6. IF the `BrainstormServiceContext` assembly throws an error during construction, THEN THE `buildBlueprintServiceContext` factory SHALL log the error, set `brainstormContext` to `null`, and continue context assembly without interruption

### Requirement 2: Per-Stage Brainstorm Decision Gating

**User Story:** As a 平台工程师, I want each pipeline stage to independently decide whether multi-agent brainstorming is needed, so that simple stages proceed quickly while complex stages benefit from diverse perspectives.

#### Acceptance Criteria

1. WHEN a Pipeline_Stage begins execution, THE Stage_Wrapper SHALL invoke `executeStageWithBrainstorm()` with the current stage context, brainstorm context, LLM caller, event emitter, and a single-agent fallback function
2. THE Stage_Wrapper SHALL construct a `StageContext` object containing: `jobId`, `stageId` (matching the `BlueprintGenerationStage` value), `stageDescription` (human-readable summary of what the stage produces), `degradedBridges` (list of currently degraded capability bridges), and `previousStageOutputs` (summaries of prior stage results)
3. THE single-agent fallback function passed to `executeStageWithBrainstorm()` SHALL execute the existing LLM call path for that stage and return its output as a string
4. WHEN `executeStageWithBrainstorm()` returns a result with `type === "brainstorm"`, THE Stage_Wrapper SHALL use the `output` field as the stage's LLM generation result
5. WHEN `executeStageWithBrainstorm()` returns a result with `type === "single-agent"`, THE Stage_Wrapper SHALL use the `output` field as the stage's LLM generation result (identical to current behavior)
6. THE Stage_Wrapper SHALL be applied to the following Pipeline_Stages: `route_generation`, `spec_tree`, `spec_docs`, `effect_preview`, `prompt_packaging`, `engineering_handoff`

### Requirement 3: Per-Stage Enable/Disable Configuration

**User Story:** As a 运维工程师, I want to enable or disable brainstorm decision gating on a per-stage basis via environment variables, so that I can gradually roll out brainstorm to individual stages without affecting others.

#### Acceptance Criteria

1. THE system SHALL support the following per-stage environment variables: `BRAINSTORM_STAGE_ROUTE_GENERATION_ENABLED`, `BRAINSTORM_STAGE_SPEC_TREE_ENABLED`, `BRAINSTORM_STAGE_SPEC_DOCS_ENABLED`, `BRAINSTORM_STAGE_EFFECT_PREVIEW_ENABLED`, `BRAINSTORM_STAGE_PROMPT_PACKAGING_ENABLED`, `BRAINSTORM_STAGE_ENGINEERING_HANDOFF_ENABLED`
2. WHEN a per-stage environment variable equals `"true"` AND `BLUEPRINT_BRAINSTORM_ENABLED` equals `"true"`, THE Stage_Wrapper for that stage SHALL invoke the Decision Gate
3. WHEN a per-stage environment variable does not equal `"true"`, THE Stage_Wrapper for that stage SHALL skip the Decision Gate entirely and execute the single-agent fallback directly
4. WHEN `BLUEPRINT_BRAINSTORM_ENABLED` does not equal `"true"`, THE Stage_Wrapper for all stages SHALL skip the Decision Gate regardless of per-stage settings
5. THE per-stage environment variable check SHALL complete in constant time without any LLM call or network operation

### Requirement 4: Graceful Degradation and Fault Isolation

**User Story:** As a 平台工程师, I want the brainstorm integration to degrade gracefully on any failure, so that the existing single-agent pipeline path is never broken by brainstorm subsystem errors.

#### Acceptance Criteria

1. IF the Decision Gate LLM call throws an error, THEN THE Stage_Wrapper SHALL execute the single-agent fallback and emit a `brainstorm.degraded` event with the error reason
2. IF the Brainstorm_Orchestrator session fails or times out, THEN THE Stage_Wrapper SHALL execute the single-agent fallback and emit a `brainstorm.degraded` event
3. IF the Brainstorm_Orchestrator synthesis produces an empty or invalid output, THEN THE Stage_Wrapper SHALL execute the single-agent fallback and emit a `brainstorm.degraded` event
4. THE Stage_Wrapper SHALL catch all exceptions from the brainstorm subsystem in a top-level try/catch that unconditionally falls through to single-agent execution
5. WHEN graceful degradation occurs, THE Stage_Wrapper SHALL log the failure at `warn` level through `ctx.logger` with the stage ID, job ID, and error summary
6. THE single-agent fallback path SHALL execute with identical behavior to the current codebase when `BLUEPRINT_BRAINSTORM_ENABLED` is not set (zero behavioral change)

### Requirement 5: Event Emission Through Existing Event Bus

**User Story:** As a 前端工程师, I want brainstorm lifecycle events to flow through the existing BlueprintEventBus and Socket.IO relay, so that the frontend can visualize brainstorm progress without a separate transport.

#### Acceptance Criteria

1. WHEN the Decision Gate completes evaluation, THE Stage_Wrapper SHALL emit a `brainstorm.gate.evaluated` event through Event_Bus containing: jobId, stageId, decision (brainstorm or single-agent), and elapsed time in milliseconds
2. WHEN a brainstorm session starts, THE Brainstorm_Orchestrator SHALL emit `brainstorm.session.started` through Event_Bus containing: sessionId, jobId, stageId, mode, and roles
3. WHEN a brainstorm session completes, THE Brainstorm_Orchestrator SHALL emit `brainstorm.session.completed` through Event_Bus containing: sessionId, jobId, stageId, synthesisDecision summary, and elapsed time
4. WHEN degradation occurs, THE Stage_Wrapper SHALL emit `brainstorm.degraded` through Event_Bus containing: jobId, stageId, reason, affectedComponent, and fallbackAction
5. ALL brainstorm events SHALL use the `"brainstorm"` event family and SHALL NOT introduce new event family prefixes beyond those already defined in `autopilot-multi-agent-brainstorm`
6. ALL brainstorm events SHALL include the `jobId` and `stage` fields required by `BlueprintGenerationEvent` to enable correlation with existing pipeline events

### Requirement 6: LLM Caller Adapter Bridge

**User Story:** As a 平台工程师, I want the brainstorm subsystem's LLMCallerFn to properly bridge to the real BlueprintServiceContext LLM dependencies, so that brainstorm LLM calls use the same provider configuration, API keys, and retry logic as the main pipeline.

#### Acceptance Criteria

1. THE LLM_Caller_Fn adapter SHALL accept `(prompt: string, systemPrompt?: string)` and delegate to `ctx.llm.callJson` with appropriate message formatting
2. THE LLM_Caller_Fn adapter SHALL use the AI configuration returned by `ctx.llm.getConfig()` for model selection, temperature, and API endpoint
3. THE LLM_Caller_Fn adapter SHALL return the LLM response content as a plain string to the brainstorm subsystem
4. IF the LLM call fails, THEN THE LLM_Caller_Fn adapter SHALL propagate the error to the brainstorm subsystem without modification (the brainstorm subsystem has its own retry and degradation logic)
5. THE LLM_Caller_Fn adapter SHALL NOT introduce a separate API key or model configuration; brainstorm LLM calls share the same provider as the main pipeline

### Requirement 7: Event Emitter Adapter Bridge

**User Story:** As a 平台工程师, I want the brainstorm subsystem's EventEmitterFn to properly bridge to the real BlueprintEventBus, so that brainstorm events are persisted in the job's event log and relayed to the frontend.

#### Acceptance Criteria

1. THE Event_Emitter_Fn adapter SHALL accept `(type: string, payload: unknown)` and construct a valid `BlueprintGenerationEvent` with the appropriate `type`, `family: "brainstorm"`, and payload fields
2. THE Event_Emitter_Fn adapter SHALL populate the `jobId`, `stage`, `status`, and `occurredAt` fields from the current stage execution context
3. THE Event_Emitter_Fn adapter SHALL call `ctx.eventBus.emit(event)` to persist the event in the job store and relay to subscribers
4. THE Event_Emitter_Fn adapter SHALL generate a unique `id` for each event using `randomUUID()`
5. IF `ctx.eventBus.emit` throws, THEN THE Event_Emitter_Fn adapter SHALL swallow the error and log at `warn` level (brainstorm events are non-critical observability data)

### Requirement 8: Backward Compatibility Guarantee

**User Story:** As a QA 工程师, I want the existing 5140+ tests to continue passing without modification after the brainstorm hookup is deployed, so that the integration does not introduce regressions.

#### Acceptance Criteria

1. WHILE `BUILD_TARGET` equals `"test"`, THE brainstorm context assembly SHALL produce `null` regardless of `BLUEPRINT_BRAINSTORM_ENABLED` value (matching existing capability bridge test isolation pattern)
2. WHILE `BLUEPRINT_BRAINSTORM_ENABLED` does not equal `"true"`, THE pipeline stage handlers SHALL execute with identical behavior to the current codebase (zero additional LLM calls, zero additional events, zero additional latency)
3. THE Stage_Wrapper SHALL NOT modify the signature or return type of existing stage handler functions; wrapping is additive at the call site
4. THE Stage_Wrapper SHALL NOT modify existing stage artifacts, events, or job state beyond appending brainstorm-specific supplementary events
5. THE per-stage environment variable defaults SHALL all be `undefined` (not `"true"`), meaning brainstorm is opt-in per stage even when the master switch is enabled

### Requirement 9: Diagnostics Endpoint Extension

**User Story:** As a 运维工程师, I want the existing `GET /api/blueprint/diagnostics` endpoint to include brainstorm subsystem health status, so that I can monitor whether brainstorm is active and functioning correctly.

#### Acceptance Criteria

1. THE `GET /api/blueprint/diagnostics` response SHALL include a `brainstorm` entry containing: `enabled` (boolean), `activeSessionsCount`, `totalSessionsCompleted`, `degradationCount`, `perStageConfig` (object mapping each stage to its enabled/disabled state)
2. WHEN brainstorm is disabled, THE diagnostics `brainstorm` entry SHALL report `enabled: false` with all counters at zero
3. WHEN brainstorm is enabled, THE diagnostics `brainstorm` entry SHALL report real-time counters from the `BrainstormOrchestrator.getDiagnostics()` method
4. THE diagnostics extension SHALL NOT introduce additional latency to the diagnostics endpoint beyond reading in-memory counters

### Requirement 10: Brainstorm Output to Stage Result Mapping

**User Story:** As a 平台工程师, I want the brainstorm synthesis output to be correctly mapped back to the expected format of each pipeline stage, so that downstream stages consume brainstorm results without modification.

#### Acceptance Criteria

1. WHEN brainstorm produces output for `route_generation` stage, THE Stage_Wrapper SHALL parse the synthesis result as a JSON RouteSet structure and pass it to the existing route set assembly logic
2. WHEN brainstorm produces output for `spec_tree` stage, THE Stage_Wrapper SHALL parse the synthesis result as a SPEC tree node array and pass it to the existing spec tree assembly logic
3. WHEN brainstorm produces output for `spec_docs` stage, THE Stage_Wrapper SHALL parse the synthesis result as SPEC document content and pass it to the existing document assembly logic
4. WHEN brainstorm produces output for `effect_preview`, `prompt_packaging`, or `engineering_handoff` stages, THE Stage_Wrapper SHALL pass the synthesis result text directly to the respective stage's output assembly
5. IF the synthesis result cannot be parsed into the expected format for a stage, THEN THE Stage_Wrapper SHALL treat it as a degradation event and fall through to single-agent execution
6. THE Stage_Wrapper SHALL log the brainstorm session ID in the stage's event trail for traceability
