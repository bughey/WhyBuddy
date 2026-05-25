/**
 * Stage Split Descriptor — logical artifact merge & key derivation.
 *
 * 这是 `.kiro/specs/spec-first-stage-process-artifact-split-uniform/` 设计文档
 * Component 4 的纯函数落地：在 `artifact.id` 字面去重之上引入「逻辑产物」
 * 维度的去重，主要解决澄清会话同一 sessionId 在本地合成 + 后端推送下出现两
 * 张卡片的问题，对 `route_set / route_selection / spec_tree / intake /
 * github_source / project_context` 等也保持一致的逻辑去重语义。
 *
 * 严格契约：
 * - 本文件**完全无副作用**：不调用 `Date.now()` / 不读 random / 不写日志 /
 *   不抛错（empty 输入返回 `[]`）。
 * - `mergeLogicalArtifacts` 自身**不**判断哪条来自本地、哪条来自服务端。
 *   它把任一 `LogicalArtifactKey` 第一次出现的 artifact 当作 representative。
 *   所有期望「本地 rich payload 在键冲突时获胜」的调用方**必须**保证调用顺
 *   序为 `mergeLogicalArtifacts([...localArtifacts, ...jobArtifacts])`，把本
 *   地数组放在前面（详见下方 JSDoc 中的 caller-ordering contract）。
 *
 * 对应需求：2.3、4.1、4.2、4.3、4.4、4.6
 */

import type {
  BlueprintGenerationArtifact,
  BlueprintGenerationArtifactType,
} from "@shared/blueprint/contracts";

import type { LogicalArtifactKey } from "./types";

const CLARIFICATION_SESSION_ARTIFACT_ID_PREFIX = "clarification-session-";

/**
 * 从形如 `clarification-session-${sessionId}` 的本地合成 artifact id 中剥出
 * sessionId。设计文档 Component 4 的回退链需要这一步用 artifact.id 兜底
 * （`payload.sessionId` 与 `payload.id` 都缺失时仍能将本地与后端的两条同会
 * 话 artifact 合并到同一 `LogicalArtifactKey`）。
 *
 * 行为：
 * - 当输入以 `clarification-session-` 开头且后续残留长度 > 0 时返回残留部分；
 * - 其它情况（前缀不匹配，或前缀后为空字符串）返回 `null`。
 *
 * 这是私有 helper，故意不导出。
 */
function parseSessionFromArtifactId(artifactId: string | undefined | null): string | null {
  if (typeof artifactId !== "string") {
    return null;
  }
  if (!artifactId.startsWith(CLARIFICATION_SESSION_ARTIFACT_ID_PREFIX)) {
    return null;
  }
  const remainder = artifactId.slice(CLARIFICATION_SESSION_ARTIFACT_ID_PREFIX.length);
  return remainder.length > 0 ? remainder : null;
}

/**
 * 把 `unknown` 形态的 payload 安全收窄为可读 record。
 * artifact 契约里 `payload?: unknown`，下游需要按对象 / 字符串字段读取，
 * 在这里统一做 nullish + typeof 守卫，避免把数组、原始值、null 当作对象访问。
 */
function readPayloadRecord(payload: unknown): Record<string, unknown> | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  if (typeof payload !== "object") {
    return null;
  }
  if (Array.isArray(payload)) {
    return null;
  }
  return payload as Record<string, unknown>;
}

/**
 * 从 payload record 中读取一个非空字符串字段，否则返回 `null`。
 * 设计文档 Component 4 的所有 fallback 字段都要求「非空字符串才算命中」，
 * 空字符串 / 非字符串值（数字 / 布尔 / 对象 / 数组 / null / undefined）一律视为缺失。
 */
function readNonEmptyStringField(
  payload: Record<string, unknown> | null,
  field: string,
): string | null {
  if (payload === null) {
    return null;
  }
  const value = payload[field];
  if (typeof value !== "string") {
    return null;
  }
  return value.length > 0 ? value : null;
}

