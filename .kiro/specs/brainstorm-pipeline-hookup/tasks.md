# Implementation Plan: Brainstorm Pipeline Hookup

## Overview

Wire the existing `autopilot-multi-agent-brainstorm` subsystem into the real autopilot blueprint pipeline. Implementation follows dependency order: config resolver → adapters → output mapper → stage wrapper → context extension → diagnostics → final wiring into `blueprint.ts`.

All new implementation files go in `server/routes/blueprint/brainstorm/`.
All new test files go in `server/routes/blueprint/brainstorm/__tests__/`.

## Tasks

- [ ] 1. Implement stageConfigResolver (stage-config.ts)
  - [x] 1.1 Create `server/routes/blueprint/brainstorm/stage-config.ts`
    - Define `BrainstormEligibleStage` type union for the 6 pipeline stages
    - Define `BrainstormStageConfig` interface with `masterEnabled` and `perStage` record
    - Implement `resolveStageConfig()` — reads `BLUEPRINT_BRAINSTORM_ENABLED` and 6 per-stage env vars
    - Implement `isStageEnabled(stageId)` — returns true only when BOTH master AND per-stage are `"true"`
    - Pure synchronous function, no LLM calls or network I/O
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.2 Write property test for stageConfigResolver
    - **Property 2: Per-Stage Configuration Resolution**
    - Generate random combinations of master/per-stage env var values
    - Verify `isStageEnabled(stageId)` returns `true` iff both master AND per-stage equal `"true"`
    - Verify resolution completes synchronously without side effects
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [ ]* 1.3 Write unit tests for stageConfigResolver
    - Test all 6 stages disabled when master is off
    - Test individual stage enabled/disabled permutations
    - Test env var values that are truthy but not exactly `"true"` (e.g. `"1"`, `"TRUE"`)
    - Test default behavior when env vars are undefined
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 2. Implement createLlmCallerAdapter (llm-adapter.ts)
  - [x] 2.1 Create `server/routes/blueprint/brainstorm/llm-adapter.ts`
    - Implement `createLlmCallerAdapter(llm: BlueprintLlmDependencies): LLMCallerFn`
    - Format prompt + optional systemPrompt into messages array for `ctx.llm.callJson`
    - Use `ctx.llm.getConfig()` for model selection and temperature
    - Return LLM response content as plain string
    - Propagate errors unmodified to the brainstorm subsystem (no wrapping)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.2 Write property test for LLM adapter delegation
    - **Property 5: LLM Adapter Delegation Transparency**
    - Generate random prompt strings and optional system prompts
    - Verify adapter invokes `ctx.llm.callJson` with equivalent content
    - Verify response is returned as plain string
    - Verify errors from `ctx.llm.callJson` propagate without modification
    - **Validates: Requirements 6.1, 6.3, 6.4**

  - [ ]* 2.3 Write unit tests for LLM adapter
    - Test message formatting with and without systemPrompt
    - Test successful response extraction as string
    - Test error propagation (mock throws, verify same error surfaces)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 3. Implement createEventEmitterAdapter (event-emitter-adapter.ts)
  - [x] 3.1 Create `server/routes/blueprint/brainstorm/event-emitter-adapter.ts`
    - Define `EventEmitterAdapterContext` interface with eventBus, logger, jobId, stage, projectId
    - Implement `createEventEmitterAdapter(adapterCtx): EventEmitterFn`
    - Construct `BlueprintGenerationEvent` with `randomUUID()` id, `family: "brainstorm"`, jobId, stage, status, occurredAt
    - Call `ctx.eventBus.emit(event)` to persist and relay
    - Swallow `eventBus.emit` errors and log at warn level
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 3.2 Write property test for event adapter structural invariant
    - **Property 4: Event Adapter Structural Invariant**
    - Generate random `(type, payload)` pairs
    - Verify constructed event always has: `family === "brainstorm"`, non-empty jobId, valid stage, unique id via `randomUUID()`, valid ISO `occurredAt`
    - Verify emit errors are swallowed and logged at warn level
    - **Validates: Requirements 5.5, 5.6, 7.1, 7.2, 7.4, 7.5**

  - [ ]* 3.3 Write unit tests for event emitter adapter
    - Test event construction with known inputs
    - Test that emit errors are caught and logged
    - Test that each event gets a unique ID
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 4. Implement stageOutputMapper (stage-output-mapper.ts)
  - [x] 4.1 Create `server/routes/blueprint/brainstorm/stage-output-mapper.ts`
    - Define `StageOutputMapResult` interface with `success`, `output`, optional `error`
    - Implement `mapStageOutput(stageId, rawOutput): StageOutputMapResult`
    - For `route_generation`: parse as JSON RouteSet, re-serialize
    - For `spec_tree`: parse as JSON node array, re-serialize
    - For `spec_docs`: parse as markdown/JSON document content, validate structure
    - For `effect_preview`, `prompt_packaging`, `engineering_handoff`: pass-through text directly
    - On parse failure: return `{ success: false, output: null, error }`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 4.2 Write property test for stage output mapper
    - **Property 6: Stage Output Parse-or-Degrade**
    - Generate random strings for each stage
    - Verify structured stages (route_generation, spec_tree, spec_docs) either parse valid JSON or return failure
    - Verify text-only stages (effect_preview, prompt_packaging, engineering_handoff) always pass through successfully
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

  - [ ]* 4.3 Write unit tests for stage output mapper
    - Test valid JSON input for route_generation/spec_tree/spec_docs
    - Test invalid JSON falls through to failure
    - Test text stages always succeed
    - Test empty string handling per stage
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement wrapStageWithBrainstorm (stage-wrapper.ts)
  - [x] 6.1 Create `server/routes/blueprint/brainstorm/stage-wrapper.ts`
    - Define `StageWrapperOptions` interface: ctx, jobId, stageId, stageDescription, previousStageOutputs, singleAgentFn
    - Implement `wrapStageWithBrainstorm(options): Promise<string>`
    - Step 1: Check `isStageEnabled(stageId)` — if false, run singleAgentFn directly
    - Step 2: Check `ctx.brainstormContext` — if null, run singleAgentFn directly
    - Step 3: Build `StageContext`, LLM adapter, Event adapter
    - Step 4: Call `executeStageWithBrainstorm()`
    - Step 5: Map output to stage format via `mapStageOutput()`; if parse fails, degrade to singleAgentFn
    - Step 6: Top-level try/catch — on any exception: log warn, run singleAgentFn
    - Emit `brainstorm.gate.evaluated` event after Decision Gate completes
    - Emit `brainstorm.degraded` event on any failure
    - Log degradation at warn level with stageId, jobId, and error summary
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.4_

  - [ ]* 6.2 Write property test for graceful degradation invariant
    - **Property 3: Graceful Degradation Invariant**
    - Generate random errors (throw, reject, invalid output) from brainstorm subsystem components
    - Verify Stage Wrapper always catches, executes single-agent fallback, produces valid output
    - Verify brainstorm never causes pipeline stage to fail
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.6**

  - [ ]* 6.3 Write property test for stage wrapper output equivalence
    - **Property 8: Stage Wrapper Output Equivalence**
    - Generate random `StageResult` objects with type "brainstorm" or "single-agent"
    - Verify the `output` field is always used as the stage's LLM generation result (after stage-specific mapping for brainstorm)
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 6.4 Write unit tests for stage wrapper
    - Test brainstorm disabled path (master off) returns singleAgentFn result
    - Test brainstorm disabled path (per-stage off) returns singleAgentFn result
    - Test null brainstormContext path
    - Test successful brainstorm path with valid output
    - Test degradation path when executeStageWithBrainstorm throws
    - Test degradation path when output mapper fails
    - Test event emissions (gate.evaluated, degraded)
    - _Requirements: 2.1, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.4_

