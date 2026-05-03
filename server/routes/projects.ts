import express, { type RequestHandler } from "express";

import type { AuthenticatedRequest } from "../auth/types.js";
import type {
  ProjectRecord,
  ProjectResourceRecord,
  ProjectResourceType,
  ProjectStatus,
} from "../persistence/repositories.js";

export interface ProjectsRepository {
  create(input: {
    ownerUserId: string;
    name: string;
    description?: string | null;
  }): Promise<ProjectRecord>;
  listForOwner(ownerUserId: string): Promise<ProjectRecord[]>;
  findByIdForOwner(
    projectId: string,
    ownerUserId: string
  ): Promise<ProjectRecord | null>;
  updateForOwner(
    projectId: string,
    ownerUserId: string,
    patch: {
      name?: string;
      description?: string | null;
      status?: ProjectStatus;
    }
  ): Promise<ProjectRecord | null>;
  archiveForOwner(projectId: string, ownerUserId: string): Promise<void>;
}

export interface ProjectResourcesRepository {
  listForProject(projectId: string): Promise<ProjectResourceRecord[]>;
  create<TPayload extends Record<string, unknown>>(input: {
    projectId: string;
    resourceType: ProjectResourceType;
    payload: TPayload;
  }): Promise<ProjectResourceRecord<TPayload>>;
}

export interface ProjectsRouterDeps {
  requireAuth: RequestHandler;
  projects: ProjectsRepository;
  resources?: ProjectResourcesRepository;
}

interface ProjectResourcePayload extends Record<string, unknown> {
  id: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ProjectBundleResponse {
  project: ProjectRecord;
  messages: ProjectResourcePayload[];
  clarificationQuestions: ProjectResourcePayload[];
  specs: ProjectResourcePayload[];
  routes: ProjectResourcePayload[];
  missions: ProjectResourcePayload[];
  artifacts: ProjectResourcePayload[];
  evidence: ProjectResourcePayload[];
}

function getUserId(request: express.Request): string {
  return (request as AuthenticatedRequest).user.id;
}

function jsonError(error: string) {
  return { success: false, error };
}

function parseName(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 255)
    : null;
}