/**
 * 当 artifact 的 id 不是非空字符串时使用的占位键。
 *
 * 设计文档要求：missing/empty `id` 必须返回**非空**键，使得这条 artifact 仍
 * 能通过 `mergeLogicalArtifacts` 而不致拖垮 merge 循环（也不会与任何「id
 * 非空」的真实键冲突，因为真实键形如 `id:<non-empty-id>` / `clar:...` /
 * `route_set:...` 等，不会与 `"id:"` 字面相等）。
 *
 * 已知边界：多条都缺失 id 的 artifact 会共享这同一个占位键并被合并为一条。
 * 设计文档把这种情况标记为「unmergeable rows pass through unchanged」的健壮
 * 性兜底场景，并未要求严格保留多条 id 缺失 artifact 的独立性；下游真正的
 * artifact 都有合法 id，不会落到此路径。
 */
const MISSING_ID_PLACEHOLDER_KEY: LogicalArtifactKey = "id:";

/**
 * 取较早的那个 createdAt。
 *
 * 行为（与 design.md "the earlier of two createdAt" 对齐）：
 * - 任一为非空字符串时优先返回非空值；
 * - 两者都是非空字符串时按字典序比较（ISO-8601 字符串字典序与时间序一致）；
 * - 两者都缺失时回退为 representative (`a`) 的原值（包括空字符串 / undefined
 *   等异常态），保证「id / title / summary / type 不被覆盖」的 representative
 *   语义不被破坏。
 *
 * 这是私有 helper，故意不导出。
 */
function pickEarlier(a: string, b: string): string {
  const aValid = typeof a === "string" && a.length > 0;
  const bValid = typeof b === "string" && b.length > 0;
  if (aValid && bValid) {
    return a <= b ? a : b;
  }
  if (aValid) {
    return a;
  }
  if (bValid) {
    return b;
  }
  // both missing/empty → 退回 representative 原值
  return a;
}

/**
 * 计算单个 artifact 在「逻辑产物去重」语义下的稳定键。
 *
 * 设计文档 Component 4 完整 7 行映射表（其中 `clarification_session` 行为
 * 经过 spec 校对的回退链）：
 *
 * | type                  | logicalKey                               |
 * | --------------------- | ---------------------------------------- |
 * | clarification_session | (见下方回退链)                           |
 * | route_set             | `route_set:${payload.routeSetId ?? id}`  |
 * | route_selection       | `route_sel:${payload.selectionId ?? id}` |
 * | spec_tree             | `spec_tree:${payload.treeId ?? id}`      |
 * | intake                | `intake:${payload.intakeId ?? id}`       |
 * | github_source         | `gh:${payload.normalizedUrl ?? id}`      |
 * | project_context       | `pctx:${payload.projectId ?? id}`        |
 * | <other>               | `id:${id}`                               |
 *
 * `clarification_session` 的回退链（已与现有数据形态对齐：本地合成 artifact
 * 的 `payload` 是 `BlueprintClarificationSession`，其 sessionId 字段名为
 * `id` 而非 `sessionId`；服务端推送的 artifact `payload` 字段名为 `sessionId`）：
 *
 * ```
 * "clar:" + (
 *   payload.sessionId ??
 *   payload.id ??                                   // 本地 rich payload
 *   parseSessionFromArtifactId(artifact.id) ??      // "clarification-session-${id}"
 *   artifact.id
 * )
 * ```
 *
 * 任何字段缺失（或退化为空字符串）都向后回退；当全部回退项都缺失时函数仍
 * 返回非空键 —— 经由 `id:` 路径或 `MISSING_ID_PLACEHOLDER_KEY` 占位 —— 保
 * 证该 artifact 不会因为「键为空」而拖垮 merge 循环。
 *
 * 该函数是纯函数：同输入恒等输出，跨多次渲染保持稳定，不依赖 `Date.now()`
 * 或随机值。
 */
