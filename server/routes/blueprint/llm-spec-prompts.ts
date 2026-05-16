/**
 * `autopilot-llm-spec-generation` spec Task 1：LLM SPEC 生成 prompt 集中管理模块。
 *
 * 本模块用于把 `spec_tree` 与 `spec_docs` 两个阶段所有 prompt 模板、版本号、
 * JSON schema 集中收口。下游 `spec-tree-llm-derivation.ts` 与
 * `spec-docs-llm-generation.ts` 通过本模块暴露的工厂构造 prompt，并通过
 * 后续 Task 1.5 将补齐的解析器对 LLM 输出做 schema 校验，避免 prompt 字面量
 * 散落在各处。
 *
 * 关键约束：
 * - 仅以 `import type` 引用 `shared/blueprint` 的类型，确保不引起 runtime
 *   副作用，也避免对 `agent-reasoning-bridge.ts` /
 *   `lite-agent-runtime.ts` / `callback-receiver.ts` / `llm-call.ts` 等
 *   既有桥接产生间接依赖。
 * - 不引入 `any` 类型；新增 schema、prompt 构造器、解析器都使用显式类型，
 *   遵守 TypeScript 113 错误基线的不扩张原则。
 * - `BUILD_TARGET=test` 下任何新增 env 旗标都视为 `false`，本模块本身
 *   不读取 `process.env`，由调用方在装配阶段统一短路。
 * - prompt 字面量与 `promptId` 保持英文，以确保 LLM provider 兼容；模块
 *   级 JSDoc / 注释统一使用中文。
 * - prompt 输出的 `userMessage` 必须是字节稳定（输入相同时输出相同），
 *   因此 `userPayload` 使用固定字段顺序 + `JSON.stringify(..., 2)` 序列化。
 *
 * 当前文件已实现 Task 1.1-1.5：
 * - Task 1.1：模块骨架与 promptId 常量。
 * - Task 1.2：`SpecTreeLlmResponseSchema` / `SpecDocsLlmResponseSchema`。
 * - Task 1.3：`buildSpecTreePrompt` / `buildSpecDocsPrompt`。
 * - Task 1.4：基于 `crypto.createHash("sha256")` 的 prompt fingerprint。
 * - Task 1.5：`parseSpecTreeLlmResponse` / `parseSpecDocsLlmResponse`，
 *   永不抛错；schema 失败返回 `{ ok: false, reason: "schema validation failed: ..." }`。
 *
 * 实施细节参见 `.kiro/specs/autopilot-llm-spec-generation/design.md`
 * 「Components and Interfaces > 1. server/routes/blueprint/llm-spec-prompts.ts」。
 */

import { createHash } from "node:crypto";

import { z } from "zod";

import type {
  BlueprintRouteCandidate,
  BlueprintRouteSet,
  BlueprintSpecTreeNode,
} from "../../../shared/blueprint/index.js";

// ---------------------------------------------------------------------------
// Prompt 版本常量
// ---------------------------------------------------------------------------

/**
 * `spec_tree` 阶段 LLM prompt 的稳定标识。
 *
 * 该 ID 写入 `BlueprintSpecTree.provenance.promptId`，用于回放、审计与
 * provenance 对账。schema 发生不向后兼容变更时升级到 `v2`。
 */
export const SPEC_TREE_PROMPT_ID = "blueprint.spec-tree-llm.v1" as const;

/**
 * `spec_docs` 阶段 LLM prompt 的稳定标识。
 *
 * 该 ID 写入 `BlueprintSpecDocument*` 的 provenance 字段，用于回放、
 * 审计与 provenance 对账。schema 发生不向后兼容变更时升级到 `v2`。
 */
export const SPEC_DOCS_PROMPT_ID = "blueprint.spec-docs-llm.v1" as const;

// ---------------------------------------------------------------------------
// Task 1.2：LLM 响应 zod schema
// ---------------------------------------------------------------------------

/**
 * `spec_tree` 阶段 LLM 响应 schema —— 只校验 LLM 输出层结构，不做扁平化。
 *
 * - `nodes.length` 限定 `1..64`，超长视为 invalid，避免 LLM 失控产出超长 token。
 * - 每个节点的 `title 1..200` / `summary 1..2000`，`id` / `parentId` 限定
 *   `1..64`，`type` 限定五枚举，`priority 0..100`。
 * - 不在此处校验“恰好一个 root”/“无环”等关系约束，关系约束放在
 *   `spec-tree-llm-derivation.ts` 的 tree 构造步骤。
 */
