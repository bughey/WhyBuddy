/**
 * Autopilot capability runtime — per-bridge diagnostics store.
 *
 * Pure in-memory, per-context aggregator that records the most recent execution
 * mode, counters, and redacted error reason for each of the 5 `/autopilot`
 * capability bridges:
 *
 *   - `docker`                   — docker-analysis-sandbox bridge
 *   - `mcpGithub`                — mcp-github-source bridge
 *   - `role`                     — role-system-architecture bridge
 *   - `aigcNode`                 — aigc-spec-node bridge
 *   - `agentCrewStageActivation` — agent crew stage activation driver
 *
 * The store is the single source of truth for `GET /api/blueprint/diagnostics`
 * (requirement 5.1) and is intentionally NOT wired to persistence, Socket.IO,
 * audit, or lineage (requirement 5.8). Process restart clears everything.
 *
 * References:
 * - design.md §4.4 — data structures, deep-copy snapshot semantics
 * - design.md §4.6 — subscriber drives the `recordBridgeInvocation` path
 * - requirements 5.1 / 5.2 / 5.3 / 5.4 / 5.5 / 5.7 / 5.8
 *
 * Invariants:
 * - `recordBridgeInvocation` / `recordBridgeConfiguration` are O(1) and never
 *   perform I/O (requirement 5.8).
 * - `snapshot()` returns a structurally independent copy; callers cannot
 *   mutate the internal `Map` through the returned object.
 * - `snapshot()` is the ONLY place this module reads `process.env`, and it
 *   reads only `AUTOPILOT_REAL_RUNTIME` / `BUILD_TARGET`.
 * - `lastError` is redacted via {@link applyAgentCrewRedaction} and truncated
 *   to at most 400 characters before being stored (requirement 5.7).
 */

import {
  applyAgentCrewRedaction,
  createDefaultAgentCrewStageActivationPolicy,
  type AgentCrewStageActivationPolicy,
} from "../agent-crew-stage-activation/policy.js";

/**
 * The five bridge identifiers recognised by the diagnostics store. These are
 * deliberately coarser than the underlying capability / event names so that
 * ops tooling (and the `/api/blueprint/diagnostics` endpoint) can reason about
 * "is this bridge currently real or fallback?" without having to resolve the
 * bridge -> capability -> event mapping.
 */
export type BridgeId =
  | "docker"
  | "mcpGithub"
  | "role"
  | "aigcNode"
  | "agentCrewStageActivation"
  // `autopilot-role-container-loader` spec Task 13：角色容器 loader 的独立诊断入口。
  // loader 的 invocation 使用 `lite` 字面量而不是 `fallback`，以区分于前 5 条桥的
  // "模板化降级"；teardown / orphan 走独立方法。
  | "roleContainerLoader"
  // `autopilot-role-autonomous-agent` spec Task 8：角色自主 Agent 的独立诊断入口。
  // 不复用 `totalInvocations` / `realInvocations` / `fallbackInvocations` 语义，
  // 而是通过 {@link recordDelegation} 写入 delegation 专属计数（real / lite /
  // fallback）和平均值（iterations / tokens / durationMs）。前 6 条 bridge 的
  // 行为不受影响。
  | "roleAutonomousAgent"
  // `autopilot-agent-reasoning-stream` spec Task 3：Agent 推理流桥接的独立诊断入口。
  // 该桥不复用 invocation / delegation / provision 语义，而是通过
  // {@link recordAgentReasoningForwarded} / {@link recordAgentReasoningDropped} /
  // {@link setAgentReasoningEnabled} 三个专属方法记录 forward / dropped 计数与
  // last event 元信息。前 7 条 bridge 的行为不受影响。
  | "agentReasoningBridge"
  // `autopilot-llm-spec-generation` spec Task 4.1：spec_tree LLM 推导桥的独立
  // 诊断入口。复用既有 `recordBridgeInvocation` / `recordBridgeConfiguration`
  // API（real / simulated_fallback），不新增方法，不引入新字段；前 8 条 bridge
  // 的字段语义保持不变。
  | "specTreeLlm"
  // `autopilot-llm-spec-generation` spec Task 4.1：spec_docs LLM 按节点生成桥
  // 的独立诊断入口。每个节点的 LLM 调用独立写入 `recordBridgeInvocation`，便于
  // 诊断端点聚合统计降级节点数；同样复用既有 entry 形态。
  | "specDocsLlm";