- [ ] 7. Extend BlueprintServiceContext with brainstormContext
  - [x] 7.1 Add `brainstormContext` field to `BlueprintServiceContext` interface in `server/routes/blueprint/context.ts`
    - Add optional `brainstormContext: BrainstormServiceContext | null` field
    - _Requirements: 1.1_

  - [x] 7.2 Update `buildBlueprintServiceContext` factory in `server/routes/blueprint/context.ts`
    - When `BLUEPRINT_BRAINSTORM_ENABLED === "true"` AND `BUILD_TARGET !== "test"`: assemble `BrainstormServiceContext` using `createLlmCallerAdapter` and `createEventEmitterAdapter`
    - When disabled or test mode: set `brainstormContext` to `null`
    - Wrap assembly in try/catch: on error, log, set to null, continue without interruption
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 8.1_

  - [ ]* 7.3 Write property test for context assembly correctness
    - **Property 1: Context Assembly Correctness**
    - Generate random env var values for `BLUEPRINT_BRAINSTORM_ENABLED` and `BUILD_TARGET`
    - Verify `brainstormContext` is non-null iff `BLUEPRINT_BRAINSTORM_ENABLED === "true"` AND `BUILD_TARGET !== "test"`
    - Verify assembly errors never propagate
    - **Validates: Requirements 1.2, 1.3, 1.6, 8.1**

  - [ ]* 7.4 Write unit tests for context assembly
    - Test brainstormContext is null when master switch is off
    - Test brainstormContext is null when BUILD_TARGET=test even if master switch is on
    - Test brainstormContext is non-null when master switch is on and not test
    - Test assembly error is caught and logged, brainstormContext remains null
    - _Requirements: 1.2, 1.3, 1.6, 8.1_