export const SpecTreeLlmResponseSchema = z.object({
  rootTitle: z.string().min(1).max(200),
  rootSummary: z.string().min(1).max(2000),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        parentId: z.string().min(1).max(64).optional(),
        title: z.string().min(1).max(200),
        summary: z.string().min(1).max(2000),
        type: z.enum([
          "root",
          "module",
          "submodule",
          "route_step",
          "alternative_route",
        ]),
        priority: z.number().int().min(0).max(100),
      }),
    )
    .min(1)
    .max(64),
});

/**
 * `spec_docs` 阶段 LLM 响应 schema —— 单节点产出三个文档段落。
 *
 * `requirements` / `design` / `tasks` 各限定 `1..20000` 字符，避免
 * 单节点产出超大 markdown 拖慢主流程或挤爆 token 预算。
 */
export const SpecDocsLlmResponseSchema = z.object({
  requirements: z.string().min(1).max(20000),
  design: z.string().min(1).max(20000),
  tasks: z.string().min(1).max(20000),
});

/** `SpecTreeLlmResponseSchema` 校验通过后的 TS 类型。 */
export type SpecTreeLlmResponse = z.infer<typeof SpecTreeLlmResponseSchema>;

/** `SpecDocsLlmResponseSchema` 校验通过后的 TS 类型。 */
export type SpecDocsLlmResponse = z.infer<typeof SpecDocsLlmResponseSchema>;

// ---------------------------------------------------------------------------
// Task 1.3：prompt 构造器输入与输出类型
// ---------------------------------------------------------------------------

/**
 * `buildSpecTreePrompt` 的输入。
 *
 * - `request`：用户原始 intake 中的关键字段（`targetText` / `githubUrls`）。
 * - `routeSet`：从已生成的 RouteSet 中取出的最小子集（id + routes 摘要）。
 * - `primaryRoute`：被选中的主路线，用于驱动节点拆解。
 * - `repoTreeDigest`：可选；MCP 拉取并截断后的仓库结构摘要。
 * - `keyFiles`：可选；关键配置文件原文（如 `package.json` / `tsconfig.json`）。
 */
export interface BuildSpecTreePromptInput {
  request: { targetText: string; githubUrls: ReadonlyArray<string> };
  routeSet: Pick<BlueprintRouteSet, "id" | "routes">;
  primaryRoute: BlueprintRouteCandidate;
  repoTreeDigest?: string;
  keyFiles?: ReadonlyArray<{ path: string; content: string }>;
}

/**
 * `buildSpecDocsPrompt` 的输入。
 *
 * - `node`：当前正在生成文档的 SPEC 树节点元数据。
 * - `parentSummary`：可选；父节点 ≤ 200 字摘要，便于子节点对齐父级语境。
 * - `siblingSummaries`：兄弟节点摘要列表，用于避免重复阐述。
 * - `primaryRouteSummary`：所选主路线的整体摘要文本，作为 spec_docs 共同
 *   背景。
 * - `relevantRepoExcerpts`：可选；该节点相关的仓库片段。
 */
export interface BuildSpecDocsPromptInput {
  node: Pick<
    BlueprintSpecTreeNode,
    "id" | "title" | "summary" | "type" | "parentId"
  >;
  parentSummary?: string;
  siblingSummaries: ReadonlyArray<{
    id: string;
    title: string;
    summary: string;
  }>;
  primaryRouteSummary: string;
  relevantRepoExcerpts?: ReadonlyArray<{ path: string; excerpt: string }>;
}

/**
 * prompt 构造结果；下游 derivation / generation 工厂消费此结构。
 *
 * `promptFingerprint` 形如 `"sha256:<64 hex chars>"`，写入
 * `provenance.promptFingerprint` 用于回放与对账（参见 Task 1.4）。
 */
export interface PromptPayload {
  promptId: string;
  systemMessage: string;
  userMessage: string;
  promptFingerprint: string;
}

// ---------------------------------------------------------------------------
// Task 1.4：prompt fingerprint 计算
// ---------------------------------------------------------------------------

/**
 * 基于 `node:crypto` 的 sha256 hex 摘要。
 *
 * 输入为 `systemMessage + "\n\n" + userMessage`；同样输入两次调用应得到
 * 完全相同的 fingerprint（顺序稳定，无随机字段）。
 */