/**
 * Ordered list of every bridge the store tracks. Used to seed default entries
 * in the snapshot view so that the diagnostics endpoint always returns all
 * five keys (requirement 5.3).
 */
export const BRIDGE_IDS: readonly BridgeId[] = [
  "docker",
  "mcpGithub",
  "role",
  "aigcNode",
  "agentCrewStageActivation",
  "roleContainerLoader",
  "roleAutonomousAgent",
  "agentReasoningBridge",
  // `autopilot-llm-spec-generation` spec Task 4.1：追加在末尾，避免破坏既有
  // 索引语义；snapshot() 会自动按本数组顺序生成 `bridges` 全量 key，前端原有
  // 8 桥消费代码不受影响（只多看到两个新 key）。
  "specTreeLlm",
  "specDocsLlm",
] as const;

/**
 * Aggregated state for a single bridge. Mirrors the shape described in
 * design.md §4.4. Fields are all primitive values — the entry itself can be
 * cloned with a shallow spread (see {@link cloneEntry}).
 */
export interface BridgeDiagnosticEntry {
  bridgeId: BridgeId;
  /**
   * Coarse display mode, derived from the most recent invocation (if any) or
   * the latest configuration write-back (if no invocation has been recorded).
   * - `"real"`     — last invocation ran real code path
   * - `"fallback"` — last invocation entered simulated fallback
   * - `"enabled"`  — configuration says the bridge is enabled but no
   *                  invocation has happened yet
   * - `"disabled"` — configuration says the bridge is disabled
   * - `"unknown"`  — neither configuration nor invocation has been recorded
   */
  mode: "real" | "fallback" | "lite" | "enabled" | "disabled" | "unknown";
  enabledByConfig: boolean;
  dependencyReady: boolean;
  lastInvocationAt: string | undefined;
  lastMode: "real" | "simulated_fallback" | "lite" | undefined;
  lastError: string | undefined;
  totalInvocations: number;
  realInvocations: number;
  fallbackInvocations: number;
  /**
   * `autopilot-role-container-loader` spec Task 13：loader 专属计数字段。
   *
   * 前 5 条 bridge 继续保持为 `undefined`；仅当 `bridgeId === "roleContainerLoader"`
   * 时由 `recordBridgeInvocation` / `recordTeardown` / `noteOrphanContainer` 写入。
   */
  totalProvisions?: number;
  realProvisions?: number;
  liteProvisions?: number;
  teardownCount?: number;
  orphanContainerWarning?: number;
  /**
   * `autopilot-role-autonomous-agent` spec Task 8：roleAutonomousAgent 专属计数与平均值。
   *
   * 仅当 `bridgeId === "roleAutonomousAgent"` 时由 {@link recordDelegation} 写入；
   * 其它 bridge 保持 `undefined`，前 6 条 bridge 的 `totalInvocations` 语义不受影响。
   *
   * 满足不变式（Property 9）：
   * `totalDelegations === realDelegations + liteDelegations + fallbackDelegations`
   */
  totalDelegations?: number;
  realDelegations?: number;
  liteDelegations?: number;
  fallbackDelegations?: number;
  averageIterations?: number;
  averageTokens?: number;
  averageDurationMs?: number;
  /**
   * `autopilot-agent-reasoning-stream` spec Task 3：Agent 推理流桥专属字段。
   *
   * 仅当 `bridgeId === "agentReasoningBridge"` 时由
   * {@link setAgentReasoningEnabled} / {@link recordAgentReasoningForwarded} /
   * {@link recordAgentReasoningDropped} 三个方法写入；其它 bridge 保持 `undefined`，
   * 前 7 条 bridge 的既有字段语义不受影响。
   *
   * - `enabled`：env flag 开关，默认 false。
   * - `totalForwarded`：成功 forward 到 `BlueprintEventBus` 的 `role.agent.*` 事件计数。
   * - `droppedEntryCount`：listener 翻译 / emit 异常导致的丢弃计数。
   * - `lastEventAt` / `lastEventType`：最近一次 forward 成功的事件元信息。
   * - `mode`：成功 forward 后切到 `"real"`，但不复用 invocation 计数器。
   *
   * snapshot 时即使 env off 也保证 `enabled / totalForwarded / droppedEntryCount`
   * 至少有 0 / false 默认值，便于诊断端点向后兼容地暴露稳定 shape。
   */
  enabled?: boolean;
  totalForwarded?: number;
  droppedEntryCount?: number;
  lastEventAt?: string;
  lastEventType?: string;
}

