import { describe, expect, it } from "vitest";

import type { BlueprintGenerationArtifact } from "@shared/blueprint/contracts";

import { filterArtifactsForStage } from "../filter-artifacts-for-stage";

function artifact(
  type: BlueprintGenerationArtifact["type"],
  payload: unknown = {},
  id = `artifact-${type}`
): BlueprintGenerationArtifact {
  return {
    id,
    type,
    title: type,
    summary: type,
    createdAt: "2026-05-29T00:00:00.000Z",
    payload,
  };
}

const routeSandbox = artifact(
  "sandbox_derivation_job",
  {
    provenance: {
      routeSetId: "RS-1",
      routeId: "R-1",
    },
  },
  "route-sandbox"
);

const runtimeSandbox = artifact(
  "sandbox_derivation_job",
  {
    provenance: {
      routeSetId: "RS-1",
      routeId: "R-1",
      specTreeId: "TREE-1",
      nodeId: "NODE-1",
    },
  },
  "runtime-sandbox"
);

describe("filterArtifactsForStage", () => {
  it("keeps sandbox derivation out of intake_created so later execution artifacts do not offset the collection lane", () => {
    const output = filterArtifactsForStage("intake_created", [
      artifact("intake"),
      artifact("github_source"),
      artifact("project_context"),
      routeSandbox,
      runtimeSandbox,
    ]);

    expect(output.map(entry => entry.type)).toEqual([
      "intake",
      "github_source",
      "project_context",
    ]);
  });

  it("routes route-generation sandbox derivation to route and runtime sandbox derivation to runtime_capability", () => {
    expect(
      filterArtifactsForStage("route", [routeSandbox, runtimeSandbox])
    ).toEqual([routeSandbox]);
    expect(
      filterArtifactsForStage("runtime_capability", [
        routeSandbox,
        runtimeSandbox,
      ])
    ).toEqual([runtimeSandbox]);
  });
});