function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * 计算 prompt fingerprint，统一使用 `"sha256:"` 前缀。
 *
 * 与 `server/routes/blueprint/spec-tree/prompt.ts` 等既有 prompt builder 保持
 * 一致，便于上游 provenance 字段统一识别哈希算法。
 */
function computePromptFingerprint(
  systemMessage: string,
  userMessage: string,
): string {
  return `sha256:${sha256Hex(systemMessage + "\n\n" + userMessage)}`;
}

// ---------------------------------------------------------------------------
// 系统提示语（英文，固定 JSON 模式提示）
// ---------------------------------------------------------------------------

/**
 * `spec_tree` 阶段 system message。
 *
 * 严格要求 LLM 输出合法 JSON，禁止 Markdown 围栏、禁止前置/后置说明，
 * 并指出输出字段必须命中 `SpecTreeLlmResponseSchema`。
 */
const SPEC_TREE_SYSTEM_MESSAGE =
  `You are the SPEC Tree reasoner inside the /autopilot pipeline.

You MUST respond with a valid JSON object matching the schema described in the user message. Do NOT wrap your answer in Markdown code fences. Do NOT include any prose before or after the JSON.

The JSON object MUST contain:
- "rootTitle": 1..200 character string describing the root node title.
- "rootSummary": 1..2000 character string describing the overall blueprint scope.
- "nodes": array of 1..64 nodes that decompose the selected primary route.

Each node MUST contain:
- "id": 1..64 character stable identifier (lowercase kebab-case recommended), unique across the array.
- "parentId": 1..64 character id of the parent node; omit for the single root node.
- "title": 1..200 character node title.
- "summary": 1..2000 character node summary.
- "type": one of "root" | "module" | "submodule" | "route_step" | "alternative_route".
- "priority": integer in [0, 100].

Modeling guidance:
- Exactly one node MUST use type "root".
- Non-root nodes MUST set "parentId" to a node that exists in the array.
- Organise nodes around the selected primary route's steps; emit "alternative_route" nodes only when the alternatives provide meaningful coverage.
- Do NOT reference real API keys, tokens, or personal data; abstract sensitive identifiers.`;

/**
 * `spec_docs` 阶段 system message。
 *
 * 单节点同时产出 `requirements` / `design` / `tasks` 三段 markdown，并
 * 严格要求合法 JSON 结构。
 */
const SPEC_DOCS_SYSTEM_MESSAGE =
  `You are the SPEC Document generator inside the /autopilot pipeline.

You MUST respond with a valid JSON object matching the schema described in the user message. Do NOT wrap your answer in Markdown code fences. Do NOT include any prose before or after the JSON.

The JSON object MUST contain three fields, each a non-empty Markdown string of 1..20000 characters:
- "requirements": user-facing requirements document for the current SPEC tree node.
- "design": technical design document for the current SPEC tree node.
- "tasks": actionable task checklist for the current SPEC tree node.

Authoring guidance:
- Stay scoped to the current node; rely on parentSummary / siblingSummaries to avoid duplication.
- Anchor the documents in the selected primary route's intent and steps.
- Do NOT reference real API keys, tokens, or personal data; abstract sensitive identifiers.`;

// ---------------------------------------------------------------------------
// Task 1.3：prompt 构造器实现
// ---------------------------------------------------------------------------

/**
 * 构造 `spec_tree` 阶段的 prompt payload。
 *
 * userPayload 字段顺序固定，便于 `JSON.stringify` 产出字节稳定的
 * userMessage：
 *   `promptId / targetText / githubUrls / routeSet / primaryRoute /
 *    repoTreeDigest? / keyFiles? / outputSchema`。
 *
 * - `routeSet.routes` 仅保留每条候选路线的 `id` / `kind` / `title` / `summary`，
 *   避免把全部 capability / step 字段都灌入 prompt 撑爆 token。
 * - `primaryRoute.steps` 保留入参顺序，确保下游 LLM 推导按主路线步骤展开。
 * - `keyFiles` 仅在调用方提供时出现，避免空数组干扰 fingerprint。
 */
