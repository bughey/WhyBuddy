import type { BlueprintGenerationArtifactType } from "@shared/blueprint/contracts";
import type { AnyStageSub } from "./types";

/**
 * Per-sub-stage artifact-type whitelist.
 *
 * `deriveStageSplitDescriptor` uses this table to filter `job.artifacts`
 * before passing them to `mergeLogicalArtifacts`. Only artifacts whose
 * `type` is in `STAGE_ARTIFACT_TYPES[sub]` reach the right-lane rendering.
 *
 * All values are final (preflight + fabric).
 */
export const STAGE_ARTIFACT_TYPES: Record<
  AnyStageSub,
  readonly BlueprintGenerationArtifactType[]
> = {
  // preflight (final)
  target_input: [],
  intake_created: ["intake", "github_source", "project_context", "sandbox_derivation_job"],
  clarification: ["clarification_session"],
  route: ["route_set", "route_selection", "spec_tree"],

  // fabric (final — verified against BlueprintGenerationArtifactType union
  // in shared/blueprint/contracts.ts and server dependency-graph.ts)
  agent_crew_fabric: ["agent_crew", "role_timeline"],
  spec_tree: ["spec_tree", "spec_tree_version", "spec_document_version", "requirements", "design", "tasks"],
  effect_preview: ["preview", "effect_preview"],
  prompt_package: ["prompt_pack"],
  runtime_capability: ["capability_registry", "capability_invocation", "capability_evidence"],
  engineering_handoff: ["engineering_plan", "engineering_run"],
  artifact_memory: ["replay", "feedback"],
};