- [x] 8. Extend diagnostics endpoint with brainstorm entry
  - [x] 8.1 Add brainstorm diagnostics to `GET /api/blueprint/diagnostics` response
    - Define `BrainstormDiagnosticsEntry` interface: enabled, activeSessionsCount, totalSessionsCompleted, degradationCount, perStageConfig
    - When brainstorm disabled: report `enabled: false` with all counters at zero
    - When brainstorm enabled: report real-time counters from `BrainstormOrchestrator.getDiagnostics()`
    - Include per-stage config map from `resolveStageConfig()`
    - No additional latency (reads in-memory counters only)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x]* 8.2 Write unit tests for diagnostics extension
    - Test disabled state returns zeroed entry
    - Test enabled state returns live counters
    - Test perStageConfig reflects current env var values
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire stage wrapper into blueprint pipeline (final integration)
  - [x] 10.1 Apply `wrapStageWithBrainstorm` to all 6 pipeline stage call sites
    - Identify call sites in `server/routes/blueprint/index.ts` or respective stage service files
    - Wrap `route_generation` stage handler
    - Wrap `spec_tree` stage handler
    - Wrap `spec_docs` stage handler
    - Wrap `effect_preview` stage handler
    - Wrap `prompt_packaging` stage handler
    - Wrap `engineering_handoff` stage handler
    - Ensure wrapper is additive — does not modify handler signatures or return types
    - _Requirements: 2.6, 8.3, 8.4_

  - [ ]* 10.2 Write property test for backward compatibility
    - **Property 7: Backward Compatibility**
    - Generate random inputs with brainstorm disabled (master off, per-stage off, or BUILD_TARGET=test)
    - Verify output is identical to calling the original handler directly
    - Verify zero additional LLM calls, zero additional events, zero additional latency
    - Verify Stage Wrapper does not modify existing artifacts or job state
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

  - [ ]* 10.3 Write integration tests for full stage wrapper flow
    - Test full flow with mock LLM that returns brainstorm-needed decision
    - Test full flow with mock LLM that returns single-agent decision
    - Test degradation path when orchestrator throws
    - Test degradation path with invalid synthesis output triggers fallback
    - Test diagnostics endpoint with brainstorm enabled returns live counters
    - Test diagnostics endpoint with brainstorm disabled returns zeroed entry
    - _Requirements: 2.1, 2.4, 2.5, 4.1, 4.2, 4.3, 9.1, 9.3_

- [ ] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1-8)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout; all implementations use TypeScript
- Test library: `fast-check` (already in project) with minimum 100 iterations per property
- Existing `pipeline-integration.ts` already provides `executeStageWithBrainstorm()`, `BrainstormServiceContext`, `StageContext`, and `StageResult` — the new modules bridge these to the real pipeline