export function buildSpecTreePrompt(
  input: BuildSpecTreePromptInput,
): PromptPayload {
  const { request, routeSet, primaryRoute, repoTreeDigest, keyFiles } = input;

  const routesSummary = routeSet.routes.map((route) => ({
    id: route.id,
    kind: route.kind,
    title: route.title,
    summary: route.summary,
  }));

  const primaryRouteView = {
    id: primaryRoute.id,
    title: primaryRoute.title,
    summary: primaryRoute.summary,
    rationale: primaryRoute.rationale,
    steps: primaryRoute.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      role: step.role,
    })),
  };

  const userPayload: Record<string, unknown> = {
    promptId: SPEC_TREE_PROMPT_ID,
    targetText: request.targetText,
    githubUrls: [...request.githubUrls],
    routeSet: {
      id: routeSet.id,
      routes: routesSummary,
    },
    primaryRoute: primaryRouteView,
  };

  if (typeof repoTreeDigest === "string" && repoTreeDigest.length > 0) {
    userPayload.repoTreeDigest = repoTreeDigest;
  }

  if (keyFiles && keyFiles.length > 0) {
    userPayload.keyFiles = keyFiles.map((file) => ({
      path: file.path,
      content: file.content,
    }));
  }

  userPayload.outputSchema = {
    rootTitle: "string, 1..200 chars",
    rootSummary: "string, 1..2000 chars",
    nodes:
      "array of 1..64 nodes, each: { id (1..64), parentId? (1..64), title (1..200), summary (1..2000), type (root|module|submodule|route_step|alternative_route), priority (int 0..100) }",
    constraints:
      "exactly one root node; non-root nodes must reference an existing parentId; node ids must be unique",
  };

  const userMessage = JSON.stringify(userPayload, null, 2);
  const promptFingerprint = computePromptFingerprint(
    SPEC_TREE_SYSTEM_MESSAGE,
    userMessage,
  );

  return {
    promptId: SPEC_TREE_PROMPT_ID,
    systemMessage: SPEC_TREE_SYSTEM_MESSAGE,
    userMessage,
    promptFingerprint,
  };
}

/**
 * 构造 `spec_docs` 阶段的 prompt payload。
 *
 * userPayload 字段顺序固定：
 *   `promptId / node / parentSummary? / siblingSummaries /
 *    primaryRouteSummary / relevantRepoExcerpts? / outputSchema`。
 *
 * - `siblingSummaries` 保留入参顺序；调用方负责过滤当前节点自身。
 * - `parentSummary` 与 `relevantRepoExcerpts` 仅在调用方提供时出现，
 *   保证两次相同输入的 fingerprint 一致。
 */
export function buildSpecDocsPrompt(
  input: BuildSpecDocsPromptInput,
): PromptPayload {
  const {
    node,
    parentSummary,
    siblingSummaries,
    primaryRouteSummary,
    relevantRepoExcerpts,
  } = input;

  const userPayload: Record<string, unknown> = {
    promptId: SPEC_DOCS_PROMPT_ID,
    node: {
      id: node.id,
      title: node.title,
      summary: node.summary,
      type: node.type,
      parentId: node.parentId,
    },
  };

  if (typeof parentSummary === "string" && parentSummary.length > 0) {
    userPayload.parentSummary = parentSummary;
  }

  userPayload.siblingSummaries = siblingSummaries.map((sibling) => ({
    id: sibling.id,
    title: sibling.title,
    summary: sibling.summary,
  }));

  userPayload.primaryRouteSummary = primaryRouteSummary;

  if (relevantRepoExcerpts && relevantRepoExcerpts.length > 0) {
    userPayload.relevantRepoExcerpts = relevantRepoExcerpts.map((excerpt) => ({
      path: excerpt.path,
      excerpt: excerpt.excerpt,
    }));
  }

  userPayload.outputSchema = {
    requirements: "string, 1..20000 chars, Markdown",
    design: "string, 1..20000 chars, Markdown",
    tasks: "string, 1..20000 chars, Markdown",
  };

  const userMessage = JSON.stringify(userPayload, null, 2);
  const promptFingerprint = computePromptFingerprint(
    SPEC_DOCS_SYSTEM_MESSAGE,
    userMessage,
  );

  return {
    promptId: SPEC_DOCS_PROMPT_ID,
    systemMessage: SPEC_DOCS_SYSTEM_MESSAGE,
    userMessage,
    promptFingerprint,
  };
}

// ---------------------------------------------------------------------------
// Task 1.5：LLM 响应解析器（永不抛错）
// ---------------------------------------------------------------------------

