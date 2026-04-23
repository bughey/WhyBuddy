import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";

import { createOpenDashboardRouter } from "../routes/open-dashboard.js";

async function withServer(
  deps: Parameters<typeof createOpenDashboardRouter>[0],
  handler: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use("/api/open-dashboard", createOpenDashboardRouter(deps));

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function makeDeps(overrides?: {
  deny?: boolean;
  withPermissionEngine?: boolean;
}) {
  return {
    resolveDashboard: vi.fn((input) => ({
      dashboardId: input.dashboardId ?? "dashboard-sales",
      route: input.route ?? "/dashboards/sales",
      title: input.title ?? "销售看板",
      description: input.description ?? "展示销售数据的默认看板。",
    })),
    ...(overrides?.withPermissionEngine
      ? {
          permissionEngine: {
            checkPermission: vi.fn(() => ({
              allowed: !overrides?.deny,
              reason: overrides?.deny ? "Permission denied" : undefined,
            })),
          },
        }
      : {}),
  };
}

describe("open dashboard routes", () => {
  it("returns 400 when nodeType is invalid", async () => {
    await withServer(makeDeps(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/open-dashboard/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "open_report",
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("nodeType");
    });
  });

  it("returns completed dashboard target with context", async () => {
    await withServer(makeDeps(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/open-dashboard/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "open_dashboard",
          input: {
            dashboardId: "dashboard-sales",
            context: {
              region: "华东",
            },
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.output.target.dashboardId).toBe("dashboard-sales");
      expect(body.output.target.context).toEqual({
        region: "华东",
      });
    });
  });

  it("maps denied access to 403", async () => {
    await withServer(
      makeDeps({ deny: true, withPermissionEngine: true }),
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/open-dashboard/nodes/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nodeType: "open_dashboard",
            input: {
              dashboardId: "dashboard-sales",
              agentId: "agent-1",
              token: "token-1",
            },
          }),
        });

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body.output.status).toBe("denied");
      },
    );
  });

  it("returns dashboard target description from route lookup", async () => {
    await withServer(makeDeps(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/open-dashboard/targets/dashboard-sales`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.target).toEqual({
        kind: "dashboard",
        dashboardId: "dashboard-sales",
        route: "/dashboards/sales",
        title: "销售看板",
        description: "展示销售数据的默认看板。",
      });
    });
  });
});
