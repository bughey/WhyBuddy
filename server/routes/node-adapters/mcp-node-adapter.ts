import type {
  McpToolExecutionRequest,
  McpToolExecutionResult,
} from "../../tool/api/mcp-tool-adapter.js";

export type McpNodeType = "mcp";

export interface McpNodeInput {
  serverId?: string;
  toolName?: string;
  arguments?: Record<string, unknown>;
  input?: string;
  context?: string[] | string;
  workflowId?: string;
  stage?: string;
  metadata?: Record<string, unknown>;
  agentId?: string;
  token?: string;
  timeoutMs?: number;
  requireApproval?: boolean;
  approverList?: string[];
}

export interface McpNodeExecutionRequest {
  nodeType: McpNodeType;
  input?: McpNodeInput;
}

export interface McpNodeExecutionResult {
  ok: boolean;
  nodeType: McpNodeType;
  output: McpToolExecutionResult;
}

export interface McpNodeAdapterDeps {
  executeMcp?: (
    request: McpToolExecutionRequest,
  ) => Promise<McpToolExecutionResult>;
}

function ensureText(value: string | undefined, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`MCP node input requires ${field}.`);
  }

  return value.trim();
}

function normalizeContext(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeApproverList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  return normalized.length > 0 ? normalized : undefined;
}

export function isMcpNodeType(value: unknown): value is McpNodeType {
  return value === "mcp";
}

export async function executeMcpNode(
  request: McpNodeExecutionRequest,
  deps: McpNodeAdapterDeps = {},
): Promise<McpNodeExecutionResult> {
  if (!isMcpNodeType(request.nodeType)) {
    throw new Error("Unsupported MCP node type.");
  }

  if (!deps.executeMcp) {
    throw new Error(
      "MCP node execution requires an MCP executor wiring.",
    );
  }

  const input = request.input ?? {};
  const result = await deps.executeMcp({
    serverId: ensureText(input.serverId, "serverId"),
    toolName: ensureText(input.toolName, "toolName"),
    input: ensureText(input.input, "input"),
    ...(input.arguments && typeof input.arguments === "object"
      ? { arguments: input.arguments }
      : {}),
    context: normalizeContext(input.context),
    ...(normalizeString(input.workflowId)
      ? { workflowId: normalizeString(input.workflowId) }
      : {}),
    ...(normalizeString(input.stage)
      ? { stage: normalizeString(input.stage) }
      : {}),
    ...(input.metadata && typeof input.metadata === "object"
      ? { metadata: input.metadata }
      : {}),
    ...(normalizeString(input.agentId)
      ? { agentId: normalizeString(input.agentId) }
      : {}),
    ...(normalizeString(input.token)
      ? { token: normalizeString(input.token) }
      : {}),
    ...(typeof input.timeoutMs === "number" ? { timeoutMs: input.timeoutMs } : {}),
    ...(typeof input.requireApproval === "boolean"
      ? { requireApproval: input.requireApproval }
      : {}),
    ...(normalizeApproverList(input.approverList)
      ? { approverList: normalizeApproverList(input.approverList) }
      : {}),
  });

  return {
    ok: result.ok,
    nodeType: "mcp",
    output: result,
  };
}