/**
 * `parseSpecTreeLlmResponse` / `parseSpecDocsLlmResponse` 的统一返回壳。
 *
 * - `ok: true`：schema 校验通过，`data` 为对应 zod 推导出的 TS 类型。
 * - `ok: false`：解析或校验失败，`reason` 为简短中英混合可读字符串。
 *
 * 解析器永不抛错；调用方按 `ok` 字段分支处理即可。
 */
export type ParseLlmResponseResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

/**
 * 把 `unknown` 输入归一为待校验的 JS 对象。
 *
 * - 字符串：包 `try/catch` 走 `JSON.parse`，失败返回固定 `"non-json response"`。
 * - 其它：直接透传给 `safeParse`，由 zod 进一步校验类型。
 *
 * 该函数本身不会抛错，所有异常都被吞掉并转成解析失败结果。
 */
function normalizeRawForParsing(
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (typeof raw === "string") {
    try {
      return { ok: true, value: JSON.parse(raw) as unknown };
    } catch {
      return { ok: false, reason: "non-json response" };
    }
  }
  return { ok: true, value: raw };
}

/**
 * 从 `safeParse` 失败结果中提取首个 issue 的 message，作为人类可读的
 * 失败原因。`issues` 为空时退回到 `"unknown schema validation error"`。
 */
function extractFirstIssueMessage(
  issues: ReadonlyArray<{ message: string }>,
): string {
  const firstIssue = issues[0];
  if (firstIssue && typeof firstIssue.message === "string" && firstIssue.message.length > 0) {
    return firstIssue.message;
  }
  return "unknown schema validation error";
}

/**
 * 解析 `spec_tree` 阶段的 LLM 响应。
 *
 * 行为约定：
 * 1. `raw` 为字符串时先 `JSON.parse`；解析失败返回 `{ ok: false, reason: "non-json response" }`。
 * 2. `raw` 为对象时直接送入 `SpecTreeLlmResponseSchema.safeParse`。
 * 3. schema 校验失败返回 `{ ok: false, reason: "schema validation failed: <issue.message>" }`，
 *    `issue.message` 取自 `result.error.issues[0]`。
 * 4. 校验通过返回 `{ ok: true, data }`。
 * 5. 函数体内任何意外异常都被吞掉并转成
 *    `{ ok: false, reason: "unexpected parse error: <error message>" }`，永不抛错。
 *
 * 不在此处校验“恰好一个 root”/“parentId 闭合”等关系约束，关系约束放在
 * `spec-tree-llm-derivation.ts` 的 tree 构造步骤。
 */
export function parseSpecTreeLlmResponse(
  raw: unknown,
): ParseLlmResponseResult<SpecTreeLlmResponse> {
  try {
    const normalized = normalizeRawForParsing(raw);
    if (!normalized.ok) {
      return { ok: false, reason: normalized.reason };
    }
    const result = SpecTreeLlmResponseSchema.safeParse(normalized.value);
    if (!result.success) {
      return {
        ok: false,
        reason: `schema validation failed: ${extractFirstIssueMessage(result.error.issues)}`,
      };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `unexpected parse error: ${message}` };
  }
}

/**
 * 解析 `spec_docs` 阶段的 LLM 响应。
 *
 * 行为与 `parseSpecTreeLlmResponse` 完全同构，仅 schema 不同：
 * 1. `raw` 为字符串时先 `JSON.parse`；解析失败返回 `{ ok: false, reason: "non-json response" }`。
 * 2. schema 校验失败返回 `{ ok: false, reason: "schema validation failed: <issue.message>" }`。
 * 3. 校验通过返回 `{ ok: true, data }`。
 * 4. 任何意外异常被吞掉并转成 `"unexpected parse error: <message>"`，永不抛错。
 */
export function parseSpecDocsLlmResponse(
  raw: unknown,
): ParseLlmResponseResult<SpecDocsLlmResponse> {
  try {
    const normalized = normalizeRawForParsing(raw);
    if (!normalized.ok) {
      return { ok: false, reason: normalized.reason };
    }
    const result = SpecDocsLlmResponseSchema.safeParse(normalized.value);
    if (!result.success) {
      return {
        ok: false,
        reason: `schema validation failed: ${extractFirstIssueMessage(result.error.issues)}`,
      };
    }
    return { ok: true, data: result.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `unexpected parse error: ${message}` };
  }
}
