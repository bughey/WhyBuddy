import { describe, expect, it } from "vitest";

import type {
  BlueprintGenerationArtifact,
  BlueprintGenerationJob,
  BlueprintSpecDocument,
  BlueprintSpecDocumentVersionSnapshot,
} from "../../../../shared/blueprint/index.js";
import { createMemoryBlueprintJobStore } from "../../blueprint.js";

import { buildBlueprintServiceContext } from "../context.js";
import { createSpecDocumentService } from "./service.js";

function makeJob(artifacts: BlueprintGenerationArtifact[]): BlueprintGenerationJob {
  return {
    id: "job-1",
    request: {},
    status: "pending",
    stage: "input",
    version: "v1",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt: "2026-05-07T00:00:00.000Z",
    artifacts,
    events: [],
  };
}

function artifact(
  id: string,
  type: BlueprintGenerationArtifact["type"],
  payload: unknown
): BlueprintGenerationArtifact {
  return {
    id,
    type,
    title: id,
    summary: "",
    createdAt: "2026-05-07T00:00:00.000Z",
    payload,
  };
}

describe("createSpecDocumentService (shell)", () => {
  it("listDocuments 取 requirements / design / tasks 三类 artifact", () => {
    const req = { id: "d-1", type: "requirements" } as unknown as BlueprintSpecDocument;
    const des = { id: "d-2", type: "design" } as unknown as BlueprintSpecDocument;
    const job = makeJob([
      artifact("a-1", "requirements", req),
      artifact("a-2", "design", des),
    ]);
    const jobStore = createMemoryBlueprintJobStore([job]);
    const ctx = buildBlueprintServiceContext({ jobStore });
    const service = createSpecDocumentService(ctx);
    expect(service.listDocuments("job-1").map(d => d.id)).toEqual([
      "d-1",
      "d-2",
    ]);
    expect(service.listDocuments("missing")).toEqual([]);
  });

  it("listVersions 只取 spec_document_version artifact", () => {
    const v = { id: "v-1" } as BlueprintSpecDocumentVersionSnapshot;
    const job = makeJob([artifact("a-1", "spec_document_version", v)]);
    const jobStore = createMemoryBlueprintJobStore([job]);
    const ctx = buildBlueprintServiceContext({ jobStore });
    const service = createSpecDocumentService(ctx);
    expect(service.listVersions("job-1").map(item => item.id)).toEqual(["v-1"]);
  });
});
