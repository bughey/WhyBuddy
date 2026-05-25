/**
 * `deriveStageSplitDescriptor` — pure function that computes the
 * `StageSplitDescriptor` for any of the 11 sub-stages.
 *
 * This is the core logic behind `useStageSplitDescriptor` (which is a thin
 * `useMemo` wrapper). Keeping it as a standalone pure function enables:
 * - Direct unit / property-based testing without React rendering
 * - Flexible hook patterns (single top-level call per sub, or a single
 *   `useMemo` that iterates all subs) without Rules-of-Hooks violations
 *
 * Rules:
 * - NO `console.warn`, NO logging, NO side effects. Pure function.
 * - For preflight subs: calls `buildPreflightArtifactEntries` (which already
 *   calls `mergeLogicalArtifacts` internally) and
 *   `buildPreflightExecutionFallbackEntries`.
 * - For fabric subs: calls `buildFabricArtifactEntries` (local-derived only),
 *   filters `job.artifacts` by the `STAGE_ARTIFACT_TYPES` whitelist, merges
 *   via `mergeLogicalArtifacts`, and calls
 *   `buildFabricExecutionFallbackEntries` for fallback entries.
 *
 * 对应需求：1.1、1.2、1.4、1.5、2.3、3.2、4.5
 */

import type { AnyStageSub, StageSplitDescriptor, StageSplitDescriptorInput } from "./types";
import { STAGE_ARTIFACT_TYPES } from "./stage-artifact-types";
import { STAGE_FILTER_BY_SUB } from "./stage-filter-by-sub";
import { buildPreflightArtifactEntries } from "./build-preflight-artifact-entries";
import { buildPreflightExecutionFallbackEntries } from "./build-preflight-execution-fallback-entries";
import { buildFabricArtifactEntries } from "./build-fabric-artifact-entries";
import { buildFabricExecutionFallbackEntries } from "./build-fabric-execution-fallback-entries";
import { mergeLogicalArtifacts } from "./merge-logical-artifacts";
import type { AppLocale } from "@/lib/locale";

/**
 * Per-stage artifact lane title — distinguishes "intermediate collection
 * results" from "final deliverable artifacts" so users don't mistake early
 * stage outputs for completed products.
 */
const ARTIFACT_TITLE_BY_SUB: Record<AnyStageSub, Record<AppLocale, string>> = {
  // preflight — intermediate outputs
  target_input: { "zh-CN": "产物预备", "en-US": "Pending" },
  intake_created: { "zh-CN": "采集结果", "en-US": "Collection results" },
  clarification: { "zh-CN": "澄清产物", "en-US": "Clarification outputs" },
  route: { "zh-CN": "路线产物", "en-US": "Route outputs" },
  // fabric — stage-specific outputs
  agent_crew_fabric: { "zh-CN": "编组产物", "en-US": "Crew outputs" },
  spec_tree: { "zh-CN": "SPEC 产物", "en-US": "SPEC outputs" },
  effect_preview: { "zh-CN": "预演产物", "en-US": "Preview outputs" },
  prompt_package: { "zh-CN": "提示词产物", "en-US": "Prompt outputs" },
  runtime_capability: { "zh-CN": "能力产物", "en-US": "Capability outputs" },
  engineering_handoff: { "zh-CN": "工程产物", "en-US": "Engineering outputs" },
  artifact_memory: { "zh-CN": "记忆产物", "en-US": "Memory outputs" },
};

const PREFLIGHT_SUBS: ReadonlySet<AnyStageSub> = new Set([
  "target_input",
  "intake_created",
  "clarification",
  "route",
] as const);

type PreflightSub = "target_input" | "intake_created" | "clarification" | "route";

type FabricSub =
  | "agent_crew_fabric"
  | "spec_tree"
  | "effect_preview"
  | "prompt_package"
  | "runtime_capability"
  | "engineering_handoff"
  | "artifact_memory";

function isPreflightSub(sub: AnyStageSub): sub is PreflightSub {
  return PREFLIGHT_SUBS.has(sub);
}

export function deriveStageSplitDescriptor(
  input: StageSplitDescriptorInput,
): StageSplitDescriptor {
  const { sub } = input;

  if (isPreflightSub(sub)) {
    return derivePreflightDescriptor(input, sub);
  }

  // Fabric path
  return deriveFabricDescriptor(input, sub as FabricSub);
}

function derivePreflightDescriptor(
  input: StageSplitDescriptorInput,
  sub: PreflightSub,
): StageSplitDescriptor {
  const {
    locale,
    isActive,
    isCompleted,
    intake,
    projectContext,
    clarificationSession,
    readiness,
    routeSet,
    selection,
    specTree,
    job,
  } = input;

  // shouldMount: active always mounts, completed always mounts,
  // route always mounts (historical route cards stay visible)
  const shouldMount = isActive || isCompleted || sub === "route";

  // stageFilter from the mapping table
  const stageFilter = STAGE_FILTER_BY_SUB[sub];

  // buildPreflightArtifactEntries already calls mergeLogicalArtifacts
  // internally with local-first ordering
  const artifacts = buildPreflightArtifactEntries({
    sub,
    intake,
    projectContext,
    clarificationSession,
    routeSet,
    selection,
    specTree,
    job,
  });

  const fallbackExecutionEntries = buildPreflightExecutionFallbackEntries({
    sub,
    locale,
    intake,
    clarificationSession,
    readiness,
    routeSet,
    selection,
  });

  return {
    sub,
    artifactTypes: STAGE_ARTIFACT_TYPES[sub],
    stageFilter,
    artifacts,
    fallbackExecutionEntries,
    shouldMount,
    artifactTitle: ARTIFACT_TITLE_BY_SUB[sub][locale],
  };
}

function deriveFabricDescriptor(
  input: StageSplitDescriptorInput,
  sub: FabricSub,
): StageSplitDescriptor {
  const { isActive, isCompleted, locale, job } = input;
  const artifactTypes = STAGE_ARTIFACT_TYPES[sub];
  const shouldMount = isActive || isCompleted;

  // Local-derived artifacts (currently [] for all fabric subs)
  const local = buildFabricArtifactEntries({ sub, job });

  // Filter job.artifacts by whitelist — single read point (no double-counting)
  const allowedTypes = new Set(artifactTypes);
  const jobArtifacts = (job?.artifacts ?? []).filter(a => allowedTypes.has(a.type));

  // Merge: local first (caller-ordering contract), then job artifacts
  const artifacts = mergeLogicalArtifacts([...local, ...jobArtifacts]);

  // Fallback entries with stageId from STAGE_FILTER_BY_SUB
  // Only provide fallback when no artifacts are present — otherwise the panel
  // uses its built-in deriveArtifactFallbackExecutionEntries ("阶段已产出…")
  const fallbackExecutionEntries = artifacts.length === 0
    ? buildFabricExecutionFallbackEntries({ sub, locale, job })
    : [];

  // stageFilter from the mapping table
  const stageFilter = STAGE_FILTER_BY_SUB[sub];

  return {
    sub,
    artifactTypes,
    stageFilter,
    artifacts,
    fallbackExecutionEntries,
    shouldMount,
    artifactTitle: ARTIFACT_TITLE_BY_SUB[sub][locale],
  };
}
