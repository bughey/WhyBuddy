import { Router } from "express";

import {
  executeMcpNode,
  isMcpNodeType,
  type McpNodeAdapterDeps,
} from "./node-adapters/mcp-node-adapter.js";

export interface McpRouterDeps extends McpNodeAdapterDeps {}

function mapMcpNodeStatusToHttpStatus(
  status: string | undefined,
): number {
  if (status === "denied") {
    return 403;
  }
  if (status === "approval_required") {
    return 409;
  }
  if (status === "failed") {
    return 500;
  }
  return 200;
}

export function createMcpRouter(deps: McpRouterDeps = {}): Router {
  const router = Router();

  router.post("/nodes/execute", async (req, res) => {
    const nodeType = req.body?.nodeType;

    if (!isMcpNodeType(nodeType)) {
      return res.status(400).json({ error: "nodeType must be mcp" });
    }

    try {
      const result = await executeMcpNode(
        {
          nodeType,
          input: req.body?.input,
        },
        deps,
      );

      return res
        .status(mapMcpNodeStatusToHttpStatus(result.output.status))
        .json(result);
    } catch (error: any) {
      const message = error?.message || "MCP node execution failed.";
      const status =
        /requires serverId/i.test(message) ||
        /requires toolName/i.test(message) ||
        /requires input/i.test(message)
          ? 400
          : 500;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

const router = createMcpRouter();

export default router;
