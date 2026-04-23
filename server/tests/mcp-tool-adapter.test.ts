import { describe, expect, it, vi } from "vitest";

import { McpToolAdapter } from "../tool/api/mcp-tool-adapter.js";

function makeAuditLogger() {
  return {
    entries: [] as Array<Record<string, unknown>>,
    log(entry: Record<string, unknown>) {
      this.entries.push(entry);
    },
  };
}

function makeDeps(overrides?: {
  invokeImpl?: (request: any) => Promise<unknown>;
  permissionResult?: {
    allowed: boolean;
    reason?: string;
    suggestion?: string;
    governance?: {
      outcome: "allowed" | "blocked" | "approval_required";
      riskLevel: "low" | "medium" | "high" | "critical";
      policyId: string;
      rationale: string;
      requiresAudit: boolean;
      specRefs?: string[];
    };
  };
}) {
  const auditLogger = makeAuditLogger();
  const invoker = {
    invoke: vi.fn(
      overrides?.invokeImpl ??
        (async ({ serverId, toolName, arguments: args }) => ({
          ok: true,
          serverId,
          toolName,
          args,
        })),
    ),
  };
  const permissionEngine = {
    checkPermission: vi.fn(
      () =>
        overrides?.permissionResult ?? {
          allowed: true,
        },
    ),
  };
  const escalationManager = {
    escalatePermission: vi.fn(() => "esc-1"),
  };

  return {
    invoker,
    permissionEngine,
    escalationManager,
    auditLogger,
  };
}

