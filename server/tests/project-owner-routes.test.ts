import express, { type RequestHandler } from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import type { CurrentUser } from "../../shared/auth.js";
import type {
  ProjectRecord,
  ProjectResourceRecord,
  ProjectResourceType,
  ProjectStatus,
} from "../persistence/repositories.js";
import {
  createProjectsRouter,
  type ProjectResourcesRepository,
  type ProjectsRepository,
} from "../routes/projects.js";

const baseUser: CurrentUser = {
  id: "user-1",
  email: "user@example.com",
  role: "user",
  status: "active",
  emailVerified: true,
  createdAt: "2026-04-30T00:00:00.000Z",
};

function project(input: {
  id: string;
  ownerUserId: string;
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
}): ProjectRecord {
  const now = new Date("2026-04-30T00:00:00.000Z");
  return {
    id: input.id,
    ownerUserId: input.ownerUserId,
    name: input.name ?? "Project",
    description: input.description ?? null,
    status: input.status ?? "active",
    source: "user",
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  };
}

class MemoryProjectsRepository implements ProjectsRepository {
  projects = new Map<string, ProjectRecord>();
  nextId = 1;
  listForOwnerCalls: string[] = [];
  createInputs: Array<{ ownerUserId: string; name: string; description?: string | null }> = [];
  updateInputs: Array<{
    projectId: string;
    ownerUserId: string;
    patch: { name?: string; description?: string | null; status?: ProjectStatus };
  }> = [];

  async create(input: {
    ownerUserId: string;
    name: string;
    description?: string | null;
  }): Promise<ProjectRecord> {
    this.createInputs.push(input);
    const created = project({
      id: `project-${this.nextId++}`,
      ownerUserId: input.ownerUserId,
      name: input.name,
      description: input.description ?? null,
    });
    this.projects.set(created.id, created);
    return created;
  }

  async listForOwner(ownerUserId: string): Promise<ProjectRecord[]> {
    this.listForOwnerCalls.push(ownerUserId);
    return [...this.projects.values()].filter(
      item => item.ownerUserId === ownerUserId
    );
  }

  async findByIdForOwner(
    projectId: string,
    ownerUserId: string
  ): Promise<ProjectRecord | null> {
    const found = this.projects.get(projectId);
    return found?.ownerUserId === ownerUserId ? found : null;
  }

  async updateForOwner(
    projectId: string,
    ownerUserId: string,
    patch: { name?: string; description?: string | null; status?: ProjectStatus }
  ): Promise<ProjectRecord | null> {
    this.updateInputs.push({ projectId, ownerUserId, patch });
    const found = await this.findByIdForOwner(projectId, ownerUserId);
    if (!found) return null;
    const updated: ProjectRecord = {
      ...found,
      ...patch,
      updatedAt: new Date("2026-04-30T00:05:00.000Z"),
      archivedAt:
        patch.status === "archived"
          ? new Date("2026-04-30T00:05:00.000Z")
          : patch.status === "active"
            ? null
            : found.archivedAt,
    };
    this.projects.set(updated.id, updated);
    return updated;
  }

  async archiveForOwner(projectId: string, ownerUserId: string): Promise<void> {
    await this.updateForOwner(projectId, ownerUserId, { status: "archived" });
  }
}

class MemoryProjectResourcesRepository implements ProjectResourcesRepository {
  resources: ProjectResourceRecord[] = [];
  createInputs: Array<{
    projectId: string;
    resourceType: ProjectResourceType;
    payload: Record<string, unknown>;
  }> = [];
  nextId = 1;

  async listForProject(projectId: string): Promise<ProjectResourceRecord[]> {
    return this.resources.filter(resource => resource.projectId === projectId);
  }

  async create<TPayload extends Record<string, unknown>>(input: {
    projectId: string;
    resourceType: ProjectResourceType;
    payload: TPayload;
  }): Promise<ProjectResourceRecord<TPayload>> {
    this.createInputs.push(input);
    const now = new Date("2026-04-30T00:10:00.000Z");
    const resource: ProjectResourceRecord<TPayload> = {
      id: `resource-${this.nextId++}`,
      projectId: input.projectId,
      resourceType: input.resourceType,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };
    this.resources.push(resource);
    return resource;
  }
}

async function withProjectServer(
  repository: MemoryProjectsRepository,
  handler: (
    baseUrl: string,
    repository: MemoryProjectsRepository,
    resources: MemoryProjectResourcesRepository,
  ) => Promise<void>,
  user: CurrentUser = baseUser
) {
  const resources = new MemoryProjectResourcesRepository();
  const requireAuth: RequestHandler = (request, _response, next) => {
    (request as typeof request & { user: CurrentUser }).user = user;
    next();
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api/projects",
    createProjectsRouter({
      requireAuth,
      projects: repository,
      resources,
    })
  );

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) =>
      error ? reject(error) : resolve()
    );
  });

  const address = server.address() as AddressInfo;
  try {
    await handler(`http://127.0.0.1:${address.port}`, repository, resources);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
}

