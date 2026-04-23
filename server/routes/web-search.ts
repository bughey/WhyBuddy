import { Router } from "express";

import {
  executeWebSearchNode,
  isWebSearchNodeType,
  type WebSearchNodeAdapterDeps,
} from "./node-adapters/web-search-node-adapter.js";

export interface WebSearchRouterDeps extends WebSearchNodeAdapterDeps {}

function normalizeTopK(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(1, Math.min(10, Math.floor(value)));
}

function normalizeWebSearchRouteResult(
  result: Awaited<ReturnType<typeof executeWebSearchNode>>,
  requestedTopK: unknown,
) {
  return {
    ...result,
    output: {
      status: "completed" as const,
      ...result.output,
      metadata: {
        query: result.output.query,
        resultCount: result.output.results.length,
        ...(typeof normalizeTopK(requestedTopK) === "number"
          ? { topK: normalizeTopK(requestedTopK) }
          : {}),
        downstreamConsumers: ["web_qa", "static_webpage_read", "end"] as const,
      },
      handoff: {
        webQa: {
          question: result.output.query,
          citations: result.output.citations,
          summaries: result.output.summaries,
        },
        staticWebpageRead: {
          urls: result.output.results.map((item) => item.url),
        },
      },
    },
  };
}

export function createWebSearchRouter(deps: WebSearchRouterDeps = {}): Router {
  const router = Router();

  router.post("/nodes/execute", async (req, res) => {
    const nodeType = req.body?.nodeType;

    if (!isWebSearchNodeType(nodeType)) {
      return res.status(400).json({ error: "nodeType must be web_search" });
    }

    try {
      const result = await executeWebSearchNode(
        {
          nodeType,
          input: req.body?.input,
        },
        deps,
      );

      const normalizedResult = normalizeWebSearchRouteResult(
        result,
        req.body?.input?.options?.topK,
      );
      return res.status(200).json(normalizedResult);
    } catch (error: any) {
      const message = error?.message || "Web search node execution failed.";
      const status = /requires query/i.test(message) ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

const router = createWebSearchRouter();

export default router;