/**
 * `autopilot-agent-reasoning-stream` spec Task 3：Agent 推理流桥诊断 entry 的
 * 显式类型投影。
 *
 * 该接口与 {@link BridgeDiagnosticEntry} 同源（都是 store snapshot 中
 * `bridges.agentReasoningBridge` 的子集），但只暴露 agent reasoning 关心的字段，
 * 用于：
 * - 端点 / 测试侧消费时获得更精确的类型语义；
 * - 文档侧表达 “该桥不复用 invocation / delegation 计数” 这一约束。
 *
 * 真实 store snapshot 仍以 `BridgeDiagnosticEntry` 形式暴露并向后兼容。
 */
export interface AgentReasoningBridgeDiagnostics {
  bridgeId: "agentReasoningBridge";
  enabled: boolean;
  totalForwarded: number;
  droppedEntryCount: number;
  lastEventAt?: string;
  lastEventType?: string;
}

/**
 * Deep-copy snapshot returned by {@link BlueprintRuntimeDiagnosticsStore.snapshot}.
 * The `bridges` record always contains all five {@link BRIDGE_IDS} keys; any
 * bridge that has neither been configured nor invoked is reported with the
 * default "unknown" entry.
 */
export interface BlueprintRuntimeDiagnosticsSnapshot {
  masterSwitch: string | null;
  buildTarget: string | null;
  bridges: Record<BridgeId, BridgeDiagnosticEntry>;
  generatedAt: string;
}

/**
 * Public contract of the diagnostics store. The store is constructed by
 * {@link createBlueprintRuntimeDiagnosticsStore}; callers MUST NOT assume any
 * other properties on the returned object.
 */