describe("project owner routes", () => {
  it("lists only projects owned by the current user", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set("project-1", project({ id: "project-1", ownerUserId: "user-1" }));
    repository.projects.set("project-2", project({ id: "project-2", ownerUserId: "user-2" }));

    await withProjectServer(repository, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/projects`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.projects).toHaveLength(1);
      expect(body.projects[0]).toMatchObject({
        id: "project-1",
        ownerUserId: "user-1",
      });
      expect(repository.listForOwnerCalls).toEqual(["user-1"]);
    });
  });

  it("creates projects with ownerUserId from the authenticated user only", async () => {
    const repository = new MemoryProjectsRepository();

    await withProjectServer(repository, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerUserId: "attacker",
          name: "Owned Project",
          description: "Private workspace",
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(repository.createInputs[0]).toMatchObject({
        ownerUserId: "user-1",
        name: "Owned Project",
        description: "Private workspace",
      });
      expect(body.project.ownerUserId).toBe("user-1");
    });
  });

  it("returns 404 for project details owned by someone else", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set("project-2", project({ id: "project-2", ownerUserId: "user-2" }));

    await withProjectServer(repository, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/projects/project-2`);

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toMatchObject({ success: false });
    });
  });

  it("updates projects through owner-scoped repository methods", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set("project-1", project({ id: "project-1", ownerUserId: "user-1" }));

    await withProjectServer(repository, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/projects/project-1`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ownerUserId: "attacker",
          name: "Renamed",
          description: "",
          status: "active",
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(repository.updateInputs[0]).toEqual({
        projectId: "project-1",
        ownerUserId: "user-1",
        patch: {
          name: "Renamed",
          description: null,
          status: "active",
        },
      });
      expect(body.project).toMatchObject({
        id: "project-1",
        name: "Renamed",
        ownerUserId: "user-1",
      });
    });
  });

  it("archives projects only after owner lookup succeeds", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set("project-1", project({ id: "project-1", ownerUserId: "user-1" }));

    await withProjectServer(repository, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/projects/project-1/archive`, {
        method: "POST",
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.project).toMatchObject({
        id: "project-1",
        status: "archived",
      });
    });
  });

  it("returns an owner-scoped project bundle with typed resources", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set(
      "project-1",
      project({ id: "project-1", ownerUserId: "user-1" }),
    );

    await withProjectServer(repository, async (baseUrl, _repository, resources) => {
      resources.resources.push(
        {
          id: "message-1",
          projectId: "project-1",
          resourceType: "message",
          payload: { content: "Hello", role: "user", projectId: "ignored" },
          createdAt: new Date("2026-04-30T00:00:00.000Z"),
          updatedAt: new Date("2026-04-30T00:00:00.000Z"),
        },
        {
          id: "spec-1",
          projectId: "project-1",
          resourceType: "spec",
          payload: { title: "Spec", content: "Do it" },
          createdAt: new Date("2026-04-30T00:01:00.000Z"),
          updatedAt: new Date("2026-04-30T00:01:00.000Z"),
        },
      );

      const response = await fetch(`${baseUrl}/api/projects/project-1/bundle`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.bundle.project).toMatchObject({
        id: "project-1",
        ownerUserId: "user-1",
      });
      expect(body.bundle.messages).toHaveLength(1);
      expect(body.bundle.messages[0]).toMatchObject({
        id: "message-1",
        projectId: "project-1",
        content: "Hello",
      });
      expect(body.bundle.specs[0]).toMatchObject({
        id: "spec-1",
        projectId: "project-1",
        title: "Spec",
      });
    });
  });

  it("returns 404 for non-owned project bundles", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set(
      "project-2",
      project({ id: "project-2", ownerUserId: "user-2" }),
    );

    await withProjectServer(repository, async baseUrl => {
      const response = await fetch(`${baseUrl}/api/projects/project-2/bundle`);

      expect(response.status).toBe(404);
    });
  });

  it("writes messages under the route project and current owner boundary", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set(
      "project-1",
      project({ id: "project-1", ownerUserId: "user-1" }),
    );

    await withProjectServer(repository, async (baseUrl, _repository, resources) => {
      const response = await fetch(`${baseUrl}/api/projects/project-1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId: "project-2",
          ownerUserId: "attacker",
          role: "assistant",
          kind: "status",
          content: "Project update",
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(resources.createInputs[0]).toMatchObject({
        projectId: "project-1",
        resourceType: "message",
      });
      expect(resources.createInputs[0].payload).toMatchObject({
        projectId: "project-1",
        role: "assistant",
        kind: "status",
        content: "Project update",
      });
      expect(body.item.projectId).toBe("project-1");
    });
  });

  it("does not write resources for non-owned projects", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set(
      "project-2",
      project({ id: "project-2", ownerUserId: "user-2" }),
    );

    await withProjectServer(repository, async (baseUrl, _repository, resources) => {
      const response = await fetch(`${baseUrl}/api/projects/project-2/specs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Spec", content: "Nope" }),
      });

      expect(response.status).toBe(404);
      expect(resources.createInputs).toEqual([]);
    });
  });

  it("supports owner-guarded writes for project specs routes missions artifacts and evidence", async () => {
    const repository = new MemoryProjectsRepository();
    repository.projects.set(
      "project-1",
      project({ id: "project-1", ownerUserId: "user-1" }),
    );

    await withProjectServer(repository, async (baseUrl, _repository, resources) => {
      const requests = [
        fetch(`${baseUrl}/api/projects/project-1/specs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Spec", content: "Requirements" }),
        }),
        fetch(`${baseUrl}/api/projects/project-1/routes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Route", summary: "Plan" }),
        }),
        fetch(`${baseUrl}/api/projects/project-1/missions/link`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ missionId: "mission-1", status: "running" }),
        }),
        fetch(`${baseUrl}/api/projects/project-1/artifacts`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Report", type: "report" }),
        }),
        fetch(`${baseUrl}/api/projects/project-1/evidence`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Log", detail: "Finished" }),
        }),
      ];

      const responses = await Promise.all(requests);

      expect(responses.map(response => response.status)).toEqual([
        201,
        201,
        201,
        201,
        201,
      ]);
      expect(resources.createInputs.map(input => input.resourceType)).toEqual([
        "spec",
        "route",
        "mission",
        "artifact",
        "evidence",
      ]);
      expect(
        resources.createInputs.every(input => input.projectId === "project-1"),
      ).toBe(true);
    });
  });
});
