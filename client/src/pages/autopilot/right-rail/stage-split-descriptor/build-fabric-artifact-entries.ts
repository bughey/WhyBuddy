import type {
  BlueprintGenerationArtifact,
  BlueprintGenerationJob,
} from "@shared/blueprint/contracts";

type FabricSub =
  | "agent_crew_fabric"
  | "spec_tree"
  | "effect_preview"
  | "prompt_package"
  | "runtime_capability"
  | "engineering_handoff"
  | "artifact_memory";

/**
 * Local-derived artifact entries for fabric sub-stages.
 *
 * Currently returns [] for all fabric subs. job.artifacts filtering happens
 * in deriveStageSplitDescriptor (task 4.4), not here — this avoids
 * double-counting the same job artifacts through both the builder and the
 * descriptor's whitelist filter.
 *
 * Future fabric subs that need locally-derived artifacts (not from
 * job.artifacts) can populate entries here without a signature change.
 */
export function buildFabricArtifactEntries(_args: {
  sub: FabricSub;
  job: BlueprintGenerationJob | null;
}): BlueprintGenerationArtifact[] {
  return [];
}
