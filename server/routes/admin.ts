import express, { type NextFunction, type RequestHandler } from "express";

import type { ProjectRecord, UserRecord } from "../persistence/repositories.js";

export interface AdminUsersReader {
  list(): Promise<UserRecord[]>;
  findById(userId: string): Promise<UserRecord | null>;
}

export interface AdminProjectsReader {
  list(): Promise<ProjectRecord[]>;
  findById(projectId: string): Promise<ProjectRecord | null>;
}

export interface AdminRouterDeps {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  users: AdminUsersReader;
  projects: AdminProjectsReader;
}

type PublicUserRecord = Omit<UserRecord, "passwordHash">;

function publicUser(user: UserRecord): PublicUserRecord {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function asyncRoute(handler: RequestHandler): RequestHandler {
  return (request, response, next: NextFunction) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function createAdminRouter(deps: AdminRouterDeps) {
  const router = express.Router();

  router.use(deps.requireAuth, deps.requireAdmin);

  router.get(
    "/summary",
    asyncRoute(async (_request, response) => {
      const [users, projects] = await Promise.all([
        deps.users.list(),
        deps.projects.list(),
      ]);

      response.json({
        success: true,
        summary: {
          users: users.length,
          projects: projects.length,
          runs: 0,
          failures: 0,
          audit: 0,
        },
      });
    }),
  );

  router.get(
    "/users",
    asyncRoute(async (_request, response) => {
      const users = await deps.users.list();
      response.json({ success: true, items: users.map(publicUser) });
    }),
  );

  router.get(
    "/users/:userId",
    asyncRoute(async (request, response) => {
      const user = await deps.users.findById(request.params.userId);
      if (!user) {
        response.status(404).json({ success: false, error: "User not found" });
        return;
      }

      response.json({ success: true, user: publicUser(user) });
    }),
  );

  router.get(
    "/projects",
    asyncRoute(async (_request, response) => {
      const projects = await deps.projects.list();
      response.json({ success: true, items: projects });
    }),
  );

  router.get(
    "/projects/:projectId",
    asyncRoute(async (request, response) => {
      const project = await deps.projects.findById(request.params.projectId);
      if (!project) {
        response.status(404).json({ success: false, error: "Project not found" });
        return;
      }

      response.json({ success: true, project });
    }),
  );

  router.get("/runs", (_request, response) => {
    response.json({ success: true, items: [] });
  });

  router.get("/failures", (_request, response) => {
    response.json({ success: true, items: [] });
  });

  router.get("/audit", (_request, response) => {
    response.json({ success: true, items: [] });
  });

  return router;
}