function parseDescription(value: unknown): string | null | undefined {
  if (value == null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseStatus(value: unknown): ProjectStatus | undefined {
  return value === "active" || value === "archived" ? value : undefined;
}

function parseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function parseRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function parsePatch(body: unknown): {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
} | null {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const patch: {
    name?: string;
    description?: string | null;
    status?: ProjectStatus;
  } = {};

  if ("name" in record) {
    const name = parseName(record.name);
    if (!name) return null;
    patch.name = name;
  }

  if ("description" in record) {
    patch.description = parseDescription(record.description);
  }

  if ("status" in record) {
    const status = parseStatus(record.status);
    if (!status) return null;
    patch.status = status;
  }

  return patch;
}

async function findOwnedProject(
  deps: ProjectsRouterDeps,
  projectId: string,
  ownerUserId: string,
): Promise<ProjectRecord | null> {
  return deps.projects.findByIdForOwner(projectId, ownerUserId);
}

function requireProjectResources(
  deps: ProjectsRouterDeps,
  response: express.Response,
): ProjectResourcesRepository | null {
  if (deps.resources) return deps.resources;
  response
    .status(501)
    .json(jsonError("Project resources are not configured."));
  return null;
}

function projectResourcePayload(
  record: ProjectResourceRecord,
): ProjectResourcePayload {
  return {
    ...record.payload,
    id: record.id,
    projectId: record.projectId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function emptyBundle(project: ProjectRecord): ProjectBundleResponse {
  return {
    project,
    messages: [],
    clarificationQuestions: [],
    specs: [],
    routes: [],
    missions: [],
    artifacts: [],
    evidence: [],
  };
}

function buildBundle(project: ProjectRecord, resources: ProjectResourceRecord[]) {
  const bundle = emptyBundle(project);

  for (const resource of resources) {
    const payload = projectResourcePayload(resource);
    switch (resource.resourceType) {
      case "message":
        bundle.messages.push(payload);
        break;
      case "clarification_question":
        bundle.clarificationQuestions.push(payload);
        break;
      case "spec":
        bundle.specs.push(payload);
        break;
      case "route":
        bundle.routes.push(payload);
        break;
      case "mission":
        bundle.missions.push(payload);
        break;
      case "artifact":
        bundle.artifacts.push(payload);
        break;
      case "evidence":
        bundle.evidence.push(payload);
        break;
    }
  }

  return bundle;
}

function normalizeResourcePayload(
  resourceType: ProjectResourceType,
  projectId: string,
  body: unknown,
): Record<string, unknown> | null {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const now = new Date().toISOString();
  const base = {
    projectId,
    createdAt: parseString(record.createdAt) ?? now,
  };

  switch (resourceType) {
    case "message": {
      const role = parseString(record.role) ?? "user";
      const content = parseString(record.content);
      if (!content) return null;
      return {
        ...base,
        role,
        kind: parseString(record.kind) ?? "chat",
        content,
        sourceMissionId: parseString(record.sourceMissionId),
      };
    }
    case "clarification_question": {
      const text = parseString(record.text);
      if (!text) return null;
      return {
        ...base,
        text,
        reason: parseString(record.reason) ?? "",
        scope: parseString(record.scope) ?? "goal",
        answerType: parseString(record.answerType) ?? "text",
        options: parseStringArray(record.options),
        required: record.required === true,
        defaultAssumption: parseString(record.defaultAssumption),
        sourceCommandId: parseString(record.sourceCommandId),
        sourceQuestionId: parseString(record.sourceQuestionId),
        sourceMessageId: parseString(record.sourceMessageId),
      };
    }
    case "spec": {
      const title = parseString(record.title);
      const content = parseString(record.content);
      if (!title || !content) return null;
      return {
        ...base,
        title,
        content,
        version:
          typeof record.version === "number" && Number.isFinite(record.version)
            ? record.version
            : 1,
        status: parseString(record.status) ?? "draft",
        sourceMessageIds: parseStringArray(record.sourceMessageIds),
        sourceEvidenceIds: parseStringArray(record.sourceEvidenceIds),
        sourceArtifactIds: parseStringArray(record.sourceArtifactIds),
        completeness:
          typeof record.completeness === "number" ? record.completeness : undefined,
        supersedesSpecId: parseString(record.supersedesSpecId),
        diffSummary: parseString(record.diffSummary),
      };
    }
    case "route": {
      const title = parseString(record.title);
      const summary = parseString(record.summary);
      if (!title || !summary) return null;
      return {
        ...base,
        specId: parseString(record.specId),
        kind: parseString(record.kind) ?? "custom",
        title,
        summary,
        steps: parseRecordArray(record.steps),
        riskLevel: parseString(record.riskLevel) ?? "medium",
        estimate: parseString(record.estimate),
        selectedAt: parseString(record.selectedAt),
      };
    }
    case "mission": {
      const missionId = parseString(record.missionId);
      if (!missionId) return null;
      return {
        ...base,
        missionId,
        specId: parseString(record.specId),
        routeId: parseString(record.routeId),
        status: parseString(record.status) ?? "queued",
        updatedAt: parseString(record.updatedAt) ?? now,
      };
    }
    case "artifact": {
      const title = parseString(record.title);
      if (!title) return null;
      return {
        ...base,
        type: parseString(record.type) ?? "other",
        title,
        path: parseString(record.path),
        contentPreview: parseString(record.contentPreview),
        sourceMissionId: parseString(record.sourceMissionId),
        sourceSpecId: parseString(record.sourceSpecId),
      };
    }
    case "evidence": {
      const title = parseString(record.title);
      const detail = parseString(record.detail);
      if (!title || !detail) return null;
      return {
        ...base,
        type: parseString(record.type) ?? "source",
        title,
        detail,
        sourceMissionId: parseString(record.sourceMissionId),
        sourceSpecId: parseString(record.sourceSpecId),
        sourceRouteId: parseString(record.sourceRouteId),
      };
    }
  }
}

async function createOwnedResource(
  deps: ProjectsRouterDeps,
  request: express.Request,
  response: express.Response,
  resourceType: ProjectResourceType,
) {
  const resources = requireProjectResources(deps, response);
  if (!resources) return;

  const projectId = request.params.projectId;
  const project = await findOwnedProject(deps, projectId, getUserId(request));
  if (!project) {
    response.status(404).json(jsonError("Project not found."));
    return;
  }

  const payload = normalizeResourcePayload(resourceType, project.id, request.body);
  if (!payload) {
    response.status(400).json(jsonError("Invalid project resource."));
    return;
  }

  const resource = await resources.create({
    projectId: project.id,
    resourceType,
    payload,
  });
  response.status(201).json({
    success: true,
    item: projectResourcePayload(resource),
  });
}

export function createProjectsRouter(deps: ProjectsRouterDeps) {
  const router = express.Router();

  router.use(deps.requireAuth);

  router.get("/", async (request, response) => {
    const projects = await deps.projects.listForOwner(getUserId(request));
    response.json({ success: true, projects });
  });

  router.post("/", async (request, response) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const name = parseName(body.name);
    if (!name) {
      response.status(400).json(jsonError("Project name is required."));
      return;
    }

    const project = await deps.projects.create({
      ownerUserId: getUserId(request),
      name,
      description: parseDescription(body.description) ?? null,
    });
    response.status(201).json({ success: true, project });
  });

  router.get("/:projectId", async (request, response) => {
    const project = await deps.projects.findByIdForOwner(
      request.params.projectId,
      getUserId(request)
    );
    if (!project) {
      response.status(404).json(jsonError("Project not found."));
      return;
    }

    response.json({ success: true, project });
  });

  router.get("/:projectId/bundle", async (request, response) => {
    const resources = requireProjectResources(deps, response);
    if (!resources) return;

    const project = await findOwnedProject(
      deps,
      request.params.projectId,
      getUserId(request),
    );
    if (!project) {
      response.status(404).json(jsonError("Project not found."));
      return;
    }

    const items = await resources.listForProject(project.id);
    response.json({ success: true, bundle: buildBundle(project, items) });
  });

  router.patch("/:projectId", async (request, response) => {
    const patch = parsePatch(request.body);
    if (!patch) {
      response.status(400).json(jsonError("Invalid project update."));
      return;
    }

    const project = await deps.projects.updateForOwner(
      request.params.projectId,
      getUserId(request),
      patch
    );
    if (!project) {
      response.status(404).json(jsonError("Project not found."));
      return;
    }

    response.json({ success: true, project });
  });

  router.post("/:projectId/archive", async (request, response) => {
    const userId = getUserId(request);
    const existing = await deps.projects.findByIdForOwner(
      request.params.projectId,
      userId
    );
    if (!existing) {
      response.status(404).json(jsonError("Project not found."));
      return;
    }

    await deps.projects.archiveForOwner(request.params.projectId, userId);
    const project =
      (await deps.projects.findByIdForOwner(request.params.projectId, userId)) ??
      { ...existing, status: "archived" as ProjectStatus };
    response.json({ success: true, project });
  });

  router.post("/:projectId/messages", async (request, response) => {
    await createOwnedResource(deps, request, response, "message");
  });

  router.post("/:projectId/clarification-questions", async (request, response) => {
    await createOwnedResource(
      deps,
      request,
      response,
      "clarification_question",
    );
  });

  router.post("/:projectId/specs", async (request, response) => {
    await createOwnedResource(deps, request, response, "spec");
  });

  router.post("/:projectId/routes", async (request, response) => {
    await createOwnedResource(deps, request, response, "route");
  });

  router.post("/:projectId/missions/link", async (request, response) => {
    await createOwnedResource(deps, request, response, "mission");
  });

  router.post("/:projectId/artifacts", async (request, response) => {
    await createOwnedResource(deps, request, response, "artifact");
  });

  router.post("/:projectId/evidence", async (request, response) => {
    await createOwnedResource(deps, request, response, "evidence");
  });

  return router;
}
