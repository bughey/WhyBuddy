import type { BlueprintGenerationArtifact } from "@shared/blueprint/contracts";

import { STAGE_ARTIFACT_TYPES } from "./stage-artifact-types";
import type { AnyStageSub } from "./types";

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown> | null,
  field: string
): string | null {
  const value = record?.[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRouteSandboxDerivation(
  artifact: BlueprintGenerationArtifact
): boolean {
  if (artifact.type !== "sandbox_derivation_job") {
    return false;
  }

  const payload = readRecord(artifact.payload);
  const provenance = readRecord(payload?.provenance);
  const hasRouteSet = readString(provenance, "routeSetId") !== null;
  const hasSpecTree = readString(provenance, "specTreeId") !== null;
  const hasNode = readString(provenance, "nodeId") !== null;

  return hasRouteSet && !hasSpecTree && !hasNode;
}

function artifactBelongsToSub(
  sub: AnyStageSub,
  artifact: BlueprintGenerationArtifact
): boolean {
  if (!STAGE_ARTIFACT_TYPES[sub].includes(artifact.type)) {
    return false;
  }

  if (artifact.type !== "sandbox_derivation_job") {
    return true;
  }

  if (sub === "route") {
    return isRouteSandboxDerivation(artifact);
  }

  if (sub === "runtime_capability") {
    return !isRouteSandboxDerivation(artifact);
  }

  return false;
}

export function filterArtifactsForStage(
  sub: AnyStageSub,
  artifacts: readonly BlueprintGenerationArtifact[]
): BlueprintGenerationArtifact[] {
  return artifacts.filter(artifact => artifactBelongsToSub(sub, artifact));
}
