/**
 * `buildPreflightArtifactEntries` — preflight 三段 sub-stage 的产物装配函数。
 *
 * 这是 `.kiro/specs/spec-first-stage-process-artifact-split-uniform/` 任务 1.2a
 * 物理迁移 + 任务 1.3 内联 `mergeLogicalArtifacts` 的最小落地版本。
 * `useStageSplitDescriptor` 与测试
 * (`build-preflight-artifact-entries.clarification-dedup.test.ts`) 都从这里
 * 独立消费；继续内联在 `AutopilotRoutePage.tsx` 中会阻塞用户可见的 fix
 * （澄清重复卡片）。
 *
 * 行为契约：
 * - **本地优先 + logical-key 维度去重**：函数末尾通过
 *   `mergeLogicalArtifacts([...localArtifacts, ...jobArtifacts])` 进行
 *   逻辑产物去重。**参数顺序绑定**：`localArtifacts` 必须在前、
 *   `jobArtifacts` 在后，使得本地 representative 在 payload 键冲突时
 *   获胜（详见 `merge-logical-artifacts.ts` 中的 caller-ordering contract）。
 * - **literal-id 过滤先于 logical-key 合并**：`seenIds` 过滤会先剔除
 *   `artifact.id` 字面重复的后端 entries，再交给 `mergeLogicalArtifacts`
 *   做跨 id 同 `logicalKey` 的合并。这是 Batch 1 的最小化改动 —— 它解决
 *   了 cross-id 同 sessionId 的澄清双卡片问题（用户报告的真实 bug）。
 *   Batch 3.1 会进一步把 literal-id 去重也下沉到 `mergeLogicalArtifacts`
 *   内部，使后端的 stale 字段能合并到与之共享 id 的本地 representative；
 *   届时此处 `seenIds` 过滤即可移除。
 * - 本模块**不**从 `AutopilotRoutePage.tsx` import 任何符号。
 * - `PREFLIGHT_ARTIFACT_TYPES` 与函数耦合（用于过滤后端 `job.artifacts`），
 *   随同 colocate 在这里；下方有 TODO 指向任务 3.4 —— 那时这个常量会被
 *   移除并替换为更宽泛的 `STAGE_ARTIFACT_TYPES`。
 *
 * 对应需求：1.3、2.3、3.1、3.3、4.5
 */

import type {
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

import type { PreflightExecutionFallbackSub } from "./build-preflight-execution-fallback-entries";
import { mergeLogicalArtifacts } from "./merge-logical-artifacts";

/**
 * preflight 三段 sub-stage 的产物白名单。
 *
 * TODO(spec-first-stage-process-artifact-split-uniform 任务 3.4): 该常量将
 * 由独立模块 `stage-artifact-types.ts` 中的 `STAGE_ARTIFACT_TYPES` 取代，
 * 覆盖 11 个 sub-stage（4 个 preflight + 7 个 fabric）。本任务（1.2a）只做
 * 物理迁移，不调整白名单内容或形状。
 */
export const PREFLIGHT_ARTIFACT_TYPES: Record<
  PreflightExecutionFallbackSub,
  readonly BlueprintGenerationArtifactType[]
> = {
  target_input: [],
  intake_created: [
    "intake",
    "github_source",
    "project_context",
    "sandbox_derivation_job",
  ],
  clarification: ["clarification_session"],
  route: ["route_set", "route_selection", "spec_tree"],
};

export function buildPreflightArtifactEntries({
  sub,
  intake,
  projectContext,
  clarificationSession,
  routeSet,
  selection,
  specTree,
  job,
}: {
  sub: PreflightExecutionFallbackSub;
  intake: BlueprintIntake | null;
  projectContext: BlueprintProjectDomainContext | null;
  clarificationSession: BlueprintClarificationSession | null;
  routeSet: BlueprintRouteSet | null;
  selection: BlueprintRouteSelection | null;
  specTree: BlueprintSpecTree | null;
  job?: BlueprintGenerationJob | null;
}): BlueprintGenerationArtifact[] {
  const localArtifacts: BlueprintGenerationArtifact[] = [];

  if (sub === "intake_created" && intake) {
    localArtifacts.push({
      id: `intake-${intake.id}`,
      type: "intake",
      title: "蓝图输入",
      summary: `输入记录 ${intake.id}`,
      createdAt: intake.createdAt,
      payload: {
        intakeId: intake.id,
        sourceCount: intake.sources.length,
        evidenceCount: intake.evidence.length,
        assetCount: intake.assets.length,
      },
    });

    intake.sources.forEach((source) => {
      localArtifacts.push({
        id: `github-source-${source.id}`,
        type: "github_source",
        title: `GitHub 仓库源: ${source.slug}`,
        summary: source.normalizedUrl,
        createdAt: intake.updatedAt ?? intake.createdAt,
        payload: source,
      });
    });

    if (projectContext || intake.assets.length > 0 || intake.evidence.length > 0) {
      localArtifacts.push({
        id: `project-context-${projectContext?.projectId ?? intake.id}`,
        type: "project_context",
        title: "项目领域上下文",
        summary: `资产 ${projectContext?.assets.length ?? intake.assets.length} 个，证据 ${projectContext?.evidence.length ?? intake.evidence.length} 条`,
        createdAt: projectContext?.updatedAt ?? intake.updatedAt ?? intake.createdAt,
        payload: projectContext ?? {
          assets: intake.assets,
          evidence: intake.evidence,
          intakeId: intake.id,
        },
      });
    }
  }

  if (sub === "clarification" && clarificationSession) {
    localArtifacts.push({
      id: `clarification-session-${clarificationSession.id}`,
      type: "clarification_session",
      title: "澄清会话",
      summary: `问题 ${clarificationSession.questions.length} 个，答案 ${clarificationSession.answers.length} 个`,
      createdAt: clarificationSession.createdAt,
      payload: clarificationSession,
    });
  }

  if (sub === "route" && routeSet) {
    localArtifacts.push({
      id: `route-set-${routeSet.id}`,
      type: "route_set",
      title: "自动驾驶 RouteSet",
      summary: `候选路线 ${routeSet.routes.length} 条`,
      createdAt: routeSet.createdAt,
      payload: routeSet,
    });

    if (selection) {
      localArtifacts.push({
        id: `route-selection-${selection.id}`,
        type: "route_selection",
        title: `路线选择: ${selection.routeTitle}`,
        summary: selection.reason ?? selection.routeId,
        createdAt: selection.selectedAt,
        payload: selection,
      });
    }

    if (specTree) {
      localArtifacts.push({
        id: `spec-tree-${specTree.id}`,
        type: "spec_tree",
        title: "SPEC 资产树",
        summary: `节点 ${specTree.nodes.length} 个`,
        createdAt: specTree.createdAt,
        payload: specTree,
      });
    }
  }

  const seenIds = new Set(localArtifacts.map((artifact) => artifact.id));
  const allowedTypes = new Set(PREFLIGHT_ARTIFACT_TYPES[sub]);
  const jobArtifacts =
    job?.artifacts.filter(
      (artifact) => allowedTypes.has(artifact.type) && !seenIds.has(artifact.id)
    ) ?? [];
  return mergeLogicalArtifacts([...localArtifacts, ...jobArtifacts]);
}
