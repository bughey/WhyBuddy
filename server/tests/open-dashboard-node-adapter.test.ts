import { describe, expect, it, vi } from "vitest";

import { executeOpenDashboardNode } from "../routes/node-adapters/open-dashboard-node-adapter.js";

function makeDeps(overrides?: {
  withPermissionEngine?: boolean;
  permission?: {
    allowed: boolean;
    reason?: string;
    suggestion?: string;
  };
  missingTarget?: boolean;
}) {
  return {
    resolveDashboard: vi.fn((input) =>
      overrides?.missingTarget
        ? null
        : {
            dashboardId: input.dashboardId ?? "dashboard-sales",
            route: input.route ?? "/dashboards/sales",
            title: input.title ?? "销售看板",
            description:
              input.description ?? "展示销售漏斗与关键指标的默认看板。",
          },
    ),
    ...(overrides?.withPermissionEngine
      ? {
          permissionEngine: {
            checkPermission: vi.fn(() => ({
              allowed: overrides?.permission?.allowed ?? true,
              reason: overrides?.permission?.reason,
              suggestion: overrides?.permission?.suggestion,
            })),
          },
        }
      : {}),
  };
}

describe("executeOpenDashboardNode", () => {
  it("returns a dashboard target with context passthrough", async () => {
    const deps = makeDeps();

    const result = await executeOpenDashboardNode(
      {
        nodeType: "open_dashboard",
        input: {
          dashboardId: "dashboard-sales",
          title: "销售看板",
          context: {
            region: "华东",
            dateRange: "last_30_days",
          },
        },
      },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(result.output.status).toBe("completed");
    expect(result.output.target).toEqual({
      kind: "dashboard",
      dashboardId: "dashboard-sales",
      route: "/dashboards/sales",
      title: "销售看板",
      description: "展示销售漏斗与关键指标的默认看板。",
      apiHref: "/api/open-dashboard/targets/dashboard-sales",
      uiHref: "/dashboards/sales?dashboardId=dashboard-sales",
      context: {
        region: "华东",
        dateRange: "last_30_days",
      },
    });
  });

  it("returns denied when permission engine blocks access", async () => {
    const deps = makeDeps({
      withPermissionEngine: true,
      permission: {
        allowed: false,
        reason: "No allow rule found for api:call",
        suggestion: "Request permission for dashboard access",
      },
    });

    const result = await executeOpenDashboardNode(
      {
        nodeType: "open_dashboard",
        input: {
          dashboardId: "dashboard-sales",
          agentId: "agent-1",
          token: "token-1",
        },
      },
      deps,
    );

    expect(result.ok).toBe(false);
    expect(result.output.status).toBe("denied");
    expect(result.output.error).toContain("No allow rule found");
    expect(result.output.governance.permission).toEqual({
      allowed: false,
      reason: "No allow rule found for api:call",
      suggestion: "Request permission for dashboard access",
    });
  });

  it("throws when permission engine is enabled but agent identity is missing", async () => {
    const deps = makeDeps({ withPermissionEngine: true });

    await expect(
      executeOpenDashboardNode(
        {
          nodeType: "open_dashboard",
          input: {
            dashboardId: "dashboard-sales",
          },
        },
        deps,
      ),
    ).rejects.toThrow(/requires agentId/i);
  });

  it("falls back to a default dashboard target when no custom resolver target is returned", async () => {
    const deps = makeDeps({ missingTarget: true });

    const result = await executeOpenDashboardNode(
      {
        nodeType: "open_dashboard",
        input: {
          dashboardId: "dashboard-missing",
        },
      },
      deps,
    );

    expect(result.ok).toBe(true);
    expect(result.output.status).toBe("completed");
    expect(result.output.target).toEqual(
      expect.objectContaining({
        dashboardId: "dashboard-missing",
        route: "/dashboards/dashboard-missing",
        title: "Dashboard dashboard-missing",
      }),
    );
  });
});
