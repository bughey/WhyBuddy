import type { PermissionCheckResult } from "../../../shared/permission/contracts.js";

export type OpenDashboardNodeType = "open_dashboard";

export interface OpenDashboardNodeInput {
  dashboardId?: string;
  route?: string;
  title?: string;
  description?: string;
  context?: Record<string, unknown>;
  agentId?: string;
  token?: string;
}

export interface OpenDashboardNodeExecutionRequest {
  nodeType: OpenDashboardNodeType;
  input?: OpenDashboardNodeInput;
}

export interface OpenDashboardPermissionEngine {
  checkPermission(
    agentId: string,
    resourceType: "api",
    action: "call",
    resource: string,
    token: string,
  ): PermissionCheckResult;
}

export interface OpenDashboardNodeAdapterDeps {
  permissionEngine?: OpenDashboardPermissionEngine;
  resolveDashboard?: (
    input: OpenDashboardNodeInput,
  ) => OpenDashboardResolvedTarget | null;
}

export interface OpenDashboardResolvedTarget {
  dashboardId: string;
  route: string;
  title: string;
  description: string;
}

export interface OpenDashboardNodeExecutionResult {
  ok: boolean;
  nodeType: OpenDashboardNodeType;
  output: {
    status: "completed" | "denied" | "not_found";
    target?: {
      kind: "dashboard";
      dashboardId: string;
      route: string;
      title: string;
      description: string;
      apiHref: string;
      uiHref: string;
      context: Record<string, unknown>;
    };
    context: Record<string, unknown>;
    resource: string;
    error?: string;
    governance: {
      permission?: {
        allowed: boolean;
        reason?: string;
        suggestion?: string;
      };
    };
  };
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function ensureString(value: unknown, field: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`Open dashboard node input requires ${field}.`);
  }

  return normalized;
}

function normalizeContext(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function buildUiRoute(route: string, dashboardId: string): string {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const separator = normalizedRoute.includes("?") ? "&" : "?";
  return `${normalizedRoute}${separator}dashboardId=${encodeURIComponent(dashboardId)}`;
}

function buildApiHref(dashboardId: string): string {
  return `/api/open-dashboard/targets/${encodeURIComponent(dashboardId)}`;
}

function buildPermissionSummary(
  permission: PermissionCheckResult | undefined,
): OpenDashboardNodeExecutionResult["output"]["governance"]["permission"] | undefined {
  if (!permission) {
    return undefined;
  }

  return {
    allowed: permission.allowed,
    reason: permission.reason,
    suggestion: permission.suggestion,
  };
}

function buildCompletedResult(input: {
  target: OpenDashboardResolvedTarget;
  context: Record<string, unknown>;
  resource: string;
  permission?: PermissionCheckResult;
}): OpenDashboardNodeExecutionResult {
  return {
    ok: true,
    nodeType: "open_dashboard",
    output: {
      status: "completed",
      target: {
        kind: "dashboard",
        dashboardId: input.target.dashboardId,
        route: input.target.route,
        title: input.target.title,
        description: input.target.description,
        apiHref: buildApiHref(input.target.dashboardId),
        uiHref: buildUiRoute(input.target.route, input.target.dashboardId),
        context: input.context,
      },
      context: input.context,
      resource: input.resource,
      governance: {
        permission: buildPermissionSummary(input.permission),
      },
    },
  };
}

function buildDeniedResult(
  resource: string,
  context: Record<string, unknown>,
  permission: PermissionCheckResult,
): OpenDashboardNodeExecutionResult {
  return {
    ok: false,
    nodeType: "open_dashboard",
    output: {
      status: "denied",
      context,
      resource,
      error: permission.reason ?? "Permission denied",
      governance: {
        permission: buildPermissionSummary(permission),
      },
    },
  };
}

function buildNotFoundResult(
  resource: string,
  context: Record<string, unknown>,
  error: string,
  permission?: PermissionCheckResult,
): OpenDashboardNodeExecutionResult {
  return {
    ok: false,
    nodeType: "open_dashboard",
    output: {
      status: "not_found",
      context,
      resource,
      error,
      governance: {
        permission: buildPermissionSummary(permission),
      },
    },
  };
}

function resolveDefaultDashboard(
  input: OpenDashboardNodeInput,
): OpenDashboardResolvedTarget | null {
  const dashboardId = normalizeString(input.dashboardId);
  const route = normalizeString(input.route);

  if (!dashboardId && !route) {
    return null;
  }

  const resolvedDashboardId = dashboardId ?? route!.replace(/^\//, "").replace(/[/?#].*$/, "");
  const resolvedRoute = route ?? `/dashboards/${encodeURIComponent(resolvedDashboardId)}`;

  return {
    dashboardId: resolvedDashboardId,
    route: resolvedRoute,
    title: normalizeString(input.title) ?? `Dashboard ${resolvedDashboardId}`,
    description:
      normalizeString(input.description) ??
      "Open dashboard target resolved from node input.",
  };
}

function checkApiPermission(
  input: OpenDashboardNodeInput,
  resource: string,
  deps: OpenDashboardNodeAdapterDeps,
): PermissionCheckResult | undefined {
  if (!deps.permissionEngine) {
    return undefined;
  }

  const agentId = ensureString(input.agentId, "agentId");
  const token = ensureString(input.token, "token");
  return deps.permissionEngine.checkPermission(
    agentId,
    "api",
    "call",
    resource,
    token,
  );
}

export function isOpenDashboardNodeType(
  value: unknown,
): value is OpenDashboardNodeType {
  return value === "open_dashboard";
}

export async function executeOpenDashboardNode(
  request: OpenDashboardNodeExecutionRequest,
  deps: OpenDashboardNodeAdapterDeps = {},
): Promise<OpenDashboardNodeExecutionResult> {
  if (!isOpenDashboardNodeType(request.nodeType)) {
    throw new Error("Unsupported open_dashboard node type.");
  }

  const input = request.input ?? {};
  const context = normalizeContext(input.context);
  const resolvedTarget =
    deps.resolveDashboard?.(input) ?? resolveDefaultDashboard(input);

  if (!resolvedTarget) {
    throw new Error(
      "Open dashboard node input requires dashboardId or route.",
    );
  }

  const resource = `GET ${buildApiHref(resolvedTarget.dashboardId)}`;
  const permission = checkApiPermission(input, resource, deps);
  if (permission && !permission.allowed) {
    return buildDeniedResult(resource, context, permission);
  }

  if (!resolvedTarget.dashboardId || !resolvedTarget.route) {
    return buildNotFoundResult(
      resource,
      context,
      "Dashboard target not found.",
      permission,
    );
  }

  return buildCompletedResult({
    target: resolvedTarget,
    context,
    resource,
    permission,
  });
}
