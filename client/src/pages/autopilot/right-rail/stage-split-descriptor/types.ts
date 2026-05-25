/**
 * Stage Split Descriptor — shared type contracts.
 *
 * 这个模块是 `.kiro/specs/spec-first-stage-process-artifact-split-uniform/`
 * 实施的第一块基石：所有 11 个 sub-stage（4 个 preflight + 7 个 fabric）通过
 * 同一份 `StageSplitDescriptor` 描述「执行流 / 产物流」双栏所需的全部参数，
 * 由唯一渲染入口 `<StageSplitMount>` 装配 `<ProcessArtifactSplitPanel>`。
 *
 * 严格契约：
 * - 本文件**仅含类型**，不导出任何运行时值（无函数、无常量、无枚举）。
 * - 任何派生表（如 `STAGE_ARTIFACT_TYPES`、`STAGE_FILTER_BY_SUB`）由后续
 *   实现任务按设计文档落地到独立模块；本文件不重复声明运行时数据。
 * - `right-rail/` 子树不允许从 `AutopilotRoutePage.tsx` 反向 import，因此
 *   `ProcessArtifactFallbackExecutionEntry` 必须从同级
 *   `../ProcessArtifactSplitPanel` 中 re-export，而不是从 page 文件。
 *
 * 版本基线（latest source of truth）：
 * - 11 sub-stages：`target_input | intake_created | clarification | route`
 *   (preflight 4) + `agent_crew_fabric | spec_tree | effect_preview |
 *   prompt_package | runtime_capability | engineering_handoff |
 *   artifact_memory` (fabric 7)。如设计文档早期 8-stage 版本与本契约冲突，
 *   以本文件为准。
 *
 * 对应需求：1.2、1.4
 */

import type { AppLocale } from "@/lib/locale";
import type {
  BlueprintClarificationReadiness,
  BlueprintClarificationSession,
  BlueprintGenerationArtifact,
  BlueprintGenerationArtifactType,
  BlueprintGenerationJob,
  BlueprintIntake,
  BlueprintProjectDomainContext,
  BlueprintRouteSelection,
  BlueprintRouteSet,
  BlueprintSpecTree,
} from "@shared/blueprint/contracts";

import type { ProcessArtifactFallbackExecutionEntry } from "../ProcessArtifactSplitPanel";

/**
 * 11 个 sub-stage 的全集：4 个 preflight + 7 个 fabric。
 *
 * Preflight（4）：
 * - `target_input`：用户输入活跃前；尚无 `intake`，主要展示输入表单 + 占位双栏。
 * - `intake_created`：输入已记录；产物白名单包含 intake / github_source /
 *   project_context / sandbox_derivation_job。
 * - `clarification`：澄清；产物白名单只有 clarification_session。
 * - `route`：路线生成 / 选择 / spec_tree 派生；产物白名单 route_set /
 *   route_selection / spec_tree。
 *
 * Fabric（7）—— 取自 `right-rail/types.ts` 的 `AutopilotRailSubStage`：
 * - `agent_crew_fabric`、`spec_tree`、`effect_preview`、`prompt_package`、
 *   `runtime_capability`、`engineering_handoff`、`artifact_memory`。
 *
 * 注意：`spec_tree` 同时在 preflight 的 `route` 后段产物白名单和 fabric 子
 * 阶段集合里出现，这是预期行为；前者是右栏 artifact 类型字面量，后者是 sub
 * 标识，二者作用域不同。
 */
export type AnyStageSub =
  | "target_input"
  | "intake_created"
  | "clarification"
  | "route"
  | "agent_crew_fabric"
  | "spec_tree"
  | "effect_preview"
  | "prompt_package"
  | "runtime_capability"
  | "engineering_handoff"
  | "artifact_memory";

/**
 * 逻辑产物去重的稳定键。
 *
 * 定义为 `string` 而非 branded type，与设计文档 Algorithmic Pseudocode 中
 * `string` 字面用法保持一致。**禁止使用空字符串**：`computeLogicalArtifactKey`
 * 的实现必须为任何输入返回非空键（包括缺失 id 的 artifact，需返回非空占位
 * 键以保证不会与其它 artifact 合并）。
 *
 * 推荐键格式（由实现侧的 `computeLogicalArtifactKey` 落地）：
 * - `clar:${sessionId}` / `route_set:${routeSetId}` / `spec_tree:${treeId}` 等；
 * - `id:${artifact.id}` 作为未识别 type 的退化键。
 */
export type LogicalArtifactKey = string;

/**
 * `useStageSplitDescriptor` / `deriveStageSplitDescriptor` 的纯函数输入。
 *
 * 字段分组：
 * - 路由控制：`sub`、`isActive`、`isCompleted`、`locale`；
 * - preflight 真相源：`intake / projectContext / clarificationSession /
 *   readiness / routeSet / selection / specTree`；
 * - fabric 真相源：`job`（即 `latestJob`，承载 `BlueprintGenerationArtifact[]`）。
 *
 * 所有真相源字段允许为 `null` / `undefined`，由实现侧用 nullish 守卫处理；
 * 不要求调用方为某个 sub 提前裁剪不相关字段。
 */
export interface StageSplitDescriptorInput {
  sub: AnyStageSub;
  locale: AppLocale;
  isActive: boolean;
  isCompleted: boolean;
  // preflight 真相源
  intake: BlueprintIntake | null;
  projectContext: BlueprintProjectDomainContext | null;
  clarificationSession: BlueprintClarificationSession | null;
  readiness: BlueprintClarificationReadiness | undefined;
  routeSet: BlueprintRouteSet | null;
  selection: BlueprintRouteSelection | null;
  specTree: BlueprintSpecTree | null;
  // fabric 真相源
  job: BlueprintGenerationJob | null;
}

/**
 * `useStageSplitDescriptor` 输出，供 `<StageSplitMount>` 透传给
 * `<ProcessArtifactSplitPanel>`。
 *
 * 字段语义：
 * - `sub`：原样回传输入的 sub，便于 mount 计算 `data-testid`；
 * - `artifactTypes`：该 sub 在右栏允许的 `BlueprintGenerationArtifactType`
 *   白名单（来自后续 `STAGE_ARTIFACT_TYPES` 表）；
 * - `stageFilter`：左栏 reasoning 流的 stageId 过滤（单 sub 多为字符串，
 *   `route` 等聚合 sub 为字符串数组；fabric 的 `prompt_package` 因服务端
 *   stageId 与 sub 名不一致，需走 `STAGE_FILTER_BY_SUB` 表落地）；
 * - `artifacts`：本地合成 + 后端 `job.artifacts`（按 `artifactTypes` 过滤后）
 *   经 `mergeLogicalArtifacts` 去重的最终右栏数据；调用方不再二次过滤；
 * - `fallbackExecutionEntries`：reasoning 为空时左栏使用的 fallback 文案；
 * - `shouldMount`：是否应渲染双栏（active 必挂；completed 与历史 route 卡片
 *   同样挂载；其它情况按设计规则）。
 */
export interface StageSplitDescriptor {
  sub: AnyStageSub;
  artifactTypes: readonly BlueprintGenerationArtifactType[];
  stageFilter: string | readonly string[];
  artifacts: readonly BlueprintGenerationArtifact[];
  fallbackExecutionEntries: readonly ProcessArtifactFallbackExecutionEntry[];
  shouldMount: boolean;
  /** Per-stage title for the execution lane (left). When omitted, panel uses its locale default. */
  executionTitle?: string;
  /** Per-stage title for the artifact lane (right). When omitted, panel uses its locale default. */
  artifactTitle?: string;
}