describe("McpToolAdapter", () => {
  it("executes an MCP tool call when permission passes", async () => {
    const deps = makeDeps();
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      escalationManager: deps.escalationManager,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      arguments: {
        sessionId: "sess-1",
        limit: 5,
      },
      input: "读取最近记忆",
      context: ["优先返回最近 5 条"],
      workflowId: "wf-1",
      stage: "node_mcp",
      agentId: "agent-mcp",
      token: "token-1",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.resource).toContain("mcp://workspace.memory/recent_memory");
    expect(deps.permissionEngine.checkPermission).toHaveBeenCalledWith(
      "agent-mcp",
      "mcp_tool",
      "call",
      expect.stringContaining("mcp://workspace.memory/recent_memory"),
      "token-1",
    );
    expect(deps.invoker.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        serverId: "workspace.memory",
        toolName: "recent_memory",
        arguments: {
          sessionId: "sess-1",
          limit: 5,
        },
      }),
    );
    expect(deps.auditLogger.entries).toHaveLength(1);
    expect(deps.auditLogger.entries[0]).toMatchObject({
      agentId: "agent-mcp",
      operation: "mcp_tool",
      resourceType: "mcp_tool",
      action: "call",
      result: "allowed",
      metadata: expect.objectContaining({
        serverId: "workspace.memory",
        toolName: "recent_memory",
        workflowId: "wf-1",
        stage: "node_mcp",
      }),
    });
  });

  it("returns denied when permission engine blocks the MCP call", async () => {
    const deps = makeDeps({
      permissionResult: {
        allowed: false,
        reason: "No allow rule found for mcp_tool:call",
      },
    });
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      input: "读取最近记忆",
      agentId: "agent-mcp",
      token: "token-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("denied");
    expect(result.error).toContain("No allow rule found");
    expect(deps.invoker.invoke).not.toHaveBeenCalled();
    expect(deps.auditLogger.entries).toHaveLength(1);
    expect(deps.auditLogger.entries[0]).toMatchObject({
      result: "denied",
      reason: "No allow rule found for mcp_tool:call",
    });
  });

  it("returns approval_required when governance marks MCP calls as high risk", async () => {
    const deps = makeDeps({
      permissionResult: {
        allowed: false,
        reason: "MCP tool calls require manual approval and audit evidence before execution.",
        governance: {
          outcome: "approval_required",
          riskLevel: "critical",
          policyId: "security-governance.mcp-approval-gate",
          rationale:
            "MCP tool calls require manual approval and audit evidence before execution.",
          requiresAudit: true,
        },
      },
    });
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      escalationManager: deps.escalationManager,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      input: "读取最近记忆",
      agentId: "agent-mcp",
      token: "token-1",
      approverList: ["admin-1"],
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("approval_required");
    expect(result.escalationId).toBe("esc-1");
    expect(result.governance.approval.source).toBe("governance_policy");
    expect(deps.escalationManager.escalatePermission).toHaveBeenCalledWith(
      "agent-mcp",
      "MCP tool calls require manual approval and audit evidence before execution.",
      ["admin-1"],
    );
  });

  it("still returns approval_required when governance blocks execution even if permission.allowed is true", async () => {
    const deps = makeDeps({
      permissionResult: {
        allowed: true,
        reason: "Governance requires approval before this MCP call can proceed.",
        governance: {
          outcome: "approval_required",
          riskLevel: "high",
          policyId: "security-governance.mcp-approval-gate",
          rationale: "Governance requires approval before this MCP call can proceed.",
          requiresAudit: true,
        },
      },
    });
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      escalationManager: deps.escalationManager,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      input: "读取最近记忆",
      agentId: "agent-mcp",
      token: "token-1",
      approverList: ["admin-1"],
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("approval_required");
    expect(result.governance.permission).toMatchObject({
      allowed: true,
      reason: "Governance requires approval before this MCP call can proceed.",
    });
    expect(result.governance.approval.source).toBe("governance_policy");
    expect(deps.invoker.invoke).not.toHaveBeenCalled();
    expect(deps.auditLogger.entries[0]).toMatchObject({
      result: "denied",
      reason: "Governance requires approval before this MCP call can proceed.",
      metadata: expect.objectContaining({
        governanceHook: "permission-engine",
        approvalRequired: true,
      }),
    });
  });

  it("returns denied when governance outcome is blocked even if permission.allowed is true", async () => {
    const deps = makeDeps({
      permissionResult: {
        allowed: true,
        reason: "MCP registry access is blocked by governance policy.",
        governance: {
          outcome: "blocked",
          riskLevel: "critical",
          policyId: "security-governance.mcp-blocked",
          rationale: "MCP registry access is blocked by governance policy.",
          requiresAudit: true,
        },
      },
    });
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "internal.registry",
      toolName: "mcp_manifest",
      input: "读取 MCP 清单",
      agentId: "agent-mcp",
      token: "token-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("denied");
    expect(result.error).toBe("MCP registry access is blocked by governance policy.");
    expect(result.governance.permission).toMatchObject({
      allowed: true,
    });
    expect(deps.invoker.invoke).not.toHaveBeenCalled();
    expect(deps.auditLogger.entries[0]).toMatchObject({
      result: "denied",
      reason: "MCP registry access is blocked by governance policy.",
      metadata: expect.objectContaining({
        governanceHook: "permission-engine",
      }),
    });
  });

  it("returns approval_required when manual gate is requested", async () => {
    const deps = makeDeps();
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      escalationManager: deps.escalationManager,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      input: "读取最近记忆",
      agentId: "agent-mcp",
      token: "token-1",
      requireApproval: true,
      approverList: ["admin-1", "admin-2"],
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("approval_required");
    expect(result.escalationId).toBe("esc-1");
    expect(result.governance.approval.source).toBe("manual_gate");
    expect(deps.invoker.invoke).not.toHaveBeenCalled();
  });

  it("keeps mainline workflow metadata in approval-required governance and audit output", async () => {
    const deps = makeDeps();
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      escalationManager: deps.escalationManager,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      arguments: {
        sessionId: "sess-mainline",
        limit: 10,
      },
      input: "请读取最近会话记忆并等待人工确认",
      context: ["来自 workflow runtime 主线", "需要审批后再继续"],
      workflowId: "wf-mainline-1",
      stage: "node_mcp",
      metadata: {
        missionId: "mission-mainline-1",
        sessionId: "session-mainline-1",
        replayId: "replay-mainline-1",
      },
      agentId: "agent-mainline",
      token: "token-mainline",
      timeoutMs: 20000,
      requireApproval: true,
      approverList: ["admin-1", "admin-2"],
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("approval_required");
    expect(result.escalationId).toBe("esc-1");
    expect(result.governance.approval).toMatchObject({
      required: true,
      status: "pending",
      source: "manual_gate",
      escalationId: "esc-1",
    });
    expect(result.metadata).toMatchObject({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      workflowId: "wf-mainline-1",
      stage: "node_mcp",
      timeoutMs: 20000,
      fallbackUsed: false,
    });
    expect(deps.invoker.invoke).not.toHaveBeenCalled();
    expect(deps.auditLogger.entries).toHaveLength(1);
    expect(deps.auditLogger.entries[0]).toMatchObject({
      agentId: "agent-mainline",
      operation: "mcp_tool",
      resourceType: "mcp_tool",
      action: "call",
      result: "denied",
      reason: "MCP tool call requires manual approval",
      metadata: expect.objectContaining({
        serverId: "workspace.memory",
        toolName: "recent_memory",
        workflowId: "wf-mainline-1",
        stage: "node_mcp",
        requireApproval: true,
        approverCount: 2,
        approvalSource: "none",
        escalationId: "esc-1",
        governanceHook: "manual-gate",
      }),
    });
  });

  it("returns failed when the MCP call times out", async () => {
    const deps = makeDeps({
      invokeImpl: async () =>
        await new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 30);
        }),
    });
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      auditLogger: deps.auditLogger as any,
      defaultTimeoutMs: 5,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      input: "读取最近记忆",
      agentId: "agent-mcp",
      token: "token-1",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("timed out");
    expect(deps.auditLogger.entries).toHaveLength(1);
    expect(deps.auditLogger.entries[0]).toMatchObject({
      result: "error",
      reason: expect.stringContaining("timed out"),
    });
  });

  it("uses fallback metadata for recoverable MCP failures", async () => {
    const deps = makeDeps({
      invokeImpl: async () => {
        throw new Error("MCP server unavailable");
      },
    });
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
      auditLogger: deps.auditLogger as any,
    });

    const result = await adapter.execute({
      serverId: "workspace.memory",
      toolName: "recent_memory",
      input: "读取最近记忆",
      agentId: "agent-mcp",
      token: "token-1",
      metadata: {
        fallback: {
          mode: "static_response",
          targetLabel: "MCP 静态回退",
          operation: "mcp_tool.fallback",
          recoverableErrors: ["server unavailable"],
          response: {
            ok: false,
            data: [],
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.metadata.fallbackUsed).toBe(true);
    expect(result.targetLabel).toBe("MCP 静态回退");
    expect(result.operation).toBe("mcp_tool.fallback");
    expect(result.output).toContain('"fallbackUsed": true');
    expect(deps.auditLogger.entries).toHaveLength(1);
    expect(deps.auditLogger.entries[0]).toMatchObject({
      result: "allowed",
      metadata: expect.objectContaining({
        fallbackUsed: true,
        fallbackStrategy: "static_response",
      }),
    });
  });

  it("requires agentId and token when permission engine is enabled", async () => {
    const deps = makeDeps();
    const adapter = new McpToolAdapter({
      invoker: deps.invoker,
      permissionEngine: deps.permissionEngine as any,
    });

    await expect(
      adapter.execute({
        serverId: "workspace.memory",
        toolName: "recent_memory",
        input: "读取最近记忆",
      }),
    ).rejects.toThrow("agentId");
  });
});
