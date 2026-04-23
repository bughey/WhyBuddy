import { describe, expect, it } from "vitest";

import { McpChecker } from "../permission/checkers/mcp-checker.js";
import { PermissionCheckEngine } from "../permission/check-engine.js";

describe("PermissionCheckEngine MCP checker wiring", () => {
  it("applies endpoint constraints to mcp_tool resources", () => {
    const tokenService = {
      verifyToken() {
        return {
          agentId: "agent-mcp",
          permissionMatrix: [
            {
              resourceType: "mcp_tool" as const,
              actions: ["call" as const],
              effect: "allow" as const,
              constraints: {
                endpoints: ["internal.memory/recent_memory"],
              },
            },
          ],
        };
      },
    };

    const engine = new PermissionCheckEngine(
      tokenService as any,
      undefined,
      new Map([
        ["mcp_tool", new McpChecker()],
      ]),
    );

    const allowed = engine.checkPermission(
      "agent-mcp",
      "mcp_tool",
      "call",
      "mcp://internal.memory/recent_memory?limit=3",
      "token-1",
    );
    const denied = engine.checkPermission(
      "agent-mcp",
      "mcp_tool",
      "call",
      "mcp://internal.memory/search_memory?query=test",
      "token-1",
    );

    expect(allowed.allowed).toBe(false);
    expect(allowed.reason).toContain("manual approval");
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain("Constraint check failed");
  });

  it("keeps governance approval semantics even when endpoint constraints match", () => {
    const tokenService = {
      verifyToken() {
        return {
          agentId: "agent-mcp",
          permissionMatrix: [
            {
              resourceType: "mcp_tool" as const,
              actions: ["call" as const],
              effect: "allow" as const,
              constraints: {
                endpoints: ["internal.reports/download_report"],
              },
            },
          ],
        };
      },
    };

    const engine = new PermissionCheckEngine(
      tokenService as any,
      undefined,
      new Map([
        ["mcp_tool", new McpChecker()],
      ]),
    );

    const result = engine.checkPermission(
      "agent-mcp",
      "mcp_tool",
      "call",
      "mcp://internal.reports/download_report?scope=final&format=json",
      "token-1",
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("manual approval");
    expect(result.governance).toMatchObject({
      outcome: "approval_required",
      policyId: expect.any(String),
    });
  });
});