export interface BlueprintRuntimeDiagnosticsStore {
  /**
   * Record the outcome of a single bridge invocation.
   *
   * Preconditions:
   * - `bridgeId` is one of {@link BRIDGE_IDS}.
   * - `result.mode` is the bridge invocation's `provenance.executionMode`
   *   (or the equivalent for stage activation).
   *
   * Postconditions:
   * - `lastInvocationAt` is set to the store's `now()`-derived ISO string.
   * - `lastMode` equals `result.mode`.
   * - `lastError` is set when `result.error` is provided, after redaction
   *   and truncation to 400 characters; otherwise left untouched.
   * - `totalInvocations` is incremented by 1.
   * - `realInvocations` / `fallbackInvocations` are incremented based on
   *   `result.mode`.
   * - `mode` transitions to `"real"` or `"fallback"`.
   */
  recordBridgeInvocation(
    bridgeId: BridgeId,
    result: { mode: "real" | "simulated_fallback"; error?: string },
  ): void;
  /**
   * Record the startup-time configuration for a bridge.
   *
   * Preconditions:
   * - Called by the composition root AFTER {@link resolveAllBridgeEnablement}
   *   and any dependency probe has settled for the bridge.
   *
   * Postconditions:
   * - `enabledByConfig` / `dependencyReady` are overwritten.
   * - If no invocation has been recorded yet (`totalInvocations === 0`), the
   *   display `mode` transitions to `"enabled"` / `"disabled"` based on
   *   `enabledByConfig`. Once an invocation has been observed, `mode` stays
   *   on the real / fallback track and is not regressed by configuration
   *   updates.
   */
  recordBridgeConfiguration(
    bridgeId: BridgeId,
    config: { enabledByConfig: boolean; dependencyReady: boolean },
  ): void;
  /**
   * `autopilot-role-container-loader` spec Task 13.4：记录 role container
   * teardown。仅对 `bridgeId === "roleContainerLoader"` 生效；其它 bridge id
   * 的调用会被直接忽略（与现有 API 对称：不抛错、不污染既有数据）。
   */
  recordTeardown(
    bridgeId: BridgeId,
    payload: { key: unknown; mode: "real" | "lite" },
  ): void;
  /**
   * `autopilot-role-container-loader` spec Task 13.4：记录物理容器释放失败
   * 产生的孤儿告警。仅对 `bridgeId === "roleContainerLoader"` 生效。
   */
  noteOrphanContainer(
    bridgeId: BridgeId,
    payload: { key: unknown; err: string },
  ): void;
  /**
   * `autopilot-role-autonomous-agent` spec Task 8：记录一次角色 Agent 委派结果。
   *
   * 仅对 `bridgeId === "roleAutonomousAgent"` 生效；其它 bridge id 直接 no-op，
   * 与 {@link recordTeardown} / {@link noteOrphanContainer} 对称。
   *
   * Preconditions:
   * - `result.mode` 是委派最终归属的模式：
   *   - `"real"`     — Real Mode（容器内 Agent Loop）成功
   *   - `"lite"`     — Lite Mode（宿主内简化 Agent Loop）成功
   *   - `"fallback"` — 三级降级链最终退化到 `callLLMJson` 的 fallback 结果
   *
   * Postconditions:
   * - `totalDelegations += 1`
   * - `realDelegations` / `liteDelegations` / `fallbackDelegations` 按 `mode` 累加
   * - 累加 iterations / tokens / durationMs 到内部 sum，`snapshot()` 时按
   *   `sum / totalDelegations` 计算对应 average 字段；totalDelegations === 0 时
   *   average 字段为 0。
   * - `lastInvocationAt` / `lastMode` / `lastError` 同步更新。
   * - `entry.mode` 迁移为 `"real"` / `"lite"` / `"fallback"` 之一，与 `lastMode`
   *   保持一致。
   * - `lastError` 经 {@link applyAgentCrewRedaction} 脱敏并截断到 400 字符。
   */
  recordDelegation(
    bridgeId: BridgeId,
    result: {
      mode: "real" | "lite" | "fallback";
      iterations: number;
      tokens: number;
      durationMs: number;
      error?: string;
    },
  ): void;
  /**
   * `autopilot-agent-reasoning-stream` spec Task 3.3：设置 Agent 推理流桥的
   * `enabled` 标志。仅对 `bridgeId === "agentReasoningBridge"` entry 生效；
   * 其它 bridge 不受影响。
   *
   * Postconditions:
   * - 直接覆写 `agentReasoningBridge.enabled`；不联动 `mode` / 计数器。
   * - 即使从未 invoke，本方法也会保证 entry 至少存在并具备稳定字段默认值。
   */
  setAgentReasoningEnabled(enabled: boolean): void;
  /**
   * `autopilot-agent-reasoning-stream` spec Task 3.3：记录一次成功 forward 的
   * `role.agent.*` 事件。
   *
   * Postconditions:
   * - `totalForwarded += 1`
   * - `lastEventAt` 更新为传入 `now` 的 ISO 表示。
   * - `lastEventType` 更新为传入的 `eventType`。
   * - 不影响 `droppedEntryCount` / `enabled` / `mode`。
   */
  recordAgentReasoningForwarded(eventType: string, now: Date): void;
  /**
   * `autopilot-agent-reasoning-stream` spec Task 3.3：记录一次 listener 翻译 /
   * emit 异常导致的丢弃事件。
   *
   * Postconditions:
   * - `droppedEntryCount += 1`
   * - 不影响 `totalForwarded` / `lastEventAt` / `lastEventType` / `enabled`。
   */
  recordAgentReasoningDropped(): void;
  /**
   * Produce a deep-copy snapshot of the current state.
   *
   * @param now Clock injected by the caller (the route handler typically
   *            passes `ctx.now`). This is the only time reference used for
   *            `generatedAt`; `lastInvocationAt` continues to reflect the
   *            clock that was active when the invocation was recorded.
   *
   * Postconditions:
   * - Returned object is structurally independent from the internal `Map`;
   *   mutating it has no effect on subsequent snapshots.
   * - `bridges` contains all five {@link BRIDGE_IDS} keys.
   * - `masterSwitch` / `buildTarget` reflect the current `process.env`
   *   values (this is the ONLY `process.env` read in the store).
   */
  snapshot(now: () => Date): BlueprintRuntimeDiagnosticsSnapshot;
}

/**
 * Factory options. The `now` hook is primarily exposed for deterministic unit
 * tests; production callers can omit it and rely on the default `() => new Date()`.
 */
export interface CreateDiagnosticsStoreOptions {
  now?: () => Date;
}