export function computeLogicalArtifactKey(
  artifact: BlueprintGenerationArtifact,
): LogicalArtifactKey {
  const payload = readPayloadRecord(artifact.payload);
  const artifactId = typeof artifact.id === "string" && artifact.id.length > 0 ? artifact.id : null;
  const type: BlueprintGenerationArtifactType | undefined = artifact.type;

  // clarification_session 走专属回退链
  if (type === "clarification_session") {
    const fromSessionField = readNonEmptyStringField(payload, "sessionId");
    if (fromSessionField !== null) {
      return `clar:${fromSessionField}`;
    }
    const fromIdField = readNonEmptyStringField(payload, "id");
    if (fromIdField !== null) {
      return `clar:${fromIdField}`;
    }
    const fromArtifactIdPrefix = parseSessionFromArtifactId(artifactId);
    if (fromArtifactIdPrefix !== null) {
      return `clar:${fromArtifactIdPrefix}`;
    }
    if (artifactId !== null) {
      return `clar:${artifactId}`;
    }
    return MISSING_ID_PLACEHOLDER_KEY;
  }

  // 其它 6 行映射：`<prefix>:${payload.field ?? artifact.id}` —— design.md
  // Component 4 中字面写为 `payload.routeSetId ?? id` 的语义。即便 payload
  // 字段与 artifact.id 都缺失，前缀本身仍非空，键不会退化成空串。
  if (type === "route_set") {
    const fromPayload = readNonEmptyStringField(payload, "routeSetId");
    if (fromPayload !== null) return `route_set:${fromPayload}`;
    // Local artifact stores the entire BlueprintRouteSet as payload, whose
    // identifier field is `id` (not `routeSetId`).
    const fromIdField = readNonEmptyStringField(payload, "id");
    if (fromIdField !== null) return `route_set:${fromIdField}`;
    // Strip the "route-set-" prefix from artifact.id if present
    if (artifactId !== null && artifactId.startsWith("route-set-")) {
      return `route_set:${artifactId.slice("route-set-".length)}`;
    }
    return `route_set:${artifactId ?? ""}`;
  }
  if (type === "route_selection") {
    const fromPayload = readNonEmptyStringField(payload, "selectionId");
    if (fromPayload !== null) return `route_sel:${fromPayload}`;
    const fromIdField = readNonEmptyStringField(payload, "id");
    if (fromIdField !== null) return `route_sel:${fromIdField}`;
    if (artifactId !== null && artifactId.startsWith("route-selection-")) {
      return `route_sel:${artifactId.slice("route-selection-".length)}`;
    }
    return `route_sel:${artifactId ?? ""}`;
  }
  if (type === "spec_tree") {
    const fromPayload = readNonEmptyStringField(payload, "treeId");
    if (fromPayload !== null) return `spec_tree:${fromPayload}`;
    const fromIdField = readNonEmptyStringField(payload, "id");
    if (fromIdField !== null) return `spec_tree:${fromIdField}`;
    if (artifactId !== null && artifactId.startsWith("spec-tree-")) {
      return `spec_tree:${artifactId.slice("spec-tree-".length)}`;
    }
    return `spec_tree:${artifactId ?? ""}`;
  }
  if (type === "intake") {
    const fromPayload = readNonEmptyStringField(payload, "intakeId");
    return `intake:${fromPayload ?? artifactId ?? ""}`;
  }
  if (type === "github_source") {
    const fromPayload = readNonEmptyStringField(payload, "normalizedUrl");
    return `gh:${fromPayload ?? artifactId ?? ""}`;
  }
  if (type === "project_context") {
    const fromPayload = readNonEmptyStringField(payload, "projectId");
    return `pctx:${fromPayload ?? artifactId ?? ""}`;
  }

  // <other> 行：直接用 id 兜底；id 缺失 / 为空时落到非空占位键。
  if (artifactId !== null) {
    return `id:${artifactId}`;
  }
  return MISSING_ID_PLACEHOLDER_KEY;
}

/**
 * 把后端 sparse payload 与本地 rich payload 浅合并：
 * 后端 payload 的非冲突键填补本地缺失键，本地 representative 在键冲突时获胜。
 *
 * 实现细节：把后端 payload 放在前面、本地 representative 的 payload 放在后
 * 面，利用对象展开的「后写后赢」语义让 representative 覆盖 server。`null /
 * undefined / 非对象值` 一律按 `{}` 处理。
 *
 * 该函数返回新对象，永远不会修改入参。
 */
