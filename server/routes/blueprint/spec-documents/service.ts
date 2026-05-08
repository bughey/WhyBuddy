/**
 * 子域 6：SPEC Documents 的服务层壳（方案 B）。
 *
 * 当前只读：从 ctx.jobStore 拉出 spec_document / spec_document_version artifact。
 * `review = accepted` 推进到 `confirmed` 的逻辑由 `handoff-projection.ts` 自动派生，
 * 无需单独在 service 里重复写入。
 *
 * 对应需求 2.1 子域 6、3.2、4.1、4.4、7.3。
 */

import type {
  BlueprintGenerationJob,
  BlueprintSpecDocument,
  BlueprintSpecDocumentVersionSnapshot,
} from "../../../../shared/blueprint/index.js";

import type { BlueprintServiceContext } from "../context.js";

export interface SpecDocumentService {
  listDocuments(jobId: string): BlueprintSpecDocument[];
  listVersions(jobId: string): BlueprintSpecDocumentVersionSnapshot[];
}

function readArtifactPayloads<T>(
  job: BlueprintGenerationJob | null,
  types: string[]
): T[] {
  if (!job) return [];
  return job.artifacts
    .filter(artifact => types.includes(artifact.type))
    .map(artifact => artifact.payload as T)
    .filter((payload): payload is T => payload !== undefined && payload !== null);
}

export function createSpecDocumentService(
  ctx: BlueprintServiceContext
): SpecDocumentService {
  return {
    listDocuments(jobId) {
      const job = ctx.jobStore.get(jobId);
      return readArtifactPayloads<BlueprintSpecDocument>(job, [
        "requirements",
        "design",
        "tasks",
      ]);
    },
    listVersions(jobId) {
      const job = ctx.jobStore.get(jobId);
      return readArtifactPayloads<BlueprintSpecDocumentVersionSnapshot>(
        job,
        ["spec_document_version"]
      );
    },
  };
}
