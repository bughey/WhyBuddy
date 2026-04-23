import { Router } from "express";

import {
  executeOpenDashboardNode,
  isOpenDashboardNodeType,
  type OpenDashboardNodeAdapterDeps,
} from "./node-adapters/open-dashboard-node-adapter.js";

export interface OpenDashboardRouterDeps extends OpenDashboardNodeAdapterDeps {}

function mapStatusToHttpStatus(status: string | undefined): number {
  if (status === "denied") {
    return 403;
  }
  if (status === "not_found") {
    return 404;
  }
  return 200;
}

export function createOpenDashboardRouter(
  deps: OpenDashboardRouterDeps = {},
): Router {
  const router = Router();

  router.get("/targets/:dashboardId", (req, res) => {
    const dashboardId = req.params.dashboardId?.trim();
    if (!dashboardId) {
      return res.status(400).json({ error: "dashboardId is required" });
    }

    const target =
      deps.resolveDashboard?.({
        dashboardId,
        route:
          typeof req.query.route === "string" ? req.query.route : undefined,
        title:
          typeof req.query.title === "string" ? req.query.title : undefined,
        description:
          typeof req.query.description === "string"
            ? req.query.description
            : undefined,
      }) ?? {
        dashboardId,
        route: `/dashboards/${encodeURIComponent(dashboardId)}`,
        title: `Dashboard ${dashboardId}`,
        description: "Open dashboard target resolved from route lookup.",
      };

    return res.json({
      ok: true,
      target: {
        kind: "dashboard",
        dashboardId: target.dashboardId,
        route: target.route,
        title: target.title,
        description: target.description,
      },
    });
  });

  router.post("/nodes/execute", async (req, res) => {
    const nodeType = req.body?.nodeType;
    if (!isOpenDashboardNodeType(nodeType)) {
      return res
        .status(400)
        .json({ error: "nodeType must be open_dashboard" });
    }

    try {
      const result = await executeOpenDashboardNode(
        {
          nodeType,
          input: req.body?.input,
        },
        deps,
      );

      return res.status(mapStatusToHttpStatus(result.output.status)).json(result);
    } catch (error: any) {
      const message = error?.message || "Open dashboard node execution failed.";
      const status =
        /requires dashboardId or route/i.test(message) ||
        /requires agentId/i.test(message) ||
        /requires token/i.test(message)
          ? 400
          : 500;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

const router = createOpenDashboardRouter();

export default router;