function mergePayloads(serverPayload: unknown, representativePayload: unknown): unknown {
  const serverRecord = readPayloadRecord(serverPayload);
  const representativeRecord = readPayloadRecord(representativePayload);

  // 完全无 payload 的情况：保持 representative 的原始 payload 引用，避免无谓
  // 的 `{}` 字面创建造成下游误以为 payload 存在。
  if (serverRecord === null && representativeRecord === null) {
    return representativePayload ?? serverPayload;
  }
  return {
    ...(serverRecord ?? {}),
    ...(representativeRecord ?? {}),
  };
}

/**
 * 在「逻辑产物去重」维度合并 artifacts。
 *
 * 算法：单趟扫描，使用 `Map<LogicalArtifactKey, BlueprintGenerationArtifact>`
 * 收集 representative，并维护一个并行的 `LogicalArtifactKey[]` 数组以保证
 * 输出顺序为同 key 在输入中**首次出现**的相对顺序（稳定）。
 *
 * representative 选择：相同 `LogicalArtifactKey` 的第一条 artifact 即为
 * representative；其后到达的同 key artifact 仅用于补齐 representative 缺失
 * 的字段，不会替换 representative 自身的 `id / title / summary / type`。
 *
 * 字段级合并精度（合并 `prev`（先到的 representative）与 `a`（同 key 后到的
 * artifact）时）：
 *
 * - `id / title / summary / type`：始终来自 `prev`（**不**被覆盖）；
 * - `staleSince`：`a.staleSince` 非空时取 `a`，否则保留 `prev`；
 * - `invalidatedBy`：`a.invalidatedBy` 非空时取 `a`，否则保留 `prev`；
 * - `createdAt`：`pickEarlier(prev.createdAt, a.createdAt)`，避免占位先于真
 *   实产物消失；两者都缺失时退回 `prev.createdAt`；
 * - `payload`：`{ ...(a.payload ?? {}), ...(prev.payload ?? {}) }`，让本地
 *   representative 在键冲突时获胜；后端 sparse payload 仅填补 representative
 *   缺失的键，绝不擦除已渲染的 rich 字段（如澄清问题列表 / 答案）。
 *
 * Caller-ordering contract（**重要**）：本函数自身**不**推断哪条 artifact 来
 * 自本地、哪条来自服务端。它将任一 `LogicalArtifactKey` 第一次出现的 artifact
 * 视为 representative。所有期望「本地 rich payload 在键冲突时获胜」的调用方
 * **必须**把本地 artifact 数组放在 job artifact 数组之前调用本函数：
 *
 * ```ts
 * mergeLogicalArtifacts([...localArtifacts, ...jobArtifacts])
 * ```
 *
 * 这一约束在每个使用 `mergeLogicalArtifacts` 的调用点都需要显式遵守；
 * Batch 4/5 的 fabric 调用方如果不按此顺序传参，本函数不会自动纠正。
 *
 * 边界：
 * - 空数组输入返回 `[]`，永不抛错；
 * - 输入中 id / type 异常的 artifact（id 为空、payload 不是对象等）也不会
 *   抛错，会经由 `computeLogicalArtifactKey` 的占位键正常通过；
 * - 函数纯：不调用 `Date.now()` / random / 日志 / 网络。
 */
export function mergeLogicalArtifacts(
  artifacts: readonly BlueprintGenerationArtifact[],
): BlueprintGenerationArtifact[] {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return [];
  }

  const byKey = new Map<LogicalArtifactKey, BlueprintGenerationArtifact>();
  const order: LogicalArtifactKey[] = [];

  for (const next of artifacts) {
    const key = computeLogicalArtifactKey(next);
    const prev = byKey.get(key);
    if (prev === undefined) {
      byKey.set(key, next);
      order.push(key);
      continue;
    }
    // 同 key：以 prev 为 representative，补齐 / 覆盖逻辑见 JSDoc。
    const merged: BlueprintGenerationArtifact = {
      ...prev,
      staleSince: next.staleSince ?? prev.staleSince,
      invalidatedBy: next.invalidatedBy ?? prev.invalidatedBy,
      createdAt: pickEarlier(prev.createdAt, next.createdAt),
      payload: mergePayloads(next.payload, prev.payload),
    };
    byKey.set(key, merged);
  }

  const result: BlueprintGenerationArtifact[] = [];
  for (const key of order) {
    const value = byKey.get(key);
    if (value !== undefined) {
      result.push(value);
    }
  }
  return result;
}
