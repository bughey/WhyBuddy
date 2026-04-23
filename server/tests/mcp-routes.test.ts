import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";

import { createMcpRouter } from "../routes/mcp.js";

async function withServer(
  handler: (baseUrl: string, executeMock: ReturnType<typeof vi.fn>) => Promise<void>,
): Promise<void> {
  const executeMock = vi.fn();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/mcp",
    createMcpRouter({
      executeMcp: executeMock,
    }),
  );

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await handler(baseUrl, executeMock);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("POST /api/mcp/nodes/execute", () => {
  it("returns 400 when nodeType is invalid", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "llm",
          input: {},
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("nodeType");
    });
  });

  it("returns 400 when required MCP input is missing", async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
            serverId: "workspace.memory",
          },
        }),
      });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("toolName");
    });
  });

  it("dispatches MCP node execution and returns completed output", async () => {
    await withServer(async (baseUrl, executeMock) => {
      executeMock.mockResolvedValue({
        ok: true,
        status: "completed",
        targetLabel: "workspace.memory/recent_memory",
        operation: "mcp_tool",
        resource: "mcp://workspace.memory/recent_memory?sessionId=sess-1",
        output: '{"ok":true}',
        response: { ok: true },
        governance: {
          approval: {
            required: false,
            status: "not_required",
            source: "none",
          },
        },
        metadata: {
          serverId: "workspace.memory",
          toolName: "recent_memory",
          timeoutMs: 15000,
          fallbackUsed: false,
        },
      });

      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
            serverId: "workspace.memory",
            toolName: "recent_memory",
            arguments: {
              sessionId: "sess-1",
            },
            input: "读取最近记忆",
            context: ["优先返回最近 5 条"],
            workflowId: "wf-1",
            stage: "node_mcp",
            agentId: "agent-mcp",
            token: "token-1",
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
      expect(body.nodeType).toBe("mcp");
      expect(body.output.status).toBe("completed");
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: "workspace.memory",
          toolName: "recent_memory",
          input: "读取最近记忆",
          workflowId: "wf-1",
          stage: "node_mcp",
          agentId: "agent-mcp",
          token: "token-1",
        }),
      );
    });
  });

  it("maps approval_required to 409", async () => {
    await withServer(async (baseUrl, executeMock) => {
      executeMock.mockResolvedValue({
        ok: false,
        status: "approval_required",
        targetLabel: "workspace.memory/recent_memory",
        operation: "mcp_tool",
        resource: "mcp://workspace.memory/recent_memory",
        output: "approval required",
        response: null,
        governance: {
          approval: {
            required: true,
            status: "pending",
            source: "manual_gate",
          },
        },
        metadata: {
          serverId: "workspace.memory",
          toolName: "recent_memory",
          timeoutMs: 15000,
          fallbackUsed: false,
        },
      });

      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
            serverId: "workspace.memory",
            toolName: "recent_memory",
            input: "读取最近记忆",
          },
        }),
      });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.output.status).toBe("approval_required");
    });
  });

  it("forwards mainline approval-gate payload used by workflow/operator entry", async () => {
    await withServer(async (baseUrl, executeMock) => {
      executeMock.mockResolvedValue({
        ok: false,
        status: "approval_required",
        targetLabel: "workspace.memory/recent_memory",
        operation: "mcp_tool",
        resource: "mcp://workspace.memory/recent_memory?sessionId=sess-mainline",
        output: "manual approval required",
        response: null,
        escalationId: "esc-mainline-1",
        governance: {
          permission: {
            allowed: true,
          },
          approval: {
            required: true,
            status: "pending",
            source: "manual_gate",
            escalationId: "esc-mainline-1",
          },
        },
        metadata: {
          serverId: "workspace.memory",
          toolName: "recent_memory",
          workflowId: "wf-mainline-1",
          stage: "node_mcp",
          timeoutMs: 20000,
          fallbackUsed: false,
        },
      });

      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
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
          },
        }),
      });

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.output.status).toBe("approval_required");
      expect(body.output.escalationId).toBe("esc-mainline-1");
      expect(body.output.metadata).toMatchObject({
        workflowId: "wf-mainline-1",
        stage: "node_mcp",
        timeoutMs: 20000,
      });
      expect(executeMock).toHaveBeenCalledWith(
        expect.objectContaining({
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
        }),
      );
    });
  });

  it("maps denied to 403", async () => {
    await withServer(async (baseUrl, executeMock) => {
      executeMock.mockResolvedValue({
        ok: false,
        status: "denied",
        targetLabel: "workspace.memory/recent_memory",
        operation: "mcp_tool",
        resource: "mcp://workspace.memory/recent_memory",
        output: "permission denied",
        response: null,
        error: "permission denied",
        governance: {
          approval: {
            required: false,
            status: "not_required",
            source: "none",
          },
        },
        metadata: {
          serverId: "workspace.memory",
          toolName: "recent_memory",
          timeoutMs: 15000,
          fallbackUsed: false,
        },
      });

      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
            serverId: "workspace.memory",
            toolName: "recent_memory",
            input: "read recent memory",
          },
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.output.status).toBe("denied");
      expect(body.output.error).toBe("permission denied");
    });
  });

  it("preserves governance payload when route returns denied from a blocked mainline decision", async () => {
    await withServer(async (baseUrl, executeMock) => {
      executeMock.mockResolvedValue({
        ok: false,
        status: "denied",
        targetLabel: "internal.registry/mcp_manifest",
        operation: "mcp_tool",
        resource: "mcp://internal.registry/mcp_manifest",
        output: "blocked by governance",
        response: null,
        error: "blocked by governance",
        governance: {
          permission: {
            allowed: true,
            reason: "blocked by governance",
          },
          decision: {
            outcome: "blocked",
            riskLevel: "critical",
            policyId: "security-governance.mcp-blocked",
            rationale: "blocked by governance",
            requiresAudit: true,
          },
          approval: {
            required: false,
            status: "not_required",
            source: "none",
          },
        },
        metadata: {
          serverId: "internal.registry",
          toolName: "mcp_manifest",
          workflowId: "wf-governance-1",
          stage: "node_mcp",
          timeoutMs: 15000,
          fallbackUsed: false,
        },
      });

      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
            serverId: "internal.registry",
            toolName: "mcp_manifest",
            input: "读取 MCP 清单",
            workflowId: "wf-governance-1",
            stage: "node_mcp",
          },
        }),
      });

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.output.status).toBe("denied");
      expect(body.output.governance).toMatchObject({
        permission: {
          allowed: true,
          reason: "blocked by governance",
        },
        decision: {
          outcome: "blocked",
          policyId: "security-governance.mcp-blocked",
        },
        approval: {
          required: false,
          status: "not_required",
        },
      });
      expect(body.output.metadata).toMatchObject({
        workflowId: "wf-governance-1",
        stage: "node_mcp",
      });
    });
  });

  it("maps failed to 500", async () => {
    await withServer(async (baseUrl, executeMock) => {
      executeMock.mockResolvedValue({
        ok: false,
        status: "failed",
        targetLabel: "workspace.memory/recent_memory",
        operation: "mcp_tool",
        resource: "mcp://workspace.memory/recent_memory",
        output: "upstream timeout",
        response: null,
        error: "upstream timeout",
        governance: {
          approval: {
            required: false,
            status: "not_required",
            source: "none",
          },
        },
        metadata: {
          serverId: "workspace.memory",
          toolName: "recent_memory",
          timeoutMs: 15000,
          fallbackUsed: false,
        },
      });

      const response = await fetch(`${baseUrl}/api/mcp/nodes/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeType: "mcp",
          input: {
            serverId: "workspace.memory",
            toolName: "recent_memory",
            input: "read recent memory",
          },
        }),
      });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.output.status).toBe("failed");
      expect(body.output.error).toBe("upstream timeout");
    });
  });
});