const MAX_ERROR_CHARS = 400;
const REDACTION_POLICY: AgentCrewStageActivationPolicy =
  createDefaultAgentCrewStageActivationPolicy();

/**
 * Produces a fresh {@link BridgeDiagnosticEntry} pre-populated with the
 * "unknown" default so that snapshots are well-formed even before any data
 * has been recorded (requirement 5.4).
 */
function createDefaultEntry(bridgeId: BridgeId): BridgeDiagnosticEntry {
  return {
    bridgeId,
    mode: "unknown",
    enabledByConfig: false,
    dependencyReady: false,
    lastInvocationAt: undefined,
    lastMode: undefined,
    lastError: undefined,
    totalInvocations: 0,
    realInvocations: 0,
    fallbackInvocations: 0,
  };
}

/**
 * Shallow-copy helper. `BridgeDiagnosticEntry` is a flat record of primitives
 * and string literals, so a spread clone is structurally safe.
 */
function cloneEntry(entry: BridgeDiagnosticEntry): BridgeDiagnosticEntry {
  return { ...entry };
}

/**
 * Applies the shared Agent Crew redaction policy and truncates the result to
 * at most {@link MAX_ERROR_CHARS} characters (requirement 5.7). Returns
 * `undefined` pass-through so that `recordBridgeInvocation` can skip the
 * assignment when no error is supplied.
 */
function redactAndTruncateError(error: string | undefined): string | undefined {
  if (error === undefined) {
    return undefined;
  }
  const redacted = applyAgentCrewRedaction(error, REDACTION_POLICY);
  if (redacted.length <= MAX_ERROR_CHARS) {
    return redacted;
  }
  return redacted.slice(0, MAX_ERROR_CHARS);
}

/**
 * Reads a `process.env` value and normalises empty strings to `null` so the
 * snapshot field consumers (and the diagnostics API clients) can tell
 * "unset" apart from "set to a concrete string".
 */
function readEnvOrNull(key: string): string | null {
  const value = process.env[key];
  if (value === undefined || value === "") {
    return null;
  }
  return value;
}

/**
 * Creates an in-memory diagnostics store. Callers typically construct one
 * instance per {@link BlueprintServiceContext} so that parallel test cases
 * observe independent state.
 */
export function createBlueprintRuntimeDiagnosticsStore(
  options: CreateDiagnosticsStoreOptions = {},
): BlueprintRuntimeDiagnosticsStore {
  const now = options.now ?? (() => new Date());
  const entries: Map<BridgeId, BridgeDiagnosticEntry> = new Map();

  /**
   * `autopilot-role-autonomous-agent` spec Task 8.4：agent delegation 累加和。
   *
   * 只在 `recordDelegation` 里写入；`snapshot()` 时按
   * `sum / totalDelegations` 计算 average 字段，避免把浮点 average 直接存到
   * entry 造成多次 record 后的累计误差。外部不可见。
   */
  const agentSums = new Map<
    BridgeId,
    { iterationsSum: number; tokensSum: number; durationMsSum: number }
  >();

  /**
   * Returns the live entry for a bridge, creating a fresh default if the
   * bridge has never been touched. The returned reference MUST only be
   * mutated by store methods — it is never exposed to external callers.
   */
  function getOrCreateEntry(bridgeId: BridgeId): BridgeDiagnosticEntry {
    let entry = entries.get(bridgeId);
    if (entry === undefined) {
      entry = createDefaultEntry(bridgeId);
      entries.set(bridgeId, entry);
    }
    return entry;
  }

  function recordBridgeInvocation(
    bridgeId: BridgeId,
    result: { mode: "real" | "simulated_fallback"; error?: string },
  ): void {
    const entry = getOrCreateEntry(bridgeId);
    entry.lastInvocationAt = now().toISOString();
    entry.lastMode = result.mode;
    if (result.error !== undefined) {
      entry.lastError = redactAndTruncateError(result.error);
    }
    entry.totalInvocations += 1;
    if (result.mode === "real") {
      entry.realInvocations += 1;
      entry.mode = "real";
      entry.dependencyReady = true;
    } else {
      entry.fallbackInvocations += 1;
      entry.mode = "fallback";
    }
    // Task 13.3：loader 专属计数。real → realProvisions，lite → liteProvisions。
    // 同时把 mode 字面量从 "fallback" 升级为 "lite"，与 loader 模式命名保持一致。
    if (bridgeId === "roleContainerLoader") {
      entry.totalProvisions = (entry.totalProvisions ?? 0) + 1;
      if (result.mode === "real") {
        entry.realProvisions = (entry.realProvisions ?? 0) + 1;
      } else {
        entry.liteProvisions = (entry.liteProvisions ?? 0) + 1;
        entry.mode = "lite";
      }
    }
  }

  function recordTeardown(
    bridgeId: BridgeId,
    _payload: { key: unknown; mode: "real" | "lite" },
  ): void {
    if (bridgeId !== "roleContainerLoader") {
      return;
    }
    const entry = getOrCreateEntry(bridgeId);
    entry.teardownCount = (entry.teardownCount ?? 0) + 1;
  }

  function noteOrphanContainer(
    bridgeId: BridgeId,
    payload: { key: unknown; err: string },
  ): void {
    if (bridgeId !== "roleContainerLoader") {
      return;
    }
    const entry = getOrCreateEntry(bridgeId);
    entry.orphanContainerWarning = (entry.orphanContainerWarning ?? 0) + 1;
    if (payload.err !== undefined) {
      entry.lastError = redactAndTruncateError(payload.err);
    }
  }

  /**
   * `autopilot-role-autonomous-agent` spec Task 8：记录一次角色 Agent 委派结果。
   *
   * 该方法只对 `bridgeId === "roleAutonomousAgent"` 生效；其它 bridge 直接 no-op，
   * 与 {@link recordTeardown} / {@link noteOrphanContainer} 对称，保证前 6 条 bridge
   * 的现有计数语义不被污染。
   *
   * 维护的不变式（Property 9）：
   * `totalDelegations === realDelegations + liteDelegations + fallbackDelegations`
   */
  function recordDelegation(
    bridgeId: BridgeId,
    result: {
      mode: "real" | "lite" | "fallback";
      iterations: number;
      tokens: number;
      durationMs: number;
      error?: string;
    },
  ): void {
    if (bridgeId !== "roleAutonomousAgent") {
      return;
    }
    const entry = getOrCreateEntry(bridgeId);
    entry.lastInvocationAt = now().toISOString();
    entry.totalDelegations = (entry.totalDelegations ?? 0) + 1;

    // 根据 mode 累加对应 counter 并同步 entry.mode / lastMode 字面量。
    // lastMode 保持既有 union 兼容性：fallback 映射为 "simulated_fallback"，
    // lite 作为本次新增的显式字面量。
    if (result.mode === "real") {
      entry.realDelegations = (entry.realDelegations ?? 0) + 1;
      entry.mode = "real";
      entry.lastMode = "real";
    } else if (result.mode === "lite") {
      entry.liteDelegations = (entry.liteDelegations ?? 0) + 1;
      entry.mode = "lite";
      entry.lastMode = "lite";
    } else {
      entry.fallbackDelegations = (entry.fallbackDelegations ?? 0) + 1;
      entry.mode = "fallback";
      entry.lastMode = "simulated_fallback";
    }

    // 维护 sum 到模块私有 Map；average 在 snapshot() 里按 sum / total 计算。
    const sums =
      agentSums.get(bridgeId) ??
      { iterationsSum: 0, tokensSum: 0, durationMsSum: 0 };
    sums.iterationsSum += Math.max(0, Math.floor(result.iterations));
    sums.tokensSum += Math.max(0, Math.floor(result.tokens));
    sums.durationMsSum += Math.max(0, Math.floor(result.durationMs));
    agentSums.set(bridgeId, sums);

    if (result.error !== undefined) {
      entry.lastError = redactAndTruncateError(result.error);
    }
  }

  /**
   * `autopilot-agent-reasoning-stream` spec Task 3.3：覆写 agent reasoning 桥的
   * `enabled` 标志。仅对 `agentReasoningBridge` entry 生效；其它 bridge id 不
   * 触发任何写入，与 {@link recordTeardown} / {@link recordDelegation} 对称。
   */
  function setAgentReasoningEnabled(enabled: boolean): void {
    const entry = getOrCreateEntry("agentReasoningBridge");
    entry.enabled = enabled;
    // 初始化伴随计数器，确保 snapshot 时即使从未 forward 过也返回稳定 shape。
    if (entry.totalForwarded === undefined) {
      entry.totalForwarded = 0;
    }
    if (entry.droppedEntryCount === undefined) {
      entry.droppedEntryCount = 0;
    }
  }

  /**
   * `autopilot-agent-reasoning-stream` spec Task 3.3：累加 forward 计数并更新
   * `lastEventAt` / `lastEventType`。
   */
  function recordAgentReasoningForwarded(eventType: string, now: Date): void {
    const entry = getOrCreateEntry("agentReasoningBridge");
    entry.totalForwarded = (entry.totalForwarded ?? 0) + 1;
    entry.lastEventAt = now.toISOString();
    entry.lastEventType = eventType;
    entry.lastInvocationAt = now.toISOString();
    entry.lastMode = "real";
    entry.mode = "real";
    entry.dependencyReady = true;
    if (entry.droppedEntryCount === undefined) {
      entry.droppedEntryCount = 0;
    }
    if (entry.enabled === undefined) {
      entry.enabled = false;
    }
  }

  /**
   * `autopilot-agent-reasoning-stream` spec Task 3.3：累加 dropped 计数。
   */
  function recordAgentReasoningDropped(): void {
    const entry = getOrCreateEntry("agentReasoningBridge");
    entry.droppedEntryCount = (entry.droppedEntryCount ?? 0) + 1;
    if (entry.totalForwarded === undefined) {
      entry.totalForwarded = 0;
    }
    if (entry.enabled === undefined) {
      entry.enabled = false;
    }
  }

  function recordBridgeConfiguration(
    bridgeId: BridgeId,
    config: { enabledByConfig: boolean; dependencyReady: boolean },
  ): void {
    const entry = getOrCreateEntry(bridgeId);
    entry.enabledByConfig = config.enabledByConfig;
    entry.dependencyReady = config.dependencyReady;
    if (entry.totalInvocations === 0) {
      entry.mode = config.enabledByConfig ? "enabled" : "disabled";
    }
  }

  function snapshot(
    snapshotNow: () => Date,
  ): BlueprintRuntimeDiagnosticsSnapshot {
    const bridges = {} as Record<BridgeId, BridgeDiagnosticEntry>;
    for (const bridgeId of BRIDGE_IDS) {
      const entry = entries.get(bridgeId) ?? createDefaultEntry(bridgeId);
      const copy = cloneEntry(entry);
      // spec Task 8.4：只对 roleAutonomousAgent 计算 averages。
      // totalDelegations === 0 时 averages 字段保持 undefined，避免在诊断端点
      // 返回 NaN / 0/0。若存在 delegation，则按 sum / total 计算。
      if (bridgeId === "roleAutonomousAgent") {
        const total = copy.totalDelegations ?? 0;
        const sums = agentSums.get(bridgeId);
        if (total > 0 && sums) {
          copy.averageIterations = sums.iterationsSum / total;
          copy.averageTokens = sums.tokensSum / total;
          copy.averageDurationMs = sums.durationMsSum / total;
        } else if (total > 0) {
          // 理论上不会触发：delegation 被记过但 sum 丢失——防御性兜底为 0。
          copy.averageIterations = 0;
          copy.averageTokens = 0;
          copy.averageDurationMs = 0;
        }
      }
      // `autopilot-agent-reasoning-stream` spec Task 3.4：env off 默认也应返回
      // `{ enabled: false, totalForwarded: 0, droppedEntryCount: 0 }`，避免
      // 诊断端点把缺省值暴露成 undefined / NaN。其它 bridge entry 不写入这些
      // 字段，保持向后兼容。
      if (bridgeId === "agentReasoningBridge") {
        copy.enabled = copy.enabled ?? false;
        copy.totalForwarded = copy.totalForwarded ?? 0;
        copy.droppedEntryCount = copy.droppedEntryCount ?? 0;
      }
      bridges[bridgeId] = copy;
    }
    return {
      masterSwitch: readEnvOrNull("AUTOPILOT_REAL_RUNTIME"),
      buildTarget: readEnvOrNull("BUILD_TARGET"),
      bridges,
      generatedAt: snapshotNow().toISOString(),
    };
  }

  return {
    recordBridgeInvocation,
    recordBridgeConfiguration,
    recordTeardown,
    noteOrphanContainer,
    recordDelegation,
    setAgentReasoningEnabled,
    recordAgentReasoningForwarded,
    recordAgentReasoningDropped,
    snapshot,
  };
}
